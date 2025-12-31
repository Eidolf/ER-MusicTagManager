# Architecture Documentation

## Overview
ER-MusicTagManager is designed using Domain-Driven Design (DDD) principles to ensure modularity and maintainability.

## Layers

### 1. Domain Layer (`app/domain`)
Contains the core business logic and entities.
- **Models**: `Album`, `MusicFile`.
- **Logic**: Pure Python code, no external dependencies.

### 2. Infrastructure Layer (`app/infrastructure`)
Handles external concerns.
- **MusicBrainzClient**: Communicates with the MusicBrainz API.
- **FileSystemRepository**: Handles file operations (read, move, rename).

### 3. Application/API Layer (`app/api`)
Exposes the domain logic via REST endpoints.
- **FastAPI**: Handles requests and response serialization.

### 4. Frontend Layer (`frontend/src`)
React-based UI for interacting with the system.
- **Components**: Reusable UI elements.
- **Dashboard**: Main control center.

## Deployment
The application is containerized using Docker.
- **Backend**: Python 3.11 Slim.
- **Frontend**: Nginx Alpine serving React static build.
