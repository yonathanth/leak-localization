import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';
import { MassBalanceService } from './services/mass-balance.service';
import { LocalizationService } from './services/localization.service';
import { ReadingsService } from '../readings/readings.service';
import { DetectLeaksDto } from './dto/detect-leaks.dto';
import { QueryLeakDetectionsDto } from './dto/query-leak-detections.dto';
import { AnalyzeLeaksDto } from './dto/analyze-leaks.dto';
import { LeakSeverity, LeakStatus, NodeType, Prisma } from '@prisma/client';

@Injectable()
export class LeaksService {
  private readonly logger = new Logger(LeaksService.name);
  private readonly DEFAULT_THRESHOLD = 5.0; // L/s
  private readonly DEFAULT_TIME_WINDOW = 300; // 5 minutes in seconds

  constructor(
    private readonly prisma: PrismaService,
    private readonly massBalanceService: MassBalanceService,
    private readonly localizationService: LocalizationService,
    private readonly readingsService: ReadingsService,
  ) {}

  async detectLeaks(options: DetectLeaksDto) {
    const timestamp = options.timestamp
      ? new Date(options.timestamp)
      : new Date();
    const threshold = options.threshold ?? this.DEFAULT_THRESHOLD;
    const timeWindow = options.timeWindow ?? this.DEFAULT_TIME_WINDOW;

    const detections: any[] = [];

    if (options.nodeId) {
      // Detect at specific node
      const detection = await this.detectLeakAtNode(
        options.nodeId,
        timestamp,
        threshold,
        timeWindow,
      );
      if (detection) {
        detections.push(detection);
      }
    } else if (options.partitionId) {
      // Detect in specific DMA
      const dmaDetections = await this.detectLeaksInDma(
        options.partitionId,
        timestamp,
        threshold,
        timeWindow,
      );
      detections.push(...dmaDetections);
    } else {
      // Detect at all junctions/nodes (filter by networkId if provided)
      const where: any = {
        nodeType: {
          in: [NodeType.JUNCTION, NodeType.BRANCH],
        },
      };
      if (options.networkId) {
        where.networkId = options.networkId;
      }

      const nodes = await this.prisma.networkNode.findMany({
        where,
      });

      for (const node of nodes) {
        const detection = await this.detectLeakAtNode(
          node.id,
          timestamp,
          threshold,
          timeWindow,
        );
        if (detection) {
          detections.push(detection);
        }
      }
    }

    return detections;
  }

