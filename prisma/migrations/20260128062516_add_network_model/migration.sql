-- Drop all existing tables (since we're wiping test data)
DROP TABLE IF EXISTS "leak_detections" CASCADE;
DROP TABLE IF EXISTS "sensitivity_matrix" CASCADE;
DROP TABLE IF EXISTS "sensor_readings" CASCADE;
DROP TABLE IF EXISTS "sensors" CASCADE;
DROP TABLE IF EXISTS "network_partitions" CASCADE;
DROP TABLE IF EXISTS "network_nodes" CASCADE;

-- CreateTable: Network
CREATE TABLE "networks" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "description" TEXT,
    "epanetFileId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "networks_pkey" PRIMARY KEY ("id")
);

-- CreateTable: NetworkNode
CREATE TABLE "network_nodes" (
    "id" TEXT NOT NULL,
    "networkId" TEXT NOT NULL,
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

-- CreateTable: NetworkPartition
CREATE TABLE "network_partitions" (
    "id" TEXT NOT NULL,
    "networkId" TEXT NOT NULL,
    "partitionId" TEXT NOT NULL,
    "mainlineId" TEXT NOT NULL,
    "name" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "network_partitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Sensor
CREATE TABLE "sensors" (
    "id" TEXT NOT NULL,
    "networkId" TEXT NOT NULL,
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

-- CreateTable: SensorReading
CREATE TABLE "sensor_readings" (
    "id" TEXT NOT NULL,
    "networkId" TEXT NOT NULL,
    "sensorId" TEXT NOT NULL,
    "flowValue" DOUBLE PRECISION NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "source" "DataSource" NOT NULL DEFAULT 'MANUAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sensor_readings_pkey" PRIMARY KEY ("id")
);

-- CreateTable: SensitivityMatrix
CREATE TABLE "sensitivity_matrix" (
    "id" TEXT NOT NULL,
    "networkId" TEXT NOT NULL,
    "leakNodeId" TEXT NOT NULL,
    "sensorId" TEXT NOT NULL,
    "sensitivityValue" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sensitivity_matrix_pkey" PRIMARY KEY ("id")
);

-- CreateTable: LeakDetection
CREATE TABLE "leak_detections" (
    "id" TEXT NOT NULL,
    "networkId" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "partitionId" TEXT,
    "flowImbalance" DOUBLE PRECISION NOT NULL,
    "severity" "LeakSeverity" NOT NULL,
    "status" "LeakStatus" NOT NULL DEFAULT 'DETECTED',
    "detectedAt" TIMESTAMP(3) NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "timeWindow" INTEGER,
    "threshold" DOUBLE PRECISION,
    "localizedNodeId" TEXT,
    "localizationScore" DOUBLE PRECISION,
    "localizedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leak_detections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "network_nodes_networkId_nodeId_key" ON "network_nodes"("networkId", "nodeId");

-- CreateIndex
CREATE INDEX "network_nodes_networkId_idx" ON "network_nodes"("networkId");

-- CreateIndex
CREATE INDEX "network_nodes_networkId_nodeType_idx" ON "network_nodes"("networkId", "nodeType");

-- CreateIndex
CREATE INDEX "network_nodes_parentId_idx" ON "network_nodes"("parentId");

-- CreateIndex
CREATE INDEX "network_nodes_nodeType_idx" ON "network_nodes"("nodeType");

-- CreateIndex
CREATE INDEX "network_nodes_zoneCode_branchCode_idx" ON "network_nodes"("zoneCode", "branchCode");

-- CreateIndex
CREATE UNIQUE INDEX "network_partitions_networkId_partitionId_key" ON "network_partitions"("networkId", "partitionId");

-- CreateIndex
CREATE UNIQUE INDEX "network_partitions_mainlineId_key" ON "network_partitions"("mainlineId");

-- CreateIndex
CREATE INDEX "network_partitions_networkId_idx" ON "network_partitions"("networkId");

-- CreateIndex
CREATE UNIQUE INDEX "sensors_networkId_sensorId_key" ON "sensors"("networkId", "sensorId");

-- CreateIndex
CREATE INDEX "sensors_networkId_idx" ON "sensors"("networkId");

-- CreateIndex
CREATE INDEX "sensors_nodeId_idx" ON "sensors"("nodeId");

-- CreateIndex
CREATE INDEX "sensors_partitionId_idx" ON "sensors"("partitionId");

-- CreateIndex
CREATE INDEX "sensors_sensorType_idx" ON "sensors"("sensorType");

-- CreateIndex
CREATE INDEX "sensor_readings_networkId_timestamp_idx" ON "sensor_readings"("networkId", "timestamp");

-- CreateIndex
CREATE INDEX "sensor_readings_sensorId_timestamp_idx" ON "sensor_readings"("sensorId", "timestamp");

-- CreateIndex
CREATE INDEX "sensor_readings_timestamp_idx" ON "sensor_readings"("timestamp");

-- CreateIndex
CREATE INDEX "sensor_readings_sensorId_idx" ON "sensor_readings"("sensorId");

-- CreateIndex
CREATE UNIQUE INDEX "sensitivity_matrix_networkId_leakNodeId_sensorId_key" ON "sensitivity_matrix"("networkId", "leakNodeId", "sensorId");

-- CreateIndex
CREATE INDEX "sensitivity_matrix_networkId_idx" ON "sensitivity_matrix"("networkId");

-- CreateIndex
CREATE INDEX "sensitivity_matrix_leakNodeId_idx" ON "sensitivity_matrix"("leakNodeId");

-- CreateIndex
CREATE INDEX "sensitivity_matrix_sensorId_idx" ON "sensitivity_matrix"("sensorId");

-- CreateIndex
CREATE INDEX "leak_detections_networkId_idx" ON "leak_detections"("networkId");

-- CreateIndex
CREATE INDEX "leak_detections_networkId_status_idx" ON "leak_detections"("networkId", "status");

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
ALTER TABLE "network_nodes" ADD CONSTRAINT "network_nodes_networkId_fkey" FOREIGN KEY ("networkId") REFERENCES "networks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "network_nodes" ADD CONSTRAINT "network_nodes_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "network_nodes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "network_partitions" ADD CONSTRAINT "network_partitions_networkId_fkey" FOREIGN KEY ("networkId") REFERENCES "networks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "network_partitions" ADD CONSTRAINT "network_partitions_mainlineId_fkey" FOREIGN KEY ("mainlineId") REFERENCES "network_nodes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sensors" ADD CONSTRAINT "sensors_networkId_fkey" FOREIGN KEY ("networkId") REFERENCES "networks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sensors" ADD CONSTRAINT "sensors_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "network_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sensors" ADD CONSTRAINT "sensors_partitionId_fkey" FOREIGN KEY ("partitionId") REFERENCES "network_partitions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sensor_readings" ADD CONSTRAINT "sensor_readings_networkId_fkey" FOREIGN KEY ("networkId") REFERENCES "networks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sensor_readings" ADD CONSTRAINT "sensor_readings_sensorId_fkey" FOREIGN KEY ("sensorId") REFERENCES "sensors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sensitivity_matrix" ADD CONSTRAINT "sensitivity_matrix_networkId_fkey" FOREIGN KEY ("networkId") REFERENCES "networks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sensitivity_matrix" ADD CONSTRAINT "sensitivity_matrix_leakNodeId_fkey" FOREIGN KEY ("leakNodeId") REFERENCES "network_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sensitivity_matrix" ADD CONSTRAINT "sensitivity_matrix_sensorId_fkey" FOREIGN KEY ("sensorId") REFERENCES "sensors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leak_detections" ADD CONSTRAINT "leak_detections_networkId_fkey" FOREIGN KEY ("networkId") REFERENCES "networks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leak_detections" ADD CONSTRAINT "leak_detections_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "network_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leak_detections" ADD CONSTRAINT "leak_detections_partitionId_fkey" FOREIGN KEY ("partitionId") REFERENCES "network_partitions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
