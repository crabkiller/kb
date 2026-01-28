# Web Widget 架构设计与 syncCacheProvider 机制深度解析

## 核心知识点

- **Web Widget 核心定位**：基于 Web Components 标准的微模块方案，解决 Monorepo 项目中跨团队协作、跨框架混合运行（如 React 中运行 Vue）及渐进式迁移问题。
- **实现原理**：
  - **HTMLWebWidgetElement**：自定义元素作为容器，管理 Widget 的生命周期状态（LOADING, LOADED, BOOTSTRAPPED, MOUNTED）。
  - **生命周期协议**：标准化 `bootstrap`、`mount`、`unmount` 钩子，屏蔽框架差异。
  - **适配器模式**：通过 `toReact` 等 HOC 在 React 生命周期内管理 Vue 实例，同步 Props 并桥接事件。
- **syncCacheProvider 机制**：
  - **SSR 阶段**：阻塞执行 fetcher，将数据存入 `lifecycleCache` 并序列化至 HTML 的 JSON 状态中。
  - **CSR 阶段**：首屏加载从 JSON 恢复缓存，`syncCacheProvider` 命中缓存后同步返回数据，消除白屏闪烁。若无缓存则退化为异步 Promise。
- **性能优化**：支持 `loading="lazy"` 按需激活（Hydration），仅在进入视口时初始化运行时。

## 源对话记录 (Q&A)

**Q**: 详细介绍 @web-widget 包：
1. 解决什么问题
2. 设计思路和实现原理
3. 如何支持多框架混合运行，比如 React 中使用 Vue

**A**: <details>
<summary>AI 思考过程</summary>

I will first search for the `@web-widget` package in the codebase to understand its structure and usage. Then I will look for its implementation details and how it handles cross-framework components.
</details>

`@web-widget` 是稿定前端架构中的一套**微模块（Web Widget）解决方案**。它基于 Web Components 标准，旨在解决大型 Monorepo 项目中的跨团队协作、跨框架组件复用以及渐进式架构迁移等问题。

### 1. 解决什么问题
- **跨框架混合运行**：允许在 React 项目中无缝使用 Vue 组件，或在 Vue 2 项目中使用 Vue 3 组件。
- **解耦与独立部署**：将复杂的页面拆分为多个独立的 Widget。每个 Widget 可以有自己的技术栈、依赖版本和生命周期。
- **性能优化（懒加载与按需注水）**：支持 Widget 的懒加载和按需注水。
- **统一的生命周期管理**：通过 Web Components 标准化了组件的加载、启动、挂载和卸载过程。

### 2. 设计思路和实现原理
- **核心抽象：HTMLWebWidgetElement**：定义了一个自定义元素 `<web-widget>`。它充当了微模块的“沙箱容器”。
- **生命周期协议**：每个微模块需要导出特定的生命周期钩子：`bootstrap`、`mount`、`unmount`。
- **渲染引擎（Renderer）**：提供了一套插件化的渲染机制，能够识别不同框架编写的组件并调用对应的渲染器进行挂载。

### 3. 如何支持多框架混合运行
- **框架适配层**：项目提供了如 `@web-widget/vue2` 或 `@web-widget/vue` 的适配工具函数（如 `toReact`）。
- **桥接机制**：`toReact(VueComponent)` 会创建一个 React 高阶组件，在挂载时创建一个占位符，并调用 Vue 的渲染引擎将组件挂载到占位符上。
- **属性与事件同步**：适配器会自动监听 React Props 的变化并触发 Vue 实例更新，同时捕获 Vue 事件并以 React 习惯的 `onXxx` 回调形式传递。

**Q**: 以 @apps/gaoding-art/routes/create/index@route.tsx 为例，详细说明 web-widget 的渲染流程

**A**: <details>
<summary>AI 思考过程</summary>

I will read the content of `apps/gaoding-art/routes/create/index@route.tsx` and its related files to trace the rendering flow of web-widget.
</details>

以 `apps/gaoding-art/routes/create/index@route.tsx` 为例，`web-widget` 的渲染流程可以分为 **服务端预渲染（SSR）** 和 **客户端激活（Hydration）** 两个阶段。

### 1. 渲染架构概览
核心入口：`const RVue2Page = toReact(Vue2Page);`。`toReact` 适配器将 Vue 2 组件包装成 React 组件，底层渲染 `<web-widget>` 自定义元素。

