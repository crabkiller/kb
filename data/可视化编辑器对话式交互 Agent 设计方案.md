# 可视化编辑器对话式交互 Agent 设计方案

## 核心知识点

### 1. 业界方案调研结论

- **OpenAI Function Calling**：定义 Tool Schema，LLM 选择并生成结构化参数，支持 `strict: true` 保证 100% Schema 合规
- **AG-UI Protocol**：事件驱动的 Agent-User 交互协议，16 种标准事件类型，支持双向交互和流式响应
- **MCP (Model Context Protocol)**：标准的 `tools/list` → `tools/call` 两步模式，按需加载 Schema
- **TypeChat (微软)**：用 TypeScript 类型作为 Schema 直接驱动 LLM 输出，TypeScript 编译器级别校验
- **Orchestrator-Worker 分层架构**：研究表明可提升 90% 性能，但 Token 消耗高 15x

### 2. 方案演进路径

| 版本 | 方案 | Token 消耗 | 幻觉风险 | 问题 |
|------|------|-----------|---------|------|
| v1 | Tool-per-Element | 中 | 低 | 维护成本 O(n)，随元素类型增长 |
| v2 | 全量 Schema 直接生成 | 高 | 低 | Schema 太大（~50K tokens） |
| **v3** | **MCP 两步 + 分步处理** | **低** | 中（可控） | **推荐方案** |

### 3. v3 分步处理架构核心设计

**MCP 两步模式**：
```
Step 1: tools/list → 轻量列表 [{name, description}]  (~500 tokens)
Step 2: tools/call → 单个工具的完整 Schema          (~2K tokens)
```

**Orchestrator-Worker 分层**：
- **Orchestrator（路由层）**：意图识别、Tool 选择，使用小模型（gpt-4o-mini）
- **Worker（执行层）**：完整数据生成，使用大模型（gpt-4o）+ Structured Outputs

**Token 节省**：从 ~55K 降到 ~5K（约 90%）

### 4. 幻觉风险控制策略

多步骤确实增加错误传播风险，但通过以下策略可控：

1. **路由层校验**：置信度阈值（< 0.7 则请求用户澄清）
2. **Schema 强约束**：Zod strict 模式 + `.min(0)` 等值约束
3. **业务规则校验**：位置/尺寸合理性检查
4. **失败重试**：带错误反馈的修正（最多 2 次）

研究数据：通过验证约束 + Schema 校验可提升 85.5% 一致性

### 5. 关键实现模块

```
packages/editor/agent/
├── registry/tool-registry.ts    # MCP 风格工具注册（自动从 Zod Schema 发现）
├── orchestrator.ts              # 路由层（小模型意图识别）
├── worker.ts                    # 执行层（大模型数据生成）
├── validator.ts                 # 验证层（幻觉控制）
├── context/builder.ts           # 上下文构建（画布信息注入）
└── executor.ts                  # 编辑器操作执行
```

### 6. 扩展性设计

- 新增元素类型只需有 Zod Schema（已有 115 个），无需写任何 Agent 代码
- Schema 自动发现：约定以 `elementSchema` 结尾的导出自动注册
- 支持工具组合与宏定义
- 可集成用户偏好学习

## 源对话记录 (Q&A)

**Q**: 我现在拥有一个可视化编辑器，定义了一套标准的元素数据模型，支持用户进行各种交互调整，各类交互最终都以数据驱动方式反馈到画布中。
现在希望支持对话式交互，比如用户输入「添加一个文字元素，内容写"恭喜发财"，使用微软雅黑16号斜体字体，放在画布正中间」，最终会得到一份文字元素的模型数据：
{contents: ['恭喜发财'], fontFamily: 'Microsoft Yahei', fontSize: 16, fontStyle: 'italic', top: 200, left: 200}，其中「top: 200, left: 200」涉及到基于画布尺寸的计算。
请设计一套基于 Agent 的实现方案，先调研业界已有或通用的实现方案，提供分层设计思路，需要具备高可扩展性，以便后续支持更多属性、元素的对话式交互

**A**: <details>
<summary>AI 思考过程</summary>

用户希望我设计一套基于 Agent 的对话式交互方案，用于可视化编辑器。让我先理解需求：

1. 现有系统：可视化编辑器，有标准的元素数据模型，支持交互调整，数据驱动
2. 目标：支持对话式交互，用户通过自然语言描述来操作编辑器
3. 示例：用户输入自然语言 → 生成元素数据模型
4. 要求：基于 Agent 实现、调研业界方案、分层设计、高可扩展性

我需要：
1. 先了解现有的数据模型结构
2. 调研业界的 Agent 方案
3. 设计分层架构
</details>

我来帮你设计一套基于 Agent 的对话式交互方案。首先调研了业界方案：

