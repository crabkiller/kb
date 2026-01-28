# 稿定编辑器扩展(Extension)系统架构设计与链路分析

## 核心知识点

### 1. 扩展系统三层架构

| 包/目录 | 定位 | 核心内容 |
|---------|------|----------|
| `packages/design/extension` | **运行时核心** | `ExtensionManager`、`Extension`、`ExtensionApi`、入口注册 hooks |
| `packages/design/extension-store` | **状态管理** | Pinia Store，管理菜单/入口的注册、启用/禁用 |
| `extensions/*` | **扩展实现** | 每个子目录是一个独立扩展，包含 `manifest.json` + `src/index.ts` |

### 2. 三个核心类职责

- **ExtensionManager**：集中管理所有扩展的加载、注册、运行、卸载，维护 `Map<id, Extension>` 映射表
- **Extension**：单个扩展实例封装，管理生命周期状态（init/register/bootstrap/run/unmount）
- **ExtensionApi**：扩展可调用的 API 上下文，桥接编辑器核心能力，提供 100+ API 方法

### 3. 扩展生命周期

```
load → register → bootstrap（懒加载）→ run → unmount
```

- **load**：解析 ExtensionConfig，创建 Extension 实例
- **register**：调用 beforeRegister/afterRegister 钩子，注册 UI 入口（此时扩展代码尚未执行）
- **bootstrap**：用户首次交互时才动态加载代码并执行 activate()
- **run**：执行具体命令
- **unmount**：清理所有注册项

### 4. Manifest 声明规范

```typescript
interface Manifest<T> {
  id: string;
  name: string;
  main: (options?: T) => Promise<{ activate: (ctx: ExtensionAPI, options?: T) => void }>;
  ui?: Record<string, () => Promise<{ ResourceStationView?; SettingContainerView? }>> | string;
  entries?: Partial<Record<EntryTypes, Entry[]>>;
  commands?: Record<string, { title: string; icon?: string; when?: string; }>;
  beforeRegister?: (ctx?: ExtensionAPI, options?: T) => void;
  afterRegister?: (api: ExtensionAPI, options?: T) => void;
}
```

### 5. 入口类型（EntryTypes）

- `ResourceActivityBar`：左侧资源栏
- `SettingContainer`：右侧设置面板
- `EditorToolbar`：编辑器 toolbar
- `EditorContextmenu`：右键菜单
- `FileMenu`：左上角文件菜单
- `ExportAction`：下载按钮
- `EditorAddTools`：左侧添加工具
- `FilterResourceSlot` / `ComponentResourceSlot`：插槽组件

### 6. JS ↔ UI 通信机制

扩展分离为 JS 层（逻辑）和 UI 层（Vue 组件），通过事件系统通信：

```
JS 层                           UI 层
ctx.postMessage() ────────────► props.on()
ctx.on()          ◄──────────── props.postMessage()
```

UI 组件通过 props 接收通信方法（`postMessage`、`postMessageToJSAsync`、`on`、`once`）。

### 7. text-rewrite 扩展完整链路

1. **注册阶段**：afterRegister 中注册 4 类入口（属性面板、右键菜单、toolbar、编辑器插件）
2. **用户触发**：点击任一入口 → openTextRewrite() → 检查登录 → showElementEditor()
3. **插件激活**：监听 element.$editing && $editingType === 'aiTextRewrite'
4. **UI 挂载**：onMounted → 隐藏 toolbar → 禁用属性面板 → 调用 OCR API
5. **OCR 识别**：调用 `new-image-ocr` 接口，解析文字坐标和内容
6. **用户编辑**：显示 Popup 弹窗，用户修改文本
7. **AI 生成**：点击应用 → 调用 `TextEdit` API → 插入新元素 → 应用结果

### 8. 设计亮点

| 特性 | 说明 |
|------|------|
| 懒加载 | 扩展代码在用户首次交互时才加载执行 |
| 声明式入口 | 通过 manifest.entries 声明 UI 挂载点 |
| API 沙箱 | ExtensionApi 作为中间层隔离扩展与编辑器内核 |
| 插件注册追踪 | registeredItems 统一管理，卸载时自动清理 |
| 权限集成 | 入口注册时自动校验 permissionCode |

## 源对话记录 (Q&A)

**Q**: 分析「扩展 extension」相关代码，梳理输出其核心设计原理，相关代码：domains/editor/extensions、domains/editor/packages/design/extension、domains/editor/packages/design/extension-store

**A**: <details>
<summary>AI 思考过程</summary>

