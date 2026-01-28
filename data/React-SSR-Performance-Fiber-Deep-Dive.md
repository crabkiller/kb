# React SSR 性能优化与 Fiber 架构深度解析

## 核心知识点

- **Suspense 渐进式水合（Progressive/Selective Hydration）**：在 React 18 中，`<Suspense>` 不仅是 UI 加载态，更是水合边界。它允许 React 流式传输 HTML 并独立水合不同区域。用户交互可以提升特定边界的水合优先级，通过事件回放确保交互不丢失。
- **Streaming SSR 机制**：服务端通过流式输出，先发送 Shell 和 Suspense 占位符（template/comment），待数据就绪后再发送真实内容和一段脚本指令（如 `$RC`），在客户端 JS 加载前实现内容的“就地替换”。
- **Partial Hydration（部分水合）**：通常指架构层面的优化（如 Islands 架构或 RSC），使服务器组件永远不下载 JS 到客户端，从而完全跳过水合过程。
- **Fiber 架构设计**：
    - **数据结构**：通过 `child`、`sibling`、`return` 指针将树结构线性化，使深度优先遍历（DFS）可以随时暂停和恢复。
    - **双缓冲（Double Buffering）**：维护 `current` 和 `workInProgress` 两棵树，确保并发渲染时 UI 的一致性。
    - **两阶段提交**：Render 阶段（可中断、计算 Diff）和 Commit 阶段（不可中断、应用 DOM 变更）。
- **Fiber 遍历与剪枝（Bailout）**：React 不会每次都遍历整棵树。通过 `lanes` 和 `childLanes` 位图标记，React 可以识别哪些子树没有更新任务，从而在 `beginWork` 阶段直接跳过（Bailout），极大提升性能。
- **Lane 模型**：取代了旧的 ExpirationTime，使用位图表示优先级和任务分组，支持更复杂的并发调度、任务合并与挂起恢复。
- **SSR 性能面试要点**：关注 TTFB/FCP/LCP 指标、Hydration Mismatch 排查、Streaming SSR 收益、Context 性能陷阱、以及如何通过 `startTransition` 优化 INP。

## 源对话记录 (Q&A)

**Q**: React Suspense 渐进式水合原理

**A**: <details>
<summary>AI 思考过程</summary>
用户询问 React Suspense 的渐进式水合（Progressive Hydration）原理。
核心点：
1. Suspense 在 React 18 中的角色转变（不仅是 loading，还是 hydration boundary）。
2. Selective Hydration 的机制（点哪里先水合哪里）。
3. 服务端流式传输（Streaming SSR）与客户端恢复。
4. 事件回放（Event Replay）。
</details>

### 结论（你问的“Suspense 渐进式水合”本质是什么）
**React 18 里，`<Suspense>` 在 SSR 场景中不仅是“加载态 UI”，还是“把页面切成可独立水合的边界（hydration boundary）”，从而实现 *Selective / Progressive Hydration*：先让更重要、可交互的部分尽快可用，其它部分延后或按需水合。**

---

### 先把几个概念对齐
- **SSR（服务端渲染）**：服务端输出 HTML，让首屏更快看到内容。
- **Hydration（水合）**：浏览器端 React 接管 SSR HTML，建立 Fiber、绑定事件、补齐状态，使其“变成真正的 React 应用”。
- **Progressive/Selective Hydration（渐进/选择性水合）**：水合不是“一口气把整页做完”，而是**分块、可暂停、可插队**。
- **Suspense Boundary**：React 用它来把 UI 树切成**多个可独立处理的片段**；SSR 输出时也会把这些片段做标记（用于流式与恢复）。

---

### 原理拆解：React 如何做到“渐进式水合”
React 18 的核心变化是：**水合变成可中断的并发工作**（Concurrent），并且有明确的“边界”。

#### 1) 服务端：流式输出（Streaming SSR） + Suspense 的占位/回填
在支持的 SSR 渲染器中（如 `renderToPipeableStream` / `renderToReadableStream`），遇到 Suspense：
- **外层（fallback）可以先输出**，保证 HTML 能尽早到达浏览器。
- **真正内容（resolved content）在数据/代码 ready 后再流式回填**。
- 服务端会在 HTML 里写入一些“指令/标记”（你可以理解为注释/脚本片段），告诉客户端：**这里是一个边界，之后会有对应片段到来/需要接管**。

这一步决定了：客户端未来可以按边界恢复（hydrate）而不是必须整棵树同步。

#### 2) 客户端：HydrateRoot 以“边界”为单位调度水合
客户端启动 `hydrateRoot` 后，React 不会强制从根到叶一次性把所有节点都水合完，而是：
- **先水合更高优先级的工作**（例如用户输入、点击）。
- **对每个 Suspense 边界单独推进水合**。
- 如果某个边界的 JS chunk 还没下载、或边界内数据还没 ready，React 可以先跳过它，继续推进别处。