  async detectLeakAtNode(
    nodeId: string,
    timestamp: Date,
    threshold: number = this.DEFAULT_THRESHOLD,
    timeWindow?: number,
  ) {
    // Calculate mass balance
    const massBalance = await this.massBalanceService.calculateMassBalance(
      nodeId,
      timestamp,
    );

    // Check if imbalance exceeds threshold
    if (massBalance.imbalance <= threshold) {
      return null;
    }

    // Determine severity
    const severity = this.determineSeverity(massBalance.imbalance);

    // Get partition if node belongs to one, and get networkId
    const node = await this.prisma.networkNode.findUnique({
      where: { id: nodeId },
      select: {
        id: true,
        networkId: true,
        partition: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!node) {
      throw new NotFoundException(`Node with ID ${nodeId} not found`);
    }

    // Create detection
    const detection = await this.prisma.leakDetection.create({
      data: {
        networkId: node.networkId,
        nodeId,
        partitionId: node.partition?.id,
        flowImbalance: massBalance.imbalance,
        severity,
        status: LeakStatus.DETECTED,
        detectedAt: new Date(),
        timestamp,
        timeWindow: timeWindow || null,
        threshold,
      },
      include: {
        network: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
        node: {
          select: {
            id: true,
            nodeId: true,
            nodeType: true,
          },
        },
        partition: {
          select: {
            id: true,
            partitionId: true,
            name: true,
          },
        },
      },
    });

    return detection;
  }

  async detectLeaksInDma(
    partitionId: string,
    timestamp: Date,
    threshold: number = this.DEFAULT_THRESHOLD,
    timeWindow?: number,
  ) {
    // Get partition to get networkId
    const partition = await this.prisma.networkPartition.findUnique({
      where: { id: partitionId },
      select: {
        id: true,
        networkId: true,
      },
    });

    if (!partition) {
      throw new NotFoundException(`Partition with ID ${partitionId} not found`);
    }

    const massBalance = await this.massBalanceService.calculateDmaMassBalance(
      partitionId,
      timestamp,
    );

    const detections: any[] = [];

    // Check if DMA has imbalance
    if (massBalance.imbalance > threshold) {
      const severity = this.determineSeverity(massBalance.imbalance);

      const detection = await this.prisma.leakDetection.create({
        data: {
          networkId: partition.networkId,
          nodeId: massBalance.nodeId,
          partitionId,
          flowImbalance: massBalance.imbalance,
          severity,
          status: LeakStatus.DETECTED,
          detectedAt: new Date(),
          timestamp,
          timeWindow: timeWindow || null,
          threshold,
        },
        include: {
          network: {
            select: {
              id: true,
              name: true,
              description: true,
            },
          },
          node: {
            select: {
              id: true,
              nodeId: true,
              nodeType: true,
            },
          },
          partition: {
            select: {
              id: true,
              partitionId: true,
              name: true,
            },
          },
        },
      });

      detections.push(detection);
    }

    return detections;
  }

  async findAll(query: QueryLeakDetectionsDto) {
    const { page = 1, limit = 10, networkId, nodeId, partitionId, status, severity, startDate, endDate } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.LeakDetectionWhereInput = {};

    if (networkId) {
      where.networkId = networkId;
    }

    if (nodeId) {
      where.nodeId = nodeId;
    }

    if (partitionId) {
      where.partitionId = partitionId;
    }

    if (status) {
      where.status = status;
    }

    if (severity) {
      where.severity = severity;
    }

    if (startDate || endDate) {
      where.detectedAt = {};
      if (startDate) {
        where.detectedAt.gte = new Date(startDate);
      }
      if (endDate) {
        where.detectedAt.lte = new Date(endDate);
      }
    }

    const [data, total] = await Promise.all([
      this.prisma.leakDetection.findMany({
        where,
        include: {
          network: {
            select: {
              id: true,
              name: true,
              description: true,
            },
          },
          node: {
            select: {
              id: true,
              nodeId: true,
              nodeType: true,
            },
          },
          partition: {
            select: {
              id: true,
              partitionId: true,
              name: true,
            },
          },
        },
        skip,
        take: limit,
        orderBy: {
          detectedAt: 'desc',
        },
      }),
      this.prisma.leakDetection.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      limit,
    };
  }

  async findOne(id: string) {
    const detection = await this.prisma.leakDetection.findUnique({
      where: { id },
      include: {
        network: true,
        node: true,
        partition: true,
      },
    });

    if (!detection) {
      throw new NotFoundException(`Leak detection with ID ${id} not found`);
    }

    return detection;
  }

  async getLatest(limit: number = 10, networkId?: string) {
    const where = networkId ? { networkId } : {};
    return this.prisma.leakDetection.findMany({
      where,
      include: {
        network: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
        node: {
          select: {
            id: true,
            nodeId: true,
            nodeType: true,
          },
        },
        partition: {
          select: {
            id: true,
            partitionId: true,
            name: true,
          },
        },
      },
      orderBy: {
        detectedAt: 'desc',
      },
      take: limit,
    });
  }

  async localizeLeak(
    detectionId: string,
    baselineTimeWindow?: number,
  ): Promise<any> {
    const detection = await this.prisma.leakDetection.findUnique({
      where: { id: detectionId },
    });

    if (!detection) {
      throw new NotFoundException(
        `Leak detection with ID ${detectionId} not found`,
      );
    }

    if (detection.status !== LeakStatus.DETECTED) {
      throw new BadRequestException(
        `Leak detection with ID ${detectionId} is not in DETECTED status. Current status: ${detection.status}`,
      );
    }

    // Perform localization
    const localizationResult =
      await this.localizationService.localizeLeakForDetection(
        detection,
        baselineTimeWindow,
      );

    // Update detection with localization results
    const updatedDetection = await this.prisma.leakDetection.update({
      where: { id: detectionId },
      data: {
        localizedNodeId: localizationResult.localizedNodeId,
        localizationScore: localizationResult.localizationScore,
        localizedAt: new Date(),
        status: LeakStatus.LOCALIZED,
      },
      include: {
        node: {
          select: {
            id: true,
            nodeId: true,
            nodeType: true,
          },
        },
        partition: {
          select: {
            id: true,
            partitionId: true,
            name: true,
          },
        },
      },
    });

    return {
      ...updatedDetection,
      candidateNodes: localizationResult.candidateNodes,
    };
  }

  async localizeLeaks(
    detectionIds?: string[],
    baselineTimeWindow?: number,
  ): Promise<any[]> {
    let detections: any[];

    if (detectionIds && detectionIds.length > 0) {
      // Localize specific detections
      detections = await this.prisma.leakDetection.findMany({
        where: {
          id: {
            in: detectionIds,
          },
          status: LeakStatus.DETECTED,
        },
      });
    } else {
      // Localize all DETECTED leaks
      detections = await this.prisma.leakDetection.findMany({
        where: {
          status: LeakStatus.DETECTED,
        },
      });
    }

    const results: any[] = [];

    for (const detection of detections) {
      try {
        const localized = await this.localizeLeak(
          detection.id,
          baselineTimeWindow,
        );
        results.push(localized);
      } catch (error) {
        // Log error but continue with other detections
        console.error(
          `Failed to localize detection ${detection.id}:`,
          error.message,
        );
      }
    }

    return results;
  }

  async getLocalizationCandidates(detectionId: string): Promise<any[]> {
    const detection = await this.prisma.leakDetection.findUnique({
      where: { id: detectionId },
    });

    if (!detection) {
      throw new NotFoundException(
        `Leak detection with ID ${detectionId} not found`,
      );
    }

    // Perform localization to get candidates
    const localizationResult =
      await this.localizationService.localizeLeakForDetection(detection);

    // Get node details for candidates
    const candidateNodes = await Promise.all(
      localizationResult.candidateNodes.map(async (candidate) => {
        const node = await this.prisma.networkNode.findUnique({
          where: { id: candidate.nodeId },
          select: {
            id: true,
            nodeId: true,
            nodeType: true,
          },
        });

        return {
          nodeId: candidate.nodeId,
          nodeIdString: node?.nodeId || '',
          score: candidate.score,
          nodeType: node?.nodeType,
        };
      }),
    );

    return candidateNodes;
  }

  async analyzeLeaks(analyzeDto: AnalyzeLeaksDto) {
    // Validate input
    if (!analyzeDto.readings || analyzeDto.readings.length === 0) {
      throw new BadRequestException(
        'Sensor readings array cannot be empty',
      );
    }

    if (!analyzeDto.timestamp) {
      throw new BadRequestException('Timestamp is required');
    }

    const timestamp = new Date(analyzeDto.timestamp);
    if (isNaN(timestamp.getTime())) {
      throw new BadRequestException('Invalid timestamp format');
    }

    this.logger.log(
      `Starting leak analysis for timestamp: ${timestamp.toISOString()} with ${analyzeDto.readings.length} sensor readings`,
    );

    try {
      // 1. Store all sensor readings (batch insert)
      this.logger.log(`Storing ${analyzeDto.readings.length} sensor readings...`);
      const readingsResult = await this.readingsService.createBatchFromAnalysis(
        analyzeDto.readings,
        timestamp,
        'SENSOR',
      );

      // 2. Run detection using existing detectLeaks()
      this.logger.log('Running leak detection...');
      const detections = await this.detectLeaks({
        timestamp: analyzeDto.timestamp,
        threshold: this.DEFAULT_THRESHOLD,
        timeWindow: this.DEFAULT_TIME_WINDOW,
      });

      if (detections.length === 0) {
        this.logger.log('No leaks detected');
        return {
          timestamp: analyzeDto.timestamp,
          readingsStored: readingsResult.count,
          detections: [],
          summary: {
            totalDetections: 0,
            localized: 0,
            severityBreakdown: {
              LOW: 0,
              MEDIUM: 0,
              HIGH: 0,
              CRITICAL: 0,
            },
          },
        };
      }

      this.logger.log(`Found ${detections.length} leak detections`);

      // 3. For each detection, run localization
      const localizedDetections: Array<{
        id: string;
        nodeId: string;
        partitionId: string | null;
        flowImbalance: number;
        severity: LeakSeverity;
        status: LeakStatus;
        detectedAt: Date;
        timestamp: Date;
        localization?: {
          localizedNodeId: string | null;
          localizedNode?: {
            nodeId: string;
            nodeType: NodeType;
            location: string | null;
          };
          localizationScore: number;
          topCandidates: Array<{
            nodeId: string;
            score: number;
            confidence: string;
          }>;
        };
      }> = [];
      let localizedCount = 0;
      const severityBreakdown = {
        LOW: 0,
        MEDIUM: 0,
        HIGH: 0,
        CRITICAL: 0,
      };

      for (const detection of detections) {
        try {
          // Run localization
          const localizationResult = await this.localizeLeak(
            detection.id,
            this.DEFAULT_TIME_WINDOW,
          );

          // Get localized node details
          let localizedNode: {
            id: string;
            nodeId: string;
            nodeType: NodeType;
            location: string | null;
          } | null = null;
          if (localizationResult.localizedNodeId) {
            const node = await this.prisma.networkNode.findUnique({
              where: { id: localizationResult.localizedNodeId },
              select: {
                id: true,
                nodeId: true,
                nodeType: true,
                location: true,
              },
            });
            if (node) {
              localizedNode = node;
            }
          }

          // Get top candidates
          const topCandidates = (localizationResult.candidateNodes || [])
            .slice(0, 5)
            .map((candidate) => ({
              nodeId: candidate.nodeId || candidate.nodeIdString || '',
              score: candidate.score,
              confidence:
                candidate.score > 0.8
                  ? 'HIGH'
                  : candidate.score > 0.6
                    ? 'MEDIUM'
                    : 'LOW',
            }));

          localizedDetections.push({
            id: detection.id,
            nodeId: detection.nodeId,
            partitionId: detection.partitionId,
            flowImbalance: detection.flowImbalance,
            severity: detection.severity,
            status: detection.status,
            detectedAt: detection.detectedAt,
            timestamp: detection.timestamp,
            localization: {
              localizedNodeId: localizationResult.localizedNodeId,
              localizedNode: localizedNode
                ? {
                    nodeId: localizedNode.nodeId,
                    nodeType: localizedNode.nodeType,
                    location: localizedNode.location,
                  }
                : undefined,
              localizationScore: localizationResult.localizationScore,
              topCandidates,
            },
          });

          localizedCount++;
        } catch (error) {
          this.logger.error(
            `Failed to localize detection ${detection.id}: ${error instanceof Error ? error.message : String(error)}`,
            error instanceof Error ? error.stack : undefined,
          );
          // Include detection without localization - don't fail entire analysis
          localizedDetections.push({
            id: detection.id,
            nodeId: detection.nodeId,
            partitionId: detection.partitionId,
            flowImbalance: detection.flowImbalance,
            severity: detection.severity,
            status: detection.status,
            detectedAt: detection.detectedAt,
            timestamp: detection.timestamp,
          });
        }

        // Update severity breakdown
        severityBreakdown[detection.severity]++;
      }

      this.logger.log(
        `Analysis complete: ${localizedCount}/${detections.length} leaks localized`,
      );

      // 4. Return combined results
      return {
        timestamp: analyzeDto.timestamp,
        readingsStored: readingsResult.count,
        detections: localizedDetections,
        summary: {
          totalDetections: detections.length,
          localized: localizedCount,
          severityBreakdown,
        },
      };
    } catch (error) {
      this.logger.error(
        `Leak analysis failed: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException(
        `Failed to analyze leaks: ${error.message}`,
      );
    }
  }

  private determineSeverity(imbalance: number): LeakSeverity {
    if (imbalance > 50) {
      return LeakSeverity.CRITICAL;
    } else if (imbalance > 20) {
      return LeakSeverity.HIGH;
    } else if (imbalance > 10) {
      return LeakSeverity.MEDIUM;
    } else {
      return LeakSeverity.LOW;
    }
  }
}
