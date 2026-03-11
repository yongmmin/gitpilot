import * as vscode from 'vscode'
import { generateCommitMessage } from './commands/commitMessage'
import { generatePRDescription } from './commands/prDescription'
import { suggestBranchName } from './commands/branchName'
import { reviewChanges, reviewSelection } from './commands/codeReview'
import { switchLLMProvider } from './commands/switchProvider'

const MODEL_SHORT: Record<string, string> = {
  'claude-haiku-4-5-20251001': 'Haiku 4.5',
  'claude-sonnet-4-6': 'Sonnet 4.6',
  'claude-opus-4-6': 'Opus 4.6',
  'gpt-4o': 'GPT-4o',
  'gpt-4o-mini': 'GPT-4o mini',
  'o3-mini': 'o3 mini',
}

function getStatusBarText(): string {
  const cfg = vscode.workspace.getConfiguration('gitpilot')
  const provider = cfg.get<string>('llm.provider') ?? 'claude'
  const model = cfg.get<string>('llm.model') ?? ''
  const modelLabel = MODEL_SHORT[model] ?? model
  const icon = provider === 'claude' ? '$(sparkle)' : provider === 'ollama' ? '$(server)' : '$(hubot)'
  return `${icon} ${modelLabel}`
}

export function activate(context: vscode.ExtensionContext) {
  console.log('gitpilot activated')

  const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100)
  statusBar.tooltip = 'gitpilot: 클릭해서 LLM 모델 변경'
  statusBar.command = 'gitpilot.switchLLMProvider'
  statusBar.text = getStatusBarText()
  statusBar.show()

  const configWatcher = vscode.workspace.onDidChangeConfiguration(e => {
    if (e.affectsConfiguration('gitpilot.llm')) {
      statusBar.text = getStatusBarText()
    }
  })

  const commands = [
    vscode.commands.registerCommand('gitpilot.generateCommitMessage', generateCommitMessage),
    vscode.commands.registerCommand('gitpilot.generatePRDescription', generatePRDescription),
    vscode.commands.registerCommand('gitpilot.suggestBranchName', suggestBranchName),
    vscode.commands.registerCommand('gitpilot.reviewChanges', reviewChanges),
    vscode.commands.registerCommand('gitpilot.reviewSelection', reviewSelection),
    vscode.commands.registerCommand('gitpilot.switchLLMProvider', switchLLMProvider),
  ]

  context.subscriptions.push(statusBar, configWatcher, ...commands)

  vscode.window.showInformationMessage('🤖 gitpilot 활성화됨 — Cmd+Shift+P → gitpilot')

  const cfg = vscode.workspace.getConfiguration('gitpilot')
  const provider = cfg.get<string>('llm.provider') ?? 'ollama'
  if (provider === 'ollama') {
    vscode.window.showInformationMessage(
      'gitpilot: Ollama 로컬 모드입니다. 터미널에서 ollama serve를 실행해주세요.',
      'Ollama 설치 안내'
    ).then(action => {
      if (action === 'Ollama 설치 안내') {
        vscode.env.openExternal(vscode.Uri.parse('https://ollama.com'))
      }
    })
  }
}

export function deactivate() {}
