# Minima Student

[![English](https://img.shields.io/badge/Language-English-blue)](README.md)
[![한국어](https://img.shields.io/badge/Language-한국어-red)](README-ko.md)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

SolidJS와 TypeScript로 만든 Minima LMS 학생 인터페이스.

> **🚧 출시 준비 중**: 아직 비즈니스 용도로 사용할 준비가 되지 않았습니다

## 주요 기능

- 현대적인 마이크로 러닝 학생 인터페이스
  - 문서 (현재 작성 중)

- 기술 스택
  - SolidJS
  - TypeScript
  - daisyUI

## 빠른 시작

### 사전 요구사항

- Node.js 22+
- Docker (백엔드 API용)

### 저장소 클론 및 설치

```bash
git clone https://github.com/cobel1024/minima && cd minima/student
npm install
```

### 개발 서버 실행

```bash
docker compose up -d
```

접속: [http://localhost:5173](http://localhost:5173)

## 개발

### 추가 패키지 설치

```bash
npm install ...
docker compose restart
```

### 패키지 업그레이드

```bash
npm run upgrade
```

### OpenAPI 스키마 업데이트

```bash
npm run openapi-ts
```

### i18n 문자열 추출

```bash
npm run i18next-extract
```

## 라이선스

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
