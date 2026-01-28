# Minima LMS

[![English](https://img.shields.io/badge/Language-English-blue)](README.md)
[![한국어](https://img.shields.io/badge/Language-한국어-red)](README-ko.md)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
![Status](https://img.shields.io/badge/Status-Alpha-orange)

**Micro-learning LMS. Alternative to Moodle, Canvas, and Open edX.**

**🚀 Alpha Release** - Core features ready. Testing and feedback appreciated!

## Thoughtful design decisions

- **Reusable date-based content architecture** - Content with dates designed to be reused without duplication or modification
- **Granular permission system** - Fine-grained access control designed for hierarchically nested content
- **Bitmap-based viewing tracking** - Designed to accurately track actual viewing and skipping patterns
- **Caption-powered search** - Designed to search content by text and jump directly to specific timestamps

These design choices are working well in practice.
For example, when tracking live session attendance, events like entry, waiting, session start, temporary exit, and re-entry are all accurately recorded without needing server-side exception handling code.

## Documentation

[https://cobel1024.github.io/minima-docs/](https://cobel1024.github.io/minima-docs/)

## Quick Start

```bash
git clone https://github.com/cobel1024/minima && cd minima
sh dev.sh up
```

Access with username `admin@example.com` and password `1111`

- student: [http://localhost:5173](http://localhost:5173)
- admin: [http://localhost:8000](http://localhost:8000/admin/)

## Screenshots

![Dashboard](./screenshot/student.webp)
![Admin Panel](screenshot/admin.webp)

## Tech Stack

- Python 3.14, Django 6, Django-ninja, Django-unfold
- SolidJS, TypeScript, Vite, daisyUI, Tailwind CSS, Tiptap
- PostgreSQL, Redis, Celery, OpenSearch, Apache Tika

## Contributing

Issues and pull requests welcome. Check [Development](#development) section for setup.

## Development

- [Core Development](core/README.md)
- [Student Development](student/README.md)

## License

MIT License - see [LICENSE](core/LICENSE)

### Attribution

Demo content includes videos and 3D models from [Blender Foundation](https://www.blender.org/), licensed under [Creative Commons Attribution 4.0 International](https://creativecommons.org/licenses/by/4.0/).
