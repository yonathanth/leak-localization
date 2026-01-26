-- CreateEnum
CREATE TYPE "LeakSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "LeakStatus" AS ENUM ('DETECTED', 'CONFIRMED', 'LOCALIZED', 'RESOLVED', 'FALSE_POSITIVE');

-- CreateTable
CREATE TABLE "leak_detections" (
    "id" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "partitionId" TEXT,
    "flowImbalance" DOUBLE PRECISION NOT NULL,
    "severity" "LeakSeverity" NOT NULL,
    "status" "LeakStatus" NOT NULL DEFAULT 'DETECTED',
    "detectedAt" TIMESTAMP(3) NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "timeWindow" INTEGER,
    "threshold" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leak_detections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "leak_detections_nodeId_idx" ON "leak_detections"("nodeId");

-- CreateIndex
CREATE INDEX "leak_detections_partitionId_idx" ON "leak_detections"("partitionId");

-- CreateIndex
CREATE INDEX "leak_detections_status_idx" ON "leak_detections"("status");

-- CreateIndex
CREATE INDEX "leak_detections_detectedAt_idx" ON "leak_detections"("detectedAt");

-- CreateIndex
CREATE INDEX "leak_detections_severity_idx" ON "leak_detections"("severity");

-- AddForeignKey
ALTER TABLE "leak_detections" ADD CONSTRAINT "leak_detections_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "network_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leak_detections" ADD CONSTRAINT "leak_detections_partitionId_fkey" FOREIGN KEY ("partitionId") REFERENCES "network_partitions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
