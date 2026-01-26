# Water Leak Detection System API

A NestJS-based API for detecting and localizing leaks in water distribution networks using flow sensors.

## Tech Stack

- **Framework**: NestJS 11
- **Database**: PostgreSQL (Neon)
- **ORM**: Prisma
- **Documentation**: Swagger/OpenAPI
- **Language**: TypeScript

## Features

- Network topology management (mainlines, branches, junctions, households)
- EPANET file import for network topology
- Network partitioning (automatic DMA creation)
- Sensor registration and management
- Automatic sensor placement
- Manual sensor reading ingestion (single and batch)
- Leak detection using mass balance calculations
- Leak localization using sensitivity matrix
- Sensitivity matrix generation with EPANET simulations
- Health check endpoints
- Full Swagger API documentation

## Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- PostgreSQL database (Neon recommended)

## Installation

1. Install dependencies:
```bash
npm install --legacy-peer-deps
```

2. Set up environment variables:
```bash
cp .env.example .env
```

Edit `.env` and add your Neon PostgreSQL connection string:
```
DATABASE_URL="postgresql://user:password@host:5432/database?sslmode=require"
PORT=3000
NODE_ENV=development
```

3. Generate Prisma client:
```bash
npm run prisma:generate
```

4. Run database migrations:
```bash
npm run prisma:migrate
```

## Running the Application

```bash
# Development mode
npm run start:dev

# Production mode
npm run start:prod
```

The API will be available at `http://localhost:3000/api`

## API Documentation

Once the application is running, access Swagger UI at:
- **Swagger UI**: http://localhost:3000/api

## Project Structure

```
src/
├── common/           # Shared utilities (filters, pipes, interceptors, DTOs)
├── config/           # Configuration files
├── database/         # Prisma service and module
├── modules/          # Feature modules
│   ├── health/       # Health check endpoints
│   ├── network/      # Network topology management & EPANET import
│   ├── sensors/      # Sensor registration & auto-placement
│   ├── readings/     # Sensor reading ingestion
│   └── leaks/        # Leak detection & localization
└── main.ts           # Application entry point
```

## API Endpoints

### Health
- `GET /api/health` - Health check with database status

### Network
- `POST /api/network/nodes` - Create network node
- `GET /api/network/nodes` - List all network nodes
- `GET /api/network/nodes/:id` - Get node by ID
- `GET /api/network/nodes/node-id/:nodeId` - Get node by nodeId
- `POST /api/network/import/epanet` - Import network from EPANET file
- `POST /api/network/sensitivity-matrix/generate` - Generate sensitivity matrix
- `GET /api/network/sensitivity-matrix/status` - Get matrix generation status
- `GET /api/network/sensitivity-matrix/stats` - Get matrix statistics

### Sensors
- `POST /api/sensors` - Register sensor
- `GET /api/sensors` - List all sensors
- `GET /api/sensors/:id` - Get sensor by ID
- `GET /api/sensors/sensor-id/:sensorId` - Get sensor by sensorId
- `POST /api/sensors/auto-place` - Automatically place sensors

### Readings
- `POST /api/readings` - Create single reading
- `POST /api/readings/batch` - Create batch readings
- `GET /api/readings` - Query readings (with filters)
- `GET /api/readings/:id` - Get reading by ID

### Leaks
- `POST /api/leaks/detect` - Run leak detection
- `GET /api/leaks/detections` - Query leak detections (with filters)
- `GET /api/leaks/detections/:id` - Get leak detection by ID
- `GET /api/leaks/detections/latest` - Get most recent detections
- `POST /api/leaks/localize` - Localize leak(s) using sensitivity matrix
- `GET /api/leaks/detections/:id/localize` - Get localization candidates
- `POST /api/leaks/analyze` - Analyze leaks (detect + localize)

## Database Schema

The application uses Prisma with the following main models:
- `NetworkNode` - Hierarchical network structure
- `NetworkPartition` - District Metered Areas (DMAs)
- `Sensor` - Flow sensors at various locations
- `SensorReading` - Time-series flow data

## Development

```bash
# Generate Prisma client
npm run prisma:generate

# Run migrations
npm run prisma:migrate

# Open Prisma Studio
npm run prisma:studio

# Run tests
npm run test

# Lint code
npm run lint
```

## Phase 1 Status

✅ NestJS project initialized
✅ Prisma schema created
✅ Database module setup
✅ Swagger documentation configured
✅ Common utilities (filters, pipes, interceptors)
✅ Health module
✅ Network module (CRUD operations)
✅ Sensors module
✅ Readings module (single + batch)

## Phase 2 Status

✅ Network topology loading from EPANET files
✅ Network partitioning (automatic DMA creation)
✅ Leak detection (mass balance calculations)
✅ Leak localization (sensitivity matrix)
✅ Sensitivity matrix generation with EPANET simulations
✅ Automatic sensor placement
✅ Combined leak analysis (detect + localize)

## License

MIT
