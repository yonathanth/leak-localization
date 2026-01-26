import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { NetworkService } from './network.service';
import { CreateNetworkNodeDto } from './dto/create-network-node.dto';
import { NetworkNodeResponseDto } from './dto/network-node-response.dto';
import { ImportResponseDto } from './dto/import-response.dto';
import { SensitivityMatrixStatsDto } from './dto/sensitivity-matrix-stats.dto';
import { SensitivityMatrixStatusDto } from './dto/sensitivity-matrix-status.dto';
import { SensitivityMatrixService } from './services/sensitivity-matrix.service';
import { EpanetImportDto } from './dto/epanet-import.dto';
import { NodeType } from '@prisma/client';

@ApiTags('network')
@Controller('network')
export class NetworkController {
  constructor(
    private readonly networkService: NetworkService,
    private readonly sensitivityMatrixService: SensitivityMatrixService,
  ) {}

  @Post('nodes')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new network node' })
  @ApiResponse({
    status: 201,
    description: 'Network node created successfully',
    type: NetworkNodeResponseDto,
  })
  @ApiResponse({
    status: 409,
    description: 'Node with this ID already exists',
  })
  create(@Body() createNetworkNodeDto: CreateNetworkNodeDto) {
    return this.networkService.create(createNetworkNodeDto);
  }

  @Get('nodes')
  @ApiOperation({ summary: 'Get all network nodes' })
  @ApiQuery({
    name: 'nodeType',
    required: false,
    enum: NodeType,
    description: 'Filter by node type',
  })
  @ApiResponse({
    status: 200,
    description: 'List of network nodes',
    type: [NetworkNodeResponseDto],
  })
  findAll(@Query('nodeType') nodeType?: NodeType) {
    return this.networkService.findAll(nodeType);
  }

  @Get('nodes/:id')
  @ApiOperation({ summary: 'Get network node by ID' })
  @ApiParam({
    name: 'id',
    description: 'Network node UUID',
    example: 'uuid-here',
  })
  @ApiResponse({
    status: 200,
    description: 'Network node details',
    type: NetworkNodeResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Network node not found',
  })
  findOne(@Param('id') id: string) {
    return this.networkService.findOne(id);
  }

  @Get('nodes/node-id/:nodeId')
  @ApiOperation({ summary: 'Get network node by nodeId' })
  @ApiParam({
    name: 'nodeId',
    description: 'Network node identifier (e.g., MAIN_01)',
    example: 'MAIN_01',
  })
  @ApiResponse({
    status: 200,
    description: 'Network node details',
    type: NetworkNodeResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Network node not found',
  })
  findByNodeId(@Param('nodeId') nodeId: string) {
    return this.networkService.findByNodeId(nodeId);
  }

  @Post('import/epanet')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Import network from EPANET file' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'EPANET .inp file to import',
    type: EpanetImportDto,
  })
  @ApiResponse({
    status: 201,
    description: 'Network imported successfully',
    type: ImportResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid file or file format',
  })
  @ApiResponse({
    status: 409,
    description: 'Network nodes already exist',
  })
  async importEpanet(@UploadedFile() file: Express.Multer.File) {
    return this.networkService.importFromEpanet(file);
  }

  @Post('sensitivity-matrix/generate')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Generate sensitivity matrix using real EPANET simulations' })
  @ApiQuery({
    name: 'force',
    required: false,
    type: String,
    description: 'Force regeneration even if matrix exists (true/false)',
    example: 'false',
  })
  @ApiQuery({
    name: 'networkId',
    required: false,
    type: String,
    description: 'Network ID from import (required if multiple networks)',
    example: 'uuid-here',
  })
  @ApiResponse({
    status: 202,
    description: 'Matrix generation started',
    type: SensitivityMatrixStatusDto,
  })
  @ApiResponse({
    status: 200,
    description: 'Matrix already exists',
    type: SensitivityMatrixStatusDto,
  })
  @ApiResponse({
    status: 400,
    description: 'No network nodes or sensors found',
  })
  async generateMatrix(
    @Query('force') force?: string,
    @Query('networkId') networkId?: string,
  ) {
    const forceRegenerate = force === 'true' || force === '1';
    return this.sensitivityMatrixService.generateMatrix(
      forceRegenerate,
      networkId,
    );
  }

  @Get('sensitivity-matrix/status')
  @ApiOperation({ summary: 'Get sensitivity matrix generation status' })
  @ApiResponse({
    status: 200,
    description: 'Generation status',
    type: SensitivityMatrixStatusDto,
  })
  async getMatrixStatus() {
    return this.sensitivityMatrixService.getGenerationStatus();
  }

  @Get('sensitivity-matrix/stats')
  @ApiOperation({ summary: 'Get sensitivity matrix statistics' })
  @ApiResponse({
    status: 200,
    description: 'Matrix statistics',
    type: SensitivityMatrixStatsDto,
  })
  async getMatrixStats() {
    return this.sensitivityMatrixService.getMatrixStats();
  }
}

