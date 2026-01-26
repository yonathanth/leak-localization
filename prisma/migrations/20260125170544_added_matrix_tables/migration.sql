-- CreateTable
CREATE TABLE "sensitivity_matrix" (
    "id" TEXT NOT NULL,
    "leakNodeId" TEXT NOT NULL,
    "sensorId" TEXT NOT NULL,
    "sensitivityValue" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sensitivity_matrix_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sensitivity_matrix_leakNodeId_idx" ON "sensitivity_matrix"("leakNodeId");

-- CreateIndex
CREATE INDEX "sensitivity_matrix_sensorId_idx" ON "sensitivity_matrix"("sensorId");

-- CreateIndex
CREATE UNIQUE INDEX "sensitivity_matrix_leakNodeId_sensorId_key" ON "sensitivity_matrix"("leakNodeId", "sensorId");

-- AddForeignKey
ALTER TABLE "sensitivity_matrix" ADD CONSTRAINT "sensitivity_matrix_leakNodeId_fkey" FOREIGN KEY ("leakNodeId") REFERENCES "network_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sensitivity_matrix" ADD CONSTRAINT "sensitivity_matrix_sensorId_fkey" FOREIGN KEY ("sensorId") REFERENCES "sensors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
