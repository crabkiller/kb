# HTTP 缓存完全指南

## 目录

- [一、HTTP 缓存请求头和响应头](#一http-缓存请求头和响应头)
- [二、ETag 的强验证 vs 弱验证](#二etag-的强验证-vs-弱验证)
- [三、no-cache vs max-age=0](#三no-cache-vs-max-age0)
- [四、s-maxage vs max-age](#四s-maxage-vs-max-age)
- [五、CDN 资源管理与回源机制](#五cdn-资源管理与回源机制)
- [六、缓存状态响应头详解](#六缓存状态响应头详解)
- [七、多层缓存架构](#七多层缓存架构)

---

## 一、HTTP 缓存请求头和响应头

HTTP 缓存相关的头部字段可以分为**响应头**和**请求头**两类，它们共同实现了强缓存和协商缓存机制。

### 1. 响应头（Response Headers）

#### Cache-Control（最重要）

控制缓存行为的主要字段，常用指令：

- `max-age=<秒>` - 缓存有效期（相对时间）
- `s-maxage=<秒>` - 共享缓存（CDN）的有效期，优先级高于 max-age
- `no-cache` - 可以缓存，但每次使用前必须验证（协商缓存）
- `no-store` - 禁止缓存，每次都请求
- `public` - 可被任何缓存存储（包括 CDN）
- `private` - 只能被浏览器缓存，不能被共享缓存
- `must-revalidate` - 过期后必须向服务器验证
- `immutable` - 资源永远不会改变

```http
Cache-Control: max-age=3600, public
Cache-Control: no-cache
Cache-Control: max-age=31536000, immutable  // 适合带 hash 的静态资源
```

#### Expires

指定缓存过期的绝对时间（HTTP/1.0，已过时）

```http
Expires: Wed, 21 Oct 2026 07:28:00 GMT
```

**注意**：`Cache-Control: max-age` 优先级更高

#### ETag

资源的唯一标识符（通常是内容的哈希值）

```http
ETag: "33a64df551425fcc55e4d42a148795d9f25f89d4"
ETag: W/"0815"  // W/ 表示弱验证
```

#### Last-Modified

资源最后修改时间

```http
Last-Modified: Wed, 21 Oct 2025 07:28:00 GMT
```

#### Age

资源在代理缓存中存在的时间（秒）

```http
Age: 3600
```

#### Vary

指定哪些请求头会影响缓存版本

```http
Vary: Accept-Encoding, User-Agent
```

### 2. 请求头（Request Headers）

#### Cache-Control

客户端控制缓存行为：

- `no-cache` - 跳过强缓存，使用协商缓存
- `no-store` - 不使用缓存
- `max-age=0` - 强制验证
- `only-if-cached` - 只使用缓存，不发请求

#### If-None-Match

配合 `ETag` 使用，发送之前保存的 ETag 值

```http
If-None-Match: "33a64df551425fcc55e4d42a148795d9f25f89d4"
```

#### If-Modified-Since

配合 `Last-Modified` 使用，询问资源是否在指定时间后修改过

```http
If-Modified-Since: Wed, 21 Oct 2025 07:28:00 GMT
```

#### Pragma（已过时）

HTTP/1.0 兼容字段

```http
Pragma: no-cache
```

### 3. 缓存工作流程

#### 强缓存流程

```
1. 浏览器发起请求
2. 检查本地缓存
3. 判断 Cache-Control/Expires 是否过期
   ├─ 未过期 → 直接使用缓存（200 from cache）
   └─ 已过期 → 进入协商缓存
```

#### 协商缓存流程

```
1. 浏览器发送验证请求
   ├─ 携带 If-None-Match（ETag 值）
   └─ 或携带 If-Modified-Since（时间戳）
   
2. 服务器验证
   ├─ 资源未改变 → 304 Not Modified（不返回内容）
   └─ 资源已改变 → 200 OK（返回新内容和新的 ETag/Last-Modified）
```

### 4. 最佳实践配合使用

#### 带版本号的静态资源（JS/CSS/图片）

```http
Cache-Control: max-age=31536000, immutable
```

- 设置超长缓存期
- 文件名带 hash（如 `app.a3f2b1.js`）
- 更新时改文件名，强制更新

#### HTML 页面

```http
Cache-Control: no-cache
ETag: "abc123"
```

- 每次都验证，但可能返回 304
- 确保用户总能获取最新页面引用

#### API 接口

```http
Cache-Control: private, max-age=60
ETag: "xyz789"
```

- 短期缓存 + 协商缓存
- private 防止 CDN 缓存敏感数据

#### CDN 资源

```http
Cache-Control: public, max-age=3600, s-maxage=86400
```

- 浏览器缓存 1 小时
- CDN 缓存 24 小时

#### 完全不缓存（敏感数据）

```http
Cache-Control: no-store, no-cache, must-revalidate
Pragma: no-cache
Expires: 0
```

### 5. 优先级关系

1. **Cache-Control** > **Expires**
2. **ETag** > **Last-Modified**（更精确）
3. `If-None-Match` 和 `If-Modified-Since` 可以同时使用，服务器通常优先检查 ETag

---

## 二、ETag 的强验证 vs 弱验证

### 强 ETag（Strong ETag）

```http
ETag: "33a64df551425fcc55e4d42a148795d9f25f89d4"
```

表示资源的**字节级完全相同**：

- 内容的每一个字节都必须完全一致
- 哪怕只改了一个空格、换行符，ETag 也会变化
- 可以用于任何 HTTP 方法（包括范围请求 Range）

### 弱 ETag（Weak ETag）

```http
ETag: W/"33a64df551425fcc55e4d42a148795d9f25f89d4"
```

表示资源**语义等价**，但字节可能不同：

- 内容的实质含义相同即可
- 一些无关紧要的差异可以忽略
- 只能用于整体资源比较，**不能用于范围请求**

### 弱验证的使用场景

#### 1. 动态生成的页面，包含时间戳

```html
<!-- 每次生成的页面都会包含当前时间，但内容实质相同 -->
<!DOCTYPE html>
<html>
<body>
  <h1>Welcome</h1>
  <footer>Generated at: 2026-01-22 10:30:45</footer>
</body>
</html>
```

```http
ETag: W/"page-version-1.0"
```

虽然每次生成的时间戳不同，但页面主要内容相同，可以使用弱 ETag。

#### 2. 压缩处理的资源

```http
# 未压缩版本
ETag: W/"12345"
Content-Length: 10000

# Gzip 压缩版本（内容相同，但字节不同）
ETag: W/"12345"
Content-Encoding: gzip
Content-Length: 3000
```

#### 3. 自动格式化的 JSON

```json
// 版本 1：紧凑格式
{"name":"John","age":30}

// 版本 2：格式化（内容相同，空白字符不同）
{
  "name": "John",
  "age": 30
}
```

### 验证规则差异

#### 强验证比较

```http
Request:
If-None-Match: "abc123"

Server:
ETag: "abc123"  ✅ 完全匹配 → 304
ETag: "abc124"  ❌ 不匹配 → 200
```

#### 弱验证比较

```http
Request:
If-None-Match: W/"abc123"

Server:
ETag: W/"abc123"  ✅ 匹配 → 304
ETag: "abc123"    ✅ 也匹配（强可以和弱比较）→ 304
ETag: W/"abc124"  ❌ 不匹配 → 200
```

### 重要限制

#### ❌ 弱 ETag 不能用于范围请求

```http
Request:
GET /video.mp4
Range: bytes=0-1023
If-Range: W/"abc123"  ❌ 弱 ETag 无法保证字节精确性

Response:
416 Range Not Satisfiable
```

#### ✅ 强 ETag 可以用于范围请求

```http
Request:
GET /video.mp4
Range: bytes=0-1023
If-Range: "abc123"  ✅ 强 ETag 保证字节完全一致

Response:
206 Partial Content
Content-Range: bytes 0-1023/102400
[数据块]
```

### 如何选择？

| 场景 | 使用 |
|------|------|
| 静态文件（图片、视频、CSS） | **强 ETag** |
| 需要支持断点续传 | **强 ETag** |
| 动态生成的 HTML | **弱 ETag** |
| 包含时间戳的 API 响应 | **弱 ETag** |
| 可能被压缩的资源 | **弱 ETag** |
| 不确定时 | **强 ETag**（更安全）|

### Node.js 实现示例

```javascript
const crypto = require('crypto');
const express = require('express');
const app = express();

app.get('/api/user', (req, res) => {
  const userData = {
    name: 'John',
    age: 30,
    // 每次请求都不同的字段
    timestamp: Date.now(),
    requestId: Math.random()
  };
  
  // 基于核心数据生成弱 ETag（忽略 timestamp 和 requestId）
  const coreData = { name: userData.name, age: userData.age };
  const hash = crypto
    .createHash('md5')
    .update(JSON.stringify(coreData))
    .digest('hex');
  
  const weakETag = `W/"${hash}"`;
  
  // 检查客户端的 If-None-Match
  if (req.headers['if-none-match'] === weakETag) {
    return res.status(304).end();
  }
  
  res.setHeader('ETag', weakETag);
  res.setHeader('Cache-Control', 'no-cache');
  res.json(userData);
});
```

---

## 三、no-cache vs max-age=0

虽然两者效果看起来相似（都会导致重新验证），但有微妙的差异。

### `Cache-Control: no-cache`

```http
Cache-Control: no-cache
```

**含义**：

- ✅ **可以存储缓存**
- ⚠️ **使用前必须验证**（强制协商缓存）
- 直接跳过"检查缓存是否过期"的步骤
- 每次都发送请求到服务器验证（带 `If-None-Match` 或 `If-Modified-Since`）

**流程**：

```
浏览器请求 
  → 检查本地是否有缓存
  → 有缓存，但因为是 no-cache
  → 直接发送验证请求到服务器（携带 ETag/Last-Modified）
  → 服务器返回 304（缓存有效）或 200（内容更新）
```

### `Cache-Control: max-age=0`

```http
Cache-Control: max-age=0
```

**含义**：

- ✅ **可以存储缓存**
- ✅ **立即过期**（缓存有效期为 0 秒）
- 会走标准的"检查缓存是否过期"流程
- 发现已过期，然后进入协商缓存

**流程**：

```
浏览器请求
  → 检查本地是否有缓存
  → 有缓存，检查是否过期
  → max-age=0，已过期
  → 发送验证请求到服务器（携带 ETag/Last-Modified）
  → 服务器返回 304 或 200
```

### 实际效果对比

#### 场景 1：首次请求

| | `no-cache` | `max-age=0` |
|---|---|---|
| 是否存储缓存 | ✅ 是 | ✅ 是 |
| 存储后是否过期 | - | ✅ 立即过期 |

#### 场景 2：再次请求

| | `no-cache` | `max-age=0` |
|---|---|---|
| 检查是否过期 | ❌ 跳过检查 | ✅ 检查（发现过期）|
| 是否重新验证 | ✅ 必须验证 | ✅ 必须验证 |
| 最终效果 | 发送验证请求 | 发送验证请求 |

### 核心差异

#### 语义差异

```http
# no-cache：明确表示"我有缓存机制，但每次都要验证"
Cache-Control: no-cache

# max-age=0：表示"缓存立即过期，按过期流程处理"
Cache-Control: max-age=0
```

#### 与 must-revalidate 的配合

```http
# 情况 1：no-cache 本身就强制验证，不需要 must-revalidate
Cache-Control: no-cache

# 情况 2：max-age=0 配合 must-revalidate，明确过期后必须验证
Cache-Control: max-age=0, must-revalidate
```

### 与 no-store 的区别

```http
# no-cache：可以缓存，但每次使用前要验证
Cache-Control: no-cache
→ 浏览器存储缓存 ✅
→ 每次使用前验证 ✅
→ 可能返回 304 ✅

# max-age=0：可以缓存，但立即过期
Cache-Control: max-age=0
→ 浏览器存储缓存 ✅
→ 立即过期，需要验证 ✅
→ 可能返回 304 ✅

# no-store：完全不缓存
Cache-Control: no-store
→ 浏览器不存储缓存 ❌
→ 每次都重新下载 ✅
→ 永远返回 200 ✅
```

### 最佳实践建议

#### HTML 页面

```http
Cache-Control: no-cache
```

理由：明确表达"有缓存机制但每次验证"的语义

#### API 接口（需要验证）

```http
Cache-Control: no-cache
# 或
Cache-Control: max-age=0, must-revalidate
```

#### 完全不缓存（敏感数据）

```http
Cache-Control: no-store, no-cache, must-revalidate
Pragma: no-cache
```

### 总结

| 特性 | `no-cache` | `max-age=0` |
|------|-----------|------------|
| **语义** | 强制验证 | 立即过期 |
| **存储缓存** | ✅ | ✅ |
| **检查过期** | ❌ 跳过 | ✅ 检查 |
| **必须验证** | ✅ | ✅ |
| **实际效果** | 几乎相同 | 几乎相同 |
| **推荐使用** | ✅ 语义更清晰 | 需要配合其他指令时使用 |

**简单记忆**：

- **`no-cache`**："我不相信缓存新鲜度，每次都要问服务器"
- **`max-age=0`**："缓存0秒就过期了，按过期流程走"
- 实际效果几乎一样，但 **`no-cache` 语义更明确，更推荐使用**

---

## 四、s-maxage vs max-age

这两个指令都用于设置缓存过期时间，但**作用的缓存层级不同**。

### `max-age`

```http
Cache-Control: max-age=3600
```

**作用范围**：

- ✅ **浏览器缓存**（私有缓存）
- ✅ **共享缓存**（CDN、代理服务器）
- 对所有类型的缓存生效

**含义**：资源可以缓存 3600 秒（1 小时）

### `s-maxage`（Shared max-age）

```http
Cache-Control: s-maxage=86400
```

**作用范围**：

- ❌ **浏览器缓存**（忽略此指令）
- ✅ **共享缓存**（CDN、代理服务器）
- 只对共享缓存生效

**含义**：在共享缓存（如 CDN）中可以缓存 86400 秒（24 小时），浏览器忽略此值

### 核心差异

| 特性 | `max-age` | `s-maxage` |
|------|-----------|-----------|
| **浏览器缓存** | ✅ 生效 | ❌ 忽略 |
| **CDN/代理缓存** | ✅ 生效 | ✅ 生效（优先） |
| **优先级** | 低 | 高（覆盖 max-age）|
| **适用场景** | 所有缓存 | 仅共享缓存 |

### 优先级规则

当两者同时存在时：

```http
Cache-Control: max-age=3600, s-maxage=86400
```

**对于浏览器**：

- 只看 `max-age=3600`
- 缓存 1 小时

**对于 CDN/代理**：

- `s-maxage` 优先级更高
- 缓存 24 小时
- 忽略 `max-age`

### 实际应用场景

#### 场景 1：CDN 加速静态资源

```http
# 浏览器缓存 1 小时，CDN 缓存 30 天
Cache-Control: max-age=3600, s-maxage=2592000, public
```

**效果**：

- 用户浏览器：1 小时后重新向 CDN 请求
- CDN：30 天内直接返回，不回源到服务器
- 减少回源压力，节省带宽成本

#### 场景 2：个性化内容，但允许 CDN 短期缓存

```http
# 浏览器不缓存，CDN 缓存 5 分钟
Cache-Control: max-age=0, s-maxage=300, public
```

**效果**：

- 用户浏览器：每次都向 CDN 请求（可能 304）
- CDN：5 分钟内不回源，减少服务器压力
- 适合用户个性化数据，但短期内变化不大的场景

#### 场景 3：API 接口，只允许浏览器缓存

```http
# 浏览器缓存 1 分钟，CDN 不缓存
Cache-Control: max-age=60, s-maxage=0, private
```

**效果**：

- 用户浏览器：缓存 1 分钟
- CDN/代理：不缓存（`s-maxage=0` 或 `private`）
- 适合用户相关的敏感数据

#### 场景 4：HTML 页面

```http
# 浏览器强制验证，CDN 缓存 10 分钟
Cache-Control: no-cache, s-maxage=600, public
```

**效果**：

- 用户浏览器：每次都验证（可能返回 304）
- CDN：10 分钟内直接返回，减少回源
- 确保用户能相对及时获得更新，同时减少服务器负载

### 完整示例

#### CDN 架构下的缓存层级

```
用户浏览器 <--max-age--> CDN <--s-maxage--> 源服务器
```

#### 静态资源（带 hash）

```http
# app.a3f2b1.js
Cache-Control: max-age=31536000, s-maxage=31536000, immutable, public
```

- 浏览器和 CDN 都超长缓存
- 文件名变化时自动失效

#### API 接口（公开数据）

```http
# GET /api/products
Cache-Control: max-age=60, s-maxage=300, public
```

- 浏览器缓存 1 分钟
- CDN 缓存 5 分钟
- 减少 API 服务器压力

#### API 接口（用户数据）

```http
# GET /api/user/profile
Cache-Control: max-age=0, private
```

- 浏览器强制验证
- CDN 不缓存（`private` 隐式禁止共享缓存）
- `s-maxage` 不需要，因为 `private` 已经禁止共享缓存

#### 动态 HTML

```http
# GET /products/123
Cache-Control: no-cache, s-maxage=600, public
```

- 浏览器每次验证（确保获取最新）
- CDN 缓存 10 分钟（减少回源）

### 与 private 的关系

```http
# private 会让 s-maxage 失效
Cache-Control: max-age=3600, s-maxage=86400, private
```

**效果**：

- `private` 明确禁止共享缓存
- `s-maxage` 被忽略
- 只有 `max-age` 对浏览器生效

**等价于**：

```http
Cache-Control: max-age=3600, private
```

### Nginx 配置示例

```nginx
# 静态资源
location ~* \.(js|css|png|jpg|jpeg|gif|svg|woff2)$ {
    add_header Cache-Control "max-age=31536000, s-maxage=31536000, public, immutable";
}

# API 接口（公开）
location /api/public/ {
    add_header Cache-Control "max-age=60, s-maxage=300, public";
    proxy_pass http://backend;
}

# API 接口（用户）
location /api/user/ {
    add_header Cache-Control "max-age=30, private";
    proxy_pass http://backend;
}

# HTML 页面
location / {
    add_header Cache-Control "no-cache, s-maxage=600, public";
    proxy_pass http://backend;
}
```

### 成本与性能权衡

#### 高 s-maxage 的好处

- ✅ 减少回源请求
- ✅ 降低服务器负载
- ✅ 节省带宽成本
- ✅ 提升全球访问速度

#### 高 s-maxage 的风险

- ⚠️ 内容更新不及时
- ⚠️ 需要手动清除 CDN 缓存
- ⚠️ 可能返回过期数据

#### 平衡策略

```http
# 内容更新频繁（每小时）
Cache-Control: max-age=300, s-maxage=600, public

# 内容更新较少（每天）
Cache-Control: max-age=3600, s-maxage=86400, public

# 几乎不变（带版本号）
Cache-Control: max-age=31536000, s-maxage=31536000, public, immutable
```

### 总结

| 需求 | 配置 |
|------|------|
| **浏览器和 CDN 同步** | `max-age=3600, public` |
| **CDN 缓存更长** | `max-age=300, s-maxage=3600, public` |
| **只浏览器缓存** | `max-age=3600, private` |
| **CDN 缓存，浏览器验证** | `no-cache, s-maxage=600, public` |
| **都不缓存** | `no-store` |

**核心要点**：

- **`max-age`**：通用的缓存时间，所有缓存都遵守
- **`s-maxage`**：专门给 CDN/代理的指令，覆盖 max-age
- **合理利用两者差异**，可以在保证用户体验的同时降低服务器成本

---

## 五、CDN 资源管理与回源机制

### 回源（Origin Fetch/Back-to-Origin）是什么？

**回源**是指 CDN 边缘节点在自己的缓存中找不到资源时，向**源站（Origin Server）**请求资源的过程。

```
用户 → CDN 边缘节点 → [缓存未命中] → 回源 → 源站服务器
```

### 源站（Origin Server）是什么？

源站就是**你的应用服务器**，存储原始内容的地方：

- 你的 Web 服务器（Nginx、Apache）
- 应用服务器（Node.js、Java、Python）
- 对象存储（AWS S3、阿里云 OSS、腾讯云 COS）
- 负载均衡器后的服务器集群

### CDN 完整架构

#### 单层架构（简化版）

```
用户浏览器
    ↓
CDN 边缘节点（全球数百个）
    ↓ 回源（缓存未命中时）
源站服务器（你的服务器）
```

#### 多层架构（实际情况）

```
用户浏览器
    ↓
CDN 边缘节点（Edge）- 离用户最近
    ↓ 未命中
CDN 二级缓存（Regional Cache）- 区域中心
    ↓ 未命中
CDN 源站缓存（Origin Shield）- 源站保护层（可选）
    ↓ 未命中
源站服务器（Origin Server）- 你的服务器
```

### 回源流程详解

#### 流程 1：首次请求（冷启动）

```
1. 用户请求 https://cdn.example.com/logo.png
   ↓
2. DNS 解析到最近的 CDN 边缘节点（如：上海节点）
   ↓
3. 上海节点检查缓存 → 未命中
   ↓
4. 上海节点向源站发起请求（回源）
   GET https://origin.example.com/logo.png
   ↓
5. 源站返回文件 + 缓存策略
   Cache-Control: max-age=3600, s-maxage=86400
   ↓
6. 上海节点缓存该文件（86400 秒 = 24 小时）
   ↓
7. 上海节点返回给用户
```

#### 流程 2：后续请求（缓存命中）

```
1. 另一个用户（也在上海）请求同样的文件
   ↓
2. DNS 解析到上海节点
   ↓
3. 上海节点检查缓存 → 命中！
   ↓
4. 直接返回缓存文件（不回源）
   响应头包含：X-Cache: HIT
```

#### 流程 3：缓存过期（再次回源）

```
1. 24 小时后，又有用户请求
   ↓
2. 上海节点检查缓存 → 已过期
   ↓
3. 上海节点向源站发起协商缓存请求（回源）
   GET https://origin.example.com/logo.png
   If-None-Match: "abc123"
   If-Modified-Since: Thu, 23 Jan 2026 10:00:00 GMT
   ↓
4. 源站判断文件未变化
   ↓
5. 源站返回 304 Not Modified（只有头部，无内容）
   ↓
6. 上海节点刷新缓存有效期，继续使用旧文件
   ↓
7. 上海节点返回给用户
```

### 源站配置示例

#### 1. 直接指向你的 Web 服务器

```
CDN 配置：
源站地址: origin.example.com
源站端口: 443（HTTPS）

实际回源请求：
CDN → https://origin.example.com/path/to/resource
```

**Nginx 源站配置**：

```nginx
server {
    listen 443 ssl;
    server_name origin.example.com;
    
    # 只允许 CDN 回源（安全措施）
    allow 1.2.3.0/24;  # CDN IP 段
    deny all;
    
    location / {
        root /var/www/html;
        
        # 设置缓存策略
        add_header Cache-Control "max-age=3600, s-maxage=86400, public";
        
        # 支持协商缓存
        etag on;
    }
}
```

#### 2. 指向对象存储（推荐）

```
CDN 配置：
源站地址: your-bucket.oss-cn-hangzhou.aliyuncs.com
源站类型: 阿里云 OSS

优势：
✅ 高可用（99.99%）
✅ 自动扩容
✅ 成本低
✅ 无需维护服务器
```

#### 3. 指向负载均衡器

```
CDN 配置：
源站地址: lb.example.com

架构：
CDN → 负载均衡器 → [服务器1, 服务器2, 服务器3]

优势：
✅ 高可用
✅ 自动故障转移
✅ 分散回源压力
```

### CDN 资源管理策略

#### 策略 1：按资源类型分层缓存

```nginx
# 静态资源（永久缓存）
location ~* \.(js|css|png|jpg|jpeg|gif|svg|woff2)$ {
    add_header Cache-Control "max-age=31536000, s-maxage=31536000, immutable, public";
}

# HTML（强制验证）
location ~* \.html$ {
    add_header Cache-Control "no-cache, s-maxage=600, public";
}

# API（短期缓存）
location /api/ {
    add_header Cache-Control "max-age=60, s-maxage=300, public";
}
```

#### 策略 2：带版本号/哈希的资源

```html
<!-- 文件名包含 hash，CDN 超长缓存 -->
<script src="https://cdn.example.com/app.a3f2b1c4.js"></script>
<link href="https://cdn.example.com/style.d5e6f7g8.css">

<!-- 源站配置 -->
Cache-Control: max-age=31536000, s-maxage=31536000, immutable
```

**优势**：

- 文件内容变化 → hash 变化 → URL 变化 → 自动失效
- 无需手动清除 CDN 缓存
- CDN 命中率极高

#### 策略 3：Origin Shield（源站保护）

```
用户
  ↓
边缘节点（100+ 个）
  ↓
Origin Shield（1-2 个中心节点）
  ↓
源站服务器

效果：
- 100 个边缘节点缓存未命中
- 不会产生 100 次回源
- 而是先向 Origin Shield 请求
- 只有 Origin Shield 未命中才回源
- 大大减少回源压力
```

#### 策略 4：预热（Cache Warming）

在大流量活动前，主动推送资源到 CDN：

```bash
# 阿里云 CDN 预热 API
aliyun cdn PushObjectCache \
  --ObjectPath https://cdn.example.com/activity/banner.jpg

# 腾讯云 CDN 预热
tccli cdn PushUrlsCache \
  --Urls '["https://cdn.example.com/activity/banner.jpg"]'
```

#### 策略 5：手动刷新缓存

内容更新后，主动清除 CDN 缓存：

```bash
# URL 刷新（精确刷新）
aliyun cdn RefreshObjectCaches \
  --ObjectPath https://cdn.example.com/style.css

# 目录刷新（批量刷新）
aliyun cdn RefreshObjectCaches \
  --ObjectPath https://cdn.example.com/assets/ \
  --ObjectType Directory
```

### 回源优化策略

#### 1. 减少回源次数

```http
# 设置足够长的 s-maxage
Cache-Control: s-maxage=2592000  # 30 天

# 使用 immutable（告诉 CDN 永不回源验证）
Cache-Control: max-age=31536000, immutable
```

#### 2. 回源时使用协商缓存

```nginx
# 源站启用 ETag
etag on;

# 源站设置 Last-Modified
add_header Last-Modified $date_gmt;

# CDN 回源时会带上 If-None-Match
# 如果文件未变，返回 304，节省带宽
```

#### 3. 启用 Gzip/Brotli 压缩

```nginx
# 源站压缩
gzip on;
gzip_types text/css application/javascript image/svg+xml;

# CDN 回源时获取压缩版本
# 减少回源流量
```

#### 4. 配置回源 Host

```
CDN 配置：
源站地址: origin.example.com
回源 Host: www.example.com

实际请求：
GET /logo.png HTTP/1.1
Host: www.example.com  ← 使用回源 Host
X-Forwarded-Host: cdn.example.com
```

### 监控回源情况

#### 关键指标

```javascript
// 1. 缓存命中率
缓存命中率 = (CDN 命中次数 / 总请求次数) × 100%

// 理想值：> 95%
// 如果 < 90%，需要优化缓存策略

// 2. 回源带宽
回源带宽 = CDN 向源站请求的数据量

// 理想：回源带宽 < 总带宽的 5%

// 3. 回源请求数
每秒回源请求数（QPS）

// 理想：< 总 QPS 的 5%
```

#### 通过响应头判断

```http
# 缓存命中
X-Cache: HIT
Age: 1200  # 在 CDN 缓存了 1200 秒

# 缓存未命中（回源了）
X-Cache: MISS
Age: 0

# 缓存过期，回源验证后仍有效
X-Cache: REVALIDATED
Age: 0
```

### 总结

#### 回源的本质

```
回源 = CDN 向你的源站服务器请求数据
目标 = 尽量减少回源（提高命中率）
```

#### 优化核心

1. **设置合理的 `s-maxage`**：让 CDN 尽量长时间缓存
2. **使用带 hash 的文件名**：避免手动刷新缓存
3. **启用 Origin Shield**：减少回源压力
4. **源站使用对象存储**：高可用、低成本
5. **监控命中率**：目标 > 95%

---

## 六、缓存状态响应头详解

### `eo-cache-status: MISS` 的含义

这是 CDN 或缓存服务返回的**缓存状态响应头**，表示缓存处理结果。

#### MISS - 缓存未命中

```http
eo-cache-status: MISS
```

**含义**：

- ❌ CDN 节点的缓存中**没有找到**这个资源
- ✅ CDN 节点向**源站发起了请求**（回源）
- ✅ 获取到内容后返回给用户，**同时缓存到 CDN**
- 📊 这是一次**较慢的请求**（需要回源）

**发生场景**：

1. **首次请求**：该资源从未被缓存过
2. **缓存已清除**：手动刷新了 CDN 缓存
3. **缓存已过期**：超过了 `s-maxage` 设置的时间，且无法协商缓存
4. **URL 参数不同**：请求了新的 URL 或参数组合
5. **缓存策略不允许**：设置了 `Cache-Control: no-store`

### 常见的缓存状态值

#### 1. HIT - 缓存命中

```http
eo-cache-status: HIT
Age: 1200
```

**含义**：

- ✅ CDN 缓存中有这个资源
- ✅ 直接从 CDN 返回，**未回源**
- ✅ 这是最理想的状态
- ⚡ 响应速度最快

#### 2. EXPIRED - 缓存已过期

```http
eo-cache-status: EXPIRED
```

**含义**：

- ⚠️ 缓存中有资源，但已过期
- ✅ 需要向源站验证
- 可能返回 304（内容未变）或 200（内容已更新）

#### 3. STALE - 返回过期缓存

```http
eo-cache-status: STALE
```

**含义**：

- ⚠️ 缓存已过期
- ✅ 但因源站不可达或其他原因，返回了过期的缓存
- 通常配合 `Cache-Control: stale-while-revalidate` 使用

#### 4. REVALIDATED - 重新验证成功

```http
eo-cache-status: REVALIDATED
Age: 0
```

**含义**：

- ✅ 缓存过期后，向源站发起协商缓存请求
- ✅ 源站返回 304 Not Modified
- ✅ CDN 刷新缓存时间，继续使用原有内容

**流程**：

```http
Request (CDN → 源站):
GET /logo.png
If-None-Match: "abc123"

Response (源站 → CDN):
304 Not Modified
Cache-Control: max-age=3600, s-maxage=86400

CDN 处理:
- 刷新缓存有效期
- 设置 Age: 0
- 返回给用户，响应头包含 eo-cache-status: REVALIDATED
```

#### 5. BYPASS - 绕过缓存

```http
eo-cache-status: BYPASS
```

**含义**：

- ❌ 该请求不使用缓存
- ✅ 直接转发到源站
- 常见于动态内容或带特殊参数的请求

#### 6. UPDATING - 后台更新中

```http
eo-cache-status: UPDATING
```

**含义**：

- ✅ 返回了过期的缓存给用户（快速响应）
- ✅ 同时在后台异步更新缓存
- 这是 `stale-while-revalidate` 策略的体现

#### 7. DYNAMIC - 动态内容

```http
eo-cache-status: DYNAMIC
```

**含义**：

- 该内容被标记为动态内容
- 不会被缓存
- 每次都直接请求源站

### 完整示例分析

#### 场景 1：新资源首次访问

```http
# 第一个用户请求
GET /app.js HTTP/1.1
Host: cdn.example.com

Response:
200 OK
eo-cache-status: MISS  ← 缓存未命中，回源了
Age: 0                  ← 刚从源站获取
Cache-Control: max-age=3600, s-maxage=86400
Content-Length: 50000
[文件内容]

# 第二个用户请求（1 分钟后）
GET /app.js HTTP/1.1
Host: cdn.example.com

Response:
200 OK
eo-cache-status: HIT   ← 缓存命中
Age: 60                ← 在 CDN 缓存了 60 秒
Cache-Control: max-age=3600, s-maxage=86400
Content-Length: 50000
[文件内容]
```

#### 场景 2：缓存过期后的协商缓存

```http
# 24 小时后，缓存过期
GET /app.js HTTP/1.1
Host: cdn.example.com

# CDN 向源站验证
CDN → Origin:
GET /app.js HTTP/1.1
If-None-Match: "abc123"

# 源站响应（文件未变）
Origin → CDN:
304 Not Modified
ETag: "abc123"
Cache-Control: max-age=3600, s-maxage=86400

# CDN 返回给用户
Response:
200 OK
eo-cache-status: REVALIDATED  ← 重新验证成功
Age: 0                         ← 刷新了缓存
ETag: "abc123"
[文件内容]
```

### 如何查看和分析

#### 1. 浏览器开发者工具

```javascript
// Chrome DevTools → Network 面板
// 点击资源 → Headers 标签 → Response Headers

// 或使用 JavaScript
fetch('https://cdn.example.com/app.js')
  .then(res => {
    console.log('Cache Status:', res.headers.get('eo-cache-status'));
    console.log('Age:', res.headers.get('Age'));
    console.log('Cache-Control:', res.headers.get('Cache-Control'));
  });
```

#### 2. curl 命令

```bash
# 查看完整响应头
curl -I https://cdn.example.com/app.js

# 输出示例
HTTP/2 200
eo-cache-status: HIT
age: 3600
cache-control: max-age=86400, public
content-type: application/javascript
```

### 不同 CDN 的缓存状态头

| CDN | 响应头名称 | 可能的值 |
|-----|----------|---------|
| **Cloudflare** | `CF-Cache-Status` | HIT, MISS, EXPIRED, BYPASS, DYNAMIC, REVALIDATED |
| **Akamai** | `X-Cache` | TCP_HIT, TCP_MISS, TCP_REFRESH_HIT |
| **阿里云 CDN** | `X-Cache` | HIT, MISS |
| **腾讯云 CDN** | `X-Cache-Lookup` | Hit From MemCache, Hit From Disktank, Cache Miss |
| **AWS CloudFront** | `X-Cache` | Hit from cloudfront, Miss from cloudfront, RefreshHit from cloudfront |
| **Fastly** | `X-Cache` | HIT, MISS, HIT-STALE |

### 优化建议

如果 MISS 率过高（> 10%）：

#### 1. 检查缓存策略

```http
# 确保设置了足够的缓存时间
Cache-Control: s-maxage=86400  # CDN 缓存 24 小时
```

#### 2. 使用带版本号的 URL

```html
<!-- 避免频繁刷新缓存 -->
<script src="/app.js?v=1.0.0"></script>

<!-- 更好的方式：文件名带 hash -->
<script src="/app.a3f2b1.js"></script>
```

#### 3. 检查 Vary 头

```http
# Vary 头会导致缓存分片
Vary: Accept-Encoding, User-Agent

# 建议只使用必要的 Vary
Vary: Accept-Encoding
```

#### 4. 启用 Origin Shield

减少回源次数，CDN 多层缓存架构

---

## 七、多层缓存架构

### 边缘 MISS + 区域 HIT 的情况

当看到这两个响应头同时存在：

```http
eo-cache-status: MISS       ← 边缘节点（离用户最近）缓存未命中
x-cache-status: HIT         ← 区域节点（中间层）缓存命中
```

说明请求经过了**多层缓存架构**。

### 多层 CDN 架构

```
用户请求
  ↓
[边缘节点 Edge] ← eo-cache-status: MISS（边缘未命中）
  ↓
[区域节点 Regional] ← x-cache-status: HIT（区域命中）
  ↓
[源站 Origin]（未到达，因为区域节点命中了）
```

### 详细流程

```
步骤 1: 用户请求到达边缘节点（如上海节点）
  → 边缘节点检查本地缓存
  → 未找到（MISS）
  → 设置响应头: eo-cache-status: MISS

步骤 2: 边缘节点向上游请求（区域节点或 Origin Shield）
  → 区域节点检查缓存
  → 找到了！（HIT）
  → 设置响应头: x-cache-status: HIT
  → 返回给边缘节点

步骤 3: 边缘节点获得内容
  → 缓存到本地
  → 返回给用户
  → 响应头同时包含两个状态

结果: 用户收到响应，同时看到两个缓存状态头
```

### 三层缓存架构示意

```
┌─────────────────┐
│   用户浏览器     │
└────────┬────────┘
         │
┌────────▼────────┐
│   边缘节点 Edge  │  ← eo-cache-status (离用户 10ms)
│  (100+ 节点)    │
└────────┬────────┘
         │ MISS
┌────────▼────────┐
│   区域节点 POP   │  ← x-cache-status (离用户 50ms)
│  (10+ 节点)     │
└────────┬────────┘
         │ MISS
┌────────▼────────┐
│  Origin Shield  │  ← 源站保护层 (离源站最近)
└────────┬────────┘
         │ MISS
┌────────▼────────┐
│   源站 Origin    │  ← 你的服务器 (100ms+)
└─────────────────┘
```

### 性能对比

| 场景 | 延迟 | 说明 |
|-----|------|-----|
| **两层都 HIT** | ~10ms | 边缘节点直接返回（最快）|
| **边缘 MISS + 区域 HIT** | ~50ms | 从区域节点获取（本次情况）|
| **两层都 MISS** | ~200ms+ | 需要回源到源站（最慢）|

### 为什么会出现这种情况？

#### 1. 边缘节点缓存刚被清除

```bash
# 刷新了 CDN 缓存
aliyun cdn RefreshObjectCaches --ObjectPath https://cdn.example.com/app.js

# 结果：
# - 边缘节点缓存被清除（下次 MISS）
# - 但区域节点可能还有缓存（返回 HIT）
```

#### 2. 边缘节点缓存刚过期

```http
# 配置了不同层级的缓存时间
Cache-Control: s-maxage=3600  # 边缘节点 1 小时

# 内部配置（假设）
区域节点缓存: 24 小时

# 结果：
# - 1 小时后，边缘节点过期（MISS）
# - 但区域节点还在有效期内（HIT）
```

#### 3. 地理位置首次访问

```
时间轴：
10:00 - 北京用户访问 → 北京边缘节点 HIT, 区域节点 HIT
10:30 - 上海用户访问 → 上海边缘节点 MISS, 区域节点 HIT
                      （上海节点首次访问，但区域节点已有缓存）
```

#### 4. 边缘节点存储空间不足

```
边缘节点存储有限，采用 LRU 淘汰：
- 热门资源保留在边缘节点
- 冷门资源被淘汰，但区域节点还保存着
- 再次访问时：边缘 MISS，区域 HIT
```

### 优化建议

#### 1. 提高边缘节点缓存时间

```http
# 如果经常出现 边缘 MISS + 区域 HIT
# 说明边缘节点缓存过期太快

# 优化前
Cache-Control: s-maxage=3600  # 1 小时

# 优化后
Cache-Control: s-maxage=86400  # 24 小时
```

#### 2. 使用 immutable 指令

```http
# 对于带 hash 的静态资源
Cache-Control: max-age=31536000, immutable

# 避免边缘节点频繁验证缓存
```

#### 3. 监控分层命中率

```javascript
// 设置告警
if (edgeMissRate > 20% && regionalHitRate > 80%) {
  alert('边缘节点缓存效率低，考虑调整缓存策略');
}
```

### 总结

**`eo-cache-status: MISS` + `x-cache-status: HIT` 表示**：

```
✅ 边缘节点缓存未命中（可能是首次访问或缓存过期）
✅ 但上游区域节点有缓存，直接返回
✅ 避免了回源到源站（节省时间和带宽）
⚡ 响应速度：介于最快（边缘命中）和最慢（回源）之间

性能影响：
- 边缘 HIT：10-20ms（最快）
- 边缘 MISS + 区域 HIT：50-100ms（当前情况）
- 完全 MISS：200ms+（最慢）

优化方向：
- 提高边缘节点缓存时间（s-maxage）
- 使用带 hash 的资源文件名
- 大促前预热关键资源
- 监控分层命中率
```

这是一个**正常且合理的状态**，说明多层缓存架构在正常工作，虽然边缘节点未命中，但区域节点起到了保护源站的作用。

---

## 结语

HTTP 缓存是 Web 性能优化的基石，合理使用缓存策略可以：

- ✅ 显著提升用户体验（减少加载时间）
- ✅ 降低服务器负载（减少请求数）
- ✅ 节省带宽成本（减少数据传输）
- ✅ 提高系统可靠性（减少对源站依赖）

核心原则：

1. **静态资源**：使用带 hash 的文件名 + 超长缓存
2. **HTML 页面**：使用协商缓存，确保及时更新
3. **API 接口**：根据数据特性选择合适的缓存策略
4. **CDN 资源**：合理设置 `s-maxage`，利用多层缓存
5. **监控优化**：持续监控缓存命中率，不断优化策略

---

*文档生成日期：2026-01-23*
