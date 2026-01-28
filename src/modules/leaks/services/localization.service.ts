import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { SensitivityMatrixService } from '../../network/services/sensitivity-matrix.service';
import { NetworkService } from '../../network/network.service';
import { LeakDetection } from '@prisma/client';

export interface LocalizationResult {
  detectionId: string;
  originalNodeId: string;
  localizedNodeId: string;
  localizationScore: number;
  candidateNodes: Array<{
    nodeId: string;
    score: number;
  }>;
  sensorChanges: Array<{
    sensorId: string;
    observedChange: number;
    predictedChange: number;
  }>;
}

@Injectable()
export class LocalizationService {
  private readonly DEFAULT_BASELINE_TIME_WINDOW = 3600; // 1 hour in seconds
  private readonly DEFAULT_DETECTION_TIME_WINDOW = 300; // 5 minutes in seconds

  constructor(
    private readonly prisma: PrismaService,
    private readonly sensitivityMatrixService: SensitivityMatrixService,
    private readonly networkService: NetworkService,
  ) {}

  async localizeLeakForDetection(
    detection: LeakDetection,
    baselineTimeWindow?: number,
  ): Promise<LocalizationResult> {
    const networkId = detection.networkId;

    // Check if sensitivity matrix exists for this network
    const matrixExists = await this.sensitivityMatrixService.checkMatrixExists(networkId);
    if (!matrixExists) {
      throw new BadRequestException(
        `Sensitivity matrix not found for network ${networkId}. Please generate the matrix first.`,
      );
    }

    // Use detection's timeWindow for the anomaly window, or default
    const detectionTimeWindow =
      detection.timeWindow ?? this.DEFAULT_DETECTION_TIME_WINDOW;

    // Baseline time window (how far back before the anomaly window to look for "normal" values)
    const baselineWindow =
      baselineTimeWindow ?? this.DEFAULT_BASELINE_TIME_WINDOW;

    // Calculate baseline readings:
    // Baseline interval: [T - detectionTimeWindow - baselineWindow, T - detectionTimeWindow]
    // This is the "normal" period before the anomaly
    const baselineReadings = await this.calculateBaselineReadingsWithWindow(
      detection.timestamp,
      detectionTimeWindow,
      baselineWindow,
      networkId,
    );

    // Get observed changes:
    // Anomaly interval: [T - detectionTimeWindow, T]
    // Compare to baseline to get changes
    const observedChanges = await this.getObservedChangesWithWindow(
      detection.timestamp,
      detectionTimeWindow,
      baselineReadings,
      networkId,
    );

    if (observedChanges.size === 0) {
      throw new BadRequestException(
        'No sensor readings available for localization',
      );
    }

    // Get all potential leak nodes from sensitivity matrix (filtered by networkId)
    let potentialNodes = await this.prisma.sensitivityMatrix.findMany({
      where: { networkId },
      select: {
        leakNodeId: true,
      },
      distinct: ['leakNodeId'],
    });

    if (potentialNodes.length === 0) {
      throw new BadRequestException(
        'No potential leak nodes found in sensitivity matrix',
      );
    }

    // Filter candidates by DMA when partitionId is set
    if (detection.partitionId) {
      const dmaNodeIds = await this.networkService.getNodeIdsInDma(
        detection.partitionId,
      );
      potentialNodes = potentialNodes.filter(({ leakNodeId }) =>
        dmaNodeIds.has(leakNodeId),
      );

      if (potentialNodes.length === 0) {
        throw new BadRequestException(
          `No potential leak nodes found in DMA ${detection.partitionId}`,
        );
      }
    }

    // Calculate scores for each potential node
    const candidateScores: Array<{ nodeId: string; score: number }> = [];

    for (const { leakNodeId } of potentialNodes) {
      const score = await this.calculateLocalizationScore(
        leakNodeId,
        observedChanges,
        detection.flowImbalance,
        networkId,
      );
      candidateScores.push({ nodeId: leakNodeId, score });
    }

    // Sort by score (descending)
    candidateScores.sort((a, b) => b.score - a.score);

    // Get top candidate
    const topCandidate = candidateScores[0];
    if (!topCandidate || topCandidate.score <= 0) {
      throw new BadRequestException(
        'Could not determine leak location. All scores are zero or negative.',
      );
    }

    // Get predicted changes for top candidate
    const predictedChanges = await this.getPredictedChanges(
      topCandidate.nodeId,
      detection.flowImbalance,
      networkId,
    );

    // Build sensor changes array
    const sensorChanges: Array<{
      sensorId: string;
      observedChange: number;
      predictedChange: number;
    }> = [];

    for (const [sensorId, observedChange] of observedChanges.entries()) {
      const predictedChange = predictedChanges.get(sensorId) || 0;
      sensorChanges.push({
        sensorId,
        observedChange,
        predictedChange,
      });
    }

    return {
      detectionId: detection.id,
      originalNodeId: detection.nodeId,
      localizedNodeId: topCandidate.nodeId,
      localizationScore: topCandidate.score,
      candidateNodes: candidateScores.slice(0, 10), // Top 10 candidates
      sensorChanges,
    };
  }

