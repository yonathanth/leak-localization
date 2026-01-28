import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { NodeType } from '@prisma/client';

export interface CoverageByType {
  nodeType: NodeType;
  total: number;
  withSensors: number;
  coveragePercentage: number;
}

export interface CoverageGap {
  nodeId: string;
  nodeType: NodeType;
  nodeIdLabel: string;
  connectivity: number;
  importance: 'critical' | 'high' | 'medium' | 'low';
}

export interface CoverageAnalysis {
  networkId: string;
  totalNodes: number;
  nodesWithSensors: number;
  overallCoveragePercentage: number;
  coverageByType: CoverageByType[];
  gaps: CoverageGap[];
  sensorDistribution: Array<{
    partitionId: string | null;
    partitionName: string | null;
    sensorCount: number;
  }>;
}

@Injectable()
export class CoverageAnalysisService {
  private readonly logger = new Logger(CoverageAnalysisService.name);

  constructor(private readonly prisma: PrismaService) {}

  async analyzeCoverage(networkId: string): Promise<CoverageAnalysis> {
    if (!networkId) {
      throw new BadRequestException('Network ID is required');
    }

    // Validate network exists
    const network = await this.prisma.network.findUnique({
      where: { id: networkId },
    });

    if (!network) {
      throw new BadRequestException(`Network with ID ${networkId} not found`);
    }

    // Get all nodes with their children count (for connectivity)
    const allNodes = await this.prisma.networkNode.findMany({
      where: { networkId },
      include: {
        children: true,
        sensors: {
          where: { isActive: true },
        },
      },
    });

    // Get all sensors
    const allSensors = await this.prisma.sensor.findMany({
      where: {
        networkId,
        isActive: true,
      },
      include: {
        partition: {
          select: {
            id: true,
            partitionId: true,
            name: true,
          },
        },
      },
    });

    // Calculate coverage by type
    const coverageByType: CoverageByType[] = [];
    const nodeTypes = [
      NodeType.MAINLINE,
      NodeType.JUNCTION,
      NodeType.BRANCH,
      NodeType.HOUSEHOLD,
    ];

    for (const nodeType of nodeTypes) {
      const nodesOfType = allNodes.filter((n) => n.nodeType === nodeType);
      const nodesWithSensors = nodesOfType.filter((n) => n.sensors.length > 0);
      const coveragePercentage =
        nodesOfType.length > 0
          ? (nodesWithSensors.length / nodesOfType.length) * 100
          : 0;

      coverageByType.push({
        nodeType,
        total: nodesOfType.length,
        withSensors: nodesWithSensors.length,
        coveragePercentage: Math.round(coveragePercentage * 100) / 100,
      });
    }

    // Calculate overall coverage
    const totalNodes = allNodes.length;
    const nodesWithSensors = allNodes.filter((n) => n.sensors.length > 0)
      .length;
    const overallCoveragePercentage =
      totalNodes > 0 ? (nodesWithSensors / totalNodes) * 100 : 0;

    // Identify gaps (nodes without sensors, prioritized by importance)
    const gaps: CoverageGap[] = allNodes
      .filter((node) => node.sensors.length === 0)
      .map((node) => {
        const connectivity = node.children.length;
        let importance: 'critical' | 'high' | 'medium' | 'low';

        if (node.nodeType === NodeType.MAINLINE) {
          importance = 'critical';
        } else if (
          node.nodeType === NodeType.JUNCTION &&
          connectivity >= 3
        ) {
          importance = 'critical';
        } else if (
          node.nodeType === NodeType.JUNCTION &&
          connectivity >= 2
        ) {
          importance = 'high';
        } else if (node.nodeType === NodeType.JUNCTION) {
          importance = 'medium';
        } else if (node.nodeType === NodeType.BRANCH && connectivity >= 2) {
          importance = 'high';
        } else {
          importance = 'low';
        }

        return {
          nodeId: node.id,
          nodeType: node.nodeType,
          nodeIdLabel: node.nodeId,
          connectivity,
          importance,
        };
      })
      .sort((a, b) => {
        // Sort by importance (critical > high > medium > low)
        const importanceOrder = {
          critical: 0,
          high: 1,
          medium: 2,
          low: 3,
        };
        const importanceDiff =
          importanceOrder[a.importance] - importanceOrder[b.importance];
        if (importanceDiff !== 0) return importanceDiff;
        // Then by connectivity (descending)
        return b.connectivity - a.connectivity;
      });

    // Calculate sensor distribution across partitions
    const partitionMap = new Map<string, number>();
    const partitionNameMap = new Map<string, string | null>();

    for (const sensor of allSensors) {
      const partitionKey = sensor.partitionId || 'no-partition';
      partitionMap.set(
        partitionKey,
        (partitionMap.get(partitionKey) || 0) + 1,
      );
      if (sensor.partition) {
        partitionNameMap.set(
          partitionKey,
          sensor.partition.name || sensor.partition.partitionId,
        );
      } else {
        partitionNameMap.set(partitionKey, null);
      }
    }

    const sensorDistribution = Array.from(partitionMap.entries()).map(
      ([partitionId, sensorCount]) => ({
        partitionId: partitionId === 'no-partition' ? null : partitionId,
        partitionName: partitionNameMap.get(partitionId) || null,
        sensorCount,
      }),
    );

    return {
      networkId,
      totalNodes,
      nodesWithSensors,
      overallCoveragePercentage: Math.round(overallCoveragePercentage * 100) / 100,
      coverageByType,
      gaps,
      sensorDistribution,
    };
  }
}
