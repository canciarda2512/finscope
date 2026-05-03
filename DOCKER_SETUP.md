# FinScope — Local Development Setup (Database & Cache)

## Prerequisites

Before you start, make sure you have the following installed:

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) — Download and install for Windows/Mac/Linux
- After installing Docker Desktop, **restart your computer**
- Verify Docker is working by running in terminal: `docker --version`

---

## What This Sets Up

Instead of manually installing ClickHouse and Redis on your machine, we use Docker to run them as containers. This means:

- ✅ Same environment for everyone on the team
- ✅ No manual database installation
- ✅ Start/stop with a single command
- ✅ Works on Windows, Mac, and Linux

---

## Step 1 — Create the docker-compose.yml file

In the root of the FinScope project (next to the `client` and `server` folders), create a file called `docker-compose.yml` with the following content:

```yaml
version: '3.8'

services:
  clickhouse:
    image: clickhouse/clickhouse-server:latest
    container_name: finscope-clickhouse
    ports:
      - "8123:8123"
      - "9000:9000"
    environment:
      CLICKHOUSE_DB: finscope
      CLICKHOUSE_USER: default
      CLICKHOUSE_PASSWORD: ""
    volumes:
      - clickhouse_data:/var/lib/clickhouse
    ulimits:
      nofile:
        soft: 262144
        hard: 262144

  redis:
    image: redis:7-alpine
    container_name: finscope-redis
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

volumes:
  clickhouse_data:
  redis_data:
```

---

## Step 2 — Start the containers

Open a terminal in the FinScope root folder and run:

```bash
docker-compose up -d
```

The `-d` flag runs the containers in the background (detached mode).

First time will take a few minutes to download the images. After that it starts in seconds.

---

## Step 3 — Verify everything is running

```bash
docker-compose ps
```

You should see both `finscope-clickhouse` and `finscope-redis` with status `Up`.

You can also open Docker Desktop and see both containers running under the `finscope` project.

---

## Step 4 — Configure your .env file

Make sure your `server/.env` file has the following (copy from `.env.example`):

```
CLICKHOUSE_HOST=localhost
CLICKHOUSE_PORT=8123
CLICKHOUSE_DATABASE=finscope
CLICKHOUSE_USER: default
CLICKHOUSE_PASSWORD:
REDIS_HOST=localhost
REDIS_PORT=6379
```

---

## Useful Commands

| Command | What it does |
|---|---|
| `docker-compose up -d` | Start ClickHouse and Redis in background |
| `docker-compose down` | Stop and remove containers |
| `docker-compose ps` | Check if containers are running |
| `docker-compose logs clickhouse` | View ClickHouse logs |
| `docker-compose logs redis` | View Redis logs |

---

## Notes

- The data is **persisted** in Docker volumes, so it is not lost when you stop the containers.
- You do not need to run `docker-compose up` every time — only when you want to start the database. Once running, it stays up until you restart your computer or run `docker-compose down`.
- If you restart your computer, just run `docker-compose up -d` again before starting the backend.
