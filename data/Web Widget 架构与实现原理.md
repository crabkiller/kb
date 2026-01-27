# Web Widget 架构与实现原理

## 1. 核心定位
`@web-widget` 是稿定前端架构中的微模块解决方案，基于 Web Components 标准，旨在解决 Monorepo 项目中的跨团队协作、跨框架混合运行（如 React 中运行 Vue）以及渐进式架构迁移问题。

## 2. 设计思路与实现原理
- **容器化组件**：通过自定义元素 `<web-widget>` 作为沙箱容器，标准化组件的生命周期。
- **生命周期协议**：定义了 `bootstrap`、`mount`、`unmount` 等标准钩子，屏蔽框架差异。
- **状态机管理**：内部维护 `LOADING` -> `LOADED` -> `BOOTSTRAPPED` -> `MOUNTED` 状态，支持性能监控。
- **适配器模式**：提供 `toReact`、`toVue` 等工具，通过桥接层在不同框架间传递 Props 和事件。

## 3. 关键机制：syncCacheProvider
`syncCacheProvider` 是解决 SSR 数据同步与注水的核心工具：
- **服务端 (SSR)**：执行异步请求，将结果存入 `lifecycleCache`，并序列化到 HTML 的 `<script type="application/json" as="state">` 中。
- **客户端 (CSR)**：首屏加载时从 HTML 状态中恢复缓存，`syncCacheProvider` 命中缓存后立即**同步返回**数据，避免白屏闪烁。若缓存失效，则退化为异步请求。

## 4. 性能优化
- **按需激活 (Hydration)**：支持 `loading="lazy"`，仅在组件进入视口时才加载 JS 资源并执行初始化。
- **渲染目标选择**：支持 `light` (普通 DOM) 或 `shadow` (Shadow DOM) 渲染模式。