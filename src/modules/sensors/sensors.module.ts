import { Module } from '@nestjs/common';
import { SensorsController } from './sensors.controller';
import { SensorsService } from './sensors.service';
import { AutoPlacementService } from './services/auto-placement.service';
import { PrismaModule } from '../../database/prisma/prisma.module';
import { NetworkModule } from '../network/network.module';

@Module({
  imports: [PrismaModule, NetworkModule],
  controllers: [SensorsController],
  providers: [SensorsService, AutoPlacementService],
  exports: [SensorsService],
})
export class SensorsModule {}

