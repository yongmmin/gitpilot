import { execSync } from 'child_process'
import * as vscode from 'vscode'

function getCwd(): string {
  const folders = vscode.workspace.workspaceFolders
  if (!folders?.length) throw new Error('열린 워크스페이스가 없습니다')
  return folders[0].uri.fsPath
}

function exec(cmd: string): string {
  try {
    return execSync(cmd, { cwd: getCwd(), encoding: 'utf-8', maxBuffer: 1024 * 1024 * 10 }).trim()
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    throw new Error(`git 명령어 실패: ${msg}`)
  }
}

export function getStagedDiff(): string {
  return exec('git diff --staged')
}

export function getUnstagedDiff(): string {
  return exec('git diff')
}

export function getFullDiff(): string {
  const staged = exec('git diff --staged')
  const unstaged = exec('git diff')
  return [staged, unstaged].filter(Boolean).join('\n')
}

export function getBranchDiff(base = 'main'): string {
  try {
    return exec(`git diff ${base}...HEAD`)
  } catch {
    return exec(`git diff HEAD~1...HEAD`)
  }
}

export function getCommitLog(base = 'main'): string {
  try {
    return exec(`git log ${base}...HEAD --oneline`)
  } catch {
    return exec('git log -10 --oneline')
  }
}

export function getCurrentBranch(): string {
  return exec('git rev-parse --abbrev-ref HEAD')
}

export function hasStagedChanges(): boolean {
  try {
    const result = exec('git diff --staged --name-only')
    return result.length > 0
  } catch {
    return false
  }
}

export function checkoutBranch(name: string): void {
  exec(`git checkout -b ${name}`)
}
