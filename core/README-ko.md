# Minima LMS

## 빠른 시작

```bash
git clone https://github.com/cobel1024/minima && cd minima
cp env.example .env
uv sync
uv run dev.py up && uv run dev.py bootstrap && uv run dev.py demo
```

관리자: [http://localhost:8000/admin/](http://localhost:8000/admin/) - `admin@example.com` / `1111`

**첫 설치는 약 10분 정도 걸릴 수 있습니다.**

## 요구사항

- Docker
- Python 3.14
- [uv](https://docs.astral.sh/uv/)

## 인프라

- PostgreSQL, Redis, OpenSearch, Celery, MinIO, Apache Tika
- Mailpit: [http://localhost:8025](http://localhost:8025)
- MinIO: [http://localhost:9001](http://localhost:9001) - `minima` / `minima.dev`

전체 구성: [docker-compose.yml](docker-compose.yml)

## 개발

```bash
uv tool install ruff pyrefly
uv run dev.py lint
docker compose exec minima pytest -v -s --cov
docker compose exec minima pytest -v -s --cov -m e2e
```

## 제거

```bash
docker compose down -v
docker network rm minima
```

## 라이선스

MIT
