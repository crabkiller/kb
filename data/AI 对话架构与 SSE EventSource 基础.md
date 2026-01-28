# AI 对话架构与 SSE EventSource 基础

## 核心知识点

- **AI 对话前端架构分层（React 内核 + Vue 壳）**：`ai-chat-react` 负责通用对话 UI、消息处理（SSE/状态/渲染）；`ai-chat-vue` 负责编辑器业务集成（占位元素、落画布、参数面板、消费记录等），并通过 `appendChat(container, options)` 把 React 挂载到 Vue 的 DOM 容器里。
- **协同机制用事件总线解耦**：两端通过 `EventEmitter` 通信。典型链路是用户提交 `submit` → React 建立流式连接 → 解析增量消息 → `updateMessages/updateFilteredMessages/requesting` → Vue 侧监听并执行编辑器动作（如 `addImage/addVideo/addLayout`）与状态同步。
- **本项目的“流式输出”实现偏 fetch-stream 而非原生 EventSource**：使用 `fetch` 获取 `response.body`，再用 `TransformStream` 做拼包与 JSON 序列解析（`parseJsonSequence`），将 chunk 转成 `{done, data: MessageType[]}` 逐步喂给 `MessageHandler.handleSSEMessage(data, done)`。
- **消息模型关键点**：`MessageType` 包含 `role`（`user/assistant/function/status/heartbeat`）、`content`（`type/text`）、`messageId/threadId`、`status`（`waiting/loading/finished/stop`）、以及 `extra.localAigc`（工具结果：`tools[] + workId`）。`function_response` 通过 `extra.lastToolMessageId` 回填到对应的 `function_call`。
- **SSE（概念）**：Server-Sent Events 是服务器→浏览器单向推送的长连接机制，典型 `Content-Type: text/event-stream`，消息以 `event/id/data/retry` 行组织，空行分隔；浏览器端可用原生 `EventSource` 订阅并自动重连。
- **原生 EventSource 的常见限制**：只能 `GET`、难以自定义请求体/自定义 header（如 `Authorization`），跨域需 CORS 且链路需禁用缓冲；若要更灵活（POST、自定义 header、细粒度取消），常用 `fetch + ReadableStream` 自行实现流解析。

## 源对话记录 (Q&A)

**Q**: 分析总结 AI 对话架构设计，包括：
1. 前端对话框设计思路
2. 与后端的消息协同机制和协议
3. 消息流式输出设计思路
4. 消息具体数据结构说明
5. React 如何与 Vue 混合使用

代码参考：domains/editor/packages/design/ai-chat-react domains/editor/packages/design/ai-chat-vue

**A**: 我会先快速扫一遍 `ai-chat-react` / `ai-chat-vue` 的目录与核心入口文件，定位：会话容器、消息模型、请求层（HTTP/SSE/WebSocket）、流式渲染与状态管理、以及 React/Vue 的互相嵌入方式；然后把这些信息整理成一份面向架构的总结（含协议字段与数据结构示例）。

**Q**: 分析总结 AI 对话架构设计，包括：
1. 前端对话框设计思路
2. 与后端的消息协同机制和协议
3. 消息流式输出设计思路
4. 消息具体数据结构说明
5. React 如何与 Vue 混合使用

代码参考：domains/editor/packages/design/ai-chat-react domains/editor/packages/design/ai-chat-vue

**A**: 我已经定位到 React 侧的 SSE/消息处理核心（`services/sse.ts`、`services/sse-manager.ts`、`services/message-handler.ts`、`MESSAGE_STRUCTURE.md`），以及 Vue 侧大量通过 `@design/ai-chat-react` 复用类型/能力并在 `chat-wrap.vue` 引入 React 的 `style.css`。接下来我会把关键文件读一遍，补齐“协议字段/数据结构/混合挂载方式”的细节，再给你一份结构化总结。

**Q**: 分析总结 AI 对话架构设计，包括：
1. 前端对话框设计思路
2. 与后端的消息协同机制和协议
3. 消息流式输出设计思路
4. 消息具体数据结构说明
5. React 如何与 Vue 混合使用

代码参考：domains/editor/packages/design/ai-chat-react domains/editor/packages/design/ai-chat-vue

**A**: 我已经把核心链路读出来了：React 侧用 `SSEManager + MessageHandler` 管“连接与流解析/消息合并/工具结果落地”，Vue 侧主要负责“编辑器业务集成（占位元素、落画布、参数面板）”，并通过共享 `EventEmitter` 跟 React 聊天 UI 互通。接下来我再补两处关键源码（`appendChat` 实现、`use-message` 如何驱动 UI），然后给你完整架构总结。

