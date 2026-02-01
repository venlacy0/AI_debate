# AI 话题辩论（OpenAI 兼容协议 / 流式）

一个本地小项目：左侧像 ChatGPT 一样保存/切换话题；输入辩题后页面变为正方/反方双栏；按“轮”交替生成辩论内容，支持流式输出与 Markdown 渲染（强调更清晰）；每轮结束会询问是否继续。

## 功能

- 话题列表：新建/切换/删除；自动保存到浏览器 `localStorage`
- 双方辩论：正方/反方轮流发言；每轮之间有分割线
- 流式输出：生成时边返回边显示
- 思考折叠：若模型返回 `reasoning_content` 则显示“思考过程”，否则不显示
- Markdown 渲染：支持 **加粗**、_斜体_、> 引用、`代码`（不启用 HTML 注入）

## 安全提醒（很重要）

- `config/ai.json` 含密钥，已被 `.gitignore` 忽略，**不要提交到 GitHub**
- 如果你曾经把密钥发到任何聊天/截图/日志里，建议立刻去上游**重置/作废**那把 key

## 配置

1) 复制配置文件：

```bash
cp config/ai.example.json config/ai.json
```

Windows PowerShell：

```powershell
Copy-Item config/ai.example.json config/ai.json
```

2) 修改 `config/ai.json`：

```json
{
  "baseUrl": "https://api.openai.com",
  "apiKey": "YOUR_API_KEY_HERE",
  "model": "deepseek-r1"
}
```

说明：
- `baseUrl`：OpenAI 兼容服务根地址，允许带或不带 `/v1`（两种都支持）
- `apiKey`：你的密钥
- `model`：模型名，例如 `deepseek-r1`

## 启动（开发）

```bash
npm install
npm run dev
```

打开：
- 前端：`http://127.0.0.1:5173`
- 后端健康检查：`http://127.0.0.1:8787/api/health`

## 生产构建（可选）

```bash
npm run build
npm run start
```

`server/index.mjs` 会在存在 `dist/` 时托管前端静态资源，并提供 `/api/*` 接口。

## 额外：静态 UI 示例

`example.html` 是一个单文件静态页面（不依赖后端），用于快速预览 UI / 交互并交给其它模型做界面优化。