**业界调研总结**：
- **OpenAI Function Calling**：成熟、生态丰富、支持 `strict: true` 保证 100% Schema 合规
- **AG-UI Protocol**：事件驱动的 Agent-User 交互协议
- **Figma Make**：自然语言到设计元素的直接生成
- **LangGraph/LlamaIndex**：多步推理、工具链编排

设计了 v1 方案：Tool-per-Element 架构，为每种元素定义 Tool，包含 Tool Registry、Adapter Layer、Action Executor 等模块。

---

**Q**: 这套方案看似可行，但大部分工作都落在了人工开发上，比如"Tool Registry"、"Adapter Layer"、"Action Executor"会随着不同编辑能力的扩展，变得非常庞大难以维护，有没有可能将这部分工作抽象成一套通用模式，具体的工作交给 LLM 来抉择。
或者，业界其他方案是否有这方面的解决思路，即：业务实现复杂度，不能与元素和操作种类的扩展正相关，最好是能有一套稳定的模式，更多的工作交由 LLM 来决策，业务后续更多的是扩展各种元素的 schema

**A**: <details>
<summary>AI 思考过程</summary>

用户提出了一个非常好的问题。他指出我之前的方案虽然可行，但随着元素类型和操作的增加，Tool Registry、Adapter Layer、Action Executor 会变得越来越庞大。用户希望找到一种方案：
1. 业务实现复杂度不随元素/操作种类线性增长
2. 有一套稳定的模式
3. 更多工作交给 LLM 来决策
4. 业务只需要扩展各种元素的 schema

这确实是一个更高级的抽象需求。让我调研：
1. Schema-Driven Generation: 不为每种元素写具体的 Tool，而是让 LLM 直接理解 Schema 并生成符合 Schema 的数据
2. TypeChat: 微软的方案，用 TypeScript 类型直接驱动 LLM 输出
3. Structured Outputs: OpenAI 的方案，直接用 JSON Schema 约束输出
</details>

调研发现了更优的方案：

**关键发现**：
- **TypeChat (微软)**：用 TypeScript 类型作为 Schema 直接驱动 LLM 输出，"types are all you need"
- **Structured Outputs**：OpenAI 的 `response_format` 直接用 JSON Schema 约束输出，100% Schema 合规

设计了 v2 方案：Schema-Driven 架构
- 直接复用现有的 115 个 Zod Schema
- 只有 3 个核心操作（add/change/remove），元素数据直接复用 Schema
- LLM 直接生成符合 Schema 的完整数据，包括位置计算
- 新增元素类型：0 行新代码（Schema 自动发现）

---

**Q**: 不应该每次都讲全量的 schema 喂给 LLM，可以借助 MCP 定义的 tools/list 和 tools/call 分步处理，先用一个 LLM 根据用户对话信息解析从 list 中拿到对应元素，再通过 call 传入最终匹配的 tool 即可。
类似的，在其他功能和流程设计上，也可以引入分步处理思想，将工作一步一步拆解成小的任务，每一步任务都做一个独立完整的小事，即：Agent 层可以更多考虑任务拆分和调度，而不是将所有事情都一次性交给一个 LLM 直接完成，可以在一定程度上降低 Token 消耗量，但不确定是否会产生新的问题，比如更多的幻觉

**A**: <details>
<summary>AI 思考过程</summary>

用户提出了一个很好的优化思路：
1. MCP 两步模式：先 list 获取可用工具列表，再 call 具体工具
2. 分步处理：将任务拆解成小任务，每步做一件独立的事
3. 降低 Token 消耗：不需要每次都传全量 Schema
4. 担忧：分步可能会引入更多幻觉

这是一个很有价值的架构优化。让我调研：
1. MCP 的 tools/list → tools/call 机制
2. 分层 Agent 架构（Orchestrator-Worker）
3. 幻觉风险与控制策略
</details>

调研了 MCP 规范和分层架构：

**关键发现**：
1. **MCP tools/list → tools/call 两步模式**：标准模式，按需加载 Schema
2. **Orchestrator-Worker 分层**：可提升 90% 性能，但 Token 消耗高 15x
3. **路由优先模式**：先路由再执行可降低 60% 成本
4. **幻觉风险**：多步骤确实有错误传播问题，但通过验证约束可提升 85.5% 一致性

设计了 v3 方案：分步处理架构

**核心改进**：
- MCP 两步模式：Token 节省约 90%
- Orchestrator（小模型）+ Worker（大模型）分层
- 每步都校验，多层幻觉控制

**幻觉 vs Token 权衡**：
| 策略 | Token 消耗 | 幻觉风险 |
|------|-----------|---------|
| 单步全量 Schema | 高 | 低 |
| 两步分步处理 | 低 | 中（可控） |
| 多步任务分解 | 最高 | 高 |

推荐 v3 方案，性价比最高。