用户想要分析扩展（extension）相关的代码设计原理。我已经拿到了目录结构，现在需要读取核心文件来理解设计：
1. extension 包的核心文件：extension-manager.ts、extension.ts、extension-api.ts、index.ts、init.ts
2. extension-store 包
3. 具体扩展的 manifest.json 和 index.ts
</details>

根据代码分析，我整理了「扩展 Extension」系统的核心设计原理，包括：

**扩展系统架构概览**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Extension System                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────────────┐  ┌─────────────────────┐  ┌────────────────────┐  │
│  │  @design/extension   │  │ @design/extension-  │  │   extensions/*     │  │
│  │    (运行时核心)       │  │       store         │  │   (扩展实现)        │  │
│  │  - ExtensionManager  │◄─┤  - Pinia Store      │◄─┤  - upload          │  │
│  │  - Extension         │  │  - Menu 注册/分发    │  │  - image-enhanced  │  │
│  │  - ExtensionApi      │  │                     │  │  - text-rewrite    │  │
│  └──────────────────────┘  └─────────────────────┘  └────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

**核心类设计**

1. **ExtensionManager**：管理所有扩展的加载、注册、运行、卸载，维护 Map<id, Extension> 映射表
2. **Extension**：单个扩展实例封装，包含生命周期状态管理（init/register/bootstrap/run/unmount）
3. **ExtensionApi**：扩展可调用的 API 上下文，提供 100+ 方法桥接编辑器能力

**扩展声明（Manifest）**

```typescript
interface Manifest<T> {
  id: string;
  name: string;
  main: (options?: T) => Promise<{ activate: (ctx: ExtensionAPI, options?: T) => void }>;
  ui?: Record<string, () => Promise<{ ResourceStationView?; SettingContainerView? }>>;
  entries?: Partial<Record<EntryTypes, Entry[]>>;
  commands?: Record<string, { title: string; icon?: string; when?: string; }>;
  beforeRegister?: (ctx?: ExtensionAPI, options?: T) => void;
  afterRegister?: (api: ExtensionAPI, options?: T) => void;
}
```

**入口类型（EntryTypes）**

- ResourceActivityBar（左侧栏）
- SettingContainer（右侧面板）
- EditorToolbar、EditorContextmenu 等

**扩展生命周期流程**

```
LOAD → REGISTER → BOOTSTRAP（懒加载）→ RUN → UNMOUNT
```

**JS ↔ UI 通信机制**

通过 postMessage/on 事件系统实现双向通信，UI 组件通过 props 接收通信方法。

**设计亮点**

- 懒加载：扩展代码在用户首次交互时才加载执行
- 声明式入口：通过 manifest.entries 声明 UI 挂载点
- API 沙箱：ExtensionApi 作为中间层隔离扩展与编辑器内核
- 插件注册追踪：registeredItems 统一管理，卸载时自动清理
- 权限集成：入口注册时自动校验 permissionCode

---

**Q**: 基于 domains/editor/extensions/text-rewrite 扩展分析完整的链路，包括注册、启动、运行、用户交互等

**A**: <details>
<summary>AI 思考过程</summary>

用户想要基于 text-rewrite 扩展分析完整的链路。我需要读取这个扩展的相关代码来进行分析，包括：
1. index.ts - 入口
2. manifest.json - 声明
3. commands/index.tsx - 命令注册
4. msg-handler.ts - 消息处理
5. plugins/ai-text-rewrite/index.tsx - 编辑器插件
6. plugins/ai-text-rewrite/editor/index.vue - 主 UI 组件
7. use-text-ocr.ts / use-generate.ts - 核心 hooks
</details>

我整理了 text-rewrite 扩展的完整链路分析：

**扩展整体结构**

```
extensions/text-rewrite/
├── manifest.json              # 静态声明
├── src/
│   ├── index.ts               # 入口：manifest + activate
│   ├── config.ts              # 配置管理
│   ├── msg-handler.ts         # JS↔UI 消息处理
│   ├── commands/index.tsx     # 入口注册
│   └── plugins/ai-text-rewrite/
│       ├── index.tsx          # 编辑器插件
│       └── editor/
│           ├── index.vue      # 主 UI 组件
│           ├── use-text-ocr.ts    # OCR 识别 hook
│           └── use-generate.ts    # AI 生成 hook
```

**完整链路时序**

```
 编辑器启动                                    用户交互                        AI 处理
    │                                            │                              │
    ▼                                            │                              │
┌───────────────────┐                            │                              │
│ 1. LOAD 阶段      │                            │                              │
│ loadExtension()   │                            │                              │
│ 解析 manifest.json│                            │                              │
└─────────┬─────────┘                            │                              │
          │                                      │                              │
          ▼                                      │                              │
┌───────────────────┐                            │                              │
│ 2. REGISTER 阶段  │                            │                              │
│ afterRegister()   │                            │                              │
│ ├─ registerAttributeActions() ◄────────────────┼──── 右侧属性面板按钮         │
│ ├─ registerContextMenuOptions() ◄──────────────┼──── 右键菜单                │
│ ├─ toolbarManage:setTool() ◄───────────────────┼──── toolbar                 │
│ └─ registerEditorPlugin() ◄────────────────────┼──── ai-text-rewrite 插件    │
└───────────────────┘                            │                              │
          │                                      │                              │
          │  ⚠️ 此时扩展代码尚未执行               │                              │
          │     入口已注册，等待用户触发            │                              │
          │                                      ▼                              │
          │                            ┌─────────────────────┐                  │
          │                            │ 3. 用户点击入口      │                  │
          │                            └──────────┬──────────┘                  │
          │                                       │                             │
          │                                       ▼                             │
          │                            ┌─────────────────────┐                  │
          │◄───────────────────────────┤ 4. BOOTSTRAP 阶段   │                  │
          │                            │ bootstrap()         │                  │
          │                            │ └─ activate(ctx)    │                  │
          │                            └──────────┬──────────┘                  │
          │                                       │                             │
          │                                       ▼                             │
          │                            ┌─────────────────────┐                  │
          │                            │ 5. RUN 阶段         │                  │
          │                            │ openTextRewrite()   │                  │
          │                            │ └─ showElementEditor│                  │
          │                            └──────────┬──────────┘                  │
          │                                       │                             │
          │                                       ▼                             │
          │                            ┌─────────────────────┐                  │
          │                            │ 6-7. 插件激活+UI挂载 │                  │
          │                            │ startOcr() ─────────┼──────────────────┤
          │                            └──────────┬──────────┘                  │
          │                                       │                             ▼
          │                                       │                  ┌──────────────────┐
          │                                       │                  │ 8. OCR 识别       │
          │                                       │                  │ new-image-ocr     │
          │                                       │◄─────────────────┴──────────────────┘
          │                                       │
          │                                       ▼
          │                            ┌─────────────────────┐
          │                            │ 9. 显示编辑弹窗     │
          │                            │ 用户编辑文本        │
          │                            └──────────┬──────────┘
          │                                       │
          │                                       ▼
          │                            ┌─────────────────────┐
          │                            │ 10. 点击「应用」    │
          │                            │ startGenerate() ────┼──────────────────┤
          │                            └──────────┬──────────┘                  │
          │                                       │                             ▼
          │                                       │                  ┌──────────────────┐
          │                                       │                  │ 11. AI 生成       │
          │                                       │                  │ TextEdit API      │
          │                                       │◄─────────────────┴──────────────────┘
          │                                       │
          │                                       ▼
          │                            ┌─────────────────────┐
          │                            │ 12. 应用结果        │
          │                            │ insertNewElement()  │
          │                            │ applyGenerateResult()│
          │                            └─────────────────────┘
```

**关键设计模式**

| 设计点 | 实现方式 | 优势 |
|--------|----------|------|
| 懒加载 | `main: async () => import('.')` | 首次交互时才加载扩展代码 |
| 编辑模式隔离 | `$editing` + `$editingType` 状态 | 插件通过响应式监听状态变化 |
| 通信解耦 | `postMessage` / `on` props 注入 | UI 层与 JS 层松耦合 |
| 消息处理器模式 | `createMsgHandler()` 工厂函数 | 统一管理所有消息类型 |
| Hook 组合 | `useTextOcr` / `useGenerate` 等 | 逻辑复用与职责分离 |
| 缓存策略 | `ocrResultCache` Map | 避免重复 OCR 调用 |
| 结果应用策略 | 创建新元素而非修改原元素 | 保留原图，支持对比/撤销 |

**数据流向**

```
[原始图片 URL]
       ↓
[OCR API: new-image-ocr]
       ↓
ocrResult: { coords, texts }
       ↓
textList: string[] (用户可编辑)
changedTextIndexes: Set<number>
       ↓ 用户修改后
changedTextList: [{ origin, new }]
       ↓
[AI API: TextEdit]
       ↓
[生成结果图片 URL]
       ↓
[新元素插入画布]
```
