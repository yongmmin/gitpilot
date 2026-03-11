import * as vscode from 'vscode'
import { getStagedDiff, getFullDiff, hasStagedChanges } from '../services/git'
import { completeLLM } from '../services/llm'
import { showLLMError } from '../utils/errorHandler'

const SYSTEM = `당신은 시니어 개발자입니다. git diff를 분석해서 Conventional Commits 형식의 커밋 메시지를 작성합니다.

규칙:
- 형식: <type>(<scope>): <subject>
- type: feat, fix, refactor, style, docs, test, chore
- subject는 명령형 현재시제
- 본문은 변경 이유와 내용을 bullet point로
- 영어로 작성 (커밋 메시지 국제 표준)
- 50자 이내 제목, 본문은 선택사항

응답은 커밋 메시지만 출력하세요. 설명이나 코드블록 없이.`

export async function generateCommitMessage() {
  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'gitpilot: 커밋 메시지 생성 중...',
      cancellable: false,
    },
    async () => {
      try {
        const diff = hasStagedChanges() ? getStagedDiff() : getFullDiff()

        if (!diff) {
          vscode.window.showWarningMessage('변경된 파일이 없습니다. 먼저 파일을 수정하세요.')
          return
        }

        const prompt = `다음 git diff를 분석해서 커밋 메시지를 작성해주세요:\n\n${diff.slice(0, 8000)}`
        const message = await completeLLM(prompt, SYSTEM)

        const gitExtension = vscode.extensions.getExtension('vscode.git')?.exports
        const git = gitExtension?.getAPI(1)
        const repo = git?.repositories[0]

        if (repo) {
          repo.inputBox.value = message
          vscode.window.showInformationMessage('✅ 커밋 메시지가 생성되었습니다')
        } else {
          await vscode.env.clipboard.writeText(message)
          vscode.window.showInformationMessage('✅ 커밋 메시지가 클립보드에 복사되었습니다')
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        await showLLMError(msg)
      }
    }
  )
}
