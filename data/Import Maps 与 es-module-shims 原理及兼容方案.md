# Import Maps 与 es-module-shims 原理及兼容方案

## 核心知识点

### 1. Import Maps 解决的问题

- **把"裸模块名"映射成可加载的 URL**：浏览器原生 `import` 只认识 URL（相对/绝对），不认识 `import "react"` 这种"包名"。`importmap` 让你在 HTML 里声明映射，从而不用打包也能直接在浏览器跑 ESM。
- **集中管理依赖入口与版本**：同一个模块名在全站统一指向某个版本/产物，避免每个文件里到处写 CDN URL。
- **控制子路径与前缀映射**：支持 `"lodash/" -> "/vendor/lodash/"` 这类前缀映射。
- **运行时注入/多环境切换更容易**：可以按环境生成不同的 import map（dev 指向本地、prod 指向 CDN）。
- **本质**：解决"浏览器 ESM 缺少 Node/打包器那套模块解析（node_modules、package.json exports、版本解析）"的能力缺口。

### 2. Import Maps 的替代方案

| 方案 | 优点 | 缺点 |
|------|------|------|
| 打包器（Vite/Webpack/Rollup/esbuild） | 完整的 npm 解析、tree-shaking、代码分割、压缩等 | 需要构建流程与产物 |
| 开发期预打包服务（Vite dev server） | 开发体验好，源码仍写裸模块名 | 不是 importmap，是工具解决解析与转换 |
| CDN + URL 直引 | 最简单，不需要 importmap | 源码到处是 URL，版本分散，可控性差 |
| 服务器端重写/代理 import | 可控、能做鉴权/内网镜像 | 维护成本高 |
| SystemJS | 早期解决浏览器模块加载与映射 | 额外 runtime、生态偏老 |

### 3. 不支持 Import Maps 浏览器的兼容方案

**A 类（有 ESM、没 Import Maps）**：
- 使用 `es-module-shims` 作为 polyfill，是目前事实上的标准方案
- 用法：`type="importmap"` → `type="importmap-shim"`，`type="module"` → `type="module-shim"`
- 可用 `HTMLScriptElement.supports?.('importmap')` 做特性检测

**B 类（连 ESM 都不支持）**：
- 走 **modern/legacy 双产物** 策略
- `<script type="module">` + `<script nomodule>` 分流
- 工具：`@vitejs/plugin-legacy`、Webpack Babel 方案

### 4. es-module-shims 实现原理

**核心思路**：在浏览器原生 ESM 运行时之上，补上一层"解析 import / 解析 importmap / 重写模块源码"的 loader。

**关键机制**：
1. **用自定义 script type 接管加载**：`type="importmap-shim"` / `type="module-shim"` 让浏览器忽略，由 shim 接管
2. **构建 import map 解析表**：收集页面上的 import map，按规范实现 `resolve(specifier, parentURL)`
3. **解析模块源码 → 找出依赖 → 重写 specifier**：
   - fetch 模块源码文本
   - 用轻量 lexer 静态分析 import/export
   - 对每个 specifier 调用 resolve 得到最终 URL
   - 字符串层面重写源码
4. **用 Blob URL 交回给原生 ESM 执行**：`URL.createObjectURL(new Blob([rewrittenCode]))` 然后 `import(blobUrl)`，让浏览器原生模块系统负责执行语义

**限制/副作用**：
- 有运行时开销（fetch、解析、重写、生成 blob）
- CSP 需要允许 `blob:`
- importmap 必须先于模块执行稳定下来
- 不解决无 ESM 的老浏览器

### 5. 动态 import 裸模块在 shim 模式下的处理

**问题**：入口用 `importShim()` 启动后，模块内部的动态 `import('bare-specifier')` 仍是原生 `import()`，不会被 shim 接管。

**解决方案**：

| 方案 | 改动范围 | 性能影响 | 适用场景 |
|------|---------|---------|---------|
| 构建时转换 | 加 vite 插件 | 无额外开销 | **推荐**，适合大量动态 import 场景 |
| shimMode | 改 HTML 模板 | 全部走 shim | 小项目、需要最大兼容 |
| polyfill hook | 配置 esmsInitOptions | 不可靠 | 不推荐 |