**Q**: 分析总结 AI 对话架构设计，包括：
1. 前端对话框设计思路
2. 与后端的消息协同机制和协议
3. 消息流式输出设计思路
4. 消息具体数据结构说明
5. React 如何与 Vue 混合使用

代码参考：domains/editor/packages/design/ai-chat-react domains/editor/packages/design/ai-chat-vue

**A**: ## 1. 前端对话框设计思路（整体架构）
我已经把关键文件读出来了：React 侧用 `SSEManager + MessageHandler` 管“连接与流解析/消息合并/工具结果落地”，Vue 侧主要负责“编辑器业务集成（占位元素、落画布、参数面板）”，并通过共享 `EventEmitter` 跟 React 聊天 UI 互通。接下来我再补两处关键源码（`appendChat` 实现、`use-message` 如何驱动 UI），然后给你完整架构总结。

## 2. 与后端的消息协同机制和协议（请求/停止/历史）
### 2.1 创建/续写对话（completion）
- **默认 SSE 服务地址**：`{baseUrl}/api/ai-agent/v1/thread/completion`（可通过 `ChatOptions.sseBaseUrl` 覆盖）。见 `ai-chat-react/src/services/chat-config.ts`。
- **HTTP headers 关键字段**
  - `Authorization`: OAuth header 或外部注入 `getAuthorization()`
  - `x-content-id`: 编辑器 work/content id（从 URL query 取 `id`，必要时先 `beforeGenerate` 生成）
  - `x-user-id`: 用户 id
- **POST body 关键字段（驼峰/下划线以服务端为准）**
  - `content`: `{ type, text }`（用户输入）
  - `thread_id`: 续写时带当前 threadId；新对话为空
  - `local_thread_id` / `local_message_id`: 客户端生成的临时 id
  - `input_skill_id`: 技能/模式
  - `attachments`: `[{ uri, mime_type, from_user_upload }]`
  - `extra`: 透传扩展字段（例如场景、参数等）

关键实现（请求体 + headers）：

```120:151:/Users/tudou/Documents/Project/gaoding/meta/domains/editor/packages/design/ai-chat-react/src/services/sse.ts
        const response = await fetch(chatConfigInstance.sseBaseUrl, {
            signal,
            method: 'post',
            credentials: 'include',
            body: JSON.stringify({
                content,
                name: 'user',
                role: role || 'user',
                local_thread_id: currentThreadId ? '' : uuidv4(),
                local_message_id: uuidv4(),
                thread_id: currentThreadId,
                input_skill_id: messageList[0]?.inputSkillId || '0',
                attachments:
                    messageList[0]?.attachments?.map((item) => {
                        return {
                            uri: item.uri,
                            mime_type: item.mimeType,
                            from_user_upload: !!item.fromUserUpload,
                        };
                    }) || [],
                extra: {
                    ...messageList[0]?.extra,
                },
            }),
            headers: {
                'Content-Type': 'application/json',
                'Authorization': authorization,
                'x-content-id': contentId,
                'x-user-id': userId,
            },
        });
```

### 2.2 停止生成（stop）
- 关闭连接时（用户取消）会额外调用：`POST {baseUrl}/api/ai-agent/v1/thread/{threadId}/stop`，并带同样的 `Authorization/x-content-id/x-user-id`。见 `ai-chat-react/src/services/sse.ts`。

### 2.3 拉取历史消息（messages）
- 如果已有 `recordConversation.id`：请求 `GET {aiAgentBaseUrl}/ai-agent/v1/thread/{id}/messages`（header 带 `x-user-id`）。见 `ai-chat-react/src/components/chat/index.tsx`。

## 3. 消息流式输出设计思路（SSE/流解析/增量更新）
- **不使用浏览器原生 EventSource**，而是 `fetch + ReadableStream`：这样更容易统一鉴权、携带 cookie、支持自定义解析。
- **流解析策略**：服务端返回的并非标准 SSE `data:` 行，而是“JSON 序列/可能拆包”的文本流；前端用自定义 `TransformStream` 做“拼包 + JSON 序列解析（parseJsonSequence）”，产出 `{done, data: MessageType[]}`。
- **增量更新**：每个 chunk 进 `MessageHandler.handleSSEMessage(data, done)`
  - `done=false`：逐条 `processMessage`，更新/创建消息、合并 extra、处理 function_response，最后 `observer.onUpdate(filteredMessages)` 推 UI。
  - `done=true`：`finishMessages()`，把状态落到 `finished`，补齐失败的 `localAigc`/`isError`，然后 `observer.onSuccess(...)`。
- **连接保活**：存在 `heartbeat` 消息（`code=-1005`），在 `MessageHandler` 中直接过滤不展示。
- **回放模式**：`ai-chat-react` 有模拟 SSE 的 playback 流（`use-playback.ts`），复用同一套 `MessageHandler`，但 `noSSE=true`（不打埋点/不走真实网络）。

