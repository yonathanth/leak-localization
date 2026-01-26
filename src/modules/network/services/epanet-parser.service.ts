import { Injectable } from '@nestjs/common';
import { NodeType } from '@prisma/client';

export interface EpanetNode {
  id: string;
  elevation?: number;
  demand?: number;
  nodeType: 'JUNCTION' | 'TANK' | 'RESERVOIR';
}

export interface EpanetLink {
  id: string;
  fromNode: string;
  toNode: string;
  length?: number;
  diameter?: number;
  linkType: 'PIPE' | 'PUMP' | 'VALVE';
}

export interface ParsedEpanetData {
  nodes: EpanetNode[];
  links: EpanetLink[];
  title?: string;
}

export interface NetworkNodeData {
  nodeId: string;
  nodeType: NodeType;
  parentId?: string;
  epanetNodeId: string;
  location?: string;
}

@Injectable()
export class EpanetParserService {
  parseFile(file: Express.Multer.File): ParsedEpanetData {
    const content = file.buffer.toString('utf-8');
    const lines = content.split('\n');

    const data: ParsedEpanetData = {
      nodes: [],
      links: [],
    };

    let currentSection: string | null = null;
    let lineNumber = 0;

    for (const line of lines) {
      lineNumber++;
      const trimmedLine = line.trim();

      // Skip empty lines and comments
      if (!trimmedLine || trimmedLine.startsWith(';')) {
        continue;
      }

      // Check for section headers
      if (trimmedLine.startsWith('[') && trimmedLine.endsWith(']')) {
        currentSection = trimmedLine
          .slice(1, -1)
          .toUpperCase()
          .trim();
        continue;
      }

      // Parse sections
      switch (currentSection) {
        case 'TITLE':
          if (!data.title) {
            data.title = trimmedLine;
          }
          break;

        case 'JUNCTIONS':
          this.parseJunction(trimmedLine, data);
          break;

        case 'TANKS':
          this.parseTank(trimmedLine, data);
          break;

        case 'RESERVOIRS':
          this.parseReservoir(trimmedLine, data);
          break;

        case 'PIPES':
          this.parsePipe(trimmedLine, data);
          break;

        case 'PUMPS':
          this.parsePump(trimmedLine, data);
          break;

        case 'VALVES':
          this.parseValve(trimmedLine, data);
          break;
      }
    }

    return data;
  }

  private parseJunction(line: string, data: ParsedEpanetData): void {
    const parts = line.split(/\s+/).filter((p) => p.length > 0);
    if (parts.length < 1) return;

    const node: EpanetNode = {
      id: parts[0],
      nodeType: 'JUNCTION',
    };

    if (parts[1]) {
      node.elevation = parseFloat(parts[1]);
    }
    if (parts[2]) {
      node.demand = parseFloat(parts[2]);
    }

    data.nodes.push(node);
  }

  private parseTank(line: string, data: ParsedEpanetData): void {
    const parts = line.split(/\s+/).filter((p) => p.length > 0);
    if (parts.length < 1) return;

    const node: EpanetNode = {
      id: parts[0],
      nodeType: 'TANK',
    };

    if (parts[1]) {
      node.elevation = parseFloat(parts[1]);
    }

    data.nodes.push(node);
  }

  private parseReservoir(line: string, data: ParsedEpanetData): void {
    const parts = line.split(/\s+/).filter((p) => p.length > 0);
    if (parts.length < 1) return;

    const node: EpanetNode = {
      id: parts[0],
      nodeType: 'RESERVOIR',
    };

    if (parts[1]) {
      node.elevation = parseFloat(parts[1]);
    }

    data.nodes.push(node);
  }

  private parsePipe(line: string, data: ParsedEpanetData): void {
    const parts = line.split(/\s+/).filter((p) => p.length > 0);
    if (parts.length < 2) return;

    const link: EpanetLink = {
      id: parts[0],
      fromNode: parts[1],
      toNode: parts[2],
      linkType: 'PIPE',
    };

    if (parts[3]) {
      link.length = parseFloat(parts[3]);
    }
    if (parts[4]) {
      link.diameter = parseFloat(parts[4]);
    }

    data.links.push(link);
  }

