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
} from '@nestjs/swagger';
import { LeaksService } from './leaks.service';
import { DetectLeaksDto } from './dto/detect-leaks.dto';
import { LeakDetectionResponseDto } from './dto/leak-detection-response.dto';
import { QueryLeakDetectionsDto } from './dto/query-leak-detections.dto';
import { LocalizeLeakDto } from './dto/localize-leak.dto';
import { LocalizationResponseDto } from './dto/localization-response.dto';
import { LocalizationCandidateDto } from './dto/localization-candidate.dto';
import { AnalyzeLeaksDto } from './dto/analyze-leaks.dto';
import { AnalyzeLeaksResponseDto } from './dto/analyze-leaks-response.dto';

@ApiTags('leaks')
@Controller('leaks')
export class LeaksController {
  constructor(private readonly leaksService: LeaksService) {}

  @Post('detect')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Run leak detection' })
  @ApiResponse({
    status: 201,
    description: 'Leak detection completed',
    type: [LeakDetectionResponseDto],
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid input data',
  })
  @ApiResponse({
    status: 404,
    description: 'Node or partition not found',
  })
  async detectLeaks(@Body() detectLeaksDto: DetectLeaksDto) {
    return this.leaksService.detectLeaks(detectLeaksDto);
  }

  @Get('detections')
  @ApiOperation({ summary: 'Get all leak detections with filters' })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of leak detections',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: { $ref: '#/components/schemas/LeakDetectionResponseDto' },
        },
        total: { type: 'number', example: 100 },
        page: { type: 'number', example: 1 },
        limit: { type: 'number', example: 10 },
      },
    },
  })
  async findAll(@Query() query: QueryLeakDetectionsDto) {
    return this.leaksService.findAll(query);
  }

  @Get('detections/:id')
  @ApiOperation({ summary: 'Get leak detection by ID' })
  @ApiParam({
    name: 'id',
    description: 'Leak detection UUID',
    example: 'uuid-here',
  })
  @ApiResponse({
    status: 200,
    description: 'Leak detection details',
    type: LeakDetectionResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Leak detection not found',
  })
  async findOne(@Param('id') id: string) {
    return this.leaksService.findOne(id);
  }

  @Get('detections/latest')
  @ApiOperation({ summary: 'Get most recent leak detections' })
  @ApiResponse({
    status: 200,
    description: 'List of most recent leak detections',
    type: [LeakDetectionResponseDto],
  })
  async getLatest() {
    return this.leaksService.getLatest();
  }

  @Post('localize')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Localize leak(s) using sensitivity matrix' })
  @ApiResponse({
    status: 200,
    description: 'Leak(s) localized successfully',
    type: [LocalizationResponseDto],
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid input or sensitivity matrix not found',
  })
  @ApiResponse({
    status: 404,
    description: 'Leak detection not found',
  })
  async localizeLeak(@Body() localizeLeakDto: LocalizeLeakDto) {
    if (localizeLeakDto.detectionId) {
      const result = await this.leaksService.localizeLeak(
        localizeLeakDto.detectionId,
        localizeLeakDto.baselineTimeWindow,
      );
      return [result];
    } else if (
      localizeLeakDto.detectionIds &&
      localizeLeakDto.detectionIds.length > 0
    ) {
      return this.leaksService.localizeLeaks(
        localizeLeakDto.detectionIds,
        localizeLeakDto.baselineTimeWindow,
      );
    } else {
      return this.leaksService.localizeLeaks(
        undefined,
        localizeLeakDto.baselineTimeWindow,
      );
    }
  }

  @Get('detections/:id/localize')
  @ApiOperation({ summary: 'Get localization candidates for a detection' })
  @ApiParam({
    name: 'id',
    description: 'Leak detection UUID',
    example: 'uuid-here',
  })
  @ApiResponse({
    status: 200,
    description: 'List of localization candidates',
    type: [LocalizationCandidateDto],
  })
  @ApiResponse({
    status: 404,
    description: 'Leak detection not found',
  })
  @ApiResponse({
    status: 400,
    description: 'Sensitivity matrix not found or no sensor readings',
  })
  async getLocalizationCandidates(@Param('id') id: string) {
    return this.leaksService.getLocalizationCandidates(id);
  }

  @Post('analyze')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Analyze leaks from simultaneous sensor readings (detect + localize)',
  })
  @ApiResponse({
    status: 200,
    description: 'Leak analysis completed with detection and localization',
    type: AnalyzeLeaksResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid input data or missing sensors',
  })
  async analyzeLeaks(@Body() analyzeLeaksDto: AnalyzeLeaksDto) {
    return this.leaksService.analyzeLeaks(analyzeLeaksDto);
  }
}