这就是“渐进”：边界之间互不阻塞。

#### 3) 事件回放（Event Replay）让“没水合也能先响应”
渐进水合最怕的问题是：用户点了一个还没水合的按钮怎么办？
React 18 做法大致是：
- 某些事件会先被捕获并**暂存**（在根容器上有委托监听）。
- 如果点击落在尚未水合的区域，React 会**提高该边界的水合优先级**（相当于“点哪里先水合哪里”）。
- 水合完成后再**回放**事件，让逻辑看起来像“当时就点到了”。

结果是：你可以延后水合，但不至于牺牲交互正确性。

---

### Suspense 在“渐进式水合”里扮演的角色
你可以把 `<Suspense>` 理解为同时提供了三件事：
1) **UI 语义**：加载态（fallback）与完成态（children）的切换。
2) **数据/代码的依赖切分点**：边界内可等待，边界外不必等待。
3) **Hydration 调度切分点**：边界是 React 能“跳过、延后、按需优先水合”的单位。

没有 Suspense 边界时，整段 UI 往往会更“捆绑”，更难做到真正的选择性水合（仍可并发，但可切分粒度更差）。

---

### 典型时间线（帮助你形成直觉）
以“页面 = Header + Feed(慢) + Sidebar(快)”为例，Feed 用 Suspense 包起来：

1. **HTML 先到**：Header/Sidebar 已是完整 HTML；Feed 位置先是 fallback。
2. **JS 先执行**：React 开始 hydrate，Header/Sidebar 很快可交互。
3. **用户滚动/点击 Feed 区域**：React 发现该边界尚未水合，提升其优先级（必要时先下载对应 chunk）。
4. **Feed ready**：边界内容替换 fallback，完成水合，事件回放保证点击不丢。

---

### 常见误解澄清
- **“Suspense 只是 loading”**：在 CSR 里接近如此；但在 React 18 SSR + 流式场景里，它还是“分块与调度”的关键边界。
- **“渐进水合 = Partial Hydration”**：Partial Hydration 往往指“只水合一部分，其它永远不水合”；React 的 progressive/ selective hydration 更像“可以延后、可按需、最终通常都会水合”（除非你架构上刻意不水合某些区域）。
- **“没有 SSR 也有渐进水合吗？”**：严格说“水合”只在 SSR 之后发生；但 Suspense + 并发调度在纯 CSR 中也能带来“渐进渲染/分片加载”的体验。

---

### 你如果想把它用好，关键设计点
- **用 Suspense 把“慢的、可延后交互的区域”包起来**：例如推荐流、评论区、非首屏模块。
- **保证边界外的关键交互尽快水合**：搜索框、主按钮、导航等。
- **避免一个巨大边界包住所有东西**：会丧失切分粒度，渐进收益下降。

---

**Q**: 1. 没有 Suspense 边界时，如何做到选择性水合
2. Partial Hydration 如何做到永远不水合某一部分
3. Streaming + Suspense 输出的 HTML 结构长什么样，如何在 Suspense ready 后渲染正确的内容

**A**: <details>
<summary>AI 思考过程</summary>
用户提出了三个进阶问题：
1. 无 Suspense 时的选择性水合。
2. Partial Hydration 的实现（永远不水合）。
3. Streaming SSR 的 HTML 结构及恢复机制。
</details>

### 1) 没有 Suspense 边界时，如何做到选择性水合（Selective Hydration）
没有 `<Suspense>` 边界时，React 仍然能“选择性”地推进水合，但**粒度和可跳过性会差很多**，核心靠两点：

- **并发可中断的水合调度**：React 18 的水合工作是可中断的（Concurrent）。它可以先做一部分水合，遇到更高优先级任务（比如输入、点击）就暂停水合，先处理交互，再回来继续水合。
- **事件回放 + “点哪里优先水合哪里”**：用户在尚未完成水合的区域触发事件时，React 会捕获事件，**提升该事件目标附近路径的水合优先级**，尽快把那一段变成可交互，然后再回放事件。

但注意限制（也是为什么 Suspense 很关键）：
- **没有边界就缺少“可独立恢复/推迟”的分割点**：React 仍要在同一个根里维护一致的树形结构与 DOM 对应关系；要优先水合某个深层节点，通常必须先把它的祖先路径水合起来，很多时候还会被遍历顺序/一致性约束牵连，导致“跳过去水合某块”的收益不稳定。
- **Suspense 边界提供的是“可脱水/再水合”的明确容器**：有边界时，React 可以把边界内部当成一个整体单元（dehydrated boundary），更大胆地延后、插队或按需恢复。

