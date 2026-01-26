# Minima LMS

## Quick Start

```bash
git clone https://github.com/cobel1024/minima && cd minima
cp env.example .env
uv sync
uv run dev.py up && uv run dev.py bootstrap && uv run dev.py demo
```

Admin: [http://localhost:8000/admin/](http://localhost:8000/admin/) - `admin@example.com` / `1111`

**First install takes about 10 minutes**

## Requirements

- Docker
- Python 3.14
- [uv](https://docs.astral.sh/uv/)

## Infrastructure

- PostgreSQL, Redis, OpenSearch, Celery, MinIO, Apache Tika
- Mailpit: [http://localhost:8025](http://localhost:8025)
- MinIO: [http://localhost:9001](http://localhost:9001) - `minima` / `minima.dev`

Full setup: [docker-compose.yml](docker-compose.yml)

## Development

```bash
uv tool install ruff pyrefly
uv run dev.py lint
docker compose exec minima pytest -v -s --cov
docker compose exec minima pytest -v -s --cov -m e2e
```

## Cleanup

```bash
docker compose down -v
docker network rm minima
```

## License

MIT
