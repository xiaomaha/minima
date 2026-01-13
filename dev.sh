#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

case "$1" in
  up)
    echo "Starting core..."
    cd "$SCRIPT_DIR/core"
    [ -f env.example ] && [ ! -f .env ] && cp env.example .env
    [ ! -f .env ] && touch .env
    uv run dev.py up
    uv run dev.py bootstrap
    uv run dev.py download-images
    docker compose exec minima pytest -m load_data
    
    echo "Starting student..."
    cd "$SCRIPT_DIR/student"
    docker compose up -d
    ;;

  down)
    cd "$SCRIPT_DIR/core" && docker compose down
    cd "$SCRIPT_DIR/student" && docker compose down
    ;;

  clean)
    cd "$SCRIPT_DIR/core" && docker compose down -v
    cd "$SCRIPT_DIR/student" && docker compose down -v
    ;;

  stop)
    cd "$SCRIPT_DIR/core" && docker compose stop
    cd "$SCRIPT_DIR/student" && docker compose stop
    ;;

  restart)
    cd "$SCRIPT_DIR/core" && docker compose restart
    cd "$SCRIPT_DIR/student" && docker compose restart
    ;;

  logs)
    if [ $# -eq 1 ]; then
      docker compose -f "$SCRIPT_DIR/core/docker-compose.yml" -f "$SCRIPT_DIR/student/docker-compose.yml" logs -f --tail=100
    else
      shift
      docker compose -f "$SCRIPT_DIR/core/docker-compose.yml" -f "$SCRIPT_DIR/student/docker-compose.yml" logs "$@"
    fi
    ;;

  *)
    echo "Usage: ./dev.sh {up|down|clean|stop|restart|logs}"
    exit 1
    ;;
esac
