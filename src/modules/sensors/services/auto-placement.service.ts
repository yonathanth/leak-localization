import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { NetworkService } from '../../network/network.service';
import { SensorsService } from '../sensors.service';
import { SensorType, NodeType } from '@prisma/client';

export interface AutoPlacementResult {
  sensorsPlaced: number;
  sensors: Array<{
    sensorId: string;
    sensorType: SensorType;
    nodeId: string;
    nodeType: NodeType;
    partitionId: string | null;
    location: string | null;
  }>;
  summary: {
    mainlineSensors: number;
    householdSensors: number;
  };
}

@Injectable()
export class AutoPlacementService {
  private readonly logger = new Logger(AutoPlacementService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly networkService: NetworkService,
    private readonly sensorsService: SensorsService,
  ) {}

  async autoPlaceSensors(networkId: string): Promise<AutoPlacementResult> {
    if (!networkId) {
      throw new BadRequestException('Network ID is required for auto-placement');
    }

    // Validate network exists
    const network = await this.prisma.network.findUnique({
      where: { id: networkId },
    });

    if (!network) {
      throw new BadRequestException(`Network with ID ${networkId} not found`);
    }

    // Get all MAINLINE nodes for this network
    const mainlines = await this.prisma.networkNode.findMany({
      where: {
        networkId,
        nodeType: NodeType.MAINLINE,
      },
    });

    // Get all HOUSEHOLD nodes for this network
    const households = await this.prisma.networkNode.findMany({
      where: {
        networkId,
        nodeType: NodeType.HOUSEHOLD,
      },
    });

    if (mainlines.length === 0 && households.length === 0) {
      throw new BadRequestException(
        'No mainlines or households found. Import network first.',
      );
    }

    this.logger.log(
      `Auto-placing sensors: ${mainlines.length} mainlines, ${households.length} households`,
    );

    const placedSensors: AutoPlacementResult['sensors'] = [];
    let mainlineCount = 0;
    let householdCount = 0;

    // Place sensors on mainlines
    for (let i = 0; i < mainlines.length; i++) {
      const mainline = mainlines[i];
      const sensorId = `MAIN_${String(i + 1).padStart(2, '0')}`;

      // Check if sensor already exists in this network
      const existing = await this.prisma.sensor.findUnique({
        where: {
          networkId_sensorId: {
            networkId,
            sensorId,
          },
        },
      });

      if (existing) {
        this.logger.warn(`Sensor ${sensorId} already exists in network ${networkId}, skipping`);
        continue;
      }

      try {
        // Find DMA for this mainline
        const partition = await this.prisma.networkPartition.findUnique({
          where: { mainlineId: mainline.id },
        });

        const sensor = await this.sensorsService.create({
          sensorId,
          sensorType: SensorType.MAINLINE_FLOW,
          nodeId: mainline.id,
          partitionId: partition?.id,
          description: `Auto-placed mainline sensor at ${mainline.nodeId}`,
          isActive: true,
        });

        placedSensors.push({
          sensorId: sensor.sensorId,
          sensorType: sensor.sensorType,
          nodeId: sensor.nodeId,
          nodeType: mainline.nodeType,
          partitionId: sensor.partitionId,
          location: mainline.location,
        });

        mainlineCount++;
        } catch (error) {
          this.logger.error(
            `Failed to place sensor at mainline ${mainline.nodeId}: ${error instanceof Error ? error.message : String(error)}`,
            error instanceof Error ? error.stack : undefined,
          );
          // Continue with other sensors - don't fail entire placement
        }
    }

    // Place sensors on households (batch processing)
    const batchSize = 100;
    for (let i = 0; i < households.length; i += batchSize) {
      const batch = households.slice(i, i + batchSize);
      const batchPromises = batch.map(async (household, batchIndex) => {
        const globalIndex = i + batchIndex;
        const sensorId = `HH_${String(globalIndex + 1).padStart(3, '0')}`;

        // Check if sensor already exists in this network
        const existing = await this.prisma.sensor.findUnique({
          where: {
            networkId_sensorId: {
              networkId,
              sensorId,
            },
          },
        });

        if (existing) {
          this.logger.warn(`Sensor ${sensorId} already exists in network ${networkId}, skipping`);
          return null;
        }

        try {
          // Find DMA for this household
          const mainlineId = await this.networkService.findMainlineForNode(
            household.id,
          );
          let partitionId: string | null = null;
          if (mainlineId) {
            const partition = await this.prisma.networkPartition.findUnique({
              where: { mainlineId },
            });
            partitionId = partition?.id || null;
          }

          const sensor = await this.sensorsService.create({
            sensorId,
            sensorType: SensorType.HOUSEHOLD_FLOW,
            nodeId: household.id,
            partitionId,
            description: `Auto-placed household sensor at ${household.nodeId}`,
            isActive: true,
          });

          return {
            sensorId: sensor.sensorId,
            sensorType: sensor.sensorType,
            nodeId: sensor.nodeId,
            nodeType: household.nodeType,
            partitionId: sensor.partitionId,
            location: household.location,
          };
        } catch (error) {
          this.logger.error(
            `Failed to place sensor at household ${household.nodeId}: ${error instanceof Error ? error.message : String(error)}`,
            error instanceof Error ? error.stack : undefined,
          );
          return null;
        }
      });

      const batchResults = await Promise.all(batchPromises);
      const validSensors = batchResults.filter(
        (s) => s !== null,
      ) as AutoPlacementResult['sensors'];
      placedSensors.push(...validSensors);
      householdCount += validSensors.length;

      this.logger.log(
        `Processed batch ${Math.floor(i / batchSize) + 1}: ${validSensors.length} sensors placed`,
      );
    }

    this.logger.log(
      `Auto-placement complete: ${mainlineCount} mainline sensors, ${householdCount} household sensors`,
    );

    return {
      sensorsPlaced: placedSensors.length,
      sensors: placedSensors,
      summary: {
        mainlineSensors: mainlineCount,
        householdSensors: householdCount,
      },
    };
  }
}
