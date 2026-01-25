# Minima LMS

[![English](https://img.shields.io/badge/Language-English-blue)](README.md)
[![한국어](https://img.shields.io/badge/Language-한국어-red)](README-ko.md)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Django와 Solidjs TypeScript로 만든 현대적인 셀프 호스팅 마이크로러닝 LMS.
Moodle, Canvas, Open edX의 가볍고 빠른 대안.

> **🚧 출시 준비 중**: 아직 비즈니스 용도로 사용할 준비가 되지 않았습니다

## 주요 기능

- 현대적인 마이크로러닝 학습 관리 시스템
  - [https://cobel1024.github.io/minima-docs/ko/](https://cobel1024.github.io/minima-docs/ko/)

- 기술 스택
  - Django 6.x
  - Solidjs TypeScript
  - OpenSearch 통합
  - Gemini, OpenAI, Anthropic 통합
  - i18n 지원
  - JWT + 2FA 인증

## 빠른 시작

Docker 기반 5분 설치

### 사전 요구사항

- Docker
- Python 3.14
- uv (빠른 Python 패키지 매니저)

### 저장소 클론

```bash
git clone https://github.com/cobel1024/minima && cd minima
```

### 환경 설정

```bash
cp env.example .env
# .env 파일을 편집하여 설정을 변경하세요
```

### uv 설치 및 패키지 동기화

[https://docs.astral.sh/uv/](https://docs.astral.sh/uv/)

```bash
uv sync
```

### Docker 환경 설정 및 Django 부트스트랩

```bash
uv run dev.py up && uv run dev.py bootstrap && uv run dev.py download-images
docker compose exec minima pytest -v -s --cov -m load_data

# 몇 분 정도 걸릴 수 있습니다.
# 더미 테스트 데이터도 로드할 수 있습니다. 아래를 참고하세요.
```

관리자 패널 접속: [http://localhost:8000/admin/](http://localhost:8000/admin/)

- 계정: `admin@example.com`
- 비밀번호: `1111`

API 문서: [http://localhost:8000/api/docs](http://localhost:8000/api/docs)

### 추가 서비스

- **Mailpit** (이메일 테스트): [http://localhost:8025](http://localhost:8025)
- **MinIO Console** (오브젝트 스토리지): [http://localhost:9001](http://localhost:9001)
  - 사용자: `minima`
  - 비밀번호: `minima.dev`
- **OpenSearch**: [http://localhost:9200](http://localhost:9200)

## 테스팅

### 모든 테스트 실행

```bash
uv run dev.py download-images

# 한 번만 실행하면 됩니다.
# 샘플 이미지를 다운로드하여 .cache 디렉토리에 저장합니다.
```

```bash
docker compose exec minima pytest -v -s --cov
```

### 지속 테스트 데이터 로드

```bash
docker compose exec minima pytest -v -s --cov -m load_data

# 실제 데이터를 원하면
# docker compose exec minima python manage.py import_youtube playlist_id_or_video_id --owner admin@example.com
```

### e2e API 테스트 실행

```bash
docker compose exec minima pytest -v -s --cov -m e2e
```

### 병렬 테스트 실행

```bash
docker compose exec minima pytest -v -s --cov -n auto
```

## 개발

### Docker 환경 포함 사항

전체 설정은 [docker-compose.yml](docker-compose.yml)을 참고하세요.

- **Minima** - Minima LMS
- **Celery worker** - 백그라운드 태스크 처리
- **PostgreSQL** - 주 데이터베이스
- **OpenSearch** - 검색 엔진
- **Redis** - 캐시 및 메시지 브로커
- **Mailpit** - 이메일 테스트
- **MinIO** - 오브젝트 스토리지
- **Apache Tika** - 문서 처리

### 헬퍼 명령어

```bash
uv run dev.py up                # 이미지 빌드, 네트워크 생성, 서비스 시작
uv run dev.py bootstrap         # 데이터베이스 초기화 및 환경 설정
uv run dev.py lint              # 타입 체킹 및 린팅 실행
uv run dev.py download-images   # 샘플 이미지 다운로드
```

### 개발 도구

```bash
# 개발 도구 설치
uv tool install pyrefly      # 타입 체커
uv tool install ruff    # 린터 및 포매터

# 도구 업데이트
uv tool upgrade pyrefly ruff
```

### 코드 품질

```bash
# 모든 검사 실행
uv run dev.py lint

# 또는 개별 실행
uv run pyrefly check               # 타입 체킹
uv run ruff check .                # 린팅
uv run ruff check --select I .     # Import 정렬
uv run ruff format .               # 코드 포매팅
```

### 번역

```bash
docker compose exec minima python manage.py makemessages -a --extension html,txt,py,mjml
# locale/ 폴더의 {언어}.po 파일을 편집하세요
docker compose exec minima python manage.py compilemessages --ignore=.venv
```

## 문제 해결

### 환경 초기화

```bash
docker compose down -v
docker network rm minima
```

### 네트워크 이미 존재 오류

```bash
# dev.py up을 이전에 실행했다면 정상입니다
# 명령은 계속 진행됩니다
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