一句话：**没 Suspense 也能做到“可中断 + 事件驱动优先级”的选择性水合；有 Suspense 才能把选择性水合做得更可控、更细粒度、边界更清晰。**

---

### 2) Partial Hydration 如何做到“永远不水合某一部分”
这里要先澄清：**在“同一个 `hydrateRoot` 根”内部，React 核心并没有一个官方 API 让你指定“这棵子树永远不水合，但仍由 React 管理”**。想“永远不水合”，通常是架构层面的做法（islands / RSC / 多根），常见路径有三类：

- **Islands / 多根挂载（最直接）**  
  把页面拆成：大部分是纯 SSR 静态 HTML（永远不被 React 接管），只有少数“岛屿”容器用 `hydrateRoot`/`createRoot` 挂载。  
  - **永远不水合的那部分**：不在任何 React root 容器内，所以根本不会发生 hydration。

- **React Server Components（RSC）的“服务器组件不水合”**（Next / React 生态常见）  
  RSC 模型里：**Server Component 只在服务端执行与产出，客户端没有对应的组件代码，因此也不会水合**；只有标记为 Client Component 的部分会下发 JS 并水合。  
  - 这是一种“在同一棵 React 应用语义下实现部分不水合”的主流方式，但依赖框架/运行时能力。

- **把它变成“纯静态内容”而非 React 子树**  
  例如服务端输出一段 HTML 字符串（CMS 内容等），客户端只是展示，不需要事件绑定/状态管理——它不应该被设计为 React 组件树的一部分（否则你终究要水合它，或者会遇到一致性/更新问题）。

一句话：**“永远不水合”本质是“不要让那块进入需要 hydration 的 React 管辖范围”，或者让它成为“无客户端表示”的产物（如 RSC server component）。**

---

### 3) Streaming + Suspense 输出的 HTML 大致结构是什么样？Suspense ready 后怎么变成正确内容？
React 18 的流式 SSR（Fizz）会把 Suspense 边界输出成“**占位标记 + fallback**”，等边界内容 ready 后，再额外流一段“**真实内容 + 轻量脚本指令**”去把 DOM 就地替换/插入。下面是**简化示意**（不同版本/框架会有细节差异，但机制一致）。

#### 3.1 首屏先到的 HTML（边界未 ready：输出 fallback + 边界占位）
```html
<div class="page">
  <header>...</header>

  <!-- Suspense boundary: pending -->
  <!--$?--><template id="B:0"></template>
  <div class="skeleton">Loading feed...</div>
  <!--/$-->

  <aside>...</aside>
</div>
```

要点：
- `<!--$?--> ... <!--/$-->`（或类似标记）用于告诉客户端/后续流：**这里是一个 Suspense 边界**，当前处于 pending。
- `<template id="B:0">`（或类似占位节点）是一个“锚点”，后续 ready 内容会对准它进行替换/插入。

#### 3.2 边界 ready 后，服务端追加流式片段（真实内容 + 替换指令）
```html
<div hidden id="S:0">
  <div class="feed">...real feed html...</div>
</div>
<script>
  /* 伪代码：把 S:0 的内容移动到 B:0 位置，移除 fallback 等 */
  $RC("B:0", "S:0");
</script>
```

要点：
- 真实内容常先放在一个 `hidden` 容器里（避免闪烁/布局问题），然后通过一小段脚本把节点**移动到正确位置**。
- 这一步通常发生在 **React 客户端代码尚未加载完成之前**，所以你能看到“内容逐块出现”的体验——这就是 Streaming + Suspense 的 UI 渐进呈现。

#### 3.3 客户端 React 何时介入，如何保证“最终正确”
React 客户端启动 `hydrateRoot` 后，会：
- 识别这些边界标记，把边界内部当成 **dehydrated/pending/complete boundary** 来管理；
- 如果边界已经通过流式脚本完成 DOM 替换，React 会按当前 DOM 状态进行匹配与接管；
- 事件系统配合“事件回放”，确保用户在边界未水合时的交互不会丢（典型是点击触发后提升该边界水合优先级）。

一句话：**Streaming 负责“尽早把正确 HTML 放进 DOM”；Hydration 负责“把这些 HTML 接管成可交互的 React 应用”。Suspense 边界是两者对齐的协议点。**

---

**Q**: React 的 Fiber 架构设计

**A**: <details>
<summary>AI 思考过程</summary>
用户询问 React Fiber 架构设计。
核心点：
1. 目标：可中断调度。
2. 痛点：React 15 递归同步更新。
3. 数据结构：Fiber 节点（链表）。
4. 双缓冲：Current/WIP。
5. 两阶段：Render/Commit。
6. 优先级：Lane 模型。
</details>

