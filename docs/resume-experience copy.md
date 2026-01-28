## 简历内容补充

### SSR

水合数据设计：封装 defineSSRComponent 工具方法，并传入 metaSource/dataSource 两个 option 配置，注入 serverPrefetch 生命周期

旧页面性能数据：FCP 2s、LCP 3s、Speed Index 3s

LazyRender：渲染队列区分 Eager 和 Lazy 确保高优先级元素提前渲染，比如 hover 比 visible 优先级高

BFF：历史原因无法去除，后续 AI 社区项目直接调用 SSR 服务，为后续接入边缘计算节点打好基础

计算属性：在 SSR 下没有响应式和缓存机制，而是执行函数，导致多层循环在 CSR 下没问题，SSR 下很慢
