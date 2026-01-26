import { Module } from '@nestjs/common';
import { LeaksController } from './leaks.controller';
import { LeaksService } from './leaks.service';
import { PrismaModule } from '../../database/prisma/prisma.module';
import { NetworkModule } from '../network/network.module';
import { ReadingsModule } from '../readings/readings.module';
import { MassBalanceService } from './services/mass-balance.service';
import { LocalizationService } from './services/localization.service';

@Module({
  imports: [PrismaModule, NetworkModule, ReadingsModule],
  controllers: [LeaksController],
  providers: [LeaksService, MassBalanceService, LocalizationService],
  exports: [LeaksService],
})
export class LeaksModule {}
