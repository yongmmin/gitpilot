import * as vscode from 'vscode'
import { getFullDiff } from '../services/git'
import { streamLLM } from '../services/llm'
import { showLLMError } from '../utils/errorHandler'

const SYSTEM = `당신은 시니어 개발자입니다. 코드를 리뷰하고 개선점을 제안합니다.

다음 관점에서 분석하세요:
1. 🐛 버그 / 잠재적 오류
2. ⚡ 성능 이슈
3. 🏗️ 구조 / 아키텍처
4. 📖 가독성 / 네이밍
5. 🔒 보안 취약점
6. ✅ 긍정적인 부분

각 항목은 파일명과 라인 번호를 명시하세요.
심각도: 🔴 Critical / 🟡 Warning / 🟢 Suggestion

한국어로 작성하세요.`

export async function reviewChanges() {
  await openReviewPanel('변경사항 코드 리뷰', async (panel) => {
    try {
      const diff = getFullDiff()
      if (!diff) {
        updatePanel(panel, '변경된 파일이 없습니다')
        return
      }
      await streamToPanel(panel, `다음 git diff를 리뷰해주세요:\n\n${diff.slice(0, 12000)}`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      updatePanel(panel, `오류: ${msg}`)
    }
  })
}

export async function reviewSelection() {
  const editor = vscode.window.activeTextEditor
  if (!editor) {
    vscode.window.showWarningMessage('열린 에디터가 없습니다')
    return
  }

  const selection = editor.selection
  if (selection.isEmpty) {
    vscode.window.showWarningMessage('코드를 선택해주세요')
    return
  }

  const selectedText = editor.document.getText(selection)
  const fileName = editor.document.fileName.split('/').pop() ?? ''
  const language = editor.document.languageId

  await openReviewPanel(`${fileName} 선택 코드 리뷰`, async (panel) => {
    const prompt = `다음 ${language} 코드를 리뷰해주세요 (파일: ${fileName}):\n\n\`\`\`${language}\n${selectedText}\n\`\`\``
    await streamToPanel(panel, prompt)
  })
}

async function openReviewPanel(
  title: string,
  fn: (panel: vscode.WebviewPanel) => Promise<void>
) {
  const panel = vscode.window.createWebviewPanel(
    'gitpilotReview',
    `gitpilot: ${title}`,
    vscode.ViewColumn.Beside,
    { enableScripts: true }
  )

  panel.webview.html = getBaseHtml('⏳ 코드 리뷰 중...')
  await fn(panel)
}

async function streamToPanel(panel: vscode.WebviewPanel, prompt: string) {
  let accumulated = ''
  try {
    for await (const token of streamLLM(prompt, SYSTEM)) {
      accumulated += token
      panel.webview.html = getBaseHtml(accumulated)
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    panel.webview.html = getBaseHtml(`❌ 오류: ${msg}`)
    await showLLMError(msg)
  }
}

function updatePanel(panel: vscode.WebviewPanel, content: string) {
  panel.webview.html = getBaseHtml(content)
}

function getBaseHtml(content: string): string {
  const formatted = content
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/`(.*?)`/g, '<code>$1</code>')
    .replace(/🔴/g, '<span style="color:#f48771">🔴</span>')
    .replace(/🟡/g, '<span style="color:#cca700">🟡</span>')
    .replace(/🟢/g, '<span style="color:#4ec9b0">🟢</span>')

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  body { font-family: -apple-system, sans-serif; padding: 24px; background: #1e1e1e; color: #d4d4d4; line-height: 1.7; max-width: 860px; }
  h1 { font-size: 15px; color: #9cdcfe; border-bottom: 1px solid #333; padding-bottom: 8px; }
  code { background: #2d2d2d; padding: 2px 6px; border-radius: 3px; font-family: monospace; font-size: 12px; color: #ce9178; }
  strong { color: #dcdcaa; }
</style>
</head>
<body>
  <h1>🔍 코드 리뷰</h1>
  <div id="content">${formatted}</div>
</body>
</html>`
}
