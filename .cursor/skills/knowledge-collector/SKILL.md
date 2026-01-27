---
name: knowledge-collector
description: 将对话上下文总结为结构化的知识条目，并发送至本地采集器服务。当用户要求“保存知识”、“记录这一点”或“添加到知识库”时使用。
---

# 知识采集助手 (Knowledge Collector)

此 Skill 允许 Cursor 快速将对话中的重要知识点整理并发送至“采集器”服务，实现个人知识库的自动化积累。

## 指令 (Instructions)

当用户请求保存知识或记录讨论内容时：

1. **内容整理 (Summarize)**：
   - **核心知识点**：提取对话中的关键结论、解决方案、技术要点等，形成结构清晰的总结。
   - **源对话记录**：以 Q&A 形式记录对话过程，保留原始上下文。内容可适当精简（如去除寒暄、重复），但**尽可能保持源数据完整**，避免信息丢失。
   - 最终 Markdown 文档结构应包含：`## 核心知识点` 和 `## 源对话记录 (Q&A)` 两个主要章节。
2. **生成标题 (Generate Title)**：根据内容生成一个简洁、具有概括性的标题（将作为文件名，例如：“Koa 中间件实现原理”）。
3. **构建 Payload**：创建一个包含 `title` 和 `content` 的 JSON 对象。
4. **发送至采集器 (Send)**：调用本地 API 接口保存知识。

## 检索知识 (Retrieval)

当需要从知识库中检索相关信息时，请遵循以下标准化流程：

1. **获取索引**：首先读取 `https://raw.githubusercontent.com/crabkiller/kb/main/resources-list.json` 获取知识索引，接口返回数据符合 MCP resources/list 方法返回值规范。
2. **语义匹配**：根据索引中各资源的 `description`（包含核心知识点摘要）匹配与当前问题最相关的知识条目。
3. **读取内容**：通过索引中的 `uri` 直接从 GitHub 读取详细的 Markdown 内容，不再经过本地采集器转发。

## API 规范 (API Specification)

- **Endpoint**: `http://localhost:3001/collect`
- **Method**: `POST`
- **Request Body**:
  ```json
  {
    "title": "知识标题",
    "content": "# 知识标题\n\n## 核心知识点\n- 要点1\n- 要点2\n\n## 源对话记录 (Q&A)\n\n**Q**: 用户的问题...\n\n**A**: Agent 的回答...",
    "tags": ["分类标签1", "分类标签2"]
  }
  ```
  - `tags` 为可选字段，用于对知识进行分类，便于后续检索。
- **Response (成功)**:
  ```json
  {
    "message": "Knowledge collected successfully",
    "data": { "filename": "知识标题.md", "path": "..." }
  }
  ```
- **Response (失败)**:
  - HTTP 400: `{ "error": "Title and content are required" }`
  - HTTP 500: `{ "error": "Internal server error" }`

## 响应状态检查 (Response Validation)

调用接口后，**必须检查响应状态**：

1. **成功条件**：HTTP 状态码为 `200` 且响应体包含 `"message": "Knowledge collected successfully"`。
2. **失败处理**：
   - 若 HTTP 状态码非 200，或响应体包含 `"error"` 字段，则视为失败。
   - 失败时，**必须明确告知用户保存未成功**，并展示错误信息。
3. **连接失败**：若无法连接到服务（如 `ECONNREFUSED`），提示用户检查采集器服务是否已启动。

## 使用示例 (Examples)

**用户**: "帮我把刚才关于 RAG 优化策略的讨论保存到知识库。"

**Agent (成功场景)**:
1. 分析对话，生成总结。
2. 调用 `POST http://localhost:3001/collect`。
3. 检查响应：收到 `200` 且 `message` 为成功。
4. 回复用户："已成功将「RAG 优化策略总结」保存到知识库。"

**Agent (失败场景)**:
1. 调用接口后收到 `500` 或 `error` 字段。
2. 回复用户："保存失败：[错误信息]。请检查采集器服务状态。"

## 故障排除 (Troubleshooting)

- 如果服务未运行，请提醒用户通过 `node src/server.js` 启动采集器。
- 确保 `.env` 文件已正确配置 GitHub 仓库地址。
- 如果保存失败，请检查本地 3001 端口是否被占用。
