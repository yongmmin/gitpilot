import * as vscode from 'vscode'
import { completeLLM } from '../services/llm'
import { checkoutBranch } from '../services/git'

const SYSTEM = `당신은 시니어 개발자입니다. 작업 설명을 받아서 Git 브랜치명을 제안합니다.

규칙:
- kebab-case 사용
- prefix: feat/, fix/, refactor/, hotfix/, chore/
- 간결하고 명확하게 (3-5단어)
- 특수문자 없이 영어 소문자와 하이픈만

응답 형식 (정확히 이 형식으로, 번호와 브랜치명만):
1. feat/example-branch-name
2. fix/another-example
3. chore/something-else`

export async function suggestBranchName() {
  const input = await vscode.window.showInputBox({
    prompt: '작업 내용을 간단히 설명해주세요',
    placeHolder: '예: JWT 리프레시 토큰 로테이션 구현',
  })

  if (!input) return

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'gitpilot: 브랜치명 제안 중...',
      cancellable: false,
    },
    async () => {
      try {
        const prompt = `다음 작업에 대한 Git 브랜치명 3가지를 제안해주세요:\n\n${input}`
        const result = await completeLLM(prompt, SYSTEM)

        const branches = result
          .split('\n')
          .map((line) => line.replace(/^\d+\.\s*/, '').trim())
          .filter((line) => line.includes('/') && !line.includes(' '))

        if (!branches.length) {
          vscode.window.showErrorMessage('브랜치명 파싱에 실패했습니다')
          return
        }

        const selected = await vscode.window.showQuickPick(branches, {
          placeHolder: '사용할 브랜치명을 선택하세요',
          title: 'gitpilot: 브랜치명 선택',
        })

        if (!selected) return

        const action = await vscode.window.showQuickPick(
          ['바로 체크아웃 (git checkout -b)', '클립보드에 복사'],
          { placeHolder: '어떻게 할까요?' }
        )

        if (action?.includes('체크아웃')) {
          checkoutBranch(selected)
          vscode.window.showInformationMessage(`✅ 브랜치 생성: ${selected}`)
        } else if (action?.includes('클립보드')) {
          await vscode.env.clipboard.writeText(selected)
          vscode.window.showInformationMessage(`✅ 클립보드에 복사: ${selected}`)
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        vscode.window.showErrorMessage(`gitpilot 오류: ${msg}`)
      }
    }
  )
}
