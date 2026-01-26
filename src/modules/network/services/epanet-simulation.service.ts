import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { Project, Workspace } from 'epanet-js';
import * as fs from 'fs';
import * as path from 'path';

// NodeProperty enum values from epanet-js
// Using numeric values since direct import has issues
const NodeProperty = {
  BaseDemand: 1,
  Demand: 9,
} as const;

export interface SimulationResults {
  nodeFlows: Map<string, number>; // EPANET node ID -> flow value (L/s)
}

@Injectable()
export class EpanetSimulationService {
  private readonly logger = new Logger(EpanetSimulationService.name);
  private readonly SIMULATION_TIMEOUT = 30000; // 30 seconds
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY = 1000; // 1 second

  /**
   * Load EPANET network from file path with retry logic
   */
  async loadNetwork(
    filePath: string,
  ): Promise<{ project: Project; workspace: Workspace }> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        if (!fs.existsSync(filePath)) {
          throw new BadRequestException(`EPANET file not found: ${filePath}`);
        }

        // Validate file is a valid .inp file
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        if (!fileContent.includes('[JUNCTIONS]') && !fileContent.includes('[PIPES]')) {
          throw new BadRequestException(
            `Invalid EPANET file format: missing required sections`,
          );
        }

        const workspace = new Workspace();
        
        // Load EPANET module before using workspace
        if (!workspace.isLoaded) {
          await workspace.loadModule();
        }
        
        const project = new Project(workspace);

        // Write to workspace
        const fileName = path.basename(filePath);
        workspace.writeFile(fileName, fileContent);

        // Open project
        const reportFile = fileName.replace('.inp', '.rpt');
        const outputFile = fileName.replace('.inp', '.bin');

        project.open(fileName, reportFile, outputFile);

        this.logger.log(`Loaded EPANET network from ${filePath}`);
        return { project, workspace };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        this.logger.warn(
          `Attempt ${attempt}/${this.MAX_RETRIES} failed to load EPANET network: ${lastError.message}`,
        );