**推荐方案：构建时转换**

```typescript
// 构建产物中注入的兼容函数
const dynamicImport = typeof importShim !== 'undefined' ? importShim : (m) => import(m);

// 原来的代码：
import('@design/business-ui')

// 转换后：
dynamicImport('@design/business-ui')
```

可通过 vite 插件在 `renderChunk` 阶段把动态 `import('bare-specifier')` 替换成兼容写法。

---

## 源对话记录 (Q&A)

**Q**: importmap 解决了什么问题，有没有其它替代方案

**A**: ## importmap 解决了什么问题

- **把"裸模块名"映射成可加载的 URL**：浏览器原生 `import` 只认识 URL（相对/绝对），不认识 `import "react"` 这种"包名"。`importmap` 让你在 HTML 里声明映射：`"react" -> "https://cdn.../react.js"` 或 `"react" -> "/vendor/react.js"`，从而**不用打包也能直接在浏览器跑 ESM**。
- **集中管理依赖入口与版本**：同一个模块名在全站统一指向某个版本/产物，避免每个文件里到处写 CDN URL 或手动改路径。
- **控制子路径与前缀映射**：支持 `"lodash/" -> "/vendor/lodash/"` 这类前缀映射，解决大量子模块引用时的维护成本。
- **运行时注入/多环境切换更容易**：可以按环境生成不同的 import map（dev 指向本地、prod 指向 CDN），不改源码就能切换依赖来源。

它本质上解决的是：**"浏览器 ESM 缺少 Node/打包器那套模块解析（node_modules、package.json exports、版本解析）"** 这块能力缺口。

---

## 有没有其它替代方案（按常见场景）

- **打包器/构建工具（最主流）**：Vite / Webpack / Rollup / esbuild  
  - **优点**：完整的 npm 解析、tree-shaking、代码分割、压缩、CSS/资源处理、兼容旧浏览器等。  
  - **缺点**：需要构建流程与产物。
- **开发期的"按需预打包/转换"服务**：Vite dev server、Snowpack（偏历史）  
  - **优点**：开发体验好，源码仍写裸模块名；服务端帮你把依赖变成可被浏览器加载的 URL。  
  - **本质**：不是 importmap，而是"工具在开发时替你解决解析与转换"。
- **CDN + URL 直引（不使用裸模块名）**：`import "https://cdn.skypack.dev/react"` / `https://esm.sh/react` / `https://unpkg.com/...`  
  - **优点**：最简单，不需要 importmap。  
  - **缺点**：源码里到处是 URL；版本与依赖入口分散；可控性差（缓存、锁版本、统一切换难）。
- **服务器端重写/代理 import（自建解析层）**：类似"import maps + rewrite"，或自己实现一个把 `import "react"` 重写成 `/@modules/react` 的网关  
  - **优点**：可控、能做鉴权/内网镜像。  
  - **缺点**：维护成本高，接近自己造一个 dev server/小型打包器。
- **SystemJS（历史方案）**：用 SystemJS loader 加上其 map 配置  
  - **优点**：早期解决浏览器模块加载与映射。  
  - **缺点**：额外 runtime、生态偏老；现代浏览器优先用原生 ESM + importmap/构建。

---

## 怎么选（快速结论）

- **生产环境要性能/兼容/优化**：优先 **Vite/Webpack/Rollup**（构建仍是主流）。
- **想"不打包也能用裸模块名"，依赖来源可控**：用 **importmap** 很合适（尤其微前端、插件化、外链依赖、实验性页面）。
- **只是简单 demo/脚本**：直接 **URL import** 就够了。

如果你说下你的场景（是本地开发、微前端、还是线上无构建的页面），我可以给一个更具体的取舍建议和示例配置。

---

**Q**: 不支持 importmap 的浏览器如何兼容，业界有哪些成熟方案

**A**: ## 不支持 importmap 的浏览器怎么兼容

要分两类"不支持"：

