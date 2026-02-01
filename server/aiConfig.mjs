import fs from 'node:fs/promises'
import path from 'node:path'

export async function loadAiConfig() {
  const configPath = path.resolve(process.cwd(), 'config', 'ai.json')
  let raw
  try {
    raw = await fs.readFile(configPath, 'utf8')
  } catch (e) {
    throw new Error(
      `找不到配置文件：${configPath}\n` +
        `请先复制 config/ai.example.json 为 config/ai.json，并填入 baseUrl/apiKey/model。`,
    )
  }

  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error(`配置文件不是合法 JSON：${configPath}`)
  }

  const baseUrl = String(parsed.baseUrl || '').trim()
  const apiKey = String(parsed.apiKey || '').trim()
  const model = String(parsed.model || '').trim()

  if (!baseUrl) throw new Error('config/ai.json 缺少 baseUrl')
  if (!apiKey) throw new Error('config/ai.json 缺少 apiKey')
  if (!model) throw new Error('config/ai.json 缺少 model')

  return { baseUrl, apiKey, model }
}

