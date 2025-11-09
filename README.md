# Simple Adhesion API

A lightweight Express.js API for managing adhesions to the La instrumental manifest.

## Getting Started

### Setup

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables in `.env` (see `.env.example` for template):
```
HOST=0.0.0.0
PORT=1337
DATABASE_HOST=postgres
DATABASE_PORT=5432
DATABASE_NAME=lainstrumental
DATABASE_USERNAME=user
DATABASE_PASSWORD=password
DATABASE_SSL=false
```

### Running the Server

Development:
```bash
npm run dev
```

Production:
```bash
npm start
```

The server will start at `http://localhost:1337`

## API Endpoints

### POST /api/adhesions
Submit a new adhesion to the manifest.

**Request Body:**
```json
{
  "name": "John Doe",
  "email": "john@example.com"
}
```

**Response:**
```json
{
  "data": {
    "id": 1,
    "name": "John Doe",
    "email": "john@example.com",
    "created_at": "2025-01-08T12:00:00Z"
  }
}
```

### GET /api/health
Health check endpoint.

**Response:**
```json
{
  "status": "ok"
}
```

## Database

The API automatically creates the `adhesions` table on startup with the following schema:
- `id` (PRIMARY KEY)
- `name` (VARCHAR 255)
- `email` (VARCHAR 255)
- `created_at` (TIMESTAMP)
