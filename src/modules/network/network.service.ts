import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';
import { CreateNetworkNodeDto } from './dto/create-network-node.dto';
import { NodeType } from '@prisma/client';
import { EpanetParserService } from './services/epanet-parser.service';
import { StorageService } from './services/storage.service';
import { randomUUID } from 'crypto';

@Injectable()
export class NetworkService {
  private readonly logger = new Logger(NetworkService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly epanetParser: EpanetParserService,
    private readonly storageService: StorageService,
  ) {}

  async create(createNetworkNodeDto: CreateNetworkNodeDto) {
    // Check if nodeId already exists
    const existing = await this.prisma.networkNode.findUnique({
      where: { nodeId: createNetworkNodeDto.nodeId },
    });

    if (existing) {
      throw new ConflictException(
        `Node with ID ${createNetworkNodeDto.nodeId} already exists`,
      );
    }

    // Validate parent exists if provided
    if (createNetworkNodeDto.parentId) {
      const parent = await this.prisma.networkNode.findUnique({
        where: { id: createNetworkNodeDto.parentId },
      });

      if (!parent) {
        throw new NotFoundException(
          `Parent node with ID ${createNetworkNodeDto.parentId} not found`,
        );
      }
    }

    return this.prisma.networkNode.create({
      data: createNetworkNodeDto,
      include: {
        parent: true,
        children: true,
      },
    });
  }