### Fiber 是什么（从设计目标看）
**Fiber 是 React 的“渲染与更新的可中断调度架构”**：把一次更新的渲染工作拆成很多小单元（fiber nodes），让 React 能在主线程上**分片执行、可暂停/恢复、可优先级调度**，并在需要时丢弃/重做部分工作，从而支持 Concurrent Rendering、Suspense、Transitions、选择性水合等能力。

---

### 为什么要有 Fiber（React 15 的痛点）
React 15 的协调（reconciliation）基本是**递归同步**地从根走到叶：
- 一次更新会“跑到底”，中途难以让出主线程。
- 用户输入、动画、滚动可能被长任务卡住（掉帧）。
- 难以实现“先渲染重要的，后渲染不重要的”。

Fiber 的核心就是把“不可打断的递归”改造成“可打断的循环 + 可恢复的链表结构”。

---

### Fiber 节点的数据结构（它存什么）
一个 **Fiber node** 既是：
- **组件实例的运行时表示**（函数组件、类组件、Host DOM 节点等都会对应 fiber）
- **工作单元（unit of work）**：可以独立被执行/中断

常见关键字段（概念层面）：
- **`type` / `tag`**：这是函数组件？类组件？DOM 节点？
- **`key`**：列表 diff 用
- **`return` / `child` / `sibling`**：把树改成“可迭代遍历”的链表指针（父/第一个子/下一个兄弟）
- **`pendingProps` / `memoizedProps`**：新旧 props
- **`memoizedState`**：新旧 state（函数组件里包含 hooks 链）
- **`updateQueue`**：更新队列
- **`flags` / `subtreeFlags`**：本次需要做哪些副作用（插入、更新、删除、ref 等）
- **`lanes`**：优先级/车道系统（并发调度的核心标记）
- **`alternate`**：指向“另一棵树”的对应节点（用于双缓冲）

---

### 双缓冲（current / workInProgress 两棵树）
Fiber 的一个关键设计是**两棵树**：
- **Current tree**：屏幕上已提交（committed）的那棵，代表“UI 现状”
- **Work-in-progress tree（WIP）**：正在计算中的那棵，代表“UI 将来态”

每个 fiber 通过 **`alternate`** 互相指向：
- 更新时 React 复用旧 fiber，构建/修改 WIP
- 如果中途被打断，WIP 可以保留进度，之后继续
- 如果某个更高优先级更新来了，当前 WIP 可能被部分丢弃并重建
- 一旦提交（commit），WIP 变成新的 current（交换角色）

这让 React 可以“试算”并发更新，而不污染当前屏幕状态。

---

### 两大阶段：Render（可中断）与 Commit（不可中断）
React 更新大致分两阶段：

#### 1) Render/Reconcilation 阶段（构建 WIP）
- **可中断、可重入**：可以做一会儿让出主线程
- 主要做：
  - 计算新 fiber 树
  - 运行组件（函数组件执行、计算 children）
  - 做 diff（生成 flags：哪些 DOM 要改）
  - 收集 effects（副作用清单）

> 重要：这个阶段不能做会产生外部可见副作用的事情（比如直接改 DOM、读写布局造成抖动），因为可能被打断/重做。

#### 2) Commit 阶段（把变更应用到宿主环境）
- **不可中断**：为了保证一致性
- 分子阶段（概念上）：
  - before-mutation（如读 DOM、getSnapshotBeforeUpdate）
  - mutation（真正改 DOM：插入/更新/删除）
  - layout（同步副作用：refs、layout effects 等）

---

### “可中断遍历”是怎么实现的（树 → 链表）
传统递归 DFS 很难暂停并恢复到精确位置。Fiber 用 `child/sibling/return` 指针把树遍历变成一个循环：
- 处理当前 fiber 的“开始工作”（beginWork）
- 深入 child；若无 child，做“完成工作”（completeWork），然后走 sibling；没有 sibling 就回到 return

因为当前执行位置就是一个 fiber 引用，所以随时可以停下来，之后继续。

---

### 更新与优先级：Lane 模型（简述）
并发调度需要回答：**哪些更新先做？哪些可以后做？**
React 用 **lanes（车道位图）** 给更新打优先级标签：
- 同步交互（输入/点击）通常是高优先级 lane
- `startTransition` 包裹的更新是较低优先级 lane
- React 可以在调度时选择只处理某些 lanes，对其他 lanes 暂缓
- Suspense/数据准备也会影响哪些 lanes 能继续推进

你可以把 lanes 理解成：**同一棵树上并行存在多组“待完成的未来态”任务队列**，调度器按优先级分批推进。

---

