import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';

@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService) {}

  async check() {
    let databaseStatus = 'disconnected';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      databaseStatus = 'connected';
    } catch (error) {
      databaseStatus = 'error';
    }

    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      database: databaseStatus,
    };
  }
}

