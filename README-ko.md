# Minima LMS

[![English](https://img.shields.io/badge/Language-English-blue)](README.md)
[![한국어](https://img.shields.io/badge/Language-한국어-red)](README-ko.md)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
![Status](https://img.shields.io/badge/Status-Alpha-orange)

**마이크로 러닝 LMS. Moodle, Canvas, Open edX 대안.**

**🚀 알파 릴리스**: 핵심 기능 ready. 테스트와 피드백 환영합니다!

## 문서

[https://cobel1024.github.io/minima-docs/](https://cobel1024.github.io/minima-docs/)

## 빠른 시작

```bash
git clone https://github.com/cobel1024/minima && cd minima
sh dev.sh up
```

접속 username `admin@example.com` / password `1111`

- 학습자: [http://localhost:5173](http://localhost:5173)
- 어드민: [http://localhost:8000](http://localhost:8000/admin/)

## 스크린샷

![대시보드](./screenshot/student.webp)
![관리자 패널](screenshot/admin.webp)

## 기술 스택

- Python 3.14, Django 6, Django-ninja, Django-unfold
- SolidJS, TypeScript, Vite, daisyUI, Tailwind CSS, Tiptap
- PostgreSQL, Redis, Celery, OpenSearch, Apache Tika

## 기여

이슈와 풀 리퀘스트 환영. 개발 환경 설정은 [개발](#개발) 섹션을 참고해 주세요.

## 개발

- [코어 개발](core/README.md)
- [학습자 개발](student/README.md)

## 라이선스

MIT License - [LICENSE](core/LICENSE) 참고