### Fiber 如何支撑 Suspense / Concurrent / Hydration（联系前面话题）
- **Suspense**：在 render 阶段遇到“挂起”（throw promise），React 可以暂停该边界、先提交 fallback，并在 promise resolve 后重新调度该边界的 lanes。
- **Concurrent rendering**：render 阶段可中断 + lanes 让 React 能“先响应交互，再慢慢补完低优先级渲染”。
- **Selective/Progressive Hydration**：hydration 也被拆成 fiber 工作单元；事件触发可提升某段路径/边界的优先级，实现“点哪里先水合哪里”。

---

### 一句话总结
**Fiber = “可中断的渲染工作表示（数据结构） + 双缓冲（current/WIP） + 优先级车道（lanes） + 两阶段提交（render/commit）”**，它把 React 从“同步递归渲染库”变成了“可调度的 UI 任务系统”。

---

**Q**: Fiber 的颗粒度是什么，一个 HTML 节点、一个组件就是一个 Fiber 吗

**A**: <details>
<summary>AI 思考过程</summary>
用户询问 Fiber 的颗粒度。
核心点：
1. 1:1 关系（React Element -> Fiber）。
2. 组件 vs DOM 节点的区别。
3. 特殊情况（Fragment, innerHTML）。
</details>

### Fiber 的“颗粒度”是什么？
**Fiber 的颗粒度基本是“React 元素树里一个节点（一个 ReactElement / 一个组件实例 / 一个 Host 节点）对应一个 Fiber”。**  
但要加两个重要限定：**不是每个真实 DOM 节点都必然有 Fiber**，以及**有些 Fiber 不会对应 DOM 节点**。

---

### 一个组件就是一个 Fiber 吗？
大体上：**是的（一次挂载后，一个组件实例对应一个 Fiber）**。

- **函数组件**：一个函数组件实例在树中的一次出现（一次渲染位置）对应一个 Fiber（tag 类似 `FunctionComponent`）。
- **类组件**：一个类组件实例对应一个 Fiber（`ClassComponent`），并关联 instance。
- **Fragment / Context.Provider / Suspense / Memo / ForwardRef / Lazy** 等：这些“React 级结构节点”也各自有 Fiber，它们用于协调/边界/语义，不一定产出 DOM。

---

### 一个 HTML 节点（DOM 节点）就是一个 Fiber 吗？
对“由 React 创建并管理的 DOM 节点”而言，通常：**一个 Host 元素（如 `<div/>`、`<span/>`）对应一个 HostComponent Fiber**，并在 commit 后关联一个真实 DOM 节点。

但注意两类例外很常见：

#### 1) 真实 DOM 节点可能没有 Fiber（DOM 比 Fiber 多）
- 你在组件里 `dangerouslySetInnerHTML` 注入的一整段 HTML：这些**内部 DOM 节点不是逐个由 React 创建的**，所以通常**没有对应 Fiber**（React 只管外层那个设置了 innerHTML 的 Host 节点）。
- 你用第三方库/手写 DOM API 在 React 管理的节点下面插入的 DOM：这些也不会有 Fiber（React 不知道它们的“元素身份”）。

#### 2) 有 Fiber 但不会产生 DOM（Fiber 比 DOM 多）
- `<React.Fragment>`、`<Suspense>`、`Context.Provider`、`Memo`、`ForwardRef` 等 Fiber：它们主要用于协调/边界/上下文/优化，本身**不对应一个 DOM 元素**。
- 函数组件 Fiber 本身也不对应 DOM，它只是“计算 children 的节点”；真正产出 DOM 的通常是它子树里的 Host fibers。

---

### 文本节点呢？
文本是特殊的 Host 类型：  
- JSX 里的 `"hello"` 通常对应一个 **HostText Fiber**，提交后对应一个 **Text DOM node**。  
- 但如果文本被合并/被 innerHTML 托管，同样可能不逐个对应 Fiber。

---

### 更精确的一句话
- **Fiber 对齐的是“React 的逻辑树（element/component/host unit）”**  
- **DOM 对齐的是“最终宿主环境的节点（浏览器 DOM）”**  
二者高度相关但不是 1:1：**大多数 Host 元素和文本是 1:1；很多“结构性节点”只有 Fiber 没有 DOM；很多“非 React 创建的 DOM”只有 DOM 没有 Fiber。**

---

**Q**: 举个例子

**A**: <details>
<summary>AI 思考过程</summary>
用户要求举例说明 Fiber 与 DOM 的对应关系。
</details>

### 例子：同一段 JSX 里 Fiber 与 DOM 的对应关系

```tsx
function App() {
  return (
    <>
      <h1>Hello</h1>

      <Suspense fallback={<div className="sk">Loading...</div>}>
        <Panel title="A" />
      </Suspense>

      <div dangerouslySetInnerHTML={{ __html: "<b>raw</b><i>html</i>" }} />
    </>
  );
}

function Panel({ title }: { title: string }) {
  return (
    <section>
      <h2>{title}</h2>
      {" text"}
    </section>
  );
}
```

