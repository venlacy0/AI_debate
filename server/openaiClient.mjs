import { loadAiConfig } from './aiConfig.mjs'

function getChatCompletionsUrl(baseUrl) {
  const base = String(baseUrl).replace(/\/+$/, '')
  return base.endsWith('/v1') ? `${base}/chat/completions` : `${base}/v1/chat/completions`
}

export async function chatCompletions(input) {
  const cfg = await loadAiConfig()

  const url = getChatCompletionsUrl(cfg.baseUrl)
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${cfg.apiKey}`,
    },
    body: JSON.stringify({
      model: cfg.model,
      messages: input.messages,
      temperature: input.temperature ?? 0.7,
    }),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`上游返回 ${res.status}：${text}`)
  }

  const data = await res.json()
  const content = data?.choices?.[0]?.message?.content
  if (!content || typeof content !== 'string') {
    throw new Error('上游返回结构异常：缺少 choices[0].message.content')
  }
  return content
}

export async function chatCompletionsSSE(input) {
  const cfg = await loadAiConfig()
  const url = getChatCompletionsUrl(cfg.baseUrl)

  const timeoutMs = Number(process.env.UPSTREAM_TIMEOUT_MS || 120000)
  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(new Error('上游请求超时')), timeoutMs)

  const outerSignal = input.signal
  if (outerSignal) {
    if (outerSignal.aborted) ac.abort()
    else outerSignal.addEventListener('abort', () => ac.abort(), { once: true })
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${cfg.apiKey}`,
      },
      signal: ac.signal,
      body: JSON.stringify({
        model: cfg.model,
        messages: input.messages,
        temperature: input.temperature ?? 0.7,
        stream: true,
      }),
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`上游返回 ${res.status}：${text}`)
    }

    if (!res.body) throw new Error('上游未返回可读取的流')
    return res
  } finally {
    clearTimeout(timer)
  }
}
