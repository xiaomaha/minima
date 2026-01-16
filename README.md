# Minima LMS

[![English](https://img.shields.io/badge/Language-English-blue)](README.md)
[![한국어](https://img.shields.io/badge/Language-한국어-red)](README-ko.md)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Modern micro-learning LMS.
Lightweight alternative to Moodle, Canvas, and Open edX.

> **🚧 Pre-Release**: Not ready for production use yet

## Documentation

[https://cobel1024.github.io/minima-docs/](https://cobel1024.github.io/minima-docs/)

## Quick Start

```bash
git clone https://github.com/cobel1024/minima && cd minima
chmod +x dev.sh
./dev.sh up
```

Access at: http://localhost:5173 (admin@example.com / 1111)

## Screenshots

![Dashboard](./screenshot/student.dashboard.learning.png)

![Admin Panel](screenshot/admin.en.sample.png)

## Tech Stack

### Backend

- Django 6.x + Django Ninja
- PostgreSQL, OpenSearch, Redis, MinIO
- Celery, Gemini/OpenAI/Anthropic

### Frontend

- SolidJS + TypeScript
- TanStack Router, TailwindCSS 4
- Plyr, PDFSlick, TipTap

## Development

- [Core Development](core/README.md)
- [Student Development](student/README.md)

## License

MIT License - see [LICENSE](core/LICENSE)