  /**
   * Calculate baseline readings with proper windowing.
   * Baseline interval: [T - detectionTimeWindow - baselineWindow, T - detectionTimeWindow]
   * This is the "normal" period before the anomaly window.
   */
  async calculateBaselineReadingsWithWindow(
    timestamp: Date,
    detectionTimeWindow: number,
    baselineWindow: number,
    networkId: string,
  ): Promise<Map<string, number>> {
    // Baseline ends where anomaly starts
    const baselineEnd = new Date(
      timestamp.getTime() - detectionTimeWindow * 1000,
    );
    // Baseline starts baselineWindow before that
    const baselineStart = new Date(
      baselineEnd.getTime() - baselineWindow * 1000,
    );

    // Get all active sensors for this network
    const sensors = await this.prisma.sensor.findMany({
      where: {
        networkId,
        isActive: true,
      },
      select: { id: true, sensorId: true },
    });

    const baselineMap = new Map<string, number>();

    // For each sensor, calculate average reading in the baseline window
    for (const sensor of sensors) {
      const readings = await this.prisma.sensorReading.findMany({
        where: {
          sensorId: sensor.id,
          timestamp: {
            gte: baselineStart,
            lt: baselineEnd,
          },
        },
        select: {
          flowValue: true,
        },
      });

      if (readings.length > 0) {
        const sum = readings.reduce((acc, r) => acc + r.flowValue, 0);
        const average = sum / readings.length;
        baselineMap.set(sensor.sensorId, average);
      }
    }

    return baselineMap;
  }

  /**
   * Get observed changes with proper windowing.
   * Anomaly interval: [T - detectionTimeWindow, T]
   * Returns the difference between anomaly average and baseline average.
   */
  async getObservedChangesWithWindow(
    timestamp: Date,
    detectionTimeWindow: number,
    baselineReadings: Map<string, number>,
    networkId: string,
  ): Promise<Map<string, number>> {
    const changes = new Map<string, number>();

    // Anomaly window: [T - detectionTimeWindow, T]
    const anomalyStart = new Date(
      timestamp.getTime() - detectionTimeWindow * 1000,
    );
    const anomalyEnd = timestamp;

    // Get all active sensors for this network
    const sensors = await this.prisma.sensor.findMany({
      where: {
        networkId,
        isActive: true,
      },
      select: { id: true, sensorId: true },
    });

    for (const sensor of sensors) {
      const baseline = baselineReadings.get(sensor.sensorId);
      if (baseline === undefined) {
        continue; // Skip sensors without baseline
      }

      // Get average reading in the anomaly window
      const readings = await this.prisma.sensorReading.findMany({
        where: {
          sensorId: sensor.id,
          timestamp: {
            gte: anomalyStart,
            lte: anomalyEnd,
          },
        },
        select: {
          flowValue: true,
        },
      });

      if (readings.length > 0) {
        const sum = readings.reduce((acc, r) => acc + r.flowValue, 0);
        const anomalyAverage = sum / readings.length;
        const observedChange = anomalyAverage - baseline;
        changes.set(sensor.sensorId, observedChange);
      }
    }

    return changes;
  }

  // Keep legacy methods for backward compatibility with non-DMA paths
  async calculateBaselineReadings(
    timestamp: Date,
    timeWindow: number,
    networkId: string,
  ): Promise<Map<string, number>> {
    const startTime = new Date(timestamp.getTime() - timeWindow * 1000);

    // Get all active sensors for this network
    const sensors = await this.prisma.sensor.findMany({
      where: {
        networkId,
        isActive: true,
      },
      select: { id: true, sensorId: true },
    });

    const baselineMap = new Map<string, number>();

    // For each sensor, calculate average reading in the baseline window
    for (const sensor of sensors) {
      const readings = await this.prisma.sensorReading.findMany({
        where: {
          sensorId: sensor.id,
          timestamp: {
            gte: startTime,
            lt: timestamp,
          },
        },
        select: {
          flowValue: true,
        },
      });

      if (readings.length > 0) {
        const sum = readings.reduce((acc, r) => acc + r.flowValue, 0);
        const average = sum / readings.length;
        baselineMap.set(sensor.sensorId, average);
      }
    }

    return baselineMap;
  }

