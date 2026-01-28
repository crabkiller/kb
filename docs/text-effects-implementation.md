# 文字特效实现原理深度解析

> 从数据配置到 Canvas 绘制：textEffects 完整实现流程

---

## 目录

1. [特效配置结构](#1-特效配置结构)
2. [特效类型详解](#2-特效类型详解)
3. [Canvas 绘制原理](#3-canvas-绘制原理)
4. [特效绘制顺序](#4-特效绘制顺序)
5. [复杂特效实现](#5-复杂特效实现)
6. [性能优化策略](#6-性能优化策略)
7. [完整示例](#7-完整示例)
8. [常见问题](#8-常见问题)

---

## 1. 特效配置结构

### 1.1 TextEffect 数据结构

```typescript
interface TextEffect {
    enable: boolean;                 // 是否启用
    $id: number;                     // 特效 ID
    collapse?: boolean;              // 是否折叠（UI 状态）
    excludeScale?: number[];         // 排除缩放的属性

    // 偏移
    offset: {
        enable: boolean;
        x: number;                   // X 轴偏移（像素）
        y: number;                   // Y 轴偏移（像素）
    };

    // 描边
    stroke: {
        enable: boolean;
        color: string;               // 颜色 #RRGGBBAA
        width: number;               // 宽度（像素）
        type: 'outer' | 'inner' | 'center';  // 类型
        join: 'miter' | 'round' | 'bevel';   // 连接方式
    };

    // 填充
    filling: {
        enable: boolean;
        type: 0 | 1 | 2;             // 0=纯色, 1=图片, 2=渐变
        color?: string;              // 纯色填充
        imageContent?: ImageContent; // 图片填充
        gradient?: Gradient;         // 渐变填充
    };
}
```

### 1.2 用户示例配置解析

```json
{
    "enable": true,
    "offset": {
        "enable": false,
        "x": 0,
        "y": 0
    },
    "stroke": {
        "enable": false,
        "color": "#000000ff",
        "width": 1.3425,
        "type": "outer",
        "join": "round"
    },
    "filling": {
        "enable": true,
        "type": 1,                    // 图片填充
        "imageContent": {
            "repeat": 1,              // 重复模式
            "scaleX": 0.559,          // X 缩放
            "scaleY": 0.559,          // Y 缩放
            "image": "https://...",   // 图片 URL
            "width": 1058,            // 原始宽度
            "height": 459             // 原始高度
        }
    },
    "$id": 2697753
}
```

**配置说明**：

```
这个配置表示：
├── 启用特效 (enable: true)
├── 无偏移 (offset.enable: false)
├── 无描边 (stroke.enable: false)
└── 图片填充 (filling.type: 1)
    └── 使用指定图片作为文字填充纹理
```

---

## 2. 特效类型详解

### 2.1 Filling（填充特效）

#### A. 纯色填充（type: 0）

```typescript
{
    filling: {
        enable: true,
        type: 0,
        color: "#FF0000ff"  // 红色
    }
}
```

**Canvas 实现**：

```typescript
// 最简单的实现
ctx.fillStyle = '#FF0000';
ctx.fillText('Hello', x, y);
```

**效果**：

```
Hello World
^^^^^^^^^^^
纯红色文字
```

---

#### B. 图片填充（type: 1）

```typescript
{
    filling: {
        enable: true,
        type: 1,
        imageContent: {
            image: "https://example.com/texture.png",
            width: 1058,
            height: 459,
            scaleX: 0.5593,
            scaleY: 0.5593,
            repeat: 1  // 1=repeat, 0=no-repeat
        }
    }
}
```

**Canvas 实现**：

```typescript
// 1. 加载图片
const img = new Image();
img.src = imageContent.image;
await img.decode();

// 2. 创建图案（Pattern）
const pattern = ctx.createPattern(img, 'repeat');

// 3. 应用缩放
const scaleX = imageContent.scaleX;
const scaleY = imageContent.scaleY;
ctx.save();
ctx.scale(scaleX, scaleY);

// 4. 填充文字
ctx.fillStyle = pattern;
ctx.fillText('Hello', x / scaleX, y / scaleY);
ctx.restore();
```

**效果**：

```
Hello World
^^^^^^^^^^^
文字内部填充了纹理图案
（如金箔、木纹、大理石等）
```

**核心原理**：

```
Canvas Pattern 工作原理：

1. 创建 Pattern：
   pattern = ctx.createPattern(image, 'repeat')

2. Pattern 作为 fillStyle：
   ctx.fillStyle = pattern

3. fillText 时：
   ┌─────────────────────┐
   │ 文字形状作为遮罩      │
   │ ┌─────┐             │
   │ │Hello│ ← 文字轮廓   │
   │ └─────┘             │
   │   ↓                 │
   │ 图案在遮罩内重复     │
   │ ╔═════╗             │
   │ ║████║ ← 填充纹理   │
   │ ╚═════╝             │
   └─────────────────────┘
```

---

#### C. 渐变填充（type: 2）

```typescript
{
    filling: {
        enable: true,
        type: 2,
        gradient: {
            byLine: 0,      // 0=按元素, 1=按行, 2=按字符
            angle: 45,      // 渐变角度（度）
            stops: [
                { color: "#FF0000ff", offset: 0 },    // 起始颜色
                { color: "#0000FFff", offset: 1 }     // 结束颜色
            ]
        }
    }
}
```

**Canvas 实现**：

```typescript
// 1. 计算渐变方向（根据角度）
const angleRad = (gradient.angle * Math.PI) / 180;
const cos = Math.cos(angleRad);
const sin = Math.sin(angleRad);

// 2. 计算渐变起点和终点
const width = textWidth;
const height = textHeight;
const x0 = x;
const y0 = y;
const x1 = x + width * cos;
const y1 = y + height * sin;

// 3. 创建线性渐变
const gradient = ctx.createLinearGradient(x0, y0, x1, y1);

// 4. 添加颜色断点
gradient.addColorStop(0, '#FF0000');
gradient.addColorStop(0.5, '#FFFF00');
gradient.addColorStop(1, '#0000FF');

// 5. 填充文字
ctx.fillStyle = gradient;
ctx.fillText('Hello', x, y);
```

**效果**：

```
Hello World
^^^^^^^^^^^
红色 → 黄色 → 蓝色渐变
```

**渐变类型对比**：

```
byLine: 0 (按元素)
├── Hello World
│   ^^^^^^^^^^^
│   整个文字使用一个渐变
│
│   红 → 橙 → 黄 → 绿 → 蓝

byLine: 1 (按行)
├── Hello World
│   ^^^^^ ^^^^^
│   每行独立渐变
│
│   第 1 行: 红 → 蓝
│   第 2 行: 红 → 蓝

byLine: 2 (按字符)
├── Hello World
│   ^ ^ ^ ^ ^   每个字符独立渐变
│   H: 红 → 蓝
│   e: 红 → 蓝
│   l: 红 → 蓝
│   l: 红 → 蓝
│   o: 红 → 蓝
```

---

### 2.2 Stroke（描边特效）

```typescript
{
    stroke: {
        enable: true,
        color: "#000000ff",
        width: 3,
        type: "outer",
        join: "round"
    }
}
```

#### A. 描边类型

**1. Outer（外描边）**

```
原始文字边界
    ↓
    ┌─────┐
    │Hello│  ← 文字内容
    └─────┘
    ↓
外描边（默认）
    ┏━━━━━┓
    ┃Hello┃  ← 文字 + 描边
    ┗━━━━━┛
    ↑
    描边在文字外侧
```

**Canvas 实现**：

```typescript
// 外描边：先绘制描边，再绘制填充
ctx.strokeStyle = '#000000';
ctx.lineWidth = 3;
ctx.lineJoin = 'round';
ctx.strokeText('Hello', x, y);  // 1. 绘制描边

ctx.fillStyle = '#FF0000';
ctx.fillText('Hello', x, y);    // 2. 绘制填充（覆盖部分描边）
```

---

**2. Inner（内描边）**

```
原始文字边界
    ↓
    ┌─────┐
    │Hello│  ← 文字内容
    └─────┘
    ↓
内描边（裁剪）
    ┌─────┐
    │▓▓▓▓▓│  ← 描边侵蚀文字内部
    └─────┘
    ↑
    描边在文字内侧
```

**Canvas 实现**：

```typescript
// 内描边：需要使用 clip 裁剪
// 1. 创建文字路径
const path = new Path2D();
// ... 获取文字路径（TypeTool 提供）

// 2. 裁剪到文字内部
ctx.save();
ctx.clip(path);

// 3. 绘制描边（会被裁剪到文字内部）
ctx.strokeStyle = '#000000';
ctx.lineWidth = 6;  // 实际宽度需要 * 2（因为只显示一半）
ctx.stroke(path);

ctx.restore();
```

---

**3. Center（居中描边）**

```
原始文字边界
    ↓
    ┌─────┐
    │Hello│  ← 文字内容
    └─────┘
    ↓
居中描边
    ┏━━━━━┓
    ┃▓▓▓▓▓┃  ← 描边跨越边界
    ┗━━━━━┛
    ↑
    描边中心线在文字边界上
```

**Canvas 实现**：

```typescript
// 居中描边：直接使用 strokeText（Canvas 默认行为）
ctx.strokeStyle = '#000000';
ctx.lineWidth = 3;
ctx.strokeText('Hello', x, y);
```

---

#### B. 连接方式（lineJoin）

```
miter (尖角):
    /\
   /  \
  /____\

round (圆角):
    /‾‾\
   /    \
  /______\

bevel (斜角):
    /‾\
   /   \
  /_____\
```

**Canvas 实现**：

```typescript
ctx.lineJoin = 'miter';  // 尖角
ctx.lineJoin = 'round';  // 圆角
ctx.lineJoin = 'bevel';  // 斜角
```

---

### 2.3 Offset（偏移特效）

```typescript
{
    offset: {
        enable: true,
        x: 2,    // 向右偏移 2px
        y: 2     // 向下偏移 2px
    }
}
```

**Canvas 实现**：

```typescript
// 简单实现：修改绘制位置
ctx.fillText('Hello', x + offsetX, y + offsetY);

// 完整实现：使用 transform
ctx.save();
ctx.translate(offsetX, offsetY);
ctx.fillText('Hello', x, y);
ctx.restore();
```

**效果**：

```
无偏移：
Hello World

有偏移 (x:2, y:2)：
  Hello World
    (向右下偏移)
```

**用途**：
- 制作阴影效果
- 制作立体文字
- 制作错位效果

---

## 3. Canvas 绘制原理

### 3.1 单个特效绘制流程

```typescript
function drawTextEffect(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    effect: TextEffect
) {
    ctx.save();

    // 1. 应用偏移
    if (effect.offset.enable) {
        ctx.translate(effect.offset.x, effect.offset.y);
    }

    // 2. 绘制描边
    if (effect.stroke.enable) {
        ctx.strokeStyle = effect.stroke.color;
        ctx.lineWidth = effect.stroke.width;
        ctx.lineJoin = effect.stroke.join;

        if (effect.stroke.type === 'outer') {
            ctx.strokeText(text, x, y);
        } else if (effect.stroke.type === 'inner') {
            // 内描边需要特殊处理
            drawInnerStroke(ctx, text, x, y, effect.stroke);
        } else {
            // 居中描边
            ctx.strokeText(text, x, y);
        }
    }

    // 3. 绘制填充
    if (effect.filling.enable) {
        if (effect.filling.type === 0) {
            // 纯色填充
            ctx.fillStyle = effect.filling.color;
        } else if (effect.filling.type === 1) {
            // 图片填充
            const pattern = createImagePattern(ctx, effect.filling.imageContent);
            ctx.fillStyle = pattern;
        } else if (effect.filling.type === 2) {
            // 渐变填充
            const gradient = createGradient(ctx, x, y, effect.filling.gradient);
            ctx.fillStyle = gradient;
        }

        ctx.fillText(text, x, y);
    }

    ctx.restore();
}
```

---

### 3.2 图片填充详细实现

```typescript
function createImagePattern(
    ctx: CanvasRenderingContext2D,
    imageContent: ImageContent
): CanvasPattern {
    // 1. 获取已加载的图片
    const img = imageLoadedMap[imageContent.image];
    if (!img) {
        throw new Error('Image not loaded');
    }

    // 2. 创建离屏 Canvas（用于缩放）
    const offscreenCanvas = document.createElement('canvas');
    const offscreenCtx = offscreenCanvas.getContext('2d')!;

    // 3. 应用缩放
    const scaledWidth = imageContent.width * imageContent.scaleX;
    const scaledHeight = imageContent.height * imageContent.scaleY;

    offscreenCanvas.width = scaledWidth;
    offscreenCanvas.height = scaledHeight;

    // 4. 绘制缩放后的图片
    offscreenCtx.drawImage(
        img,
        0, 0,
        imageContent.width,
        imageContent.height,
        0, 0,
        scaledWidth,
        scaledHeight
    );

    // 5. 创建 Pattern
    const repeatMode = imageContent.repeat ? 'repeat' : 'no-repeat';
    const pattern = ctx.createPattern(offscreenCanvas, repeatMode);

    return pattern;
}
```

**工作流程图**：

```
原始图片 (1058x459)
    ↓
应用缩放 (scaleX: 0.559, scaleY: 0.559)
    ↓
缩放后图片 (591x257)
    ↓
创建 Pattern (repeat: true)
    ↓
┌─────────────────────────────┐
│ ╔════╗╔════╗╔════╗         │  Pattern 重复平铺
│ ║图片║║图片║║图片║         │
│ ╚════╝╚════╝╚════╝         │
│ ╔════╗╔════╗╔════╗         │
│ ║图片║║图片║║图片║         │
│ ╚════╝╚════╝╚════╝         │
└─────────────────────────────┘
    ↓
作为 fillStyle
    ↓
ctx.fillText('Hello')
    ↓
┏━━━━━┓
┃████┃  ← 文字形状作为遮罩
┗━━━━━┛    Pattern 填充其中
```

---

### 3.3 渐变填充详细实现

```typescript
function createGradient(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    gradientConfig: Gradient
): CanvasGradient {
    // 1. 计算渐变角度
    const angleRad = (gradientConfig.angle * Math.PI) / 180;

    // 2. 计算渐变向量
    const cos = Math.cos(angleRad);
    const sin = Math.sin(angleRad);

    // 3. 计算起点和终点
    const centerX = x + width / 2;
    const centerY = y + height / 2;
    const radius = Math.sqrt(width * width + height * height) / 2;

    const x0 = centerX - radius * cos;
    const y0 = centerY - radius * sin;
    const x1 = centerX + radius * cos;
    const y1 = centerY + radius * sin;

    // 4. 创建线性渐变
    const gradient = ctx.createLinearGradient(x0, y0, x1, y1);

    // 5. 添加颜色断点
    for (const stop of gradientConfig.stops) {
        gradient.addColorStop(stop.offset, stop.color);
    }

    return gradient;
}
```

**渐变角度示例**：

```
angle: 0° (水平)
┌──────────────┐
│ →→→→→→→→→→→→ │  红色 → 蓝色
└──────────────┘

angle: 90° (垂直)
┌──────────────┐
│ ↓            │  红色
│ ↓            │    ↓
│ ↓            │  蓝色
└──────────────┘

angle: 45° (对角)
┌──────────────┐
│ ↘            │  红色
│   ↘          │    ↘
│     ↘        │      ↘
└──────────────┘        蓝色

angle: 135°
┌──────────────┐
│            ↙ │  红色
│          ↙   │    ↙
│        ↙     │      ↙
└──────────────┘        蓝色
```

---

## 4. 特效绘制顺序

### 4.1 单个特效的绘制顺序

```
特效绘制顺序（从下到上）：

1️⃣ 描边层（Stroke）
    ↓
2️⃣ 填充层（Filling）
    ↓
3️⃣ 最终合成

示例：
    1. 绘制黑色描边（宽度 3px）
       ┏━━━━━┓
       ┃     ┃
       ┗━━━━━┛

    2. 绘制红色填充（覆盖部分描边）
       ┏━━━━━┓
       ┃████┃
       ┗━━━━━┛

    3. 最终效果（红色文字 + 黑色描边）
       ┏━━━━━┓
       ┃RED!┃
       ┗━━━━━┛
```

---

### 4.2 多个特效的绘制顺序

```typescript
// textEffects 数组中的多个特效
textEffects: [
    { $id: 1, filling: { color: '#FF0000' } },  // 特效 1
    { $id: 2, filling: { color: '#00FF00' } },  // 特效 2
    { $id: 3, filling: { color: '#0000FF' } }   // 特效 3
]
```

**绘制顺序**：

```
从后往前绘制（数组末尾的在最下层）

Canvas 绘制：
    特效 3 (蓝色) ← 最先绘制（最底层）
    ↓
    特效 2 (绿色) ← 第二层
    ↓
    特效 1 (红色) ← 最后绘制（最上层）

最终效果：
┌─────────────┐
│   特效 1    │  ← 可见（最上层）
│   (红色)    │
└─────────────┘
│   特效 2    │  ← 被遮挡
│   (绿色)    │
└─────────────┘
│   特效 3    │  ← 被遮挡
│   (蓝色)    │
└─────────────┘
```

**TypeTool 实现**：

```typescript
// 从后往前遍历特效数组
for (let i = textEffects.length - 1; i >= 0; i--) {
    const effect = textEffects[i];

    if (!effect.enable) continue;

    // 绘制单个特效
    drawTextEffect(ctx, text, x, y, effect);
}
```

---

### 4.3 偏移特效与层叠

```typescript
textEffects: [
    {
        offset: { enable: true, x: 0, y: 0 },
        filling: { color: '#FF0000' }  // 红色，无偏移
    },
    {
        offset: { enable: true, x: 2, y: 2 },
        filling: { color: '#000000' }  // 黑色阴影，偏移 2px
    }
]
```

**效果**：

```
绘制顺序（从后往前）：

1. 绘制黑色阴影（偏移 2, 2）
   ┌─────────┐
   │         │
   │  Hello  │  ← (x+2, y+2)
   │         │
   └─────────┘

2. 绘制红色文字（无偏移）
   ┌─────────┐
   │ Hello   │  ← (x, y)
   │  █████  │  ← 阴影可见
   └─────────┘

最终效果（立体文字）：
   Hello
    █████  ← 黑色阴影
```

---

## 5. 复杂特效实现

### 5.1 立体文字效果

```typescript
// 配置：多层偏移 + 渐变
textEffects: [
    // 主文字层
    {
        offset: { enable: false, x: 0, y: 0 },
        filling: {
            type: 2,
            gradient: {
                angle: 90,
                stops: [
                    { color: '#FFD700', offset: 0 },    // 金色
                    { color: '#FFA500', offset: 1 }     // 橙色
                ]
            }
        },
        stroke: {
            enable: true,
            color: '#8B4513',
            width: 2,
            type: 'outer'
        }
    },
    // 阴影层 1
    {
        offset: { enable: true, x: 2, y: 2 },
        filling: { color: 'rgba(0,0,0,0.3)' }
    },
    // 阴影层 2
    {
        offset: { enable: true, x: 4, y: 4 },
        filling: { color: 'rgba(0,0,0,0.2)' }
    },
    // 阴影层 3
    {
        offset: { enable: true, x: 6, y: 6 },
        filling: { color: 'rgba(0,0,0,0.1)' }
    }
]
```

**绘制流程**：

```
1. 绘制阴影层 3 (x+6, y+6, alpha=0.1)
2. 绘制阴影层 2 (x+4, y+4, alpha=0.2)
3. 绘制阴影层 1 (x+2, y+2, alpha=0.3)
4. 绘制主文字 (x, y, 渐变+描边)

效果：
    HELLO
     █████  ← 阴影逐渐淡化
      ████
       ███
```

---

### 5.2 霓虹灯效果

```typescript
textEffects: [
    // 外发光 3（最外层）
    {
        stroke: {
            enable: true,
            color: 'rgba(255,0,255,0.2)',
            width: 10,
            type: 'outer'
        }
    },
    // 外发光 2
    {
        stroke: {
            enable: true,
            color: 'rgba(255,0,255,0.4)',
            width: 6,
            type: 'outer'
        }
    },
    // 外发光 1
    {
        stroke: {
            enable: true,
            color: 'rgba(255,0,255,0.8)',
            width: 2,
            type: 'outer'
        }
    },
    // 主文字
    {
        filling: { color: '#FFFFFF' }
    }
]
```

**效果**：

```
     ▒▒▒▒▒▒▒  ← 外发光 3 (最淡)
    ▒▓▓▓▓▓▓▒  ← 外发光 2
   ▒▓█████▓▒  ← 外发光 1
   ▓███████▓  ← 主文字 (白色)
```

---

### 5.3 纹理文字 + 描边

**用户的示例配置**：

```json
{
    "stroke": {
        "enable": false
    },
    "filling": {
        "enable": true,
        "type": 1,
        "imageContent": {
            "image": "https://st-gdx.dancf.com/.../2d88.png",
            "width": 1058,
            "height": 459,
            "scaleX": 0.5593,
            "scaleY": 0.5593,
            "repeat": 1
        }
    }
}
```

**实现代码**：

```typescript
async function drawTextureText(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    effect: TextEffect
) {
    // 1. 加载纹理图片
    const img = await loadImage(effect.filling.imageContent.image);

    // 2. 创建缩放后的 Pattern
    const pattern = createScaledPattern(
        ctx,
        img,
        effect.filling.imageContent.scaleX,
        effect.filling.imageContent.scaleY
    );

    // 3. 绘制文字
    ctx.save();
    ctx.fillStyle = pattern;
    ctx.fillText(text, x, y);
    ctx.restore();
}

function createScaledPattern(
    ctx: CanvasRenderingContext2D,
    img: HTMLImageElement,
    scaleX: number,
    scaleY: number
): CanvasPattern {
    // 创建离屏 Canvas
    const canvas = document.createElement('canvas');
    const offCtx = canvas.getContext('2d')!;

    // 设置缩放后的尺寸
    canvas.width = img.width * scaleX;
    canvas.height = img.height * scaleY;

    // 绘制缩放后的图片
    offCtx.drawImage(img, 0, 0, canvas.width, canvas.height);

    // 创建 Pattern
    return ctx.createPattern(canvas, 'repeat')!;
}
```

**效果**：

```
原始纹理：
┌──────────────────┐
│ ╔══════════╗    │  1058x459 的图片
│ ║  纹理图案  ║    │
│ ╚══════════╝    │
└──────────────────┘

缩放后 (0.5593)：
┌──────────┐
│ ╔═════╗  │  591x257
│ ║纹理 ║  │
│ ╚═════╝  │
└──────────┘

应用到文字：
┏━━━━━━━━━┓
┃  HELLO  ┃  ← 文字内部填充了纹理
┗━━━━━━━━━┛
  ╔═╦═╦═╗    纹理重复平铺
```

---

### 5.4 描边类型对比示例

```typescript
// 配置 1: 外描边
{
    stroke: { type: 'outer', width: 4, color: '#000000' },
    filling: { color: '#FF0000' }
}

// 配置 2: 内描边
{
    stroke: { type: 'inner', width: 4, color: '#000000' },
    filling: { color: '#FF0000' }
}

// 配置 3: 居中描边
{
    stroke: { type: 'center', width: 4, color: '#000000' },
    filling: { color: '#FF0000' }
}
```

**效果对比**：

```
外描边 (outer):
┏━━━━━━━━━┓
┃  HELLO  ┃  ← 文字保持原始大小
┗━━━━━━━━━┛    描边在外侧，文字更宽
  ████████
  4px 描边

内描边 (inner):
┌─────────┐
│  HELLO  │  ← 描边侵蚀文字内部
└─────────┘    文字看起来更细
  ████████
  4px 描边

居中描边 (center):
┏━━━━━━━━━┓
┃  HELLO  ┃  ← 描边跨越文字边界
┗━━━━━━━━━┛    一半在内，一半在外
  ████████
  4px 描边
```

---

## 6. 性能优化策略

### 6.1 图片预加载

```typescript
// 文件位置: type-tool-render/src/init.ts
export let loadImageHook: (model: TextElementModel) => Promise<void>;

// 注册 Hook
loadImageHook = async (model: TextElementModel) => {
    const images = getUsedImages(model);  // 提取所有图片 URL

    await Promise.all(
        images.map(async (url) => {
            if (imageLoadedMap[url]) return;  // 已加载，跳过

            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.src = url;
            await img.decode();

            imageLoadedMap[url] = img;  // 缓存
        })
    );
};

// 使用
await loadImageHook(textModel);  // 预加载所有图片
// 此时所有图片已在内存中，绘制时直接使用
```

**效果**：

```
不预加载：
├── 开始绘制
├── 等待图片 1 加载... (200ms)
├── 等待图片 2 加载... (200ms)
└── 总耗时: 400ms+

预加载：
├── 预加载所有图片 (400ms, 并行)
├── 开始绘制 (立即)
└── 总耗时: 400ms (减少 50%)
```

---

### 6.2 Pattern 缓存

```typescript
// Pattern 缓存
const patternCache = new Map<string, CanvasPattern>();

function getCachedPattern(
    ctx: CanvasRenderingContext2D,
    imageContent: ImageContent
): CanvasPattern {
    // 生成缓存 key
    const key = `${imageContent.image}_${imageContent.scaleX}_${imageContent.scaleY}`;

    // 检查缓存
    if (patternCache.has(key)) {
        return patternCache.get(key)!;
    }

    // 创建新 Pattern
    const pattern = createImagePattern(ctx, imageContent);

    // 缓存
    patternCache.set(key, pattern);

    return pattern;
}
```

**效果**：

```
不缓存 Pattern:
├── 每次绘制都创建 Pattern
├── 100 个文字元素 = 100 次创建
└── 耗时: 100 * 5ms = 500ms

缓存 Pattern:
├── 首次创建 Pattern (5ms)
├── 后续直接使用缓存 (0ms)
└── 耗时: 5ms (快 100 倍)
```

---

### 6.3 离屏 Canvas 复用

```typescript
// 离屏 Canvas 池
const offscreenCanvasPool: HTMLCanvasElement[] = [];

function getOffscreenCanvas(width: number, height: number): HTMLCanvasElement {
    // 尝试复用
    const canvas = offscreenCanvasPool.pop();

    if (canvas) {
        canvas.width = width;
        canvas.height = height;
        return canvas;
    }

    // 创建新 Canvas
    return document.createElement('canvas');
}

function releaseOffscreenCanvas(canvas: HTMLCanvasElement) {
    // 回收到池中
    offscreenCanvasPool.push(canvas);
}

// 使用
const canvas = getOffscreenCanvas(200, 100);
// ... 使用 Canvas ...
releaseOffscreenCanvas(canvas);
```

---

### 6.4 特效合并优化

```typescript
// 优化前：多个相同的描边特效
textEffects: [
    { stroke: { width: 2, color: '#000000' } },
    { stroke: { width: 2, color: '#000000' } },  // 重复
    { stroke: { width: 2, color: '#000000' } }   // 重复
]

// 优化后：合并为一个
textEffects: [
    { stroke: { width: 2, color: '#000000' } }
]
```

**自动合并逻辑**：

```typescript
function optimizeEffects(effects: TextEffect[]): TextEffect[] {
    const optimized: TextEffect[] = [];
    const seen = new Set<string>();

    for (const effect of effects) {
        // 生成特效指纹
        const fingerprint = JSON.stringify({
            offset: effect.offset,
            stroke: effect.stroke,
            filling: effect.filling
        });

        // 跳过重复的特效
        if (seen.has(fingerprint)) continue;

        seen.add(fingerprint);
        optimized.push(effect);
    }

    return optimized;
}
```

---

## 7. 完整示例

### 7.1 完整的特效绘制实现

```typescript
import type { TextElementModel, TextEffect } from '@design/types';
import { getTypeToolIns } from '@editor/type-tool-render';

/**
 * 绘制带特效的文字
 */
export async function drawTextWithEffects(
    model: TextElementModel,
    ctx: CanvasRenderingContext2D
): Promise<void> {
    // 1. 初始化 TypeTool
    const typeTool = await getTypeToolIns();

    // 2. 排版
    const layout = typeTool.shape(model);

    // 3. 预加载图片资源
    await loadEffectImages(model.textEffects);

    // 4. 遍历所有特效（从后往前）
    for (let i = model.textEffects.length - 1; i >= 0; i--) {
        const effect = model.textEffects[i];

        if (!effect.enable) continue;

        // 5. 绘制单个特效
        await drawSingleEffect(ctx, model, layout, effect);
    }
}

/**
 * 绘制单个特效
 */
async function drawSingleEffect(
    ctx: CanvasRenderingContext2D,
    model: TextElementModel,
    layout: TextLayout,
    effect: TextEffect
): Promise<void> {
    const typeTool = await getTypeToolIns();

    ctx.save();

    // 1. 应用偏移
    if (effect.offset.enable) {
        ctx.translate(effect.offset.x, effect.offset.y);
    }

    // 2. 准备绘制选项
    const options = {
        resolution: 2,
        effect: effect  // 传递特效配置
    };

    // 3. TypeTool 绘制（内部处理描边和填充）
    typeTool.draw(model, ctx, layout, options);

    ctx.restore();
}

/**
 * 预加载特效图片
 */
async function loadEffectImages(effects: TextEffect[]): Promise<void> {
    const imageUrls: string[] = [];

    // 收集所有图片 URL
    for (const effect of effects) {
        if (
            effect.filling?.enable &&
            effect.filling.type === 1 &&
            effect.filling.imageContent?.image
        ) {
            imageUrls.push(effect.filling.imageContent.image);
        }
    }

    // 并行加载
    await Promise.all(
        imageUrls.map(async (url) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.src = url;
            await img.decode();
            imageLoadedMap[url] = img;
        })
    );
}

/**
 * 创建图片 Pattern
 */
function createImagePattern(
    ctx: CanvasRenderingContext2D,
    imageContent: ImageContent
): CanvasPattern {
    // 1. 获取图片
    const img = imageLoadedMap[imageContent.image];
    if (!img) throw new Error('Image not loaded');

    // 2. 创建缩放后的离屏 Canvas
    const canvas = document.createElement('canvas');
    const offCtx = canvas.getContext('2d')!;

    const scaledWidth = imageContent.width * imageContent.scaleX;
    const scaledHeight = imageContent.height * imageContent.scaleY;

    canvas.width = scaledWidth;
    canvas.height = scaledHeight;

    // 3. 绘制缩放后的图片
    offCtx.drawImage(img, 0, 0, scaledWidth, scaledHeight);

    // 4. 创建 Pattern
    const repeatMode = imageContent.repeat ? 'repeat' : 'no-repeat';
    return ctx.createPattern(canvas, repeatMode)!;
}

/**
 * 创建渐变
 */
function createGradient(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    config: Gradient
): CanvasGradient {
    // 计算渐变方向
    const angleRad = (config.angle * Math.PI) / 180;
    const cos = Math.cos(angleRad);
    const sin = Math.sin(angleRad);

    // 计算起点和终点
    const centerX = x + width / 2;
    const centerY = y + height / 2;
    const radius = Math.sqrt(width * width + height * height) / 2;

    const x0 = centerX - radius * cos;
    const y0 = centerY - radius * sin;
    const x1 = centerX + radius * cos;
    const y1 = centerY + radius * sin;

    // 创建渐变
    const gradient = ctx.createLinearGradient(x0, y0, x1, y1);

    // 添加颜色断点
    for (const stop of config.stops) {
        gradient.addColorStop(stop.offset, stop.color);
    }

    return gradient;
}
```

---

### 7.2 实际使用示例

```typescript
// 创建文字元素
const textModel: TextElementModel = {
    type: 'text',
    content: 'HELLO WORLD',
    fontFamily: 'Arial Black',
    fontSize: 72,
    textEffects: [
        // 主文字（金色渐变 + 棕色描边）
        {
            enable: true,
            offset: { enable: false, x: 0, y: 0 },
            stroke: {
                enable: true,
                color: '#8B4513',
                width: 3,
                type: 'outer',
                join: 'round'
            },
            filling: {
                enable: true,
                type: 2,
                gradient: {
                    byLine: 0,
                    angle: 90,
                    stops: [
                        { color: '#FFD700', offset: 0 },
                        { color: '#FFA500', offset: 1 }
                    ]
                }
            },
            $id: 1
        },
        // 阴影层
        {
            enable: true,
            offset: { enable: true, x: 4, y: 4 },
            stroke: { enable: false },
            filling: {
                enable: true,
                type: 0,
                color: 'rgba(0,0,0,0.5)'
            },
            $id: 2
        }
    ],
    // ... 其他属性
};

// 绘制
const canvas = document.createElement('canvas');
canvas.width = 800;
canvas.height = 200;
const ctx = canvas.getContext('2d')!;

await drawTextWithEffects(textModel, ctx);

// 结果：金色渐变文字 + 棕色描边 + 黑色阴影
document.body.appendChild(canvas);
```

---

## 8. 常见问题

### Q1: 为什么图片填充需要预加载？

**A:** Canvas Pattern 必须使用已加载的 Image 对象。

```typescript
// ❌ 错误：图片未加载
const img = new Image();
img.src = 'texture.png';
const pattern = ctx.createPattern(img, 'repeat');  // 失败！

// ✅ 正确：等待加载完成
const img = new Image();
img.src = 'texture.png';
await img.decode();  // 等待加载
const pattern = ctx.createPattern(img, 'repeat');  // 成功
```

---

### Q2: 多个特效时如何避免重复绘制？

**A:** 使用特效去重和合并。

```typescript
// 问题：多个相同特效导致重复绘制
textEffects: [
    { filling: { color: '#FF0000' } },
    { filling: { color: '#FF0000' } },  // 重复
    { filling: { color: '#FF0000' } }   // 重复
]

// 解决：在绘制前去重
const uniqueEffects = Array.from(
    new Set(textEffects.map(e => JSON.stringify(e)))
).map(s => JSON.parse(s));
```

---

### Q3: 描边类型如何实现内描边？

**A:** 使用 clip 裁剪。

```typescript
// 内描边实现
function drawInnerStroke(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    stroke: StrokeConfig
) {
    // 1. 创建文字路径
    const metrics = ctx.measureText(text);

    // 2. 裁剪到文字内部
    ctx.save();
    ctx.beginPath();
    // ... 添加文字路径 ...
    ctx.clip();

    // 3. 绘制描边（宽度翻倍，因为一半被裁剪掉）
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.width * 2;
    ctx.strokeText(text, x, y);

    ctx.restore();
}
```

---

### Q4: 如何优化大量特效的性能？

**A:** 使用多种优化策略。

```
优化策略：

1️⃣ 图片预加载
   └── 避免绘制时等待

2️⃣ Pattern 缓存
   └── 相同配置的 Pattern 只创建一次

3️⃣ 特效去重
   └── 避免重复绘制相同特效

4️⃣ 离屏 Canvas 复用
   └── 减少 Canvas 创建开销

5️⃣ 延迟渲染
   └── 视口外的元素不绘制特效
```

---

### Q5: 渐变角度如何计算？

**A:** 使用三角函数计算渐变向量。

```typescript
// 角度转弧度
const angleRad = (angle * Math.PI) / 180;

// 计算方向向量
const cos = Math.cos(angleRad);
const sin = Math.sin(angleRad);

// 计算起点和终点
const centerX = x + width / 2;
const centerY = y + height / 2;
const radius = Math.sqrt(width * width + height * height) / 2;

const x0 = centerX - radius * cos;
const y0 = centerY - radius * sin;
const x1 = centerX + radius * cos;
const y1 = centerY + radius * sin;

// 创建渐变
const gradient = ctx.createLinearGradient(x0, y0, x1, y1);
```

---

### Q6: 特效会增加多少内存和性能开销？

**A:** 取决于特效类型和数量。

```
内存开销：

纯色填充：
└── 0 额外内存（直接使用颜色值）

图片填充：
├── 原始图片: width × height × 4 bytes
├── 缩放后 Canvas: scaledWidth × scaledHeight × 4 bytes
└── Pattern: 引用，无额外开销
示例：1058×459 图片 = 1.9 MB

渐变填充：
└── 0 额外内存（只是渐变对象）

性能开销：

纯色填充: ~1ms
图片填充: ~5-10ms (首次创建 Pattern)
渐变填充: ~2-3ms
描边: ~2-5ms (取决于宽度)

多个特效: 线性叠加
3 个特效 = 3 × 5ms = 15ms (仍可 60fps)
```

---

## 总结

### 核心要点

```
文字特效实现原理：

1️⃣ 数据结构
   ├── TextEffect 配置对象
   ├── 包含：offset、stroke、filling
   └── 支持：纯色、图片、渐变

2️⃣ Canvas API
   ├── fillText: 填充文字
   ├── strokeText: 描边文字
   ├── createPattern: 创建图案
   └── createLinearGradient: 创建渐变

3️⃣ 绘制顺序
   ├── 从后往前遍历特效数组
   ├── 先绘制描边，后绘制填充
   └── 偏移通过 translate 实现

4️⃣ 性能优化
   ├── 图片预加载
   ├── Pattern 缓存
   ├── 特效去重
   └── Canvas 复用
```

### 关键流程

```
TextEffect 配置
    ↓
预加载图片资源
    ↓
从后往前遍历特效
    ↓
每个特效：
    ├── 应用偏移 (translate)
    ├── 绘制描边 (strokeText)
    └── 绘制填充 (fillText)
        ├── 纯色: fillStyle = color
        ├── 图片: fillStyle = pattern
        └── 渐变: fillStyle = gradient
    ↓
合成最终纹理
    ↓
上传到 GPU
    ↓
WebGL 渲染
```

### 最佳实践

```
1. 预加载图片
   └── 避免绘制时等待加载

2. 缓存 Pattern
   └── 相同配置只创建一次

3. 合理使用特效
   └── 避免过多重复特效

4. 优化特效顺序
   └── 将重要的放在最上层（数组开头）

5. 监控性能
   └── 特效过多时考虑降级
```

---

**文档版本**: v1.0
**创建日期**: 2026-01-22
**作者**: AI Assistant
**最后更新**: 2026-01-22
