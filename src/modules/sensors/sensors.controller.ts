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
import { SensorsService } from './sensors.service';
import { CreateSensorDto } from './dto/create-sensor.dto';
import { SensorResponseDto } from './dto/sensor-response.dto';
import { AutoPlacementService } from './services/auto-placement.service';
import { AutoPlacementResponseDto } from './dto/auto-placement-response.dto';

@ApiTags('sensors')
@Controller('sensors')
export class SensorsController {
  constructor(
    private readonly sensorsService: SensorsService,
    private readonly autoPlacementService: AutoPlacementService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new sensor' })
  @ApiResponse({
    status: 201,
    description: 'Sensor registered successfully',
    type: SensorResponseDto,
  })
  @ApiResponse({
    status: 409,
    description: 'Sensor with this ID already exists',
  })
  @ApiResponse({
    status: 404,
    description: 'Network node or partition not found',
  })
  create(@Body() createSensorDto: CreateSensorDto) {
    return this.sensorsService.create(createSensorDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all sensors' })
  @ApiResponse({
    status: 200,
    description: 'List of all sensors',
    type: [SensorResponseDto],
  })
  findAll() {
    return this.sensorsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get sensor by ID' })
  @ApiParam({
    name: 'id',
    description: 'Sensor UUID',
    example: 'uuid-here',
  })
  @ApiResponse({
    status: 200,
    description: 'Sensor details',
    type: SensorResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Sensor not found',
  })
  findOne(@Param('id') id: string) {
    return this.sensorsService.findOne(id);
  }

  @Get('sensor-id/:sensorId')
  @ApiOperation({ summary: 'Get sensor by sensorId' })
  @ApiParam({
    name: 'sensorId',
    description: 'Sensor identifier (e.g., MAIN_01)',
    example: 'MAIN_01',
  })
  @ApiResponse({
    status: 200,
    description: 'Sensor details',
    type: SensorResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Sensor not found',
  })
  findBySensorId(@Param('sensorId') sensorId: string) {
    return this.sensorsService.findBySensorId(sensorId);
  }

  @Post('auto-place')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Automatically place sensors on all mainlines and households' })
  @ApiQuery({
    name: 'networkId',
    required: false,
    description: 'Optional network ID',
    example: 'uuid-here',
  })
  @ApiResponse({
    status: 201,
    description: 'Sensors placed successfully',
    type: AutoPlacementResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'No network nodes found or invalid request',
  })
  async autoPlace(@Query('networkId') networkId?: string) {
    return this.autoPlacementService.autoPlaceSensors(networkId);
  }
}

