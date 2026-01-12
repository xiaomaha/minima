# Minima LMS

[![English](https://img.shields.io/badge/Language-English-blue)](README.md)
[![한국어](https://img.shields.io/badge/Language-한국어-red)](README-ko.md)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Modern, self-hosted Micro Learning LMS built with Django and Solidjs TypeScript.
A lightweight alternative to Moodle, Canvas, and Open edX.

> **🚧 Pre-Release**: not ready for business use yet

## Features

- Modern Micro Learning Learning Management System
  - docs (currently in progress)

- Tech Stack
  - Django 6.x
  - Solidjs TypeScript
  - OpenSearch integration
  - Gemini, OpenAI, Anthropic integration
  - i18n support
  - JWT + 2FA authentication

## Quick Start

Docker-based 5-minute installation

### Prerequisites

- Docker
- Python 3.14
- uv (Fast Python Package Manager)

### Clone repo

```bash
git clone https://github.com/cobel1024/minima && cd minima/core
```

### Configure environment

```bash
cp env.example .env
# Edit .env file with your settings
```

### Install uv and sync requirements

[https://docs.astral.sh/uv/](https://docs.astral.sh/uv/)

```bash
uv sync
```

### Setup Docker environment and bootstrap Django

```bash
uv run dev.py up && uv run dev.py bootstrap && uv run dev.py download-images
docker compose exec minima pytest -v -s --cov -m load_data

# This will take maybe some minutes.
# You can also load dummy test data. see below.
```

Access the admin panel: [http://localhost:8000/admin/](http://localhost:8000/admin/)

- account: `admin@example.com`
- password: `1111`

API docs: [http://localhost:8000/api/docs](http://localhost:8000/api/docs)

### Additional Services

- **Mailpit** (Email testing): [http://localhost:8025](http://localhost:8025)
- **MinIO Console** (Object storage): [http://localhost:9001](http://localhost:9001)
  - User: `minima`
  - Password: `minima.dev`
- **OpenSearch**: [http://localhost:9200](http://localhost:9200)

## Testing

### Run all tests

```bash
uv run dev.py download-images

# Just run this once.
# This will download sample images and store `.cache directory`.
```

```bash
docker compose exec minima pytest -v -s --cov
```

### Load persistent test data

```bash
docker compose exec minima pytest -v -s --cov -m load_data

# for real world data
# docker compose exec minima python manage.py import_youtube playlist_id_or_video_id --owner admin@example.com
```

### Run e2e API tests

```bash
docker compose exec minima pytest -v -s --cov -m e2e
```

### Parallel test execution

```bash
docker compose exec minima pytest -v -s --cov -n auto
```

## Development

### Docker Environment Includes

See [docker-compose.yml](docker-compose.yml) for full configuration.

- **Minima** - Minima LMS
- **Celery worker** - Background task processing
- **PostgreSQL** - Primary database
- **OpenSearch** - Search engine
- **Redis** - Cache and message broker
- **Mailpit** - Email testing
- **MinIO** - Object storage
- **Apache Tika** - Document processing

### Helper Commands

```bash
uv run dev.py up                # Build images, create network, start services
uv run dev.py bootstrap         # Initialize database and setup environment
uv run dev.py lint              # Run type checking and linting
uv run dev.py download-images   # Download sample images
```

### Development Tools

```bash
# Install development tools
uv tool install ty      # Type checker
uv tool install ruff    # Linter and formatter

# Update tools
uv tool upgrade ty ruff
```

### Code Quality

```bash
# Run all checks
uv run dev.py lint

# Or run individually
uv run ty check                    # Type checking
uv run ruff check .                # Linting
uv run ruff check --select I .     # Import sorting
uv run ruff format .               # Code formatting
```

### Translation

```bash
docker compose exec minima python manage.py makemessages -a --extension html,txt,py,mjml
# edit your {language}.po file in locale/
docker compose exec minima python manage.py compilemessages --ignore=.venv
```

## Troubleshooting

### Reset environment

```bash
docker compose down -v
docker network rm minima
```

### Network already exists error

```bash
# This is normal if you've run dev.py up before
# The command will continue anyway
```

## License

MIT License

Copyright (c) 2025 Minima

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
