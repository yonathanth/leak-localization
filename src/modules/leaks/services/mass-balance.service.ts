import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { NodeType } from '@prisma/client';

export interface MassBalanceResult {
  nodeId: string;
  inflow: number; // Total inflow in L/s
  outflow: number; // Total outflow in L/s
  imbalance: number; // inflow - outflow (positive = leak)
  timestamp: Date;
  sensorsUsed: {
    inflow: string[]; // Sensor IDs used for inflow
    outflow: string[]; // Sensor IDs used for outflow
  };
  missingSensors?: string[]; // Sensors that should exist but don't
}

@Injectable()
export class MassBalanceService {
  constructor(private readonly prisma: PrismaService) {}

  async calculateMassBalance(
    nodeId: string,
    timestamp: Date,
  ): Promise<MassBalanceResult> {
    const node = await this.prisma.networkNode.findUnique({
      where: { id: nodeId },
      include: {
        parent: {
          include: {
            sensors: {
              where: { isActive: true },
            },
          },
        },
        children: {
          include: {
            sensors: {
              where: { isActive: true },
            },
          },
        },
        sensors: {
          where: { isActive: true },
        },
      },
    });

    if (!node) {
      throw new Error(`Node with ID ${nodeId} not found`);
    }

    const inflow = await this.getInflowForNode(nodeId, timestamp);
    const outflow = await this.getOutflowForNode(nodeId, timestamp);

    // Get sensor IDs used
    const inflowSensors: string[] = [];
    const outflowSensors: string[] = [];

    // Inflow sensors (from parent)
    if (node.parent) {
      for (const sensor of node.parent.sensors) {
        const reading = await this.getLatestReadingForSensor(
          sensor.id,
          timestamp,
        );
        if (reading !== null) {
          inflowSensors.push(sensor.sensorId);
        }
      }
    }

    // Outflow sensors (from children)
    for (const child of node.children) {
      for (const sensor of child.sensors) {
        const reading = await this.getLatestReadingForSensor(
          sensor.id,
          timestamp,
        );
        if (reading !== null) {
          outflowSensors.push(sensor.sensorId);
        }
      }
    }

    return {
      nodeId,
      inflow,
      outflow,
      imbalance: inflow - outflow,
      timestamp,
      sensorsUsed: {
        inflow: inflowSensors,
        outflow: outflowSensors,
      },
    };
  }

  async getInflowForNode(nodeId: string, timestamp: Date): Promise<number> {
    const node = await this.prisma.networkNode.findUnique({
      where: { id: nodeId },
      include: {
        parent: {
          include: {
            sensors: {
              where: { isActive: true },
            },
          },
        },
      },
    });

    if (!node || !node.parent) {
      return 0;
    }

    let totalInflow = 0;

    // Sum flows from parent node sensors
    for (const sensor of node.parent.sensors) {
      const reading = await this.getLatestReadingForSensor(
        sensor.id,
        timestamp,
      );
      if (reading !== null) {
        totalInflow += reading;
      }
    }

    return totalInflow;
  }

  async getOutflowForNode(nodeId: string, timestamp: Date): Promise<number> {
    const node = await this.prisma.networkNode.findUnique({
      where: { id: nodeId },
      include: {
        children: {
          include: {
            sensors: {
              where: { isActive: true },
            },
          },
        },
      },
    });

    if (!node) {
      return 0;
    }

    let totalOutflow = 0;

    // Sum flows from child node sensors
    for (const child of node.children) {
      for (const sensor of child.sensors) {
        const reading = await this.getLatestReadingForSensor(
          sensor.id,
          timestamp,
        );
        if (reading !== null) {
          totalOutflow += reading;
        }
      }
    }

    return totalOutflow;
  }

  async calculateDmaMassBalance(
    partitionId: string,
    timestamp: Date,
  ): Promise<MassBalanceResult> {
    const partition = await this.prisma.networkPartition.findUnique({
      where: { id: partitionId },
      include: {
        mainline: {
          include: {
            sensors: {
              where: { isActive: true },
            },
          },
        },
        sensors: {
          where: { isActive: true },
          include: {
            node: {
              select: {
                nodeType: true,
              },
            },
          },
        },
      },
    });

    if (!partition) {
      throw new Error(`Partition with ID ${partitionId} not found`);
    }

    // Inflow: mainline entry sensor
    let inflow = 0;
    const inflowSensors: string[] = [];
    for (const sensor of partition.mainline.sensors) {
      if (sensor.sensorType === 'MAINLINE_FLOW') {
        const reading = await this.getLatestReadingForSensor(
          sensor.id,
          timestamp,
        );
        if (reading !== null) {
          inflow += reading;
          inflowSensors.push(sensor.sensorId);
        }
      }
    }

    // Outflow: sum of all household sensors in DMA
    let outflow = 0;
    const outflowSensors: string[] = [];
    for (const sensor of partition.sensors) {
      if (
        sensor.node.nodeType === NodeType.HOUSEHOLD ||
        sensor.sensorType === 'HOUSEHOLD_FLOW'
      ) {
        const reading = await this.getLatestReadingForSensor(
          sensor.id,
          timestamp,
        );
        if (reading !== null) {
          outflow += reading;
          outflowSensors.push(sensor.sensorId);
        }
      }
    }

    return {
      nodeId: partition.mainline.id,
      inflow,
      outflow,
      imbalance: inflow - outflow,
      timestamp,
      sensorsUsed: {
        inflow: inflowSensors,
        outflow: outflowSensors,
      },
    };
  }

  private async getLatestReadingForSensor(
    sensorId: string,
    timestamp: Date,
  ): Promise<number | null> {
    // Get the latest reading at or before the specified timestamp
    const reading = await this.prisma.sensorReading.findFirst({
      where: {
        sensorId,
        timestamp: {
          lte: timestamp,
        },
      },
      orderBy: {
        timestamp: 'desc',
      },
    });

    return reading ? reading.flowValue : null;
  }

  async getLatestReadingsForTimestamp(
    timestamp: Date,
    timeWindow?: number,
  ): Promise<Map<string, number>> {
    const startTime = timeWindow
      ? new Date(timestamp.getTime() - timeWindow * 1000)
      : timestamp;

    // Get all active sensors
    const sensors = await this.prisma.sensor.findMany({
      where: { isActive: true },
      select: { id: true, sensorId: true },
    });

    const readingsMap = new Map<string, number>();

    // For each sensor, get the latest reading within the time window
    for (const sensor of sensors) {
      const reading = await this.prisma.sensorReading.findFirst({
        where: {
          sensorId: sensor.id,
          timestamp: {
            gte: startTime,
            lte: timestamp,
          },
        },
        orderBy: {
          timestamp: 'desc',
        },
      });

      if (reading) {
        readingsMap.set(sensor.sensorId, reading.flowValue);
      }
    }

    return readingsMap;
  }
}
