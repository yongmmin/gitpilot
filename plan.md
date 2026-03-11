# gitpilot — 프로젝트 플랜

> VS Code 익스텐션 | git diff 기반 AI 개발 워크플로우 자동화  
> Ollama 로컬 LLM 기반 — 무료, 코드 외부 전송 없음

---

## 왜 만들었나

커밋 메시지, PR 설명, 브랜치 네이밍은 매번 반복되는 작업이지만 적절히 작성하려면 의외로 시간이 걸린다.  
gitpilot은 실제 `git diff`를 읽어 이 작업들을 자동화하고, 개발자가 코드 작성에만 집중할 수 있게 한다.  
팀 내 실제 사용을 목표로 설계했으며, `.vsix` 배포로 팀원 누구나 설치해서 쓸 수 있다.

---

## 기술 스택

| 영역 | 기술 | 비고 |
|---|---|---|
| 익스텐션 | VS Code Extension API (TypeScript) | Webview, SCM, QuickPick, StatusBar |
| LLM | Ollama / Claude / OpenAI | 프로바이더 선택 가능 |
| Git 연동 | Node.js `child_process` | diff, log, branch 추출 |
| 빌드 | esbuild | 단일 파일 번들 |
| Node.js | v20 (nvm) | `nvm use 20` 필수 — vsce 패키징 시 v18 이하에서 오류 발생 |

> **LLM 확장성:** LLM 레이어는 프로바이더 인터페이스로 추상화되어 있어 Ollama / Claude / OpenAI 전환 시 설정값만 변경하면 된다. 코드 수정 불필요.

---

## 기능 상세

### 1. 커밋 메시지 생성
- 입력: `git diff --staged` (staged 없으면 전체 diff 사용)
- 출력: Conventional Commits 형식 (`feat`, `fix`, `refactor` 등)
- UX: VS Code SCM 입력창에 자동 삽입

### 2. PR 설명 생성
- 입력: `git diff main...HEAD` + `git log main...HEAD`
- 출력: 구조화된 마크다운 (개요 / 변경사항 / 테스트 방법 / 체크리스트)
- UX: Webview 패널 + 클립보드 복사 버튼

### 3. 브랜치명 제안
- 입력: 사용자가 입력한 작업 설명 텍스트
- 출력: kebab-case 브랜치명 3가지 (`feat/`, `fix/` 등 prefix 포함)
- UX: QuickPick 선택 → `git checkout -b` 자동 실행

### 4. 코드 리뷰
- 입력 A: `git diff` 전체 (변경사항 리뷰 커맨드)
- 입력 B: 에디터 선택 텍스트 (선택 코드 리뷰 — 우클릭 메뉴)
- 출력: 항목별 리뷰 (버그 / 성능 / 보안 / 가독성 / 긍정적인 부분)
- UX: 스트리밍 Webview 패널, 심각도 표시 (🔴 Critical / 🟡 Warning / 🟢 Suggestion)

---

## 아키텍처

```
VS Code 커맨드
      ↓
 commands/*.ts        ← 기능별 비즈니스 로직
      ↓
 services/git.ts      ← child_process git 추상화
 services/llm.ts      ← Ollama 스트리밍 클라이언트
      ↓
 VS Code UI           ← SCM / Webview / QuickPick / StatusBar
```

---

## 구현 로드맵

### Phase 0. 프로젝트 세팅 ✅
- [x] 익스텐션 스캐폴딩 (package.json, tsconfig, esbuild)
- [x] `.vscode/launch.json` + `tasks.json` F5 디버깅 환경
- [x] Ollama 연결 확인

### Phase 1. 핵심 서비스 ✅
- [x] `git.ts` — staged diff, full diff, branch diff, 커밋 로그, 브랜치 조작
- [x] `llm.ts` — Ollama 스트리밍 + Claude/OpenAI 전환 가능한 구조
- [x] `config.ts` — VS Code 설정 연동

### Phase 2. 커맨드 구현 ✅
- [x] 커밋 메시지 → SCM 입력창 자동 삽입
- [x] 브랜치명 → QuickPick → git checkout -b
- [x] PR 설명 → Webview + 클립보드 복사
- [x] 코드 리뷰 (diff + 선택 코드) → 스트리밍 Webview

### Phase 3. 패키징 ✅
- [x] `.vsix` 빌드 (`gitpilot-0.1.0.vsix`)
- [x] 팀 내부 설치 가이드
- [x] README + plan.md

### Phase 4. UI/UX 개선 ✅
- [x] StatusBar 클릭 → LLM 제공자/모델 선택 UI (`switchProvider` 커맨드)
- [x] 제공자 전환 시 API 키 입력창 항상 표시 (기존 키 덮어쓰기 지원)
- [x] LLM 오류 발생 시 "제공자 변경" 버튼이 포함된 알림 표시 (`utils/errorHandler.ts`)
- [x] 오류 유형별 친화적 메시지 (429 Rate Limit, Unauthorized, 연결 실패 등)

### Phase 5. 고도화 (예정)
- [ ] 실사용 피드백 기반 프롬프트 품질 개선
- [ ] `prepare-commit-msg` git hook 연동

---

## 포트폴리오 어필 포인트

- **LLM API 직접 연동**: Ollama API 스트리밍 직접 구현, 프로바이더 패턴으로 Ollama / Claude / OpenAI 전환 가능한 구조 설계
- **실사용 도구**: 개발팀 내 실제 배포 및 매일 사용하는 도구
- **VS Code Extension API**: SCM 연동, Webview 스트리밍, QuickPick, StatusBar, Context Menu
- **Git 자동화**: child_process 기반 git diff/log 추출 및 기능별 프롬프트 엔지니어링
