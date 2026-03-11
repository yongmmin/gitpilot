import * as vscode from 'vscode'
import { generateCommitMessage } from './commands/commitMessage'
import { generatePRDescription } from './commands/prDescription'
import { suggestBranchName } from './commands/branchName'
import { reviewChanges, reviewSelection } from './commands/codeReview'

export function activate(context: vscode.ExtensionContext) {
  console.log('gitpilot activated')

  const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100)
  statusBar.text = '$(robot) gitpilot'
  statusBar.tooltip = 'gitpilot: AI 개발 도우미'
  statusBar.command = 'gitpilot.generateCommitMessage'
  statusBar.show()

  const commands = [
    vscode.commands.registerCommand('gitpilot.generateCommitMessage', generateCommitMessage),
    vscode.commands.registerCommand('gitpilot.generatePRDescription', generatePRDescription),
    vscode.commands.registerCommand('gitpilot.suggestBranchName', suggestBranchName),
    vscode.commands.registerCommand('gitpilot.reviewChanges', reviewChanges),
    vscode.commands.registerCommand('gitpilot.reviewSelection', reviewSelection),
  ]

  context.subscriptions.push(statusBar, ...commands)

  vscode.window.showInformationMessage('🤖 gitpilot 활성화됨 — Cmd+Shift+P → gitpilot')
}

export function deactivate() {}
