# Testing Flow Guide

This document provides a step-by-step guide to test the complete leak detection and localization system.

## Prerequisites

1. **Start the application:**
   ```bash
   npm run start:dev
   ```

2. **Access Swagger UI:**
   - Open browser to: `http://localhost:3000/api`
   - This provides interactive API documentation

3. **Prepare an EPANET file:**
   - Have a valid `.inp` file ready (e.g., `net1.inp` or your network file)

## Complete Testing Flow

### Step 1: Health Check
**Verify the API is running and database is connected**

```bash
GET http://localhost:3000/api/health
```

**Expected Response:**
```json
{
  "status": "ok",
  "database": "connected"
}
```

---

### Step 2: Import EPANET Network
**Import your water distribution network from an EPANET file**

**Using Swagger UI:**
1. Navigate to `POST /api/network/import/epanet`
2. Click "Try it out"
3. Upload your `.inp` file
4. Click "Execute"

**Using cURL:**
```bash
curl -X POST "http://localhost:3000/api/network/import/epanet" \
  -H "accept: application/json" \
  -H "Content-Type: multipart/form-data" \
  -F "file=@path/to/your/network.inp"
```

**Expected Response:**
```json
{
  "message": "Network imported successfully",
  "networkId": "c34ae2f7-327a-42d2-a379-3fee13019df0",
  "nodesCreated": 10,
  "linksCreated": 12
}
```

**Save the `networkId` for later steps!**

---

### Step 3: Verify Network Import
**Check that nodes were created correctly**

```bash
GET http://localhost:3000/api/network/nodes
```

**Expected Response:**
```json
{
  "data": [
    {
      "id": "...",
      "nodeId": "J1",
      "type": "JUNCTION",
      "epanetNodeId": "J1",
      ...
    }
  ],
  "total": 10
}
```

---

### Step 4: Auto-Place Sensors
**Automatically place sensors on mainlines and households**

**Using Swagger UI:**
1. Navigate to `POST /api/sensors/auto-place`
2. Click "Try it out"
3. Optionally add `networkId` query parameter (from Step 2)
4. Click "Execute"

**Using cURL:**
```bash
curl -X POST "http://localhost:3000/api/sensors/auto-place?networkId=YOUR_NETWORK_ID" \
  -H "accept: application/json"
```

**Expected Response:**
```json
{
  "message": "Sensors placed successfully",
  "sensorsCreated": 5,
  "sensors": [
    {
      "id": "...",
      "sensorId": "SENSOR_001",
      "nodeId": "J1",
      ...
    }
  ]
}
```

---

### Step 5: Verify Sensors
**List all placed sensors**

```bash
GET http://localhost:3000/api/sensors
```

**Expected Response:**
```json
{
  "data": [
    {
      "id": "...",
      "sensorId": "SENSOR_001",
      "nodeId": "J1",
      "location": {...}
    }
  ],
  "total": 5
}
```

---

### Step 6: Generate Sensitivity Matrix
**Generate the sensitivity matrix for leak localization (this may take several minutes)**

**Using Swagger UI:**
1. Navigate to `POST /api/network/sensitivity-matrix/generate`
2. Click "Try it out"
3. Add `networkId` query parameter (from Step 2)
4. Optionally set `force=true` to regenerate
5. Click "Execute"

**Using cURL:**
```bash
curl -X POST "http://localhost:3000/api/network/sensitivity-matrix/generate?networkId=YOUR_NETWORK_ID&force=false" \
  -H "accept: application/json"
```

**Expected Response:**
```json
{
  "message": "Sensitivity matrix generation started",
  "status": "in_progress"
}
```

**Note:** This is an async operation. The matrix generation may take time depending on network size.

---

### Step 7: Check Sensitivity Matrix Status
**Monitor the generation progress**

```bash
GET http://localhost:3000/api/network/sensitivity-matrix/status
```

**Expected Responses:**

**While generating:**
```json
{
  "status": "in_progress",
  "progress": {
    "nodesProcessed": 5,
    "totalNodes": 10,
    "percentage": 50
  }
}
```

**When completed:**
```json
{
  "status": "completed",
  "progress": {
    "nodesProcessed": 10,
    "totalNodes": 10,
    "percentage": 100
  },
  "matrixStats": {
    "exists": true,
    "totalEntries": 50,
    "lastComputed": "2026-01-27T00:00:00.000Z"
  }
}
```

**Keep checking until status is "completed" before proceeding.**

---

### Step 8: Get Sensitivity Matrix Statistics
**Verify the matrix was generated correctly**

```bash
GET http://localhost:3000/api/network/sensitivity-matrix/stats
```

**Expected Response:**
```json
{
  "exists": true,
  "totalEntries": 50,
  "lastComputed": "2026-01-27T00:00:00.000Z"
}
```

---

### Step 9: Ingest Sensor Readings
**Submit sensor readings (simulating real sensor data)**

**Option A: Single Reading**
```bash
POST http://localhost:3000/api/readings
Content-Type: application/json

{
  "sensorId": "SENSOR_001",
  "timestamp": "2026-01-27T12:00:00Z",
  "flowRate": 15.5
}
```