- **A. 支持 ESM，但不支持 Import Maps**（典型：较老的 Safari、部分旧版 Chromium）
- **B. 连 ESM 都不支持**（更老的浏览器/IE 系）

对应兼容策略也不同。

---

## A 类（有 ESM、没 Import Maps）：业界最成熟的是 `es-module-shims`

- **方案**：引入 `es-module-shims`，用它在运行时"解析 + 重写"模块图，从而**把 importmap 能力 shim 出来**。
- **业内采用**：这是目前事实上的标准 polyfill，被很多"无需打包/微前端/插件化"场景使用。

典型用法（核心点）：

- `type="importmap"` → 改成 `type="importmap-shim"`
- `type="module"` → 改成 `type="module-shim"`
- 先加载 `es-module-shims` 脚本，再加载你的入口模块

同时可以做 feature detect（有的浏览器提供）：
- `HTMLScriptElement.supports?.('importmap')` 为真则走原生，否则走 shim（具体写法按你们的兼容矩阵调整即可）。

**注意点**（实战里常踩）：
- import map 必须在模块加载前就"确定下来"（无论原生还是 shim），运行中途再改 map 受限。
- shim 会有一定运行时开销（首屏/冷启动），但通常可接受；生产大规模业务多数还是建议打包。

---

## B 类（连 ESM 都不支持）：不要指望 importmap，直接走"差异化构建/降级"

成熟做法是 **modern/legacy 双产物**：

- **modern**：`<script type="module">` +（可选）importmap 或 importmap+shim
- **legacy**：`<script nomodule>` 加载 UMD/IIFE（或 SystemJS）打包产物

业内成熟工具链：
- **Vite**：`@vitejs/plugin-legacy`（自动生成 legacy bundle + 注入 `nomodule` 相关脚本）
- **Webpack**：Babel + `nomodule` 方案（或通过构建配置输出两份）
- **Rollup**：输出 ESM + IIFE/UMD 两份，再用 `module/nomodule` 分流

---

## 其他成熟替代（更偏"运行时加载器"路线）

- **SystemJS + systemjs-importmap（或类似映射机制）**  
  适合微前端、模块远程加载、运行时版本切换；代价是引入 loader runtime，生态相对"工程化/历史包袱"更重。

---

## 选型建议（一句话）

- **只是缺 importmap**：优先 `es-module-shims`（最成熟、最贴近原生 ESM 语义）。
- **缺 ESM**：走 **modern/legacy 双构建 + `module/nomodule`**，不要在 legacy 上硬 polyfill importmap。

如果你给我你们目标浏览器范围（尤其 Safari/Chrome 的最低版本，以及是否需要覆盖内嵌 WebView），我可以把兼容矩阵和推荐的脚本结构写得更精确。

---

**Q**: es-module-shims 实现原理

**A**: <details>
<summary>AI 思考过程</summary>

用户问 es-module-shims 的实现原理。我需要解释它是如何在浏览器中 polyfill import maps 功能的。

核心机制包括：
1. 使用自定义 script type 接管加载
2. fetch 模块源码并解析
3. 重写 specifier
4. 使用 Blob URL 执行

让我搜索一下确认一些细节。
</details>

## 核心思路（一句话）
`es-module-shims` 的本质是：**在浏览器原生 ESM 运行时之上，补上一层"解析 import / 解析 importmap / 重写模块源码"的 loader**，把"浏览器不认识的裸模块名"在执行前变成浏览器能加载的 URL。

---

## 它怎么做到的（关键机制）

### 1) 只在"缺 importmap"但"有 ESM"的浏览器工作
它依赖浏览器本来就支持：
- `<script type="module">` / `import()`
- fetch / Promise 等现代能力

所以它解决的是"没有 importmap"这一缺口，不是给 IE 这种"没有 ESM"的环境用的。

### 2) 通过特殊 script 类型接管加载（避免和原生冲突）
你会看到两类标签：
- `type="importmap-shim"`：让它读取并解析 import map
- `type="module-shim"`：让它接管入口模块加载（不让浏览器原生直接加载）

