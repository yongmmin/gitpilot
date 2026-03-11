import { getConfig } from '../config'

export async function* streamLLM(prompt: string, system: string): AsyncGenerator<string> {
  const cfg = getConfig()

  try {
    if (cfg.provider === 'ollama') {
      yield* streamOllama(prompt, system, cfg.model, cfg.baseUrl, cfg.timeoutMs)
    } else if (cfg.provider === 'claude') {
      yield* streamClaude(prompt, system, cfg.model, cfg.apiKey, cfg.timeoutMs)
    } else {
      yield* streamOpenAI(prompt, system, cfg.model, cfg.apiKey, cfg.timeoutMs)
    }
  } catch (err) {
    // 이미 streamOllama 내부에서 가공된 메시지는 그대로 통과
    if (err instanceof Error && (
      err.message.includes('생성 중 연결이 끊겼습니다') ||
      err.message.includes('모델 실행 실패')
    )) {
      throw err
    }
    if (cfg.provider === 'ollama' && err instanceof TypeError && (err.message.includes('fetch') || err.message.includes('connect'))) {
      throw new Error(
        `Ollama 서버에 연결할 수 없습니다.\n\n` +
        `👉 아래 중 하나를 실행하세요:\n` +
        `   • 터미널: ollama serve\n` +
        `   • Ollama 데스크톱 앱 실행\n\n` +
        `설치가 안 되어 있다면: https://ollama.com\n` +
        `다른 LLM을 쓰려면: 상태바 모델명 클릭 → 제공자 변경`
      )
    }
    throw err
  }
}

export async function completeLLM(prompt: string, system: string): Promise<string> {
  let result = ''
  for await (const token of streamLLM(prompt, system)) {
    result += token
  }
  return result.trim()
}

async function* streamOllama(
  prompt: string,
  system: string,
  model: string,
  baseUrl: string,
  timeoutMs: number
): AsyncGenerator<string> {
  const res = await fetchWithTimeout(`${baseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      stream: true,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: prompt },
      ],
    }),
  }, timeoutMs)

  if (!res.ok || !res.body) {
    if (res.status === 500) {
      throw new Error(
        `Ollama 모델 실행 실패 (500)\n\n` +
        `👉 가능한 원인:\n` +
        `   • 모델 메모리 부족 — 더 가벼운 모델로 전환해보세요 (예: llama3.2:3b)\n` +
        `   • 모델이 설치되지 않음 — 터미널: ollama pull ${model}\n` +
        `   • 상태바 클릭 → 제공자 변경으로 다른 LLM 사용`
      )
    }
    throw new Error(`Ollama 연결 실패: ${res.statusText}\n\n👉 터미널에서 'ollama serve' 또는 Ollama 앱을 실행한 뒤 다시 시도하세요.`)
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let started = false

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      started = true

      const lines = decoder.decode(value).split('\n').filter(Boolean)
      for (const line of lines) {
        try {
          const json = JSON.parse(line) as { message?: { content: string }; done: boolean }
          if (json.message?.content) yield json.message.content
          if (json.done) return
        } catch { /* 무시 */ }
      }
    }
  } catch (err) {
    if (err instanceof TypeError) {
      if (started) {
        throw new Error(
          `Ollama 생성 중 연결이 끊겼습니다\n\n` +
          `👉 가능한 원인:\n` +
          `   • 모델 메모리 부족 — 더 가벼운 모델로 전환해보세요\n` +
          `   • 입력 텍스트가 너무 김 — 더 작은 범위를 선택해 재시도\n` +
          `   • 상태바 클릭 → 제공자 변경으로 다른 LLM 사용`
        )
      }
    }
    throw err
  }
}

async function* streamClaude(
  prompt: string,
  system: string,
  model: string,
  apiKey: string,
  timeoutMs: number
): AsyncGenerator<string> {
  const res = await fetchWithTimeout('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: model || 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      stream: true,
      system,
      messages: [{ role: 'user', content: prompt }],
    }),
  }, timeoutMs)

  if (!res.ok || !res.body) {
    if (res.status === 429) {
      throw new Error(
        `Claude API 요청 한도 초과 (429 Too Many Requests)\n\n` +
        `👉 아래 중 하나를 시도하세요:\n` +
        `   • 잠시 후 다시 시도하세요\n` +
        `   • Anthropic 플랜/크레딧을 확인하세요: https://console.anthropic.com\n` +
        `   • 다른 LLM으로 전환: 상태바 모델명 클릭 → 제공자 변경`
      )
    }
    throw new Error(`Claude API 실패: ${res.statusText}`)
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    const lines = decoder.decode(value).split('\n').filter(Boolean)
    for (const line of lines) {
      if (!line.startsWith('data:')) continue
      try {
        const json = JSON.parse(line.slice(5)) as {
          type: string
          delta?: { text: string }
        }
        if (json.type === 'content_block_delta' && json.delta?.text) {
          yield json.delta.text
        }
      } catch { /* 무시 */ }
    }
  }
}

async function* streamOpenAI(
  prompt: string,
  system: string,
  model: string,
  apiKey: string,
  timeoutMs: number
): AsyncGenerator<string> {
  const res = await fetchWithTimeout('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: model || 'gpt-4o',
      stream: true,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: prompt },
      ],
    }),
  }, timeoutMs)

  if (!res.ok || !res.body) {
    if (res.status === 429) {
      throw new Error(
        `OpenAI API 요청 한도 초과 (429 Too Many Requests)\n\n` +
        `👉 아래 중 하나를 시도하세요:\n` +
        `   • 잠시 후 다시 시도하세요\n` +
        `   • OpenAI 플랜/크레딧을 확인하세요: https://platform.openai.com/usage\n` +
        `   • 다른 LLM으로 전환: 상태바 모델명 클릭 → 제공자 변경`
      )
    }
    throw new Error(`OpenAI API 실패: ${res.statusText}`)
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    const lines = decoder.decode(value).split('\n').filter(Boolean)
    for (const line of lines) {
      if (!line.startsWith('data:')) continue
      const data = line.slice(5).trim()
      if (data === '[DONE]') return
      try {
        const json = JSON.parse(data) as {
          choices: { delta: { content?: string } }[]
        }
        const content = json.choices[0]?.delta?.content
        if (content) yield content
      } catch { /* 무시 */ }
    }
  }
}

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(input, { ...init, signal: controller.signal })
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      const seconds = Math.ceil(timeoutMs / 1000)
      throw new Error(`LLM 요청 타임아웃: ${seconds}초 내 응답 없음`)
    }
    throw err
  } finally {
    clearTimeout(timeoutId)
  }
}