## 4. 消息具体数据结构说明（MessageType/角色/工具结果）
### 4.1 基础模型
`MessageType` 继承自 `@editor/data-structure` 的 `Message`（Partial），并扩展：
- **status**：`waiting | loading | finished | stop`
- **event**：例如 `system_error`
- **functionCalls**：批量生成场景把多个 `function_call` 合并到首条消息的 `functionCalls`，方便 UI 一次渲染多图结果

### 4.2 role / content.type 组合（核心约定）
- **role**
  - `user`：用户输入
  - `assistant`：AI 普通输出 / `function_call` / `reasoning`
  - `function`：工具执行结果（`function_response`），通常不直接展示，用来“回填”到对应 `function_call` 的 `extra.localAigc`
  - `status`：状态/错误/撤销/恢复等（包括稿豆不足、撤销、恢复）
  - `heartbeat`：SSE 保活（不展示）
- **content.type**
  - `plain`：纯文本
  - `function_call`：`text` 是 JSON（含 `name`、`arguments`）
  - `function_response`：`text` 是 JSON 数组（生成结果）
  - `reasoning`：思考过程
  - `system`：系统消息

### 4.3 extra.localAigc（最关键的“工具结果落地”）
当某条 `assistant/function_call` 完成后，会被补上：
- `extra.localAigc.tools[]`：每个 tool 有 `toolType + metadata + result`
- `extra.localAigc.workId`：当前 work/content id
- 并带 `extra.taskId / deductPoints / lastToolMessageId / isError / outputSchema` 等

## 5. React 如何与 Vue 混合使用（落地方式）
这里是**“Vue 容器 + React 挂载”**，不是 WebComponent：
- **React 侧提供 `appendChat(container, options)`**，内部 `createRoot(container).render(<Chat .../>)`（回放模式按需 import PlaybackChat）。
- **Vue 侧在 `chat-wrap.vue` 里提供一个空 div 容器**（`ref="chatEl"`），在 `onMounted` 调 `appendChat(chatEl.value, {..., events})`，并导入 React 的 `style.css` 复用同一套样式变量。
- **共享事件总线是关键 glue**：`ai-chat-vue` 用 `useSharedChatEvents()` 保证同一个 `EventEmitter` 实例贯穿多个对话入口（右侧/底部等），从而“React UI 的消息态”和“Vue 编辑器操作”一致。

**Q**: 1. SSE 是什么
2. 浏览器原生 EventSource 一般如何实现

**A**: ## 1. SSE 是什么
**SSE（Server-Sent Events）**是一种 **服务器 → 浏览器单向推送** 的标准能力：浏览器用一个**长连接 HTTP**（通常 `GET`）订阅某个地址，服务器持续以 `text/event-stream` 格式把事件一条条写回去。  
适合：**聊天流式回复、进度/通知、日志** 等“持续更新但不需要双向”的场景。

- **协议要点**
  - 响应头：`Content-Type: text/event-stream`
  - 连接特性：长连接、浏览器自动重连（可控）
  - 消息格式：按行组织（`data:`、`event:`、`id:`、`retry:`），消息之间用空行分隔

## 2. 浏览器原生 EventSource 一般如何实现
前端通常直接用 `EventSource(url)` 建立 SSE 连接，然后监听 `message/open/error`（以及自定义事件名）。

```js
// 1) 建连（通常是 GET /sse）
const es = new EventSource('/api/stream'); // 默认会带同源 cookie（受 CORS 影响）

// 2) 收默认事件（服务器未指定 event: 时，走 message）
es.onmessage = (e) => {
  // e.data 是 string（通常是 JSON 字符串）
  console.log('message:', e.data);
};

// 3) 连接建立
es.onopen = () => {
  console.log('sse opened');
};

// 4) 出错/断开（浏览器可能会自动重连）
es.onerror = (e) => {
  console.log('sse error', e);
};

// 5) 监听自定义事件（服务端写 event: xxx）
es.addEventListener('progress', (e) => {
  console.log('progress:', e.data);
});

// 6) 主动关闭
// es.close();
```

- **服务端返回示例（格式）**

```txt
event: progress
id: 42
data: {"percent":30}

data: {"text":"hello"}   # 默认 message 事件

```

- **常见注意点**
  - `EventSource` **只能 GET**，也不能自定义请求体；自定义 header（比如 `Authorization`）也做不到，通常只能靠 **cookie / query 参数**。
  - 跨域要配 CORS，且 SSE 场景要确保代理/网关不缓冲（否则看不到“流式”）。
  - 需要更灵活控制（POST、header、二进制、细粒度取消）时，很多项目会改用 **`fetch + ReadableStream`** 来“自己实现一层 SSE/流协议解析”。

