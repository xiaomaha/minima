# Minima LMS

[![English](https://img.shields.io/badge/Language-English-blue)](README.md)
[![한국어](https://img.shields.io/badge/Language-한국어-red)](README-ko.md)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

현대적인 마이크로 러닝 LMS.
Moodle, Canvas, Open edX 경량 대안.

> **🚧 프리 릴리스**: 아직 프로덕션 사용 준비 안 됨

## 문서

[https://cobel1024.github.io/minima-docs/](https://cobel1024.github.io/minima-docs/)

## 빠른 시작

```bash
git clone https://github.com/cobel1024/minima && cd minima
chmod +x dev.sh
./dev.sh up
```

접속: http://localhost:5173 (admin@example.com / 1111)

## 스크린샷

![대시보드](./screenshot/student.dashboard.learning.png)
![관리자 패널](screenshot/admin.ko.sample.png)

## 기술 스택

### 백엔드

- Django 6.x + Django Ninja
- PostgreSQL, OpenSearch, Redis, MinIO
- Celery, Gemini/OpenAI/Anthropic

### 프론트엔드

- SolidJS + TypeScript
- TanStack Router, TailwindCSS 4
- Plyr, PDFSlick, TipTap

## 개발

- [코어 개발](core/README.md)
- [학습자 개발](student/README.md)

## 라이선스

MIT License - [LICENSE](core/LICENSE) 참고
