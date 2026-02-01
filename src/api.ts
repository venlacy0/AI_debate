export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string }

export async function chatViaServer(input: {
  messages: ChatMessage[]
  temperature?: number
}) {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(text || `请求失败：${res.status}`)
  }

  const data = (await res.json()) as { content: string }
  if (!data?.content) throw new Error('服务端返回为空')
  return data.content
}

export async function chatViaServerStream(
  input: {
    messages: ChatMessage[]
    temperature?: number
  },
  onDelta: (ev: { type: 'reasoning' | 'content'; delta: string }) => void,
) {
  const res = await fetch('/api/chat/stream', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(text || `请求失败：${res.status}`)
  }

  if (!res.body) throw new Error('浏览器不支持流式响应')

  const reader = res.body.getReader()
  const decoder = new TextDecoder('utf-8')
  let buffer = ''
  let contentAcc = ''
  let reasoningAcc = ''

  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    buffer = buffer.replace(/\r\n/g, '\n')

    while (true) {
      const idx = buffer.indexOf('\n\n')
      if (idx === -1) break
      const event = buffer.slice(0, idx)
      buffer = buffer.slice(idx + 2)

      for (const line of event.split('\n')) {
        const trimmed = line.trim()
        if (!trimmed.startsWith('data:')) continue
        const data = trimmed.slice(5).trim()
        if (!data) continue
        if (data === '[DONE]') return { content: contentAcc, reasoning: reasoningAcc }

        let parsed: any
        try {
          parsed = JSON.parse(data)
        } catch {
          continue
        }

        const choice = parsed?.choices?.[0]
        const delta = choice?.delta
        const reasoning =
          (typeof delta?.reasoning_content === 'string' && delta.reasoning_content) || ''
        const content =
          (typeof delta?.content === 'string' && delta.content) ||
          (typeof choice?.message?.content === 'string' && choice.message.content) ||
          ''

        if (reasoning) {
          reasoningAcc += reasoning
          onDelta({ type: 'reasoning', delta: reasoning })
        }

        if (content) {
          contentAcc += content
          onDelta({ type: 'content', delta: content })
        }
      }
    }
  }

  return { content: contentAcc, reasoning: reasoningAcc }
}
