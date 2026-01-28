import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { StorageService } from './storage.service';
import { EpanetSimulationService } from './epanet-simulation.service';
import pLimit from 'p-limit';

export interface MatrixStats {
  exists: boolean;
  totalEntries: number;
  lastComputed?: Date;
}

export interface GenerationStatus {
  status: 'not_started' | 'in_progress' | 'completed' | 'error';
  progress?: {
    nodesProcessed: number;
    totalNodes: number;
    percentage: number;
  };
  matrixStats?: MatrixStats;
  error?: string;
}

@Injectable()
export class SensitivityMatrixService {
  private generationStatus: GenerationStatus = {
    status: 'not_started',
  };
  private readonly logger = new Logger(SensitivityMatrixService.name);
  private readonly LEAK_SIZE = 1.0; // 1 L/s leak for sensitivity calculation
  private readonly CONCURRENCY_LIMIT = 5; // Parallel simulations limit

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly epanetSimulation: EpanetSimulationService,
  ) {}

  async checkMatrixExists(networkId?: string): Promise<boolean> {
    const where = networkId ? { networkId } : {};
    const count = await this.prisma.sensitivityMatrix.count({ where });
    return count > 0;
  }

  async getMatrixStats(networkId?: string): Promise<MatrixStats> {
    const where = networkId ? { networkId } : {};
    const count = await this.prisma.sensitivityMatrix.count({ where });

    if (count === 0) {
      return {
        exists: false,
        totalEntries: 0,
      };
    }

    // Get the latest entry to find last computed time
    const latest = await this.prisma.sensitivityMatrix.findFirst({
      where,
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        createdAt: true,
      },
    });

    return {
      exists: true,
      totalEntries: count,
      lastComputed: latest?.createdAt,
    };
  }

  async generateMatrix(
    force: boolean = false,
    networkId: string,
  ): Promise<GenerationStatus> {
    if (!networkId) {
      throw new BadRequestException('Network ID is required for matrix generation');
    }

    // Check if matrix already exists for this network
    const exists = await this.checkMatrixExists(networkId);

    if (exists && !force) {
      const stats = await this.getMatrixStats(networkId);
      return {
        status: 'completed',
        matrixStats: stats,
      };
    }

    // Check if generation is already in progress
    if (this.generationStatus.status === 'in_progress') {
      return this.generationStatus;
    }

    // Start generation asynchronously
    this.generateMatrixAsync(force, networkId).catch((error) => {
      this.generationStatus = {
        status: 'error',
        error: error.message,
      };
    });

    return {
      status: 'in_progress',
      progress: {
        nodesProcessed: 0,
        totalNodes: 0,
        percentage: 0,
      },
    };
  }

  async getGenerationStatus(): Promise<GenerationStatus> {
    if (this.generationStatus.status === 'completed') {
      const stats = await this.getMatrixStats();
      return {
        ...this.generationStatus,
        matrixStats: stats,
      };
    }

    return this.generationStatus;
  }

  private async generateMatrixAsync(
    force: boolean,
    networkId: string,
  ): Promise<void> {
    this.generationStatus = {
      status: 'in_progress',
      progress: {
        nodesProcessed: 0,
        totalNodes: 0,
        percentage: 0,
      },
    };

    let project: any = null;
    let workspace: any = null;

    try {
      // Validate network exists
      const networkRecord = await this.prisma.network.findUnique({
        where: { id: networkId },
      });

      if (!networkRecord) {
        throw new BadRequestException(
          `Network with ID ${networkId} not found`,
        );
      }

      // Delete existing matrix for this network if force is true
      if (force) {
        await this.prisma.sensitivityMatrix.deleteMany({
          where: { networkId },
        });
      }

      // Get all network nodes (potential leak locations) with EPANET node IDs for this network
      const nodes = await this.prisma.networkNode.findMany({
        where: {
          networkId,
          epanetNodeId: {
            not: null,
          },
        },
        select: {
          id: true,
          nodeId: true,
          epanetNodeId: true,
        },
      });

      // Get all sensors with their EPANET node IDs for this network
      const sensors = await this.prisma.sensor.findMany({
        where: {
          networkId,
          isActive: true,
        },
        include: {
          node: {
            select: {
              epanetNodeId: true,
            },
          },
        },
      });

      if (nodes.length === 0) {
        throw new BadRequestException(
          `No network nodes found for network ${networkId}. Import network first.`,
        );
      }

      if (sensors.length === 0) {
        throw new BadRequestException(
          `No sensors found for network ${networkId}. Register sensors first.`,
        );
      }

      const filePath = this.storageService.getEpanetFilePath(networkId);
      if (!this.storageService.fileExists(networkId)) {
        throw new BadRequestException(
          `EPANET file not found for network ${networkId}. Please re-import the network.`,
        );
      }

      this.logger.log(`Loading EPANET network from ${filePath}`);
      const epanetNetwork = await this.epanetSimulation.loadNetwork(filePath);
      project = epanetNetwork.project;
      workspace = epanetNetwork.workspace;

      // Get sensor EPANET node IDs
      const sensorEpanetNodeIds = sensors
        .map((s) => s.node.epanetNodeId)
        .filter((id): id is string => id !== null);

      if (sensorEpanetNodeIds.length === 0) {
        throw new BadRequestException(
          'No sensors with valid EPANET node IDs found.',
        );
      }

      // Run baseline simulation once (cache result)
      this.logger.log('Running baseline simulation...');
      const baselineResults = await this.epanetSimulation.runBaselineSimulation(
        project,
        sensorEpanetNodeIds,
      );

      const totalNodes = nodes.length;
      this.generationStatus.progress = {
        nodesProcessed: 0,
        totalNodes,
        percentage: 0,
      };

      // Generate matrix entries in batches
      const batchSize = 1000;
      const matrixEntries: Array<{
        networkId: string;
        leakNodeId: string;
        sensorId: string;
        sensitivityValue: number;
      }> = [];

      // Create concurrency limiter
      const limit = pLimit(this.CONCURRENCY_LIMIT);

      // Process nodes in parallel batches
      const nodeBatches: typeof nodes[] = [];
      for (let i = 0; i < nodes.length; i += this.CONCURRENCY_LIMIT) {
        nodeBatches.push(nodes.slice(i, i + this.CONCURRENCY_LIMIT));
      }

      for (const batch of nodeBatches) {
        const batchPromises = batch.map((node) =>
          limit(async () => {
            if (!node.epanetNodeId) {
              this.logger.warn(
                `Skipping node ${node.nodeId} - no EPANET node ID`,
              );
              return;
            }

            try {
              // Run leak simulation
              const leakResults =
                await this.epanetSimulation.runLeakSimulation(
                  project,
                  node.epanetNodeId,
                  this.LEAK_SIZE,
                  sensorEpanetNodeIds,
                );

              // Calculate sensitivity for each sensor
              const sensitivity = this.epanetSimulation.calculateSensitivity(
                baselineResults,
                leakResults,
                this.LEAK_SIZE,
              );

              // Store sensitivity values
              for (const sensor of sensors) {
                if (!sensor.node.epanetNodeId) continue;

                const sensitivityValue =
                  sensitivity.get(sensor.node.epanetNodeId) || 0;

                matrixEntries.push({
                  networkId,
                  leakNodeId: node.id,
                  sensorId: sensor.id,
                  sensitivityValue,
                });
              }
            } catch (error) {
              this.logger.error(
                `Failed to calculate sensitivity for node ${node.nodeId} (EPANET ID: ${node.epanetNodeId}): ${error instanceof Error ? error.message : String(error)}`,
                error instanceof Error ? error.stack : undefined,
              );
              // Continue with other nodes - don't fail entire matrix generation
            }
          }),
        );

        await Promise.all(batchPromises);

        // Update progress
        const processed = Math.min(
          nodeBatches.indexOf(batch) * this.CONCURRENCY_LIMIT + batch.length,
          totalNodes,
        );
        this.generationStatus.progress = {
          nodesProcessed: processed,
          totalNodes,
          percentage: Math.round((processed / totalNodes) * 100),
        };

        // Insert in batches
        if (matrixEntries.length >= batchSize) {
          await this.prisma.sensitivityMatrix.createMany({
            data: matrixEntries,
            skipDuplicates: true,
          });
          matrixEntries.length = 0; // Clear array
        }
      }

      // Insert remaining entries
      if (matrixEntries.length > 0) {
        await this.prisma.sensitivityMatrix.createMany({
          data: matrixEntries,
          skipDuplicates: true,
        });
      }

      // Close EPANET project
      if (project) {
        this.epanetSimulation.closeProject(project);
      }

      const stats = await this.getMatrixStats();
      this.generationStatus = {
        status: 'completed',
        progress: {
          nodesProcessed: totalNodes,
          totalNodes,
          percentage: 100,
        },
        matrixStats: stats,
      };

      this.logger.log(
        `Sensitivity matrix generation complete: ${stats.totalEntries} entries computed`,
      );
    } catch (error) {
      // Ensure project is closed even on error
      if (project) {
        try {
          this.epanetSimulation.closeProject(project);
        } catch (closeError) {
          this.logger.warn(
            `Error closing EPANET project: ${closeError instanceof Error ? closeError.message : String(closeError)}`,
          );
        }
      }

      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred';
      const errorStack = error instanceof Error ? error.stack : undefined;

      this.generationStatus = {
        status: 'error',
        error: errorMessage,
      };

      this.logger.error(
        `Sensitivity matrix generation failed: ${errorMessage}`,
        errorStack,
      );
      throw error;
    }
  }

  async findAll(
    networkId: string,
    leakNodeId?: string,
    sensorId?: string,
    page: number = 1,
    limit: number = 100,
  ) {
    if (limit > 1000) {
      limit = 1000;
    }
    const skip = (page - 1) * limit;

    const where: any = {
      networkId,
      ...(leakNodeId && { leakNodeId }),
      ...(sensorId && { sensorId }),
    };

    const [data, total] = await Promise.all([
      this.prisma.sensitivityMatrix.findMany({
        where,
        include: {
          leakNode: {
            select: {
              id: true,
              nodeId: true,
              nodeType: true,
              epanetNodeId: true,
            },
          },
          sensor: {
            select: {
              id: true,
              sensorId: true,
              sensorType: true,
            },
          },
        },
        skip,
        take: limit,
        orderBy: {
          createdAt: 'desc',
        },
      }),
      this.prisma.sensitivityMatrix.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      limit,
    };
  }

  async findByLeakNode(leakNodeId: string) {
    const entries = await this.prisma.sensitivityMatrix.findMany({
      where: { leakNodeId },
      include: {
        leakNode: {
          select: {
            id: true,
            nodeId: true,
            nodeType: true,
            epanetNodeId: true,
          },
        },
        sensor: {
          select: {
            id: true,
            sensorId: true,
            sensorType: true,
          },
        },
      },
      orderBy: {
        sensitivityValue: 'desc',
      },
    });

    return entries;
  }

  async findBySensor(sensorId: string) {
    const entries = await this.prisma.sensitivityMatrix.findMany({
      where: { sensorId },
      include: {
        leakNode: {
          select: {
            id: true,
            nodeId: true,
            nodeType: true,
            epanetNodeId: true,
          },
        },
        sensor: {
          select: {
            id: true,
            sensorId: true,
            sensorType: true,
          },
        },
      },
      orderBy: {
        sensitivityValue: 'desc',
      },
    });

    return entries;
  }
}
