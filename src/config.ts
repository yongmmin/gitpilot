import * as vscode from 'vscode'

export interface LLMConfig {
  provider: 'ollama' | 'claude' | 'openai'
  model: string
  baseUrl: string
  apiKey: string
  language: 'ko' | 'en'
}

export function getConfig(): LLMConfig {
  const cfg = vscode.workspace.getConfiguration('gitpilot')
  return {
    provider: cfg.get('llm.provider') ?? 'ollama',
    model: cfg.get('llm.model') ?? 'llama3.2:3b',
    baseUrl: cfg.get('llm.baseUrl') ?? 'http://localhost:11434',
    apiKey: cfg.get('llm.apiKey') ?? '',
    language: cfg.get('language') ?? 'ko',
  }
}
