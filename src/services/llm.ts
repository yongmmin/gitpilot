import { getConfig } from '../config'

export async function* streamLLM(prompt: string, system: string): AsyncGenerator<string> {
  const cfg = getConfig()

  if (cfg.provider === 'ollama') {
    yield* streamOllama(prompt, system, cfg.model, cfg.baseUrl)
  } else if (cfg.provider === 'claude') {
    yield* streamClaude(prompt, system, cfg.model, cfg.apiKey)
  } else {
    yield* streamOpenAI(prompt, system, cfg.model, cfg.apiKey)
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
  baseUrl: string
): AsyncGenerator<string> {
  const res = await fetch(`${baseUrl}/api/chat`, {
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
  })

  if (!res.ok || !res.body) throw new Error(`Ollama 연결 실패: ${res.statusText}`)

  const reader = res.body.getReader()
  const decoder = new TextDecoder()

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    const lines = decoder.decode(value).split('\n').filter(Boolean)
    for (const line of lines) {
      try {
        const json = JSON.parse(line) as { message?: { content: string }; done: boolean }
        if (json.message?.content) yield json.message.content
        if (json.done) return
      } catch { /* 무시 */ }
    }
  }
}

async function* streamClaude(
  prompt: string,
  system: string,
  model: string,
  apiKey: string
): AsyncGenerator<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
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
  })

  if (!res.ok || !res.body) throw new Error(`Claude API 실패: ${res.statusText}`)

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
  apiKey: string
): AsyncGenerator<string> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
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
  })

  if (!res.ok || !res.body) throw new Error(`OpenAI API 실패: ${res.statusText}`)

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
