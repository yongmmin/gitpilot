# gitpilot

> VS Code 익스텐션 | git diff 기반 커밋 메시지, PR 설명, 브랜치명, 코드 리뷰 자동 생성
> Ollama(로컬) / Claude / OpenAI — 제공자를 UI에서 즉시 전환 가능

![Version](https://img.shields.io/badge/version-0.1.3-blue)
![VS Code](https://img.shields.io/badge/VS%20Code-^1.85.0-007ACC)
![License](https://img.shields.io/badge/license-MIT-green)

---

## 소개

gitpilot은 `git diff`를 읽어 개발 워크플로우에 필요한 문서를 자동으로 생성하는 VS Code 익스텐션입니다.
커밋 메시지 작성, PR 설명, 브랜치 네이밍, 코드 리뷰 같은 반복적인 작업을 AI가 대신하여 개발에만 집중할 수 있도록 합니다.

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

## 실시간 스트리밍 출력

코드 리뷰, PR 설명 등 긴 응답은 **전체 생성을 기다리지 않고 토큰 단위로 즉시 화면에 출력**됩니다.

```
LLM이 토큰 생성
    ↓ yield (AsyncGenerator)
streamLLM()이 토큰마다 반환
    ↓ for await
Webview 패널 즉시 업데이트
```

내부적으로 `AsyncGenerator`와 SSE(Server-Sent Events) 스트리밍을 조합해 구현했습니다:

```ts
// llm.ts — LLM 응답을 토큰 단위로 yield
async function* streamOllama(...): AsyncGenerator<string> {
  const reader = res.body.getReader()
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    // JSON 청크 파싱 후 즉시 yield
    if (json.message?.content) yield json.message.content
  }
}

// codeReview.ts — 토큰이 올 때마다 패널 갱신
for await (const token of streamLLM(prompt, SYSTEM)) {
  accumulated += token
  panel.webview.html = getBaseHtml(accumulated) // 토큰마다 화면 업데이트
}
```

Ollama, Claude, OpenAI 모두 동일한 `AsyncGenerator` 인터페이스로 추상화되어 제공자가 달라도 스트리밍 로직은 동일하게 작동합니다.

---

## LLM 제공자 비교

| 제공자 | API 키 | 비용 | 추천 용도 |
|---|---|---|---|
| **Ollama** | 불필요 | 무료 | 로컬 개발, 코드 외부 전송 불가 환경 |
| **Claude** | 필요 (`sk-ant-...`) | 종량제 | 긴 코드 리뷰, 높은 품질 필요 시 |
| **OpenAI** | 필요 (`sk-...`) | 종량제 | GPT-4o 계열 사용 시 |

> **주의:** Claude Pro(claude.ai 월 구독)와 Anthropic API는 **별개 서비스**입니다.
> Pro 구독으로는 API를 사용할 수 없으며, [console.anthropic.com](https://console.anthropic.com/settings/billing)에서 별도로 크레딧을 충전해야 합니다.

---

## LLM 제공자 전환 (UI)

**settings.json을 직접 편집하지 않아도** UI에서 즉시 전환할 수 있습니다.

### 방법 1: StatusBar 클릭
VS Code 좌측 하단 모델명 클릭 (예: `⬡ llama3.2:3b`)

### 방법 2: 커맨드 팔레트
`Cmd+Shift+P` → `gitpilot: LLM 제공자 전환`

### 전환 흐름

```
1. 제공자 선택   Ollama (Local) / Claude (Anthropic) / OpenAI (GPT)
        ↓
2. 모델 선택     llama3.2:3b / claude-haiku-4.5 / gpt-4o 등
        ↓
3. API 키 입력   (Claude/OpenAI 사용 시, 제공자 변경마다 재입력)
        ↓
4. settings.json 자동 저장 + StatusBar 즉시 갱신
```

> 제공자를 전환할 때마다 API 키 입력창이 표시됩니다.
> 이전 제공자의 키가 남아 인증 오류가 발생하는 문제를 방지합니다.

### 오류 시 즉시 전환

LLM 호출 중 오류(Rate Limit, Unauthorized, 연결 실패 등)가 발생하면 알림에 **"제공자 변경"** 버튼이 함께 표시됩니다.

```
❌ OpenAI API 요청 한도 초과 (429)   [제공자 변경]
```

버튼 클릭 시 바로 전환 UI가 열립니다.

---

## 오류 유형별 안내

| 오류 | 원인 | 해결 |
|---|---|---|
| `429 Too Many Requests` | API 크레딧 소진 또는 Rate Limit | 크레딧 충전 또는 제공자 변경 |
| `Unauthorized` | API 키 불일치 (예: OpenAI 키로 Claude 호출) | 제공자 변경 후 올바른 키 재입력 |
| `Ollama 서버에 연결할 수 없습니다` | ollama serve 미실행 | `ollama serve` 실행 |
| `Ollama 생성 중 연결이 끊겼습니다` | 모델 메모리 부족 또는 입력 너무 김 | 더 가벼운 모델 사용 또는 선택 범위 축소 |
| `Ollama 모델 실행 실패 (500)` | 모델 미설치 또는 메모리 부족 | `ollama pull <모델명>` 실행 |

---

## 사전 준비

### Ollama 사용 시 (무료, 권장)

```bash
# 설치
brew install ollama

# 모델 다운로드 (3b: 가볍고 빠름 / 더 좋은 품질은 7b 이상 권장)
ollama pull llama3.2:3b

# 서버 실행 (VS Code 사용 중 항상 켜두기)
ollama serve
```

### Claude 사용 시

1. [console.anthropic.com](https://console.anthropic.com) → API Keys → 키 발급
2. Billing → 크레딧 충전 (Claude Pro 구독과 별개)
3. gitpilot StatusBar 클릭 → Claude 선택 → `sk-ant-...` 키 입력

### OpenAI 사용 시

1. [platform.openai.com](https://platform.openai.com) → API Keys → 키 발급
2. Billing → 크레딧 충전
3. gitpilot StatusBar 클릭 → OpenAI 선택 → `sk-...` 키 입력

---

## 설치

```bash
code --install-extension gitpilot-0.1.3.vsix
```

VS Code 재시작 후 git 레포가 있는 프로젝트를 열고 `Cmd+Shift+P → gitpilot` 으로 사용합니다.

---

## settings.json 직접 편집

UI 대신 `settings.json`에서 직접 설정도 가능합니다 (`Cmd+,` → gitpilot 검색):

```json
{
  "gitpilot.llm.provider": "ollama",
  "gitpilot.llm.model": "llama3.2:3b",
  "gitpilot.llm.baseUrl": "http://localhost:11434",
  "gitpilot.llm.apiKey": "",
  "gitpilot.language": "ko"
}
```

| 설정 키 | 기본값 | 설명 |
|---|---|---|
| `llm.provider` | `ollama` | `ollama` / `claude` / `openai` |
| `llm.model` | `llama3.2:3b` | 제공자별 모델명 |
| `llm.baseUrl` | `http://localhost:11434` | Ollama 서버 주소 |
| `llm.apiKey` | `` | Claude/OpenAI API 키 |
| `language` | `ko` | 출력 언어 (`ko` / `en`) |

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
│   ├── codeReview.ts     # 코드 리뷰 (스트리밍 Webview)
│   └── switchProvider.ts # LLM 제공자/모델 전환 UI (QuickPick 2단계)
├── services/
│   ├── git.ts            # git 추상화 (diff, log, branch)
│   └── llm.ts            # LLM 스트리밍 클라이언트 (Ollama/Claude/OpenAI)
└── utils/
    └── errorHandler.ts   # LLM 오류 시 "제공자 변경" 버튼 알림
```

---

## 개발 환경 세팅

**Node.js v20 필수** — vsce 패키징 시 v18 이하에서 `ReadableStream is not defined` 오류 발생

```bash
nvm use 20

git clone https://github.com/your-username/gitpilot
cd gitpilot
npm install
npm run build
```

VS Code에서 프로젝트 열고 **F5** → Extension Development Host 실행

### .vsix 패키징

```bash
nvm use 20
npx @vscode/vsce package --no-dependencies
# gitpilot-0.1.x.vsix 생성
```

---

## 기술 스택

| 영역 | 기술 | 비고 |
|---|---|---|
| 익스텐션 | VS Code Extension API (TypeScript) | Webview, SCM, QuickPick, StatusBar |
| LLM | Ollama / Claude / OpenAI | AsyncGenerator 스트리밍, 프로바이더 패턴 |
| Git 연동 | Node.js `child_process` | diff, log, branch 추출 |
| 빌드 | esbuild | 단일 파일 번들 (dist/extension.js) |
| Node.js | v20 (nvm) | vsce 패키징 요구사항 |
