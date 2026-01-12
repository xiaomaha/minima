#!/usr/bin/env bash
set -e

case "$1" in
  up)
    echo "Starting core..."
    cd core \
      && uv run dev.py up \
      && uv run dev.py bootstrap \
      && uv run dev.py download-images \
      && docker compose exec minima pytest -m load_data \
      && cd ..
    echo "Starting student..."
    cd student && docker compose up -d && cd ..
    ;;

  down)
    cd core && docker compose down && cd ..
    cd student && docker compose down && cd ..
    ;;

  clean)
    cd core && docker compose down -v && cd ..
    cd student && docker compose down -v && cd ..
    ;;

  stop)
    cd core && docker compose stop && cd ..
    cd student && docker compose stop && cd ..
    ;;

  restart)
    cd core && docker compose restart && cd ..
    cd student && docker compose restart && cd ..
    ;;

  logs)
    docker compose -f core/docker-compose.yml -f student/docker-compose.yml logs -f
    ;;

  *)
    echo "Usage: ./dev.sh {up|down|clean|stop|restart|logs}"
    exit 1
    ;;
esac
