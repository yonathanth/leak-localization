import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly storageDir = path.join(process.cwd(), 'storage', 'epanet');

  constructor() {
    this.ensureStorageDirectory();
  }

  private ensureStorageDirectory(): void {
    try {
      if (!fs.existsSync(this.storageDir)) {
        fs.mkdirSync(this.storageDir, { recursive: true });
        this.logger.log(`Created storage directory: ${this.storageDir}`);
      }
    } catch (error) {
      this.logger.error(
        `Failed to create storage directory: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async saveEpanetFile(
    networkId: string,
    fileBuffer: Buffer,
  ): Promise<string> {
    try {
      // Validate networkId
      if (!networkId || networkId.trim().length === 0) {
        throw new Error('Network ID is required');
      }

      // Validate file buffer
      if (!fileBuffer || fileBuffer.length === 0) {
        throw new Error('File buffer is empty');
      }

      // Validate .inp file format (basic check)
      const fileContent = fileBuffer.toString('utf-8');
      if (
        !fileContent.includes('[JUNCTIONS]') &&
        !fileContent.includes('[PIPES]')
      ) {
        throw new Error(
          'Invalid EPANET file format: missing required sections [JUNCTIONS] or [PIPES]',
        );
      }

      const filePath = this.getEpanetFilePath(networkId);
      fs.writeFileSync(filePath, fileBuffer);
      this.logger.log(`Saved EPANET file: ${filePath} (${fileBuffer.length} bytes)`);
      return filePath;
    } catch (error) {
      this.logger.error(
        `Failed to save EPANET file for network ${networkId}: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw new Error(
        `Failed to save EPANET file: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  getEpanetFilePath(networkId: string): string {
    return path.join(this.storageDir, `${networkId}.inp`);
  }

  async deleteEpanetFile(networkId: string): Promise<void> {
    try {
      const filePath = this.getEpanetFilePath(networkId);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        this.logger.log(`Deleted EPANET file: ${filePath}`);
      }
    } catch (error) {
      this.logger.error(
        `Failed to delete EPANET file for network ${networkId}: ${error.message}`,
        error.stack,
      );
      throw new Error(
        `Failed to delete EPANET file: ${error.message}`,
      );
    }
  }

  fileExists(networkId: string): boolean {
    const filePath = this.getEpanetFilePath(networkId);
    return fs.existsSync(filePath);
  }
}
