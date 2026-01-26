import { DocumentBuilder } from '@nestjs/swagger';

export const swaggerConfig = new DocumentBuilder()
  .setTitle('Water Leak Detection System API')
  .setDescription('API for detecting and localizing leaks in water distribution networks using flow sensors')
  .setVersion('1.0')
  .addTag('health', 'Health check endpoints')
  .addTag('network', 'Network topology management')
  .addTag('sensors', 'Sensor registration and management')
  .addTag('readings', 'Sensor reading ingestion (manual single and batch)')
  .build();

