import { Module } from '@nestjs/common';
import { NetworkController } from './network.controller';
import { NetworkService } from './network.service';
import { PrismaModule } from '../../database/prisma/prisma.module';
import { EpanetParserService } from './services/epanet-parser.service';
import { SensitivityMatrixService } from './services/sensitivity-matrix.service';
import { StorageService } from './services/storage.service';
import { EpanetSimulationService } from './services/epanet-simulation.service';

@Module({
  imports: [PrismaModule],
  controllers: [NetworkController],
  providers: [
    NetworkService,
    EpanetParserService,
    SensitivityMatrixService,
    StorageService,
    EpanetSimulationService,
  ],
  exports: [NetworkService, SensitivityMatrixService],
})
export class NetworkModule {}

