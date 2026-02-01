import express from 'express'
import cors from 'cors'
import path from 'node:path'
import fs from 'node:fs'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { chatCompletions, chatCompletionsSSE } from './openaiClient.mjs'

const app = express()
const port = Number(process.env.PORT || 8787)
let server = null

app.use(express.json({ limit: '1mb' }))

if (process.env.NODE_ENV !== 'production') {
  app.use(
    cors({
      origin: ['http://localhost:5173'],
    }),
  )
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
})

app.post('/api/chat', async (req, res) => {
  try {
    const messages = req.body?.messages
    const temperature = req.body?.temperature

    if (!Array.isArray(messages) || messages.length === 0) {
      res.status(400).send('messages 不能为空')
      return
    }

    const content = await chatCompletions({ messages, temperature })
    res.json({ content })
  } catch (e) {
    res.status(500).send(e instanceof Error ? e.message : '服务端未知错误')
  }
})

app.post('/api/chat/stream', async (req, res) => {
  const ac = new AbortController()
  // 只在“客户端提前断开连接”时中止上游；正常结束时不要误伤
  res.on('close', () => {
    if (!res.writableEnded) ac.abort()
  })

  try {
    const messages = req.body?.messages
    const temperature = req.body?.temperature

    if (!Array.isArray(messages) || messages.length === 0) {
      res.status(400).send('messages 不能为空')
      return
    }

    // SSE 最不容易被中间层缓冲：前端 fetch 按 data: 解析
    res.setHeader('content-type', 'text/event-stream; charset=utf-8')
    res.setHeader('cache-control', 'no-cache, no-transform')
    res.setHeader('connection', 'keep-alive')
    res.setHeader('x-accel-buffering', 'no')

    const upstream = await chatCompletionsSSE({
      messages,
      temperature,
      signal: ac.signal,
    })

    // 直接把上游 SSE 原样透传给前端（最“直连”的流式体验）
    await pipeline(Readable.fromWeb(upstream.body), res)
  } catch (e) {
    if (!res.headersSent) {
      res.status(500).send(e instanceof Error ? e.message : '服务端未知错误')
      return
    }
    res.end()
  }
})

// Production: serve web
const distDir = path.resolve(process.cwd(), 'dist')
const indexHtml = path.resolve(distDir, 'index.html')
if (fs.existsSync(distDir) && fs.existsSync(indexHtml)) {
  app.use(express.static(distDir))
  app.get('*', (_req, res) => res.sendFile(indexHtml))
}

server = app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`[server] http://localhost:${port}`)
})

function shutdown(signal) {
  if (!server) process.exit(0)
  server.close(() => process.exit(0))
  // 兜底：如果还有挂起连接，强制退出
  setTimeout(() => process.exit(0), 1500).unref()
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))

server.on('error', (err) => {
  if (err && err.code === 'EADDRINUSE') {
    // eslint-disable-next-line no-console
    console.error(`[server] 端口 ${port} 已被占用：请关闭占用进程，或用 PORT=xxxx 更换端口`)
  }
})
