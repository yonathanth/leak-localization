-- CreateEnum
CREATE TYPE "NodeType" AS ENUM ('MAINLINE', 'BRANCH', 'JUNCTION', 'HOUSEHOLD');

-- CreateEnum
CREATE TYPE "SensorType" AS ENUM ('MAINLINE_FLOW', 'BRANCH_JUNCTION_FLOW', 'HOUSEHOLD_FLOW');

-- CreateEnum
CREATE TYPE "DataSource" AS ENUM ('MANUAL', 'CSV', 'EPANET', 'SENSOR');

-- CreateTable
CREATE TABLE "network_nodes" (
    "id" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "nodeType" "NodeType" NOT NULL,
    "parentId" TEXT,
    "zoneCode" TEXT,
    "branchCode" TEXT,
    "sequenceNumber" INTEGER,
    "epanetNodeId" TEXT,
    "location" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "network_nodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "network_partitions" (
    "id" TEXT NOT NULL,
    "partitionId" TEXT NOT NULL,
    "mainlineId" TEXT NOT NULL,
    "name" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "network_partitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sensors" (
    "id" TEXT NOT NULL,
    "sensorId" TEXT NOT NULL,
    "sensorType" "SensorType" NOT NULL,
    "nodeId" TEXT NOT NULL,
    "partitionId" TEXT,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sensors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sensor_readings" (
    "id" TEXT NOT NULL,
    "sensorId" TEXT NOT NULL,
    "flowValue" DOUBLE PRECISION NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "source" "DataSource" NOT NULL DEFAULT 'MANUAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sensor_readings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "network_nodes_nodeId_key" ON "network_nodes"("nodeId");

-- CreateIndex
CREATE INDEX "network_nodes_parentId_idx" ON "network_nodes"("parentId");

-- CreateIndex
CREATE INDEX "network_nodes_nodeType_idx" ON "network_nodes"("nodeType");

-- CreateIndex
CREATE INDEX "network_nodes_zoneCode_branchCode_idx" ON "network_nodes"("zoneCode", "branchCode");

-- CreateIndex
CREATE UNIQUE INDEX "network_partitions_partitionId_key" ON "network_partitions"("partitionId");

-- CreateIndex
CREATE UNIQUE INDEX "network_partitions_mainlineId_key" ON "network_partitions"("mainlineId");

-- CreateIndex
CREATE UNIQUE INDEX "sensors_sensorId_key" ON "sensors"("sensorId");

-- CreateIndex
CREATE INDEX "sensors_nodeId_idx" ON "sensors"("nodeId");

-- CreateIndex
CREATE INDEX "sensors_partitionId_idx" ON "sensors"("partitionId");

-- CreateIndex
CREATE INDEX "sensors_sensorType_idx" ON "sensors"("sensorType");

-- CreateIndex
CREATE INDEX "sensor_readings_sensorId_timestamp_idx" ON "sensor_readings"("sensorId", "timestamp");

-- CreateIndex
CREATE INDEX "sensor_readings_timestamp_idx" ON "sensor_readings"("timestamp");

-- CreateIndex
CREATE INDEX "sensor_readings_sensorId_idx" ON "sensor_readings"("sensorId");

-- AddForeignKey
ALTER TABLE "network_nodes" ADD CONSTRAINT "network_nodes_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "network_nodes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "network_partitions" ADD CONSTRAINT "network_partitions_mainlineId_fkey" FOREIGN KEY ("mainlineId") REFERENCES "network_nodes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sensors" ADD CONSTRAINT "sensors_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "network_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sensors" ADD CONSTRAINT "sensors_partitionId_fkey" FOREIGN KEY ("partitionId") REFERENCES "network_partitions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sensor_readings" ADD CONSTRAINT "sensor_readings_sensorId_fkey" FOREIGN KEY ("sensorId") REFERENCES "sensors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
