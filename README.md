# gitpilot

> VS Code 익스텐션 | git diff 기반 커밋 메시지, PR 설명, 브랜치명, 코드 리뷰 자동 생성  
> 로컬 LLM(Ollama)으로 동작 — 클라우드 의존 없이 무료로 사용 가능

![Version](https://img.shields.io/badge/version-0.1.0-blue)
![VS Code](https://img.shields.io/badge/VS%20Code-^1.85.0-007ACC)
![License](https://img.shields.io/badge/license-MIT-green)

---

## 소개

gitpilot은 `git diff`를 읽어 개발 워크플로우에 필요한 문서를 자동으로 생성하는 VS Code 익스텐션입니다.  
커밋 메시지 작성, PR 설명, 브랜치 네이밍 같은 반복적인 작업을 AI가 대신하여 개발에만 집중할 수 있도록 합니다.  
모든 처리는 로컬 머신에서 이루어지므로 코드가 외부로 전송되지 않습니다.

---

## 기능

| 커맨드 | 설명 |
|---|---|
| `gitpilot: 커밋 메시지 생성` | staged diff 분석 → Conventional Commits 형식 자동 생성 → SCM 입력창에 자동 삽입 |
| `gitpilot: PR 설명 생성` | 브랜치 diff + 커밋 로그 → 구조화된 PR 설명 마크다운 생성 |
| `gitpilot: 브랜치명 제안` | 작업 설명 입력 → 브랜치명 3가지 제안 → 선택 시 자동 체크아웃 |
| `gitpilot: 변경사항 코드 리뷰` | git diff 전체 → 버그/성능/보안/가독성 관점 리뷰 |
| `gitpilot: 선택 코드 리뷰` | 에디터에서 코드 선택 후 우클릭 → 즉시 리뷰 |

---

## 동작 방식

```
git diff
    ↓
로컬 LLM (Ollama)        ← 코드가 외부로 전송되지 않음
    ↓
VS Code UI
(SCM 입력창 / Webview 패널 / QuickPick)
```

1. `child_process`로 `git diff` 추출
2. 로컬에서 실행 중인 Ollama에 전송
3. 스트리밍으로 VS Code UI에 응답 출력

---

## 사전 준비

### Ollama 설치 (로컬 LLM 실행 환경)

```bash
# 설치
brew install ollama

# 모델 다운로드
ollama pull llama3.2:3b

# 서버 실행 (VS Code 사용 중 항상 켜두기)
ollama serve
```

---

## 설치

### .vsix 파일로 설치 (팀 내부 배포)

```bash
code --install-extension gitpilot-0.1.0.vsix
```

VS Code 재시작 후 git 레포가 있는 프로젝트를 열고 `Cmd+Shift+P → gitpilot` 으로 사용합니다.

---

## 설정

`Cmd+,` → `gitpilot` 검색, 또는 `settings.json` 직접 편집:

```json
{
  "gitpilot.llm.provider": "ollama",
  "gitpilot.llm.model": "llama3.2:3b",
  "gitpilot.llm.baseUrl": "http://localhost:11434",
  "gitpilot.language": "ko"
}
```

> **참고:** gitpilot은 현재 Ollama 기반으로 동작합니다.  
> LLM 레이어는 프로바이더 인터페이스로 추상화되어 있어, 추후 Claude나 OpenAI 등 다른 LLM으로의 전환도 설정값 변경만으로 가능합니다.

---

## 프로젝트 구조

```
src/
├── extension.ts          # 진입점, 커맨드 등록, StatusBar
├── config.ts             # VS Code 설정 읽기
├── commands/
│   ├── commitMessage.ts  # 커밋 메시지 생성
│   ├── prDescription.ts  # PR 설명 생성 (Webview 패널)
│   ├── branchName.ts     # 브랜치명 제안 (QuickPick)
│   └── codeReview.ts     # 코드 리뷰 (스트리밍 Webview)
└── services/
    ├── git.ts            # git 추상화 (diff, log, branch)
    └── llm.ts            # LLM 스트리밍 클라이언트
```

---

## 개발 환경 세팅

```bash
git clone https://github.com/your-username/gitpilot
cd gitpilot
npm install
npm run build
```

VS Code에서 프로젝트 열고 **F5** → Extension Development Host 실행

### .vsix 패키징

```bash
npm run package
# gitpilot-0.1.0.vsix 생성
```

---

## 기술 스택

| 영역 | 기술 |
|---|---|
| 익스텐션 | VS Code Extension API (TypeScript) |
| LLM | Ollama (`llama3.2:3b`) — 로컬, 무료 |
| Git 연동 | Node.js `child_process` |
| UI | Webview, QuickPick, SCM API, StatusBar |
| 빌드 | esbuild |