#### Fiber（React 逻辑树，会有这些 Fiber 节点）
- **`App`**：FunctionComponent Fiber（无 DOM）
- **Fragment `<>...</>`**：Fragment Fiber（无 DOM）
- **`h1`**：HostComponent Fiber（对应一个 `<h1>` DOM）
- **`"Hello"`**：HostText Fiber（对应一个 Text DOM）
- **`Suspense`**：Suspense Fiber（无 DOM）
- **`fallback` 里的 `div.sk`**：HostComponent Fiber（pending 时会出现在 DOM）
- **`Panel`**：FunctionComponent Fiber（无 DOM）
- **`section`**：HostComponent Fiber（对应 `<section>` DOM）
- **`h2`**：HostComponent Fiber（对应 `<h2>` DOM）
- **`{title}`**：HostText Fiber（对应 Text DOM）
- **`" text"`**：HostText Fiber（对应 Text DOM）
- **最后那个 `div`（dangerouslySetInnerHTML）**：HostComponent Fiber（对应 `<div>` DOM）
  - 但 **`<b>raw</b><i>html</i>` 里的 `b/i`**：**没有逐个 Fiber**（React 不管理这段 innerHTML 的内部结构）

#### DOM（浏览器里最终节点，大概会是这样）
- 始终存在：
  - `<h1>` + Text("Hello")
  - `<div>`（innerHTML 容器本身）
  - `<div>` 里面的 `<b>`、`<i>`（这些 DOM 节点存在，但**没有 Fiber**）
- **Suspense 区域取决于状态**：
  - **数据/代码未 ready**：DOM 里有 `<div class="sk">Loading...</div>`
  - **ready 后**：fallback 的 `<div class="sk">...` 被替换为 `<section>...`（对应 Panel 子树的 Host DOM）

### 这个例子想说明的 3 件事
- **一个组件（App/Panel）会有 Fiber，但不一定有 DOM**（组件 Fiber 只是“计算子树”的节点）。
- **一个真实 DOM 节点（比如 `<h1>`, `<section>`, Text）通常有对应 Host Fiber**。
- **innerHTML 这种“非 React 创建的内部 DOM”会出现 DOM 但没有 Fiber**（React 只管外层容器节点）。

---

**Q**: React 如何将一个树结构变成循环

**A**: <details>
<summary>AI 思考过程</summary>
用户询问 React 如何将树结构遍历变成循环。
核心点：
1. child/sibling/return 指针。
2. beginWork/completeWork 的 DFS 模拟。
3. 可中断性。
</details>

### 关键澄清：不是把“树变成环”，而是把“递归遍历变成 while 循环”
React 的 Fiber 仍然是**树结构**（父子兄弟关系不变），只是它把原来靠调用栈的递归 DFS：

```js
function walk(node) {
  begin(node)
  for (child of node.children) walk(child)
  complete(node)
}
```

改成用 **`child / sibling / return` 三个指针**来“手动维护调用栈”，从而可以用一个 **work loop（while 循环）**遍历，并且随时暂停/恢复。

---

### 1) Fiber 用指针把树“线索化”（threaded）
每个 Fiber 节点有：
- **`child`**：第一个子节点
- **`sibling`**：下一个兄弟节点
- **`return`**：父节点

例如这棵树：

```
A
├─ B
│  ├─ D
│  └─ E
└─ C
```

在 Fiber 指针上是：
- `A.child = B`
- `B.sibling = C`
- `B.child = D`
- `D.sibling = E`
- `D.return = B`, `E.return = B`
- `B.return = A`, `C.return = A`

这样就不需要 `children[]` 数组递归调用来遍历整棵树了。

---

### 2) 用 while 循环实现 DFS（beginWork / completeWork）
React 的遍历是“深度优先”，每个节点分两次到达：
- **begin（向下走）**：`beginWork(fiber)`，生成子 fiber、计算 props/state、决定下一个 child
- **complete（向上归并）**：`completeWork(fiber)`，收集 flags、把子树结果归并到父节点

伪代码（高度简化）：

```js
let next = root; // 下一个工作单元

while (next !== null) {
  next = performUnitOfWork(next);
}

function performUnitOfWork(fiber) {
  // 1) begin phase
  const child = beginWork(fiber);

  // 有孩子：继续向下
  if (child !== null) return child;

  // 2) 没孩子：开始 complete，并寻找“下一个可走的兄弟”，否则一路回父亲
  let node = fiber;
  while (node !== null) {
    completeWork(node);

    if (node.sibling !== null) {
      return node.sibling; // 转向兄弟，继续 begin
    }
    node = node.return; // 没兄弟就回父节点继续 complete
  }

  return null; // 回到根也没兄弟了，遍历结束
}
```