### 2. 详细渲染流程
#### 第一阶段：服务端渲染 (SSR)
1. **路由命中与 Handler 执行**：`defineRouteHandler` 中的 `GET` 方法准备数据。
2. **组件树构建**：React 渲染到 `<RVue2Page />` 时，适配器生成 `<web-widget>` 标签及 Vue SSR 初始 HTML 内容。
3. **数据脱水 (Dehydration)**：`syncCacheProvider` 将异步数据序列化并嵌入到页面底部的 JSON 脚本中。

#### 第二阶段：客户端激活 (Hydration)
1. **自定义元素初始化**：`HTMLWebWidgetElement` 检测到标签。
2. **资源加载与引导 (Bootstrap)**：加载 JS 模块并调用 `bootstrap` 钩子。
3. **框架挂载 (Mount)**：适配器在客户端创建 Vue 实例，同步 Props，接管服务端渲染的 HTML 节点。
4. **数据注水 (Hydration)**：`syncCacheProvider` 优先从预埋的 JSON 数据中读取缓存，实现无缝闪现。

**Q**: toReact 具体实现代码

**A**: <details>
<summary>AI 思考过程</summary>

I will search for the implementation of `toReact` in the codebase or node_modules to explain its internal logic.
</details>

`toReact` 的本质是一个 **React 高阶组件 (HOC)**，它在 React 的生命周期内管理着一个 Vue 实例。

### toReact 核心实现原理（简化版）
```typescript
export function toReact(VueComponent) {
  return function ReactWrapper(props) {
    const containerRef = useRef(null);
    const vueInstanceRef = useRef(null);

    useEffect(() => {
      if (containerRef.current && !vueInstanceRef.current) {
        vueInstanceRef.current = new Vue({
          el: containerRef.current,
          render: (h) => h(VueComponent, {
            props: props,
            on: translateEvents(props),
          }),
        });
      }
      return () => {
        if (vueInstanceRef.current) {
          vueInstanceRef.current.$destroy();
          vueInstanceRef.current = null;
        }
      };
    }, []);

    useEffect(() => {
      if (vueInstanceRef.current) {
        Object.assign(vueInstanceRef.current.$children[0].$props, props);
      }
    }, [props]);

    return React.createElement('web-widget', {
      ref: containerRef,
      import: VueComponent.__file || '',
      name: VueComponent.name || 'VueWidget',
    });
  };
}
```

**Q**: web-widget 代码在 node_modules/.pnpm/@web-widget+web-widget@1.63.0_react-dom@19.1.0_react@19.1.0__react@19.1.0_unctx@2.4.1/node_modules/@web-widget/web-widget，根据实际代码 analysis 实现细节，包括 syncCacheProvider 运行机制

**A**: <details>
<summary>AI 思考过程</summary>

I will explore the specified directory in `node_modules` and search for `syncCacheProvider` to analyze its implementation details.
</details>

### 1. syncCacheProvider 的核心运行机制
`syncCacheProvider` 是 Web Widget 解决 **SSR 数据同步与脱水/注水** 的核心工具。它通过“环境识别”来实现不同的返回行为。

#### 运行逻辑分析：
1. **服务端（SSR）阶段**：执行 `fetcher`，阻塞当前 Widget 渲染直到返回结果，存入 `lifecycleCache`，序列化为 JSON 存放在 `<script type=\"application/json\" as=\"state\">` 中。
2. **客户端（CSR）阶段**：读取 HTML 中的 JSON 状态恢复到 `lifecycleCache`。调用时若命中缓存则**立即同步返回**；若缓存失效则退化为普通的异步调用，返回 `Promise`。

### 2. Web Widget 容器实现细节 (HTMLWebWidgetElement)
- **状态常量**：`LOADED`, `BOOTSTRAPPED`, `MOUNTED`。
- **性能监控**：通过监听 `statuschange` 事件记录耗时。
- **资源加载**：通过 `this.import` 属性动态加载 JS 模块。

### 3. 跨框架适配的实现细节 (toReact)
- **Render Target 识别**：支持 `light` 或 `shadow` 渲染目标。
- **属性代理**：React `props` 转换为自定义元素的 `attributes` 或直接传递。
- **事件桥接**：拦截 Vue 事件并转换为 React 的 `onEventName` 回调。