        if (attempt < this.MAX_RETRIES) {
          await new Promise((resolve) => setTimeout(resolve, this.RETRY_DELAY));
        }
      }
    }

    this.logger.error(
      `Failed to load EPANET network from ${filePath} after ${this.MAX_RETRIES} attempts: ${lastError?.message}`,
      lastError?.stack,
    );
    throw new BadRequestException(
      `Failed to load EPANET network after ${this.MAX_RETRIES} attempts: ${lastError?.message}`,
    );
  }

  /**
   * Run baseline simulation (no leaks) with error handling
   */
  async runBaselineSimulation(
    project: Project,
    sensorNodeIds: string[], // EPANET node IDs where sensors are located
  ): Promise<Map<string, number>> {
    try {
      this.logger.log(
        `Running baseline simulation for ${sensorNodeIds.length} sensor nodes...`,
      );

      // Run hydraulic simulation with timeout protection
      const simulationPromise = new Promise<void>((resolve, reject) => {
        try {
          project.solveH();
          resolve();
        } catch (error) {
          reject(error);
        }
      });

      await Promise.race([
        simulationPromise,
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error('Simulation timeout')),
            this.SIMULATION_TIMEOUT,
          ),
        ),
      ]);

      // Get flow results for sensor nodes
      const results = new Map<string, number>();
      let successCount = 0;
      let failureCount = 0;

      for (const nodeId of sensorNodeIds) {
        try {
          // Get node index
          const nodeIndex = project.getNodeIndex(nodeId);
          if (nodeIndex <= 0) {
            // EPANET indices start from 1, 0 or negative means not found
            this.logger.warn(
              `Node ${nodeId} not found in EPANET model (index: ${nodeIndex})`,
            );
            failureCount++;
            results.set(nodeId, 0);
            continue;
          }

          // Get computed demand/flow at node (L/s)
          // NodeProperty.Demand = current computed demand (read-only after simulation)
          const demand = project.getNodeValue(nodeIndex, NodeProperty.Demand);
          if (isNaN(demand) || !isFinite(demand)) {
            this.logger.warn(
              `Invalid demand value for node ${nodeId}: ${demand}`,
            );
            results.set(nodeId, 0);
            failureCount++;
          } else {
            results.set(nodeId, demand);
            successCount++;
          }
        } catch (error) {
          this.logger.warn(
            `Failed to get flow for node ${nodeId}: ${error instanceof Error ? error.message : String(error)}`,
          );
          results.set(nodeId, 0);
          failureCount++;
        }
      }

      this.logger.log(
        `Baseline simulation complete: ${successCount} successful, ${failureCount} failed readings`,
      );

      if (successCount === 0) {
        throw new BadRequestException(
          'Baseline simulation completed but no valid sensor readings obtained',
        );
      }

      return results;
    } catch (error) {
      this.logger.error(
        `Baseline simulation failed: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw new BadRequestException(
        `Baseline simulation failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Run simulation with leak at specified node with error handling
   */
  async runLeakSimulation(
    project: Project,
    leakNodeId: string, // EPANET node ID where leak occurs
    leakSize: number, // Leak size in L/s
    sensorNodeIds: string[], // EPANET node IDs where sensors are located
  ): Promise<Map<string, number>> {
    let originalBaseDemand: number = 0;
    let nodeIndex: number = 0;

    try {
      this.logger.debug(
        `Running leak simulation: ${leakSize} L/s at node ${leakNodeId}`,
      );

      // Validate leak size
      if (leakSize <= 0 || !isFinite(leakSize)) {
        throw new BadRequestException(
          `Invalid leak size: ${leakSize}. Must be positive and finite.`,
        );
      }

      // Get node index
      nodeIndex = project.getNodeIndex(leakNodeId);
      if (!nodeIndex || nodeIndex <= 0) {
        throw new BadRequestException(
          `Leak node ${leakNodeId} not found in EPANET model (index: ${nodeIndex})`,
        );
      }

      // Get current base demand at node
      const baseDemandValue = project.getNodeValue(nodeIndex, NodeProperty.BaseDemand);
      originalBaseDemand = baseDemandValue ?? 0;

      // Add leak as additional base demand
      const newBaseDemand = originalBaseDemand + leakSize;
      project.setNodeValue(nodeIndex, NodeProperty.BaseDemand, newBaseDemand);

      // Run hydraulic simulation with timeout protection
      const simulationPromise = new Promise<void>((resolve, reject) => {
        try {
          project.solveH();
          resolve();
        } catch (error) {
          reject(error);
        }
      });

      await Promise.race([
        simulationPromise,
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error('Simulation timeout')),
            this.SIMULATION_TIMEOUT,
          ),
        ),
      ]);

      // Get flow results for sensor nodes
      const results = new Map<string, number>();

      for (const sensorNodeId of sensorNodeIds) {
        try {
          const sensorNodeIndex = project.getNodeIndex(sensorNodeId);
          if (sensorNodeIndex <= 0) {
            this.logger.warn(
              `Sensor node ${sensorNodeId} not found in EPANET model`,
            );
            results.set(sensorNodeId, 0);
            continue;
          }

          const demand = project.getNodeValue(
            sensorNodeIndex,
            NodeProperty.Demand,
          );
          if (isNaN(demand) || !isFinite(demand)) {
            this.logger.warn(
              `Invalid demand value for sensor node ${sensorNodeId}: ${demand}`,
            );
            results.set(sensorNodeId, 0);
          } else {
            results.set(sensorNodeId, demand);
          }
        } catch (error) {
          this.logger.warn(
            `Failed to get flow for sensor node ${sensorNodeId}: ${error instanceof Error ? error.message : String(error)}`,
          );
          results.set(sensorNodeId, 0);
        }
      }

      return results;
    } catch (error) {
      this.logger.error(
        `Leak simulation failed for node ${leakNodeId}: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw new BadRequestException(
        `Leak simulation failed for node ${leakNodeId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      // Always restore original base demand
      if (nodeIndex > 0) {
        try {
          project.setNodeValue(
            nodeIndex,
            NodeProperty.BaseDemand,
            originalBaseDemand,
          );
        } catch (restoreError) {
          this.logger.error(
            `Failed to restore original demand for node ${leakNodeId}: ${restoreError instanceof Error ? restoreError.message : String(restoreError)}`,
          );
        }
      }
    }
  }

  /**
   * Calculate sensitivity values from baseline and leak simulation results
   */
  calculateSensitivity(
    baseline: Map<string, number>,
    withLeak: Map<string, number>,
    leakSize: number,
  ): Map<string, number> {
    const sensitivity = new Map<string, number>();

    for (const [sensorNodeId, baselineValue] of baseline.entries()) {
      const leakValue = withLeak.get(sensorNodeId) || 0;
      const change = leakValue - baselineValue;
      
      // Sensitivity = change in sensor reading / leak size
      // Units: (L/s) / (L/s) = dimensionless
      const sensitivityValue = leakSize > 0 ? change / leakSize : 0;
      sensitivity.set(sensorNodeId, sensitivityValue);
    }

    return sensitivity;
  }

  /**
   * Close project and cleanup
   */
  closeProject(project: Project): void {
    try {
      project.close();
    } catch (error) {
      this.logger.warn(`Error closing EPANET project: ${error.message}`);
    }
  }
}