  private parsePump(line: string, data: ParsedEpanetData): void {
    const parts = line.split(/\s+/).filter((p) => p.length > 0);
    if (parts.length < 2) return;

    const link: EpanetLink = {
      id: parts[0],
      fromNode: parts[1],
      toNode: parts[2],
      linkType: 'PUMP',
    };

    data.links.push(link);
  }

  private parseValve(line: string, data: ParsedEpanetData): void {
    const parts = line.split(/\s+/).filter((p) => p.length > 0);
    if (parts.length < 2) return;

    const link: EpanetLink = {
      id: parts[0],
      fromNode: parts[1],
      toNode: parts[2],
      linkType: 'VALVE',
    };

    data.links.push(link);
  }

  mapToNetworkNodes(
    parsedData: ParsedEpanetData,
  ): {
    nodes: NetworkNodeData[];
    nodeMap: Map<string, string>; // EPANET ID -> nodeId mapping
  } {
    const nodes: NetworkNodeData[] = [];
    const nodeMap = new Map<string, string>();

    // First pass: identify mainlines (reservoirs or entry points)
    const entryNodes = new Set<string>();
    const linkConnections = new Map<string, Set<string>>();

    // Build connection graph
    for (const link of parsedData.links) {
      if (!linkConnections.has(link.fromNode)) {
        linkConnections.set(link.fromNode, new Set());
      }
      if (!linkConnections.has(link.toNode)) {
        linkConnections.set(link.toNode, new Set());
      }
      linkConnections.get(link.fromNode)!.add(link.toNode);
    }

    // Find entry nodes (nodes with no incoming links or reservoirs)
    for (const node of parsedData.nodes) {
      if (node.nodeType === 'RESERVOIR') {
        entryNodes.add(node.id);
      } else {
        // Check if node has no incoming links
        let hasIncoming = false;
        for (const link of parsedData.links) {
          if (link.toNode === node.id) {
            hasIncoming = true;
            break;
          }
        }
        if (!hasIncoming) {
          entryNodes.add(node.id);
        }
      }
    }

    // Second pass: create nodes with hierarchy
    const processedNodes = new Set<string>();
    const nodeIdMap = new Map<string, string>(); // EPANET ID -> UUID nodeId

    // Process entry nodes as mainlines
    for (const epanetId of entryNodes) {
      const nodeData: NetworkNodeData = {
        nodeId: epanetId,
        nodeType: NodeType.MAINLINE,
        epanetNodeId: epanetId,
      };
      nodes.push(nodeData);
      nodeMap.set(epanetId, epanetId);
      processedNodes.add(epanetId);
    }

    // Process remaining nodes
    for (const node of parsedData.nodes) {
      if (processedNodes.has(node.id)) {
        continue;
      }

      // Determine node type based on connections
      const connections = linkConnections.get(node.id) || new Set();
      const isJunction = connections.size > 1 || node.nodeType === 'JUNCTION';
      const isHousehold = node.demand && node.demand > 0;

      let nodeType: NodeType;
      if (isHousehold) {
        nodeType = NodeType.HOUSEHOLD;
      } else if (isJunction) {
        nodeType = NodeType.JUNCTION;
      } else {
        nodeType = NodeType.BRANCH;
      }

      // Find parent (node that connects to this one)
      let parentId: string | undefined;
      for (const link of parsedData.links) {
        if (link.toNode === node.id) {
          parentId = link.fromNode;
          break;
        }
      }

      const nodeData: NetworkNodeData = {
        nodeId: node.id,
        nodeType,
        parentId: parentId ? nodeMap.get(parentId) : undefined,
        epanetNodeId: node.id,
      };

      nodes.push(nodeData);
      nodeMap.set(node.id, node.id);
      processedNodes.add(node.id);
    }

    return { nodes, nodeMap };
  }
}
