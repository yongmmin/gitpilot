import * as vscode from 'vscode'

type ProviderId = 'openai' | 'claude' | 'ollama'

const PROVIDERS: {
  id: ProviderId
  label: string
  description: string
  models: { id: string; label: string; description: string }[]
  defaultBaseUrl?: string
  needsApiKey: boolean
}[] = [
  {
    id: 'ollama',
    label: '$(server) Ollama (Local)',
    description: 'API 키 불필요 — ollama serve 실행 필요',
    defaultBaseUrl: 'http://localhost:11434',
    needsApiKey: false,
    models: [
      { id: 'llama3.2:3b', label: 'Llama 3.2 3B', description: '가볍고 빠름 (기본값)' },
      { id: 'llama3.2:latest', label: 'Llama 3.2', description: '범용' },
      { id: 'mistral:latest', label: 'Mistral', description: '코드 특화' },
      { id: 'custom', label: '$(edit) 직접 입력...', description: '모델명 직접 입력' },
    ],
  },
  {
    id: 'claude',
    label: '$(sparkle) Claude (Anthropic)',
    description: 'Anthropic API 키 필요',
    needsApiKey: true,
    models: [
      { id: 'claude-haiku-4-5-20251001', label: 'Haiku 4.5', description: '가장 빠르고 저렴' },
      { id: 'claude-sonnet-4-6', label: 'Sonnet 4.6', description: '성능·비용 균형' },
      { id: 'claude-opus-4-6', label: 'Opus 4.6', description: '최고 성능' },
    ],
  },
  {
    id: 'openai',
    label: '$(hubot) OpenAI (GPT)',
    description: 'OpenAI API 키 필요',
    needsApiKey: true,
    models: [
      { id: 'gpt-4o-mini', label: 'GPT-4o mini', description: '가장 저렴' },
      { id: 'gpt-4o', label: 'GPT-4o', description: '성능·비용 균형' },
      { id: 'o3-mini', label: 'o3 mini', description: '추론 특화' },
    ],
  },
]

export async function switchLLMProvider() {
  const cfg = vscode.workspace.getConfiguration('gitpilot')
  const currentProvider = cfg.get<string>('llm.provider')
  const currentModel = cfg.get<string>('llm.model')

  // Step 1: Provider 선택
  const providerPick = await vscode.window.showQuickPick(
    PROVIDERS.map(p => ({
      label: p.label,
      description: p.description,
      detail: p.id === currentProvider ? `$(check) 현재 사용 중 — ${currentModel}` : undefined,
      providerId: p.id,
    })),
    {
      placeHolder: 'LLM 제공자를 선택하세요',
      title: 'gitpilot: LLM 설정 (1/2 — 제공자)',
    }
  )
  if (!providerPick) return

  const selected = PROVIDERS.find(p => p.id === providerPick.providerId)!

  // Step 2: 모델 선택
  const modelPick = await vscode.window.showQuickPick(
    selected.models.map(m => ({
      label: m.label,
      description: m.description,
      detail: m.id === currentModel ? '$(check) 현재 모델' : undefined,
      modelId: m.id,
    })),
    {
      placeHolder: '모델을 선택하세요',
      title: `gitpilot: LLM 설정 (2/2 — 모델) · ${selected.label.replace(/\$\(\w+\)\s*/, '')}`,
    }
  )
  if (!modelPick) return

  let modelId = modelPick.modelId
  if (modelId === 'custom') {
    const input = await vscode.window.showInputBox({
      prompt: 'Ollama 모델명을 입력하세요',
      placeHolder: 'ex) deepseek-r1:8b',
      value: currentProvider === 'ollama' ? currentModel : '',
    })
    if (!input) return
    modelId = input.trim()
  }

  // 설정 저장
  await cfg.update('llm.provider', selected.id, vscode.ConfigurationTarget.Global)
  await cfg.update('llm.model', modelId, vscode.ConfigurationTarget.Global)
  if (selected.defaultBaseUrl) {
    await cfg.update('llm.baseUrl', selected.defaultBaseUrl, vscode.ConfigurationTarget.Global)
  }

  // Step 3: API Key 처리
  if (selected.needsApiKey) {
    const currentApiKey = cfg.get<string>('llm.apiKey') ?? ''
    const providerName = selected.label.replace(/\$\(\w+\)\s*/, '')
    const input = await vscode.window.showInputBox({
      prompt: `${providerName} API 키를 입력하세요`,
      placeHolder: selected.id === 'claude' ? 'sk-ant-...' : 'sk-...',
      value: currentApiKey,
      password: true,
    })
    if (input?.trim()) {
      await cfg.update('llm.apiKey', input.trim(), vscode.ConfigurationTarget.Global)
    } else if (!currentApiKey) {
      vscode.window.showWarningMessage('API 키를 입력하지 않았습니다. 설정에서 gitpilot.llm.apiKey를 직접 입력하세요.')
    }
  } else {
    // API 키 불필요한 provider로 전환 시 기존 키 초기화
    await cfg.update('llm.apiKey', '', vscode.ConfigurationTarget.Global)
  }

  vscode.window.showInformationMessage(`gitpilot: ${selected.label.replace(/\$\(\w+\)\s*/, '')} · ${modelId} 로 설정되었습니다.`)
}
