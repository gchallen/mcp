# Docker Support for MCP Everything Server

This document describes how to build and run the MCP Everything Server using Docker.

## Prerequisites

- Docker Engine 20.10 or later
- Docker Compose 2.0 or later (for docker-compose usage)
- Node.js 22.x (for local development)

## Quick Start

### Using Docker Compose (Recommended for Development)

1. **Start the services:**

   ```bash
   docker-compose up -d
   ```

   This will:
   - Build the MCP server image
   - Start Redis
   - Start the MCP server on port 3000

2. **View logs:**

   ```bash
   docker-compose logs -f mcp-server
   ```

3. **Stop the services:**
   ```bash
   docker-compose down
   ```

### Building the Docker Image Manually

```bash
# Build the image
docker build -t mcp-server-everything:latest .

# Run the container (requires Redis)
docker run -d \
  --name mcp-server \
  -p 3000:3000 \
  -e REDIS_URL=redis://your-redis-host:6379 \
  -e NODE_ENV=production \
  -e LOG_LEVEL=INFO \
  mcp-server-everything:latest
```

## Production Deployment

### Using Docker Compose for Production

1. **Create a `.env` file with your production settings:**

   ```env
   REDIS_URL=redis://your-redis-instance:6379
   CLIENT_SECRET=your-client-secret
   GOOGLE_CLOUD_PROJECT=your-project-id
   ```

2. **Deploy using the production compose file:**
   ```bash
   docker-compose -f docker-compose.production.yml up -d
   ```

### Cloud Run Deployment

The Dockerfile is optimized for Google Cloud Run:

```bash
# Build and push to Google Container Registry
gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/mcp-server-everything

# Deploy to Cloud Run
gcloud run deploy mcp-server-everything \
  --image gcr.io/YOUR_PROJECT_ID/mcp-server-everything \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars="REDIS_URL=your-redis-url,NODE_ENV=production"
```

## Environment Variables

The following environment variables can be configured:

| Variable               | Description                                    | Default                  |
| ---------------------- | ---------------------------------------------- | ------------------------ |
| `NODE_ENV`             | Environment mode (development/test/production) | `development`            |
| `LOG_LEVEL`            | Logging level (DEBUG/INFO/WARNING/ERROR)       | Based on NODE_ENV        |
| `REDIS_URL`            | Redis connection URL                           | `redis://localhost:6379` |
| `PORT`                 | Server port                                    | `3000`                   |
| `CLIENT_SECRET`        | OAuth client secret                            | -                        |
| `GOOGLE_CLOUD_PROJECT` | GCP project ID                                 | -                        |

## Health Check

The server exposes a health check endpoint at `/health` that verifies:

- Server is running
- Redis connection is active

Example response:

```json
{
  "status": "healthy",
  "timestamp": "2024-01-20T10:30:00.000Z",
  "service": "mcp-server-everything",
  "redis": "connected"
}
```

## Docker Image Details

The Docker image uses a multi-stage build:

1. **Build Stage:**
   - Uses Node.js 22 Alpine Linux
   - Installs all dependencies
   - Compiles TypeScript to JavaScript

2. **Production Stage:**
   - Uses Node.js 22 Alpine Linux (minimal size)
   - Installs only production dependencies
   - Runs as non-root user for security
   - Uses dumb-init for proper signal handling
   - Final image size: ~150MB

## Security Considerations

- The container runs as a non-root user (nodejs:1001)
- Sensitive environment variables should be managed using secrets in production
- The image includes only production dependencies
- Security headers are enabled by default

## Troubleshooting

### Container won't start

- Check logs: `docker logs mcp-server`
- Verify Redis is accessible from the container
- Ensure all required environment variables are set

### Health check failing

- Verify Redis connection string is correct
- Check network connectivity between containers
- Review server logs for specific errors

### Permission issues

- Ensure the mounted volumes have correct permissions
- The container runs as UID 1001 (nodejs user)

## Development Tips

1. **Hot reload in development:**

   ```bash
   # Use volume mounts for development
   docker run -v $(pwd)/src:/app/src ...
   ```

2. **Debug mode:**

   ```bash
   docker run -e LOG_LEVEL=DEBUG ...
   ```

3. **Shell access:**
   ```bash
   docker exec -it mcp-server sh
   ```