这段逻辑等价于递归 DFS，但优势是：
- **可中断**：`while` 每次只做一个 fiber 的一小段工作；需要让出主线程就暂停，之后从 `next` 继续。
- **可恢复**：不依赖 JS 调用栈，暂停后状态（当前 fiber 指针）仍在。
- **可优先级调度**：调度器可以在 fiber 粒度插队/重排。

---

**Q**: 递归 DFS 改成循环遍历，也可以使用一个数组记录每一层节点方式实现，这种方式无法做到 Fiber 当前指针方式想要的效果吗

**A**: <details>
<summary>AI 思考过程</summary>
用户询问为什么不用数组栈实现 DFS。
核心点：
1. 状态绑定在节点上。
2. 任意节点恢复与插队。
3. 并发下的多任务管理。
</details>

可以，用“显式栈（数组）+ 当前索引”把递归 DFS 改成循环遍历，**同样能做到“可中断/可恢复地遍历一棵树”**。但它**做不到（或很不划算）Fiber 方案想要的一整套效果**，原因在于：React 的 Fiber 不是只为“遍历”设计，而是为“把更新建模成可调度的工作单元 + 可重做的中间态”设计。

### 但它很难达到 Fiber 想要的效果（核心差异）
#### 1) Fiber 的“状态”要挂在节点上，不能只挂在“遍历栈帧”上
React 在 render 阶段需要为每个节点持续保存很多中间结果与元数据：`pendingProps/memoizedState/updateQueue/flags/subtreeFlags/lanes` 等，并且这些要跟 **WIP tree** 绑定，后续可能被继续、被放弃、被重算、被提交。

- 显式栈只描述“我遍历到哪儿了”
- Fiber 节点描述“这个节点这次更新算到什么程度、算出了什么、将来怎么提交”

#### 2) React 需要“从任意节点快速恢复/插队”，栈不擅长
选择性水合、事件回放、优先级插队等场景，本质是：**点哪里，就要尽快推进哪里那条路径/边界**。

- Fiber 有 `return` 指针：从任意 fiber 可 \(O(depth)\) 回溯到根，或从边界节点继续推进，不依赖“当时那条遍历栈还在不在”。
- 栈方案通常只对“按既定 DFS 顺序继续走”很自然；如果要“跳到另一片子树优先做”，要么保留/切换多份栈，要么重建栈（从根重新走到目标），实现会更复杂、开销更高。

#### 3) 并发下会出现“多条未完成的工作”，栈更容易膨胀/难管理
Concurrent + lanes 意味着可能存在：
- 低优先级更新做到一半（有一份中间态）
- 高优先级更新插进来（需要另一份中间态或重算策略）
- 某些边界挂起（Suspense），等待后再续算

如果用“遍历栈”来承载进度，你很容易需要保存/切换/丢弃多份栈帧集合；而 Fiber 把进度与结果存到 WIP fiber 节点上，调度器更多是在“选择推进哪些 fiber/哪些 lanes”，而不是管理一堆遍历栈。

---

**Q**: Fiber 遍历每次都是从根节点开始，遍历整个树吗，比如：
A
├─ B
│  ├─ D
│  └─ E
└─ C
这个树，如果我改了 D 节点，C 节点也会被遍历一次吗

**A**: <details>
<summary>AI 思考过程</summary>
用户询问 Fiber 遍历是否每次都从根开始，以及是否会遍历整个树。
核心点：
1. 调度从根开始。
2. 剪枝（Bailout）机制。
3. lanes/childLanes 的作用。
</details>

### 不一定。React 的工作从 root 开始“调度”，但 **render 遍历会被剪枝（bailout）**，不会每次都把整棵树跑一遍。

以你这个树为例：

```
A
├─ B
│  ├─ D
│  └─ E
└─ C
```

假设这次更新是 **D 自己触发**（比如 `setState` / hook state 更新），且 **不影响 A/B 的 props，也没有 context 变化**：

#### React 会做什么
- **更新会从 D 往上“冒泡标记”到 root**：React 会把“这次更新的优先级(lane)”标到 D，并一路让 B、A 的 `childLanes` 知道“我的子树里有活”。
- **render 阶段从 A 开始**：因为要生成新的 WIP 树，并保证一致性。
- **遍历会深入到包含工作的那条路径**：A → B → D（以及可能的兄弟 E，取决于 E 子树有没有工作/是否能 bailout）。
- **到 C 时会发生 bailout**：C 的 `lanes/childLanes` 里没有本次更新的 lane，`beginWork(C)` 会直接复用现有子树结果，**不会进入 C 的 children 继续遍历**，也不会重新 render C（除非有其它原因）。