这样就能做到：**原生不支持 importmap 时走 shim；原生支持时可选择直接走原生**（通常配合 feature detect）。

### 3) 构建 import map（按规范做解析与合并）
它会：
- 收集页面上的 import map（包含动态插入的，通常用 `MutationObserver` 监听）
- 按 import maps 规范把 `imports` / `scopes` 编译成内部的"解析表"
- 实现 `resolve(specifier, parentURL)`：把 `"react"`、`"lodash/"` 这类 specifier 解析为最终 URL

这一层基本就是"把 Node/打包器的解析能力的一小部分搬到浏览器里"，但解析规则以 import maps 规范为准。

### 4) "解析模块源码 → 找出依赖 → 重写 specifier"
当它接管入口模块后，会对模块图做递归处理：

- **fetch 模块源码文本**
- **静态分析 import/export**（只需要找出静态依赖，不必完整 AST；业界通常用轻量 lexer）
- 对每个依赖 specifier 调用上面的 `resolve` 得到最终 URL
- **把源码里的 `import 'react'` 重写成 `import 'https://.../react@x.y.z/...js'`**（或重写到它生成的 blob URL，见下一条）
- 对依赖继续递归，直到模块图完整

关键点：它主要处理的是 **静态 import/export**（因为模块依赖图要在执行前确定）；动态 `import(expr)` 只有在表达式可静态推断/字符串字面量等场景才有机会提前解析，否则只能在运行时再走一遍 hook（实现上通常提供 `importShim()` 来兜底）。

### 5) 用 Blob URL（或等价手段）把"重写后的模块"交回给原生 ESM 执行
重写后的模块内容需要一个可被浏览器 `import()` 的 URL。常见做法是：
- `URL.createObjectURL(new Blob([rewrittenCode], { type: 'text/javascript' }))`
- 然后 `import(blobUrl)` 或把入口模块做成 `module-shim` 触发加载

这样 `es-module-shims` 不需要自己实现完整的模块执行器（不会自己跑模块的作用域、循环依赖执行顺序、TLA 等），而是：
- **让浏览器原生模块系统负责执行语义**
- 它只负责"让模块变得可加载、可解析"

为啥这很重要：循环依赖、执行顺序、Top-level await 等复杂语义交给浏览器，正确性更高。

---

## 一些常见限制/副作用（理解原理时很关键）
- **有运行时开销**：需要额外 fetch、解析、重写、生成 blob；首次加载更慢，所以生产大业务一般还是打包。
- **CSP 可能卡住**：如果用 blob URL，页面 CSP 需要允许 `blob:`（比如 `script-src`），否则会加载失败。
- **importmap 必须"先于模块执行"稳定下来**：和原生一样，map 不是给你随便运行时热切的（它能监听 DOM 插入，但有"开始执行后再改"的天然限制）。
- **不解决无 ESM 的老浏览器**：那是 modern/legacy 双构建（`module/nomodule`）的范畴。

---

如果你想更贴你们场景：你们是"线上无打包插件系统"还是"开发期临时用 importmap"？不同场景下 `es-module-shims` 的用法（是否需要 scopes、是否需要 importShim 兜底、CSP 怎么配）会不一样。

---

**Q**: 「3) 动态 import 怎么办？」当前仓库中存在动态 import 裸模块用法，这类代码上线后如何做到 shim

**A**: <details>
<summary>AI 思考过程</summary>

用户问的是：当前仓库中存在动态 import 裸模块的用法（比如 `import('lodash')` 这种动态导入裸模块名的写法），这类代码上线后如何让 es-module-shims 也能正确处理。我需要先搜索一下仓库中动态 import 裸模块的用法，了解具体情况，然后给出解决方案。
</details>

我先搜索一下仓库中动态 import 裸模块的用法，了解具体情况后给出针对性的 shim 方案。

发现仓库中有 **1983 处动态 import 裸模块** 分布在 770 个文件中，并且已经有 es-module-shims 的集成（在 `gd-importmap.ts` 的 `injectEsShim` 函数中）。

## 当前实现的问题

