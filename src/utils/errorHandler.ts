import * as vscode from 'vscode'

export async function showLLMError(msg: string): Promise<void> {
  const firstLine = msg.split('\n')[0]
  const action = await vscode.window.showErrorMessage(
    `gitpilot: ${firstLine}`,
    '제공자 변경'
  )
  if (action === '제공자 변경') {
    vscode.commands.executeCommand('gitpilot.switchLLMProvider')
  }
}
