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
    // Check if sensorId already exists
    const existing = await this.prisma.sensor.findUnique({
      where: { sensorId: createSensorDto.sensorId },
    });

    if (existing) {
      throw new ConflictException(
        `Sensor with ID ${createSensorDto.sensorId} already exists`,
      );
    }

    // Validate node exists
    const node = await this.prisma.networkNode.findUnique({
      where: { id: createSensorDto.nodeId },
    });

    if (!node) {
      throw new NotFoundException(
        `Network node with ID ${createSensorDto.nodeId} not found`,
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

    // Validate partition exists if provided
    if (partitionId) {
      const partition = await this.prisma.networkPartition.findUnique({
        where: { id: partitionId },
      });

      if (!partition) {
        throw new NotFoundException(
          `Network partition with ID ${partitionId} not found`,
        );
      }
    }

    return this.prisma.sensor.create({
      data: {
        ...createSensorDto,
        partitionId,
        isActive: createSensorDto.isActive ?? true,
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
  }

  async findAll() {
    return this.prisma.sensor.findMany({
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
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findOne(id: string) {
    const sensor = await this.prisma.sensor.findUnique({
      where: { id },
      include: {
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

  async findBySensorId(sensorId: string) {
    const sensor = await this.prisma.sensor.findUnique({
      where: { sensorId },
      include: {
        node: true,
        partition: true,
      },
    });

    if (!sensor) {
      throw new NotFoundException(`Sensor with sensorId ${sensorId} not found`);
    }

    return sensor;
  }
}