从 `gd-importmap.ts` 第 71-84 行可以看到：

```javascript
if (!HTMLScriptElement.supports || !HTMLScriptElement.supports('importmap')) {
    // 不支持 importmap → 加载 es-module-shims，用 importShim 启动入口
    importShim('${entry}');
} else {
    // 支持 importmap → 直接用原生 import
    import('${entry}');
}
```

**问题在于**：入口模块用 `importShim()` 启动了，但模块内部的动态 `import('bare-specifier')` 仍然是**原生 `import()`**。

当浏览器不支持 importmap 时：
- 入口模块：✅ 通过 `importShim()` 正确加载
- 静态依赖：✅ es-module-shims 解析源码时会重写静态 import
- **动态 import**：❌ 原生 `import('@design/xxx')` 直接执行，浏览器不认识裸模块名 → **报错**

---

## 解决方案

### 方案 1：构建时把 `import()` 转换成 `importShim()`（推荐）

用 babel 插件或 vite 插件，把源码中的动态 `import('xxx')` 统一转换成一个兼容函数：

```typescript
// 构建产物中注入的兼容函数
const dynamicImport = typeof importShim !== 'undefined' ? importShim : (m) => import(m);

// 原来的代码：
import('@design/business-ui')

// 转换后：
dynamicImport('@design/business-ui')
```

### 方案 2：使用 es-module-shims 的 shimMode（更激进）

把整个页面强制走 shim 流程：

```html
<!-- 改成 shim 专用类型 -->
<script type="importmap-shim">
{ "imports": { ... } }
</script>

<script async src="es-module-shims.js"></script>

<!-- 入口也用 shim 类型 -->
<script type="module-shim" src="/main.js"></script>
```

**优点**：简单，不需要改源码  
**缺点**：**所有浏览器都走 shim**（包括支持 importmap 的），有运行时性能开销

### 方案 3：利用 es-module-shims 的 polyfill 模式下的 `import()` hook（有限制）

es-module-shims 在 polyfill 模式下会尝试 hook 原生 `import()`，但这个 hook **只在模块被 shim 加载的上下文中有效**，且在现代浏览器中不可靠。

---

## 推荐方案：构建时转换 + 运行时兼容函数

在 vite 配置中添加一个插件，把动态 `import('bare-specifier')` 转换成兼容写法：

```typescript
// vite-plugin-dynamic-import-shim.ts
import type { Plugin } from 'vite';
import MagicString from 'magic-string';

export function vitePluginDynamicImportShim(): Plugin {
  const dynamicImportRe = /\bimport\s*\(\s*(['"])([^'"./][^'"]*)\1\s*\)/g;

  return {
    name: 'vite-plugin-dynamic-import-shim',
    enforce: 'post',
    
    renderChunk(code, chunk) {
      if (!dynamicImportRe.test(code)) return null;
      
      const s = new MagicString(code);
      let match;
      dynamicImportRe.lastIndex = 0;
      
      while ((match = dynamicImportRe.exec(code)) !== null) {
        const start = match.index;
        const end = start + match[0].length;
        const quote = match[1];
        const specifier = match[2];
        
        s.overwrite(
          start,
          end,
          `(typeof importShim!=='undefined'?importShim:m=>import(m))(${quote}${specifier}${quote})`
        );
      }
      
      return {
        code: s.toString(),
        map: s.generateMap({ hires: true }),
      };
    },
  };
}
```

## 总结

| 方案 | 改动范围 | 性能影响 | 适用场景 |
|------|---------|---------|---------|
| 构建时转换 | 加 vite 插件 | 无额外开销 | **推荐**，适合大量动态 import 场景 |
| shimMode | 改 HTML 模板 | 全部走 shim | 小项目、需要最大兼容 |
| polyfill hook | 配置 esmsInitOptions | 不可靠 | 不推荐 |

推荐用**方案 1（构建时转换）**，因为：动态 import 数量多（1983 处），手动改不现实；已有 vite 插件体系，加一个转换插件成本低；支持 importmap 的浏览器仍走原生路径，无性能损失。
