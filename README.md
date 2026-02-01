# 话题辩论（OpenAI 协议）

一个本地小项目：左侧像 ChatGPT 一样保存/切换话题；输入辩题后，页面分为正方/反方两栏，按“轮”自动交替调用 OpenAI 兼容接口生成辩论内容；每轮结束会询问是否继续。

## 1) 配置

1. 复制 `config/ai.example.json` 为 `config/ai.json`
2. 填入你的配置：

```json
{
  "baseUrl": "https://api.openai.com",
  "apiKey": "YOUR_API_KEY_HERE",
  "model": "gpt-4o-mini"
}
```

说明：
- `baseUrl`：OpenAI 兼容服务的根地址（不要带 `/v1/...`）
- `apiKey`：服务的密钥
- `model`：模型名

## 2) 启动

```bash
npm install
npm run dev
```

然后打开：
- Web：`http://localhost:5173`
- Server：`http://localhost:8787/api/health`

## 3) 生产构建（可选）

```bash
npm run build
npm run start
```

`server/index.mjs` 会在存在 `dist/` 时托管前端静态资源，并提供 `/api/*` 接口。