  async findAll(nodeType?: NodeType) {
    const where = nodeType ? { nodeType } : {};
    return this.prisma.networkNode.findMany({
      where,
      include: {
        parent: {
          select: {
            id: true,
            nodeId: true,
            nodeType: true,
          },
        },
        children: {
          select: {
            id: true,
            nodeId: true,
            nodeType: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findOne(id: string) {
    const node = await this.prisma.networkNode.findUnique({
      where: { id },
      include: {
        parent: true,
        children: true,
        sensors: true,
      },
    });

    if (!node) {
      throw new NotFoundException(`Network node with ID ${id} not found`);
    }

    return node;
  }

  async findByNodeId(nodeId: string) {
    const node = await this.prisma.networkNode.findUnique({
      where: { nodeId },
      include: {
        parent: true,
        children: true,
        sensors: true,
      },
    });

    if (!node) {
      throw new NotFoundException(`Network node with nodeId ${nodeId} not found`);
    }

    return node;
  }

  async importFromEpanet(file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('EPANET file is required');
    }

    if (!file.originalname.endsWith('.inp')) {
      throw new BadRequestException('File must be an EPANET .inp file');
    }

    // Validate file size (max 50MB)
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
      throw new BadRequestException(
        `File size (${(file.size / 1024 / 1024).toFixed(2)} MB) exceeds maximum allowed size (50 MB)`,
      );
    }

    // Basic validation of .inp file format
    const fileContent = file.buffer.toString('utf-8');
    if (
      !fileContent.includes('[JUNCTIONS]') &&
      !fileContent.includes('[PIPES]')
    ) {
      throw new BadRequestException(
        'Invalid EPANET file format: missing required sections [JUNCTIONS] or [PIPES]',
      );
    }

    try {
      // Generate unique network ID for file storage
      const networkId = randomUUID();
      this.logger.log(`Importing network with ID: ${networkId}`);

      // Parse EPANET file
      const parsedData = this.epanetParser.parseFile(file);
      const { nodes: networkNodes, nodeMap } =
        this.epanetParser.mapToNetworkNodes(parsedData);

      // Create nodes in transaction with optimized batch operations
      const createdNodes = await this.prisma.$transaction(
        async (tx) => {
          const nodeIdToUuid = new Map<string, string>();
          const nodesToCreate: any[] = [];
          const existingNodeIds: string[] = [];

          // Check which nodes already exist (batch query)
          const existingNodes = await tx.networkNode.findMany({
            where: {
              nodeId: {
                in: networkNodes.map((n) => n.nodeId),
              },
            },
            select: {
              id: true,
              nodeId: true,
            },
          });

          // Map existing nodes
          for (const existing of existingNodes) {
            nodeIdToUuid.set(existing.nodeId, existing.id);
            existingNodeIds.push(existing.nodeId);
          }

          // Prepare nodes to create (only new ones)
          for (const nodeData of networkNodes) {
            if (!existingNodeIds.includes(nodeData.nodeId)) {
              nodesToCreate.push({
                nodeId: nodeData.nodeId,
                nodeType: nodeData.nodeType,
                epanetNodeId: nodeData.epanetNodeId,
                location: nodeData.location,
              });
            }
          }

          // Batch create new nodes
          if (nodesToCreate.length > 0) {
            // Use createMany for better performance, then fetch to get IDs
            await tx.networkNode.createMany({
              data: nodesToCreate,
              skipDuplicates: true,
            });

            // Fetch created nodes to get their IDs
            const createdNodes = await tx.networkNode.findMany({
              where: {
                nodeId: {
                  in: nodesToCreate.map((n) => n.nodeId),
                },
              },
              select: {
                id: true,
                nodeId: true,
              },
            });

            // Map created nodes
            for (const node of createdNodes) {
              nodeIdToUuid.set(node.nodeId, node.id);
            }
          }

          // Prepare parent updates in batches
          const parentUpdates: Array<{ id: string; parentId: string }> = [];
          for (const nodeData of networkNodes) {
            if (nodeData.parentId && nodeIdToUuid.has(nodeData.parentId)) {
              const nodeUuid = nodeIdToUuid.get(nodeData.nodeId);
              const parentUuid = nodeIdToUuid.get(nodeData.parentId);
              if (nodeUuid && parentUuid) {
                parentUpdates.push({
                  id: nodeUuid,
                  parentId: parentUuid,
                });
              }
            }
          }

          // Batch update parent relationships
          if (parentUpdates.length > 0) {
            // Update in batches of 100 to avoid overwhelming the database
            const batchSize = 100;
            for (let i = 0; i < parentUpdates.length; i += batchSize) {
              const batch = parentUpdates.slice(i, i + batchSize);
              await Promise.all(
                batch.map((update) =>
                  tx.networkNode.update({
                    where: { id: update.id },
                    data: { parentId: update.parentId },
                  }),
                ),
              );
            }
          }

          // Return all nodes (existing + newly created)
          return await tx.networkNode.findMany({
            where: {
              nodeId: {
                in: networkNodes.map((n) => n.nodeId),
              },
            },
          });
        },
        {
          timeout: 300000, // 5 minutes timeout for very large networks
          maxWait: 300000, // 5 minutes max wait
        },
      );

      // Create DMAs for mainlines
      const dmAsCreated = await this.createDmasForMainlines();

      // Store .inp file for future EPANET simulations
      try {
        await this.storageService.saveEpanetFile(networkId, file.buffer);
        this.logger.log(`EPANET file stored for network ${networkId}`);
      } catch (storageError) {
        this.logger.error(
          `Failed to store EPANET file: ${storageError.message}`,
          storageError.stack,
        );
        // Continue even if storage fails - network is already imported
      }

      return {
        status: 'success',
        nodesImported: createdNodes.length,
        linksImported: parsedData.links.length,
        dmAsCreated: dmAsCreated.length,
        message: 'Network imported successfully',
        networkId,
      };
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof ConflictException) {
        throw error;
      }
      throw new BadRequestException(
        `Failed to import EPANET file: ${error.message}`,
      );
    }
  }

  async createDmasForMainlines() {
    const mainlines = await this.prisma.networkNode.findMany({
      where: { nodeType: NodeType.MAINLINE },
    });

    const createdDmas: Awaited<
      ReturnType<typeof this.prisma.networkPartition.create>
    >[] = [];

    for (const mainline of mainlines) {
      // Check if DMA already exists for this mainline
      const existing = await this.prisma.networkPartition.findUnique({
        where: { mainlineId: mainline.id },
      });

      if (existing) {
        continue;
      }

      const partitionId = `DMA_${mainline.nodeId}`;
      const dma = await this.prisma.networkPartition.create({
        data: {
          partitionId,
          mainlineId: mainline.id,
          name: `DMA for ${mainline.nodeId}`,
          description: `Auto-created DMA for mainline ${mainline.nodeId}`,
        },
      });

      createdDmas.push(dma);
    }

    return createdDmas;
  }

  async findMainlineForNode(nodeId: string): Promise<string | null> {
    const node = await this.prisma.networkNode.findUnique({
      where: { id: nodeId },
      include: {
        parent: {
          include: {
            parent: {
              include: {
                parent: true,
              },
            },
          },
        },
      },
    });

    if (!node) {
      return null;
    }

    // Traverse up the hierarchy to find mainline
    let current: any = node;
    while (current) {
      if (current.nodeType === NodeType.MAINLINE) {
        return current.id;
      }
      current = current.parent;
    }

    return null;
  }
}

