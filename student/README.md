# Minima Student

[![English](https://img.shields.io/badge/Language-English-blue)](README.md)
[![한국어](https://img.shields.io/badge/Language-한국어-red)](README-ko.md)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Minima LMS student interface built with SolidJS and TypeScript.

> **🚧 Pre-Release**: not ready for business use yet

## Features

- Modern Micro Learning Student Interface
  - [https://cobel1024.github.io/minima-docs/](https://cobel1024.github.io/minima-docs/)

- Tech Stack
  - SolidJS
  - TypeScript
  - daisyUI

## Quick Start

### Prerequisites

- Node.js 22+
- Docker (for backend API)

### Clone and install

```bash
git clone https://github.com/cobel1024/minima && cd minima/student
npm install
```

### Run development server

```bash
docker compose up -d
```

Access at [http://localhost:5173](http://localhost:5173)

## Development

### Install additional packages

```bash
npm install ...
docker compose restart
```

### Upgrade packages

```bash
npm run upgrade
```

### Update openapi schema

```bash
npm run openapi-ts
```

### Extract i18n strings

```bash
npm run i18next-extract
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
