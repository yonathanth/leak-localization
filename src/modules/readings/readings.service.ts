import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';
import { CreateReadingDto } from './dto/create-reading.dto';
import { QueryReadingsDto } from './dto/query-readings.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class ReadingsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createReadingDto: CreateReadingDto) {
    // Validate sensor exists and get networkId (sensorId is not unique alone, use findFirst)
    const sensor = await this.prisma.sensor.findFirst({
      where: { sensorId: createReadingDto.sensorId },
      select: {
        id: true,
        networkId: true,
      },
    });

    if (!sensor) {
      throw new NotFoundException(
        `Sensor with ID ${createReadingDto.sensorId} not found`,
      );
    }

    return this.prisma.sensorReading.create({
      data: {
        networkId: sensor.networkId,
        sensorId: sensor.id,
        flowValue: createReadingDto.flowValue,
        timestamp: new Date(createReadingDto.timestamp),
        source: createReadingDto.source || 'MANUAL',
      },
      include: {
        network: {
          select: {
            id: true,
            name: true,
          },
        },
        sensor: {
          select: {
            id: true,
            sensorId: true,
            sensorType: true,
          },
        },
      },
    });
  }

  async createBatch(readings: CreateReadingDto[]) {
    if (!readings || readings.length === 0) {
      throw new BadRequestException('Readings array cannot be empty');
    }

    // Validate all sensors exist
    const sensorIds = [...new Set(readings.map((r) => r.sensorId))];
    const sensors = await this.prisma.sensor.findMany({
      where: {
        sensorId: {
          in: sensorIds,
        },
      },
      select: {
        id: true,
        sensorId: true,
        networkId: true,
      },
    });

    if (sensors.length !== sensorIds.length) {
      const foundIds = sensors.map((s) => s.sensorId);
      const missingIds = sensorIds.filter((id) => !foundIds.includes(id));
      throw new NotFoundException(
        `Sensors not found: ${missingIds.join(', ')}`,
      );
    }

    // Create sensor ID to UUID and networkId mapping
    const sensorMap = new Map(
      sensors.map((s) => [s.sensorId, { id: s.id, networkId: s.networkId }]),
    );

    // Prepare data for batch insert
    const data = readings.map((reading) => {
      const sensor = sensorMap.get(reading.sensorId)!;
      return {
        networkId: sensor.networkId,
        sensorId: sensor.id,
        flowValue: reading.flowValue,
        timestamp: new Date(reading.timestamp),
        source: reading.source || 'MANUAL',
      };
    });

    // Use transaction for batch insert
    const result = await this.prisma.$transaction(
      data.map((item) =>
        this.prisma.sensorReading.create({
          data: item,
          include: {
            network: {
              select: {
                id: true,
                name: true,
              },
            },
            sensor: {
              select: {
                id: true,
                sensorId: true,
                sensorType: true,
              },
            },
          },
        }),
      ),
    );

    return {
      count: result.length,
      readings: result,
    };
  }

  async findAll(query: QueryReadingsDto) {
    const { page = 1, limit = 10, networkId, sensorId, startDate, endDate } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.SensorReadingWhereInput = {};

    if (networkId) {
      where.networkId = networkId;
    }

    if (sensorId) {
      const sensor = await this.prisma.sensor.findFirst({
        where: networkId ? { networkId, sensorId } : { sensorId },
      });
      if (sensor) {
        where.sensorId = sensor.id;
        // Ensure networkId consistency if both are provided
        if (networkId && sensor.networkId !== networkId) {
          return {
            data: [],
            total: 0,
            page,
            limit,
          };
        }
      } else {
        // Return empty result if sensor not found
        return {
          data: [],
          total: 0,
          page,
          limit,
        };
      }
    }

    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) {
        where.timestamp.gte = new Date(startDate);
      }
      if (endDate) {
        where.timestamp.lte = new Date(endDate);
      }
    }

    const [data, total] = await Promise.all([
      this.prisma.sensorReading.findMany({
        where,
        include: {
          network: {
            select: {
              id: true,
              name: true,
            },
          },
          sensor: {
            select: {
              id: true,
              sensorId: true,
              sensorType: true,
            },
          },
        },
        skip,
        take: limit,
        orderBy: {
          timestamp: 'desc',
        },
      }),
      this.prisma.sensorReading.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      limit,
    };
  }

  async findOne(id: string) {
    const reading = await this.prisma.sensorReading.findUnique({
      where: { id },
      include: {
        network: true,
        sensor: true,
      },
    });

    if (!reading) {
      throw new NotFoundException(`Reading with ID ${id} not found`);
    }

    return reading;
  }

  async createBatchFromAnalysis(
    readings: Array<{ sensorId: string; flowValue: number }>,
    timestamp: Date,
    source: 'SENSOR' | 'MANUAL' = 'SENSOR',
  ) {
    if (!readings || readings.length === 0) {
      throw new BadRequestException('Readings array cannot be empty');
    }

    // Validate all sensors exist
    const sensorIds = [...new Set(readings.map((r) => r.sensorId))];
    const sensors = await this.prisma.sensor.findMany({
      where: {
        sensorId: {
          in: sensorIds,
        },
      },
      select: {
        id: true,
        sensorId: true,
        networkId: true,
      },
    });

    if (sensors.length !== sensorIds.length) {
      const foundIds = sensors.map((s) => s.sensorId);
      const missingIds = sensorIds.filter((id) => !foundIds.includes(id));
      throw new NotFoundException(
        `Sensors not found: ${missingIds.join(', ')}`,
      );
    }

    // Create sensor ID to UUID and networkId mapping
    const sensorMap = new Map(
      sensors.map((s) => [s.sensorId, { id: s.id, networkId: s.networkId }]),
    );

    // Validate and prepare data for batch insert (all with same timestamp)
    const data = readings.map((reading) => {
      // Validate flow value
      if (
        typeof reading.flowValue !== 'number' ||
        !isFinite(reading.flowValue)
      ) {
        throw new BadRequestException(
          `Invalid flow value for sensor ${reading.sensorId}: ${reading.flowValue}. Must be a finite number.`,
        );
      }

      const sensor = sensorMap.get(reading.sensorId);
      if (!sensor) {
        throw new NotFoundException(
          `Sensor ${reading.sensorId} not found in mapping`,
        );
      }

      return {
        networkId: sensor.networkId,
        sensorId: sensor.id,
        flowValue: reading.flowValue,
        timestamp,
        source,
      };
    });

    // Batch insert using createMany for better performance
    await this.prisma.sensorReading.createMany({
      data,
      skipDuplicates: true,
    });

    return {
      count: data.length,
      timestamp,
    };
  }
}