  async getObservedChanges(
    timestamp: Date,
    baselineReadings: Map<string, number>,
    networkId: string,
  ): Promise<Map<string, number>> {
    const changes = new Map<string, number>();

    // Get all active sensors for this network
    const sensors = await this.prisma.sensor.findMany({
      where: {
        networkId,
        isActive: true,
      },
      select: { id: true, sensorId: true },
    });

    for (const sensor of sensors) {
      const baseline = baselineReadings.get(sensor.sensorId);
      if (baseline === undefined) {
        continue; // Skip sensors without baseline
      }

      // Get reading at detection timestamp (or latest before)
      const reading = await this.prisma.sensorReading.findFirst({
        where: {
          sensorId: sensor.id,
          timestamp: {
            lte: timestamp,
          },
        },
        orderBy: {
          timestamp: 'desc',
        },
        select: {
          flowValue: true,
        },
      });

      if (reading) {
        const observedChange = reading.flowValue - baseline;
        changes.set(sensor.sensorId, observedChange);
      }
    }

    return changes;
  }

  async calculateLocalizationScore(
    leakNodeId: string,
    observedChanges: Map<string, number>,
    estimatedLeakSize: number,
    networkId: string,
  ): Promise<number> {
    // Get sensitivity values for this leak node (filtered by networkId)
    const sensitivityEntries = await this.prisma.sensitivityMatrix.findMany({
      where: {
        networkId,
        leakNodeId,
      },
      include: {
        sensor: {
          select: {
            sensorId: true,
          },
        },
      },
    });

    if (sensitivityEntries.length === 0) {
      return 0;
    }

    // Build predicted changes map
    const predictedChanges = new Map<string, number>();
    for (const entry of sensitivityEntries) {
      const predictedChange = entry.sensitivityValue * estimatedLeakSize;
      predictedChanges.set(entry.sensor.sensorId, predictedChange);
    }

    // Calculate correlation/score using least squares method
    let sumSquaredDiff = 0;
    let sumObservedSquared = 0;
    let sumPredictedSquared = 0;
    let count = 0;

    for (const [sensorId, observedChange] of observedChanges.entries()) {
      const predictedChange = predictedChanges.get(sensorId) || 0;

      if (predictedChange === 0 && observedChange === 0) {
        continue; // Skip sensors with no change
      }

      const diff = observedChange - predictedChange;
      sumSquaredDiff += diff * diff;
      sumObservedSquared += observedChange * observedChange;
      sumPredictedSquared += predictedChange * predictedChange;
      count++;
    }

    if (count === 0) {
      return 0;
    }

    // Calculate normalized score using inverse of residual sum of squares
    // Normalize to 0-1 range
    const rss = sumSquaredDiff / count;
    const score = 1 / (1 + rss);

    // Alternative: Use correlation coefficient if both have variance
    if (sumObservedSquared > 0 && sumPredictedSquared > 0) {
      // Calculate Pearson correlation
      let sumProduct = 0;
      let sumObserved = 0;
      let sumPredicted = 0;

      for (const [sensorId, observedChange] of observedChanges.entries()) {
        const predictedChange = predictedChanges.get(sensorId) || 0;
        sumProduct += observedChange * predictedChange;
        sumObserved += observedChange;
        sumPredicted += predictedChange;
      }

      const n = count;
      const meanObserved = sumObserved / n;
      const meanPredicted = sumPredicted / n;

      let covariance = 0;
      let varianceObserved = 0;
      let variancePredicted = 0;

      for (const [sensorId, observedChange] of observedChanges.entries()) {
        const predictedChange = predictedChanges.get(sensorId) || 0;
        const obsDiff = observedChange - meanObserved;
        const predDiff = predictedChange - meanPredicted;
        covariance += obsDiff * predDiff;
        varianceObserved += obsDiff * obsDiff;
        variancePredicted += predDiff * predDiff;
      }

      if (varianceObserved > 0 && variancePredicted > 0) {
        const correlation =
          covariance / Math.sqrt(varianceObserved * variancePredicted);
        // Use weighted average of RSS-based score and correlation
        return (score * 0.5 + (correlation + 1) * 0.25); // Normalize correlation to 0-1
      }
    }

    return score;
  }

  private async getPredictedChanges(
    leakNodeId: string,
    estimatedLeakSize: number,
    networkId: string,
  ): Promise<Map<string, number>> {
    const sensitivityEntries = await this.prisma.sensitivityMatrix.findMany({
      where: {
        networkId,
        leakNodeId,
      },
      include: {
        sensor: {
          select: {
            sensorId: true,
          },
        },
      },
    });

    const predictedChanges = new Map<string, number>();
    for (const entry of sensitivityEntries) {
      const predictedChange = entry.sensitivityValue * estimatedLeakSize;
      predictedChanges.set(entry.sensor.sensorId, predictedChange);
    }

    return predictedChanges;
  }
}
