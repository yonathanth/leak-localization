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
    junctionSensors: number;
    branchSensors: number;
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

  async autoPlaceSensors(
    networkId: string,
    targetCount: number = 12,
  ): Promise<AutoPlacementResult> {
    if (!networkId) {
      throw new BadRequestException('Network ID is required for auto-placement');
    }

    if (targetCount < 1 || targetCount > 1000) {
      throw new BadRequestException(
        'Target count must be between 1 and 1000',
      );
    }

    // Validate network exists
    const network = await this.prisma.network.findUnique({
      where: { id: networkId },
    });

    if (!network) {
      throw new BadRequestException(`Network with ID ${networkId} not found`);
    }

    // Get all nodes that already have sensors
    const existingSensors = await this.prisma.sensor.findMany({
      where: { networkId },
      select: { nodeId: true },
    });
    const nodesWithSensors = new Set(existingSensors.map((s) => s.nodeId));

    this.logger.log(
      `Found ${nodesWithSensors.size} nodes with existing sensors. Target: ${targetCount} sensors.`,
    );

    const placedSensors: AutoPlacementResult['sensors'] = [];
    let mainlineCount = 0;
    let junctionCount = 0;
    let branchCount = 0;
    let householdCount = 0;

    // Step 1: Prioritize MAINLINE nodes (up to targetCount)
    const mainlines = await this.prisma.networkNode.findMany({
      where: {
        networkId,
        nodeType: NodeType.MAINLINE,
        id: {
          notIn: Array.from(nodesWithSensors),
        },
      },
      include: {
        children: true,
      },
    });

    this.logger.log(
      `Found ${mainlines.length} mainline nodes without sensors (${nodesWithSensors.size} already have sensors)`,
    );

    // Place sensors on mainlines (up to targetCount)
    for (let i = 0; i < Math.min(mainlines.length, targetCount); i++) {
      const mainline = mainlines[i];
      const sensorId = `MAIN_${String(mainlineCount + 1).padStart(2, '0')}`;

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

        nodesWithSensors.add(mainline.id);
        mainlineCount++;
      } catch (error) {
        this.logger.error(
          `Failed to place sensor at mainline ${mainline.nodeId}: ${error instanceof Error ? error.message : String(error)}`,
          error instanceof Error ? error.stack : undefined,
        );
        // Continue with other sensors
      }
    }

    // Step 2: If slots remain, select high-connectivity JUNCTION nodes
    const remainingSlots = targetCount - placedSensors.length;
    if (remainingSlots > 0) {
      const junctions = await this.prisma.networkNode.findMany({
        where: {
          networkId,
          nodeType: NodeType.JUNCTION,
          id: {
            notIn: Array.from(nodesWithSensors),
          },
        },
        include: {
          children: true,
        },
      });

      // Sort by number of children (connectivity) - descending
      junctions.sort((a, b) => b.children.length - a.children.length);

      this.logger.log(
        `Found ${junctions.length} junction nodes. Selecting top ${remainingSlots} by connectivity.`,
      );

      // Place sensors on top N junctions
      for (let i = 0; i < Math.min(junctions.length, remainingSlots); i++) {
        const junction = junctions[i];
        const sensorId = `JUNC_${String(junctionCount + 1).padStart(2, '0')}`;

        try {
          // Find DMA for this junction
          const mainlineId = await this.networkService.findMainlineForNode(
            junction.id,
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
            sensorType: SensorType.BRANCH_JUNCTION_FLOW,
            nodeId: junction.id,
            partitionId,
            description: `Auto-placed junction sensor at ${junction.nodeId} (connectivity: ${junction.children.length})`,
            isActive: true,
          });

          placedSensors.push({
            sensorId: sensor.sensorId,
            sensorType: sensor.sensorType,
            nodeId: sensor.nodeId,
            nodeType: junction.nodeType,
            partitionId: sensor.partitionId,
            location: junction.location,
          });

          nodesWithSensors.add(junction.id);
          junctionCount++;
        } catch (error) {
          this.logger.error(
            `Failed to place sensor at junction ${junction.nodeId}: ${error instanceof Error ? error.message : String(error)}`,
            error instanceof Error ? error.stack : undefined,
          );
          // Continue with other sensors
        }
      }
    }

    // Step 3: If slots still remain, select BRANCH nodes with high connectivity
    const remainingSlotsAfterJunctions = targetCount - placedSensors.length;
    if (remainingSlotsAfterJunctions > 0) {
      const branches = await this.prisma.networkNode.findMany({
        where: {
          networkId,
          nodeType: NodeType.BRANCH,
          id: {
            notIn: Array.from(nodesWithSensors),
          },
        },
        include: {
          children: true,
        },
      });

      // Sort by number of children (connectivity) - descending
      branches.sort((a, b) => b.children.length - a.children.length);

      this.logger.log(
        `Found ${branches.length} branch nodes. Selecting top ${remainingSlotsAfterJunctions} by connectivity.`,
      );

      // Place sensors on top N branches
      for (
        let i = 0;
        i < Math.min(branches.length, remainingSlotsAfterJunctions);
        i++
      ) {
        const branch = branches[i];
        const sensorId = `BRANCH_${String(branchCount + 1).padStart(2, '0')}`;

        try {
          // Find DMA for this branch
          const mainlineId = await this.networkService.findMainlineForNode(
            branch.id,
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
            sensorType: SensorType.BRANCH_JUNCTION_FLOW,
            nodeId: branch.id,
            partitionId,
            description: `Auto-placed branch sensor at ${branch.nodeId} (connectivity: ${branch.children.length})`,
            isActive: true,
          });

          placedSensors.push({
            sensorId: sensor.sensorId,
            sensorType: sensor.sensorType,
            nodeId: sensor.nodeId,
            nodeType: branch.nodeType,
            partitionId: sensor.partitionId,
            location: branch.location,
          });

          nodesWithSensors.add(branch.id);
          branchCount++;
        } catch (error) {
          this.logger.error(
            `Failed to place sensor at branch ${branch.nodeId}: ${error instanceof Error ? error.message : String(error)}`,
            error instanceof Error ? error.stack : undefined,
          );
          // Continue with other sensors
        }
      }
    }

    this.logger.log(
      `Auto-placement complete: ${mainlineCount} mainline, ${junctionCount} junction, ${branchCount} branch sensors (total: ${placedSensors.length}/${targetCount})`,
    );

    return {
      sensorsPlaced: placedSensors.length,
      sensors: placedSensors,
      summary: {
        mainlineSensors: mainlineCount,
        junctionSensors: junctionCount,
        branchSensors: branchCount,
        householdSensors: householdCount,
      },
    };
  }
}
