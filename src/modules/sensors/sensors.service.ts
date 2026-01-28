import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';
import { CreateSensorDto } from './dto/create-sensor.dto';
import { NetworkService } from '../network/network.service';

@Injectable()
export class SensorsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly networkService: NetworkService,
  ) {}

  async create(createSensorDto: CreateSensorDto) {
    // Validate node exists and get its networkId
    const node = await this.prisma.networkNode.findUnique({
      where: { id: createSensorDto.nodeId },
      select: {
        id: true,
        networkId: true,
      },
    });

    if (!node) {
      throw new NotFoundException(
        `Network node with ID ${createSensorDto.nodeId} not found`,
      );
    }

    const networkId = node.networkId;

    // Check if sensorId already exists in this network
    const existing = await this.prisma.sensor.findUnique({
      where: {
        networkId_sensorId: {
          networkId,
          sensorId: createSensorDto.sensorId,
        },
      },
    });

    if (existing) {
      throw new ConflictException(
        `Sensor with ID ${createSensorDto.sensorId} already exists in network ${networkId}`,
      );
    }

    // Auto-assign to DMA if partitionId not provided
    let partitionId = createSensorDto.partitionId;
    if (!partitionId) {
      const mainlineId = await this.networkService.findMainlineForNode(
        createSensorDto.nodeId,
      );
      if (mainlineId) {
        const partition = await this.prisma.networkPartition.findUnique({
          where: { mainlineId },
        });
        if (partition) {
          partitionId = partition.id;
        }
      }
    }

    // Validate partition exists if provided and belongs to same network
    if (partitionId) {
      const partition = await this.prisma.networkPartition.findUnique({
        where: { id: partitionId },
      });

      if (!partition) {
        throw new NotFoundException(
          `Network partition with ID ${partitionId} not found`,
        );
      }

      if (partition.networkId !== networkId) {
        throw new ConflictException(
          `Partition belongs to a different network. Partition network: ${partition.networkId}, Node network: ${networkId}`,
        );
      }
    }

    return this.prisma.sensor.create({
      data: {
        ...createSensorDto,
        networkId,
        partitionId,
        isActive: createSensorDto.isActive ?? true,
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
  }

  async findAll(networkId?: string) {
    const where = networkId ? { networkId } : {};
    return this.prisma.sensor.findMany({
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
        createdAt: 'desc',
      },
    });
  }

  async findOne(id: string) {
    const sensor = await this.prisma.sensor.findUnique({
      where: { id },
      include: {
        network: true,
        node: true,
        partition: true,
        readings: {
          take: 10,
          orderBy: {
            timestamp: 'desc',
          },
        },
      },
    });

    if (!sensor) {
      throw new NotFoundException(`Sensor with ID ${id} not found`);
    }

    return sensor;
  }

  async findBySensorId(sensorId: string, networkId?: string) {
    const where: any = { sensorId };
    if (networkId) {
      where.networkId = networkId;
    }
    const sensor = await this.prisma.sensor.findFirst({
      where,
      include: {
        network: true,
        node: true,
        partition: true,
      },
    });

    if (!sensor) {
      throw new NotFoundException(
        `Sensor with sensorId ${sensorId}${networkId ? ` in network ${networkId}` : ''} not found`,
      );
    }

    return sensor;
  }
}

