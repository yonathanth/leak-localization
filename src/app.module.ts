import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './database/prisma/prisma.module';
import { HealthModule } from './modules/health/health.module';
import { NetworkModule } from './modules/network/network.module';
import { SensorsModule } from './modules/sensors/sensors.module';
import { ReadingsModule } from './modules/readings/readings.module';
import { LeaksModule } from './modules/leaks/leaks.module';
import databaseConfig from './config/database.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig],
    }),
    PrismaModule,
    HealthModule,
    NetworkModule,
    SensorsModule,
    ReadingsModule,
    LeaksModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