#### 回答你问的“C 也会被遍历一次吗？”
- **C 这个 fiber 节点本身：很可能会被“碰到/检查一次”**（因为 DFS 走完 B 之后会走 sibling C），但只是快速判断“没活”然后 bailout。
- **C 子树：不会被遍历**（被剪枝）。
- **C 组件逻辑：不会执行 render**（在没有 props/context 变化等情况下）。

---

**Q**: 按时间线列成一步一步的序列

**A**: <details>
<summary>AI 思考过程</summary>
用户要求按时间线列出更新过程。
</details>

### 时间线：只更新 D（不影响 A/B props、无 context 变化）时，Fiber 怎么走

#### T0：D 触发更新
- **在 D 对应的 fiber 上创建 update**，并带一个优先级 **lane**。

#### T1：从 D 往上“冒泡标记”到 root
- React 把这个 lane 记到：
  - **D.lanes |= lane**
  - **B.childLanes |= lane**
  - **A.childLanes |= lane**
  - 一直冒泡到 HostRoot。

#### T2：调度器选择执行这次更新
- React 进入该 root 对应 lane 的工作流程。

#### T3：开始 DFS，到 A（beginWork(A)）
- 检查 A 的 lanes/childLanes：包含。继续。

#### T4：到 B（beginWork(B)）
- B 的 `childLanes` 包含 lane。继续。

#### T5：到 D（beginWork(D)）
- D 的 `lanes` 包含 lane（源头）。执行 D 组件更新逻辑。

#### T6：completeWork(D)
- 寻找下一个节点：D 有 sibling → **E**。

#### T7：到 E（beginWork(E)）
- **E 子树没有本次 lane**。`beginWork(E)` 直接 **bailout**。复用 current 的 E 子树结果。

#### T8：completeWork(E) -> completeWork(B)
- 寻找 B 的 sibling：有 → **C**。

#### T9：到 C（beginWork(C)）
- 关键判断：`C.lanes`、`C.childLanes` 不包含本次 lane。直接 bailout。

#### T10：completeWork(C) -> completeWork(A) -> 结束 render

#### T11：进入 commit
- React 只对被标了 mutation flags 的部分（D）做 DOM 变更。

---

**Q**: lane 是什么概念

**A**: <details>
<summary>AI 思考过程</summary>
用户询问 Lane 概念。
</details>

### Lane 是什么（核心概念）
**Lane（车道）是 React 18 并发更新里的“优先级 + 任务分组”的位图标记。**  
每一次更新都会被分配到某个 lane；React 用 lane 来决定：
- **先做哪些更新（优先级）**
- **哪些更新可以合并一起做（同 lane / lane 集合）**
- **哪些更新可以延后、被打断、之后继续（并发调度）**

可以把 lane 理解成：**“这次更新属于哪条优先级通道/队列”**。

---

**Q**: React 常见面试题（偏 SSR 和性能）

**A**: <details>
<summary>AI 思考过程</summary>
用户询问 React 常见面试题，侧重 SSR 和性能。
</details>

### SSR + 性能向的 React 高频题单

#### 1) SSR 的核心收益与成本是什么？
- **要点**：SSR 提升首屏可见（FCP/LCP）与 SEO；成本是 TTFB 可能变长、服务器压力、缓存复杂度、hydration 成本与一致性问题。

#### 2) Hydration 是什么？和 CSR 的 render 有何不同？
- **要点**：hydration 是在已有 DOM 上对齐 Fiber、绑定事件、恢复状态；CSR 是创建 DOM。Hydration 要求“结构一致”，否则 mismatch。

#### 3) React 18 Streaming SSR 是什么？解决了什么？
- **要点**：流式把 HTML 分段发送；可让 shell 更快到达；配合 Suspense 可“先 fallback，后内容”。

#### 4) 选择性/渐进式水合（Selective/Progressive Hydration）原理
- **要点**：hydration 可被调度；事件回放可让“点哪里先水合哪里”；Suspense 边界帮助跳过/延后。

#### 5) 如何降低 hydration 成本？
- **要点**：减小可交互区域（islands/RSC 思路）、减少首屏组件树、拆分 Suspense、延后非关键交互。

#### 6) Context 的性能陷阱与优化
- **要点**：provider `value` 变会让所有 consumer 重新 render；拆分多个 context、把 value memo、selector 模式。

#### 7) 指标：你如何解释并优化 LCP/INP/CLS？
- **要点**：
  - **LCP**：关键资源优先、减少阻塞 JS、流式 shell。
  - **INP**：减少主线程长任务、拆分更新、`startTransition`。
  - **CLS**：稳定尺寸、占位。
