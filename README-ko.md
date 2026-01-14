# Minima LMS

[![English](https://img.shields.io/badge/Language-English-blue)](README.md)
[![한국어](https://img.shields.io/badge/Language-한국어-red)](README-ko.md)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Django와 SolidJS로 만든 현대적인 마이크로러닝 LMS.
Moodle, Canvas, Open edX의 가볍고 셀프 호스팅 가능한 대안.

> **🚧 출시 준비 중**: 아직 비즈니스 용도로 사용할 준비가 되지 않았습니다

## Screenshots

![대시보드](./screenshot/student.dashboard.learning.png)

## 관리자 패널

![API 문서](screenshot/api.swagger.png)
*Django Ninja 기반 인터랙티브 API 문서*

![관리자 패널](screenshot/admin.en.sample.png)
*django-unfold를 활용한 모던 관리자 인터페이스*

![다국어 지원](screenshot/admin.ko.sample.png)
*내장 i18n 지원 (영어, 한국어)*

더 많은 스크린샷은 아래에서 있습니다.

## 주요 기능

### 🎯 마이크로러닝 아키텍처

- **유연한 학습 단위**: Quiz, Survey, Assignment, Discussion, Exam, Media
- **두 가지 학습 모드**: 개별 마이크로러닝 또는 구조화된 과정
- **자율 등록**: 학습자가 파트너 카탈로그에서 콘텐츠 선택

### 🔍 스마트 콘텐츠 검색

- **자막 검색**: 동기화된 자막을 사용해 동영상 내부 검색
- **순간 이동**: 특정 콘텐츠 타임스탬프로 직접 이동
- **콘텐츠 노트**: 콘텐츠별 노트 작성 및 파일/이미지 업로드

### 📊 역량 프레임워크

- **NCS 통합**: 한국 국가직무능력표준 지원
- **스킬 관리**: 관심사, 스킬, 스킬 구성요소 체계적 관리
- **수료증 및 배지**: 콘텐츠 또는 과정별 수료증과 배지 발급

### 🤖 AI 기반 학습

- **플러그인 아키텍처**: 확장 가능한 AI 통합 시스템
- **티칭 어시스턴트**: AI 기반 학습 지원 (Gemini, OpenAI, Anthropic)
- **스마트 큐레이션**: AI 강화 콘텐츠 추천

### 📈 정확한 트래킹

- **비트맵 트래킹**: 비트맵 정밀도로 정확한 학습 시간 추적
- **시간 기반 PDF**: 동영상처럼 PDF 읽기 진행률 추적
- **데이터베이스 수준 히스토리**: 거의 모든 기록을 데이터베이스 수준에서 추적

### 📝 포괄적인 평가

- **세 가지 평가 유형**: Assignment, Discussion, Exam
- **완전한 워크플로우**: 응시 → 제출 → 채점 → 이의 → 수정 → 확정
- **루브릭 평가**: 과제 루브릭 채점
- **표절 검사**: 과제 유사도 검사

### 💳 커머스 지원

- **과정 스토어**: 통합 쇼핑 시스템으로 과정 판매
- **쿠폰 시스템**: 유연한 할인 및 프로모션 관리
- **PG 연동 준비**: 결제 게이트웨이 연결로 B2C 플랫폼 구축

## 활용 사례

- **교육 기관**: 고가의 LMS를 대체하는 자체 호스팅 솔루션
- **기업 교육**: 직원 역량 개발 추적
- **온라인 크리에이터**: 자체 플랫폼에서 강의 판매
- **부트캠프**: 코호트 기반 학습 관리

## 기술 스택

### 백엔드 (Core)

- **프레임워크**: Django 6.x + Django Ninja
- **데이터베이스**: PostgreSQL (트리거 및 히스토리 추적)
- **검색**: OpenSearch
- **큐**: Celery + Redis
- **스토리지**: MinIO (S3 호환)
- **AI**: Gemini, OpenAI, Anthropic 통합

### 프론트엔드 (Student)

- **프레임워크**: SolidJS + TypeScript
- **라우터**: TanStack Router
- **UI**: TailwindCSS 4 + DaisyUI
- **비디오**: Plyr (자막 지원)
- **PDF**: PDFSlick (시간 추적)
- **에디터**: TipTap

## 빠른 시작

### 사전 요구사항

- Docker
- Python 3.14 (core 개발용)
- Node.js 22+ (student 개발용)

### 설치

```bash
git clone https://github.com/cobel1024/minima && cd minima
chmod +x dev.sh
./dev.sh up
```

다음 작업이 자동으로 실행됩니다:

1. core 백엔드 서비스 시작
2. Django 부트스트랩 및 샘플 데이터 로드
3. student 프론트엔드 시작

### 접속

- **학생 인터페이스**: [http://localhost:5173](http://localhost:5173)
  - 이메일: `admin@example.com`
  - 비밀번호: `1111`

- **관리자 패널**: [http://localhost:8000/admin/](http://localhost:8000/admin/)
  - 이메일: `admin@example.com`
  - 비밀번호: `1111`

- **API 문서**: [http://localhost:8000/api/docs](http://localhost:8000/api/docs)

### 추가 서비스

- **Mailpit** (이메일 테스트): [http://localhost:8025](http://localhost:8025)
- **MinIO Console** (스토리지): [http://localhost:9001](http://localhost:9001)
  - 사용자: `minima` / 비밀번호: `minima.dev`
- **OpenSearch**: [http://localhost:9200](http://localhost:9200)

## 개발

### 서비스 시작/정지

```bash
./dev.sh up      # 모든 서비스 시작
./dev.sh down    # 모든 서비스 정지
./dev.sh clean   # 서비스 정지 및 볼륨 삭제
./dev.sh stop    # 모든 서비스 정지
./dev.sh restart # 모든 서비스 재시작
./dev.sh logs    # 로그 보기
```

### 개별 개발

자세한 가이드:

- [Core 개발](core/README-ko.md)
- [Student 개발](student/README-ko.md)

## 문서

- [기능](docs/) - 상세 기능 문서 (준비 중)

## 라이선스

MIT License - 자세한 내용은 [LICENSE](core/LICENSE) 참고

Copyright (c) 2025 Minima

## 스크린샷

![대시보드](./screenshot/student.dashboard.learning.png)
![역량 목표](./screenshot/student.dashboard.goal.png)
![과정 개요](./screenshot/student.course.outline.png)
![과정 일정](./screenshot/student.course.schedule.png)
![과정 성취](./screenshot/student.course.achievement.png)
![과정 상세](./screenshot/student.course.detail.png)
![미디어 검색](./screenshot/student.search.png)
![동영상 재생](./screenshot/student.video.png)
![AI 어시스턴트](./screenshot/student.ai.png)
![설문조사](./screenshot/student.survey.png)
