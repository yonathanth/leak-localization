import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { ReadingsService } from './readings.service';
import { CreateReadingDto } from './dto/create-reading.dto';
import { BatchReadingDto } from './dto/batch-reading.dto';
import { QueryReadingsDto } from './dto/query-readings.dto';
import { ReadingResponseDto } from './dto/reading-response.dto';

@ApiTags('readings')
@Controller('readings')
export class ReadingsController {
  constructor(private readonly readingsService: ReadingsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a single sensor reading' })
  @ApiResponse({
    status: 201,
    description: 'Sensor reading created successfully',
    type: ReadingResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Sensor not found',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid input data',
  })
  create(@Body() createReadingDto: CreateReadingDto) {
    return this.readingsService.create(createReadingDto);
  }

  @Post('batch')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create multiple sensor readings in batch' })
  @ApiResponse({
    status: 201,
    description: 'Batch readings created successfully',
    schema: {
      type: 'object',
      properties: {
        count: { type: 'number', example: 5 },
        readings: {
          type: 'array',
          items: { $ref: '#/components/schemas/ReadingResponseDto' },
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'One or more sensors not found',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid input data or empty readings array',
  })
  createBatch(@Body() batchReadingDto: BatchReadingDto) {
    return this.readingsService.createBatch(batchReadingDto.readings);
  }

  @Get()
  @ApiOperation({ summary: 'Get sensor readings with optional filters' })
  @ApiQuery({
    name: 'sensorId',
    required: false,
    description: 'Filter by sensor ID',
    example: 'MAIN_01',
  })
  @ApiQuery({
    name: 'startDate',
    required: false,
    description: 'Start date (ISO 8601)',
    example: '2024-01-15T00:00:00.000Z',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    description: 'End date (ISO 8601)',
    example: '2024-01-15T23:59:59.999Z',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Page number',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Items per page',
    example: 10,
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of sensor readings',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: { $ref: '#/components/schemas/ReadingResponseDto' },
        },
        total: { type: 'number', example: 100 },
        page: { type: 'number', example: 1 },
        limit: { type: 'number', example: 10 },
      },
    },
  })
  findAll(@Query() query: QueryReadingsDto) {
    return this.readingsService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get sensor reading by ID' })
  @ApiParam({
    name: 'id',
    description: 'Reading UUID',
    example: 'uuid-here',
  })
  @ApiResponse({
    status: 200,
    description: 'Sensor reading details',
    type: ReadingResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Reading not found',
  })
  findOne(@Param('id') id: string) {
    return this.readingsService.findOne(id);
  }
}

