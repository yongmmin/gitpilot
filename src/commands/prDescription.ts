import * as vscode from 'vscode'
import { getBranchDiff, getCommitLog, getCurrentBranch } from '../services/git'
import { completeLLM } from '../services/llm'

const SYSTEM = `당신은 시니어 개발자입니다. git diff와 커밋 로그를 분석해서 GitHub PR 설명을 작성합니다.

다음 마크다운 형식으로 작성하세요:

## 개요
(변경사항 1-2문장 요약)

## 변경 사항
- (주요 변경사항 bullet point)

## 테스트 방법
- (테스트 방법 bullet point)

## 체크리스트
- [ ] 테스트 추가/수정
- [ ] 문서 업데이트
- [ ] 브레이킹 체인지 없음

한국어로 작성하세요.`

export async function generatePRDescription() {
  const panel = vscode.window.createWebviewPanel(
    'gitpilotPR',
    'gitpilot: PR 설명',
    vscode.ViewColumn.Beside,
    { enableScripts: true }
  )

  panel.webview.html = getLoadingHtml()

  try {
    const branch = getCurrentBranch()
    const diff = getBranchDiff()
    const log = getCommitLog()

    if (!diff && !log) {
      panel.webview.html = getErrorHtml('main 브랜치와 차이가 없습니다')
      return
    }

    const prompt = `현재 브랜치: ${branch}\n\n커밋 로그:\n${log}\n\n변경사항 (diff):\n${diff.slice(0, 10000)}`
    const description = await completeLLM(prompt, SYSTEM)
    panel.webview.html = getPRHtml(description, branch)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    panel.webview.html = getErrorHtml(msg)
  }
}

function getLoadingHtml(): string {
  return `<!DOCTYPE html><html><body style="font-family:sans-serif;padding:20px;background:#1e1e1e;color:#ccc">
    <p>⏳ PR 설명 생성 중...</p>
  </body></html>`
}

function getErrorHtml(msg: string): string {
  return `<!DOCTYPE html><html><body style="font-family:sans-serif;padding:20px;background:#1e1e1e;color:#f48771">
    <p>❌ ${msg}</p>
  </body></html>`
}

function getPRHtml(content: string, branch: string): string {
  const escaped = content.replace(/`/g, '\\`')
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  body { font-family: -apple-system, sans-serif; padding: 24px; background: #1e1e1e; color: #d4d4d4; max-width: 800px; }
  h1 { font-size: 16px; color: #9cdcfe; border-bottom: 1px solid #333; padding-bottom: 8px; }
  pre { background: #2d2d2d; padding: 16px; border-radius: 6px; white-space: pre-wrap; font-size: 13px; line-height: 1.6; }
  button { background: #0e639c; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-size: 13px; margin-top: 12px; }
  button:hover { background: #1177bb; }
  .branch { font-size: 12px; color: #888; margin-bottom: 12px; }
</style>
</head>
<body>
  <h1>📋 PR 설명 생성 완료</h1>
  <div class="branch">브랜치: ${branch}</div>
  <pre id="content">${content.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
  <button onclick="copyToClipboard()">📋 클립보드에 복사</button>
  <script>
    const vscode = acquireVsCodeApi();
    function copyToClipboard() {
      const text = \`${escaped}\`;
      navigator.clipboard.writeText(text).then(() => {
        document.querySelector('button').textContent = '✅ 복사됨!';
        setTimeout(() => document.querySelector('button').textContent = '📋 클립보드에 복사', 2000);
      });
    }
  </script>
</body>
</html>`
}
