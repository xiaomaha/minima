#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

wait_for_port() {
	local port=$1
	echo "Waiting for port $port..."
	for i in $(seq 1 60); do
		if curl -sf http://localhost:$port >/dev/null 2>&1; then
			return 0
		fi
		sleep 2
	done
	return 1
}

case "$1" in
up)
	_start_time=$SECONDS
	echo "Starting core..."
	cd "$SCRIPT_DIR/core"
	[ -f env.example ] && [ ! -f .env ] && cp env.example .env
	[ ! -f .env ] && touch .env
	uv run dev.py up
	uv run dev.py bootstrap
	uv run dev.py demo

	echo "Starting web..."
	cd "$SCRIPT_DIR/web"
	docker compose up -d

	wait_for_port 5173

	echo ""
	echo "All services are ready!"
	echo ""
	echo "Elapsed: $((SECONDS - _start_time))s"
	echo ""
	echo "Admin: http://localhost:8000/admin"
	echo "Web:   http://localhost:5173"
	echo ""
	;;

down)
	cd "$SCRIPT_DIR/core" && docker compose down
	cd "$SCRIPT_DIR/web" && docker compose down
	;;

clean)
	cd "$SCRIPT_DIR/core" && docker compose down -v
	cd "$SCRIPT_DIR/web" && docker compose down -v
	;;

stop)
	cd "$SCRIPT_DIR/core" && docker compose stop
	cd "$SCRIPT_DIR/web" && docker compose stop
	;;

restart)
	cd "$SCRIPT_DIR/core" && docker compose restart
	cd "$SCRIPT_DIR/web" && docker compose restart
	;;

logs)
	if [ $# -eq 1 ]; then
		docker compose -f "$SCRIPT_DIR/core/docker-compose.yml" -f "$SCRIPT_DIR/web/docker-compose.yml" logs -f --tail=100
	else
		shift
		docker compose -f "$SCRIPT_DIR/core/docker-compose.yml" -f "$SCRIPT_DIR/web/docker-compose.yml" logs "$@"
	fi
	;;

*)
	echo "Usage: ./dev.sh {up|down|clean|stop|restart|logs}"
	exit 1
	;;
esac