**Option B: Batch Readings (Recommended)**
```bash
POST http://localhost:3000/api/readings/batch
Content-Type: application/json

{
  "readings": [
    {
      "sensorId": "SENSOR_001",
      "timestamp": "2026-01-27T12:00:00Z",
      "flowRate": 15.5
    },
    {
      "sensorId": "SENSOR_002",
      "timestamp": "2026-01-27T12:00:00Z",
      "flowRate": 12.3
    },
    {
      "sensorId": "SENSOR_003",
      "timestamp": "2026-01-27T12:00:00Z",
      "flowRate": 18.7
    }
  ]
}
```

**Expected Response:**
```json
{
  "message": "Readings created successfully",
  "count": 3,
  "readings": [...]
}
```

---

### Step 10: Run Leak Detection
**Detect leaks using mass balance calculations**

```bash
POST http://localhost:3000/api/leaks/detect
Content-Type: application/json

{
  "timestamp": "2026-01-27T12:00:00Z"
}
```

**Expected Response:**
```json
{
  "detected": true,
  "leakFlow": 2.5,
  "timestamp": "2026-01-27T12:00:00Z",
  "detection": {
    "id": "...",
    "leakFlow": 2.5,
    "detectedAt": "2026-01-27T12:00:00Z",
    ...
  }
}
```

---

### Step 11: Localize Leak
**Use sensitivity matrix to find leak location**

```bash
POST http://localhost:3000/api/leaks/localize
Content-Type: application/json

{
  "detectionId": "DETECTION_ID_FROM_STEP_10",
  "timestamp": "2026-01-27T12:00:00Z"
}
```

**Expected Response:**
```json
{
  "localized": true,
  "candidates": [
    {
      "nodeId": "J5",
      "epanetNodeId": "J5",
      "confidence": 0.85,
      "sensitivity": 0.42
    },
    {
      "nodeId": "J6",
      "epanetNodeId": "J6",
      "confidence": 0.72,
      "sensitivity": 0.38
    }
  ],
  "detection": {...}
}
```

---

### Step 12: Combined Analysis (Alternative)
**Detect and localize in one step**

```bash
POST http://localhost:3000/api/leaks/analyze
Content-Type: application/json

{
  "readings": [
    {
      "sensorId": "SENSOR_001",
      "timestamp": "2026-01-27T12:00:00Z",
      "flowRate": 15.5
    },
    {
      "sensorId": "SENSOR_002",
      "timestamp": "2026-01-27T12:00:00Z",
      "flowRate": 12.3
    }
  ]
}
```

**Expected Response:**
```json
{
  "detected": true,
  "localized": true,
  "leakFlow": 2.5,
  "candidates": [
    {
      "nodeId": "J5",
      "confidence": 0.85
    }
  ],
  "detection": {...}
}
```

---

### Step 13: Query Leak Detections
**View all leak detections**

```bash
GET http://localhost:3000/api/leaks/detections
```

**With filters:**
```bash
GET http://localhost:3000/api/leaks/detections?startDate=2026-01-27T00:00:00Z&endDate=2026-01-27T23:59:59Z
```

**Get latest detection:**
```bash
GET http://localhost:3000/api/leaks/detections/latest
```

---

## Quick Test Script

Here's a quick test sequence you can run:

```bash
# 1. Health check
curl http://localhost:3000/api/health

# 2. Import network (replace with your file path)
curl -X POST "http://localhost:3000/api/network/import/epanet" \
  -F "file=@net1.inp"

# 3. Auto-place sensors (use networkId from step 2)
curl -X POST "http://localhost:3000/api/sensors/auto-place?networkId=YOUR_NETWORK_ID"

# 4. Generate sensitivity matrix
curl -X POST "http://localhost:3000/api/network/sensitivity-matrix/generate?networkId=YOUR_NETWORK_ID"

# 5. Check status (repeat until completed)
curl http://localhost:3000/api/network/sensitivity-matrix/status

# 6. Submit readings
curl -X POST "http://localhost:3000/api/readings/batch" \
  -H "Content-Type: application/json" \
  -d '{"readings": [...]}'

# 7. Detect leaks
curl -X POST "http://localhost:3000/api/leaks/detect" \
  -H "Content-Type: application/json" \
  -d '{"timestamp": "2026-01-27T12:00:00Z"}'

# 8. Localize leak
curl -X POST "http://localhost:3000/api/leaks/localize" \
  -H "Content-Type: application/json" \
  -d '{"detectionId": "DETECTION_ID", "timestamp": "2026-01-27T12:00:00Z"}'
```

## Troubleshooting

### EPANET Module Loading Error
If you see "EPANET engine not loaded" error:
- ✅ **Fixed!** The code now automatically loads the EPANET module before use
- Restart the application if you still see this error

### Sensitivity Matrix Generation Fails
- Ensure sensors are placed before generating the matrix
- Check that all sensors have valid `epanetNodeId` values
- Verify the EPANET file is still accessible in storage

### No Leaks Detected
- Ensure sensor readings show a flow imbalance
- Check that readings are from the same timestamp
- Verify sensors are placed on mainlines (inflow/outflow points)

### Localization Returns Empty Results
- Ensure sensitivity matrix generation completed successfully
- Verify the detection has a valid `leakFlow` value
- Check that sensors have valid EPANET node IDs

## Notes

- **Sensitivity Matrix Generation** is computationally intensive and may take several minutes for large networks
- **Sensor Readings** should be from the same timestamp for accurate leak detection
- **Network ID** is important - save it after import for subsequent operations
- Use **Swagger UI** at `http://localhost:3000/api` for interactive testing
