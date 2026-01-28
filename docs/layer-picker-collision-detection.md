# Layer Picker 碰撞检测实现原理

## 概述

Layer Picker 是编辑器中用于精确检测鼠标点击命中元素的碰撞检测模块。它采用了经典的 **Color Picking（颜色拾取）** 技术，解决了不规则形状元素的点击穿透问题，使用户能够准确选中具有透明区域的图像、SVG、路径等复杂元素。

## 核心原理：Color Picking 技术

### 基本思想

Color Picking 是图形学中一种高效的碰撞检测方案：

1. 为每个可交互元素分配一个**唯一的颜色 ID**
2. 将所有元素绘制到一个**离屏 Canvas（hitCanvas）** 上，每个元素使用其唯一颜色填充
3. 点击检测时，读取点击位置的**像素颜色值**
4. 通过颜色值**反向查找**对应的元素

```
┌─────────────────────────────────────────────────────────────────┐
│                        Color Picking 流程                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   1. 准备阶段                                                   │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │  Element A ──► Color #FF0000 (红色)                     │   │
│   │  Element B ──► Color #00FF00 (绿色)                     │   │
│   │  Element C ──► Color #0000FF (蓝色)                     │   │
│   └─────────────────────────────────────────────────────────┘   │
│                              │                                  │
│                              ▼                                  │
│   2. 绘制到离屏 Canvas                                          │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │  ┌──────────┐  ┌──────────┐  ┌──────────┐               │   │
│   │  │  红色区域 │  │  绿色区域 │  │  蓝色区域 │  (hitCanvas) │   │
│   │  │  (A)     │  │  (B)     │  │  (C)     │               │   │
│   │  └──────────┘  └──────────┘  └──────────┘               │   │
│   └─────────────────────────────────────────────────────────┘   │
│                              │                                  │
│                              ▼                                  │
│   3. 点击检测                                                   │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │  点击坐标 (x, y) ──► 读取像素 ──► #00FF00 ──► Element B │   │
│   └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 为什么选择 Color Picking？

| 方案 | 优点 | 缺点 |
|------|------|------|
| 包围盒检测 | 简单快速 | 无法处理透明区域和不规则形状 |
| 路径碰撞检测 | 精确 | 计算复杂，难以处理图像元素 |
| **Color Picking** | **精确、统一、高效** | **需要维护离屏 Canvas** |

## 架构设计

### 文件结构

```
layer-picker/
├── index.ts                    # 插件入口，导出 createLayerPickerPlugin
├── core/
│   ├── index.ts               # 核心模块导出
│   ├── layer-picker.ts        # LayerPicker 核心类
│   ├── layer-picker-rules.js  # 图层信息提取规则
│   ├── color-image.ts         # 图像着色算法
│   └── utils.ts               # 工具函数
```

### 核心类关系

```
┌─────────────────────────────────────────────────────────────────┐
│                     createLayerPickerPlugin                     │
│                         (插件工厂函数)                           │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐    ┌─────────────────────────────────┐     │
│  │   LayerPicker   │◄───│   getLayers (图层信息提取)       │     │
│  │                 │    └─────────────────────────────────┘     │
│  │  - hitCanvas    │                                            │
│  │  - colorMap     │    ┌─────────────────────────────────┐     │
│  │  - zoom         │◄───│   colorImage (图像着色)          │     │
│  │                 │    └─────────────────────────────────┘     │
│  │  + update()     │                                            │
│  │  + pick()       │    ┌─────────────────────────────────┐     │
│  │  + drawImage()  │◄───│   transformLayer (变换绘制)      │     │
│  │  + drawSvg()    │    └─────────────────────────────────┘     │
│  │  + drawDefault()│                                            │
│  └─────────────────┘                                            │
└─────────────────────────────────────────────────────────────────┘
```

## 核心实现详解

### 1. LayerPicker 类

LayerPicker 是碰撞检测的核心类，负责管理 hitCanvas 和颜色映射。

```typescript
export class LayerPicker {
    hitCanvas: HTMLCanvasElement;       // 离屏 Canvas，用于绘制颜色 ID
    hitCtx: CanvasRenderingContext2D;   // Canvas 2D 上下文
    colorMap: Map<string, Layer>;       // 颜色 → 图层的映射表
    zoom: number;                        // 缩放比例（性能优化）
    options: { 
        defaultSize: number;             // hitCanvas 最大尺寸
        repeatDrawCount: number;         // 着色时的重复绘制次数
    };
}
```

### 2. 颜色生成策略

每个图层需要一个唯一的颜色作为 ID：

```typescript
export const getNewColor = (colorMap = new Map()): string => {
    let [max, count] = [100, 0];
    while (true) {
        const newColor = tinycolor.random().toHexString();
        count++;
        // 排除已存在的颜色和白色（避免与背景冲突）
        if (!colorMap.get(newColor) && newColor !== '#ffffff') return newColor;
        if (count > max) throw new Error('Could not generate new hit test color.');
    }
};
```

**设计考量：**
- 使用随机颜色而非顺序颜色，避免在重复更新时出现冲突
- 排除白色 `#ffffff`，因为白色通常是 Canvas 的默认背景色
- 最多尝试 100 次，防止死循环

### 3. 图层更新流程（update 方法）

```typescript
async update(layers: Layer[], width: number, height: number) {
    // 1. 计算缩放比例（性能优化）
    const zoom = Math.min(defaultSize / width, defaultSize / height, 1);
    this.hitCanvas.width = Math.ceil(width * zoom);
    this.hitCanvas.height = Math.ceil(height * zoom);
    this.colorMap = new Map();
    this.zoom = zoom;

    // 2. 遍历所有图层
    for (let layer of layers) {
        // 3. 跳过过小的元素
        if (!(width >= 1 || height >= 1)) continue;

        // 4. 应用缩放
        layer = Object.assign({}, layer, {
            x: x * zoom,
            y: y * zoom,
            width: Math.max(1, width * zoom),
            height: Math.max(1, height * zoom),
        });

        // 5. 生成唯一颜色并建立映射
        const newColor = getNewColor(this.colorMap);
        this.colorMap.set(newColor, layer);

        // 6. 根据类型选择绘制策略
        switch (type) {
            case 'image': await this.drawImage(layer, newColor); break;
            case 'svg':   await this.drawSvg(layer, newColor);   break;
            case 'path':  await this.drawImage(layer, newColor, 6); break;
            default:      this.drawDefault(layer, newColor);
        }
    }
}
```

### 4. 图像着色算法（colorImage）

这是碰撞检测的关键算法，将带透明度的图像转换为纯色填充：

```typescript
export async function colorImage(
    image: HTMLCanvasElement | HTMLImageElement,
    options: { color: string; width: number; height: number; shadowBlur?: number },
    repeatDrawCount = 15,
) {
    // 1. 扩展边缘（shadowBlur 用于边缘柔化）
    width = Math.max(width, 3) + shadowBlur * 2;
    height = Math.max(height, 3) + shadowBlur * 2;

    const canvas = createCanvas(width, height, true);
    const ctx = canvas.getContext('2d')!;

    // 2. 绘制图像并添加阴影扩展边缘
    ctx.shadowColor = 'black';
    ctx.shadowBlur = shadowBlur;
    ctx.drawImage(image, shadowBlur, shadowBlur, ...);

    // 3. 反复绘制自身，消除半透明像素
    for (let i = 0; i < repeatDrawCount; i++) {
        ctx.drawImage(canvas, 0, 0, width, height);
    }

    // 4. 使用 source-in 混合模式进行着色
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, width, height);

    return { canvas, offsetX: -shadowBlur, offsetY: -shadowBlur, cleanCanvas };
}
```

**算法原理图解：**

```
原始图像（带透明度）          反复绘制后（消除半透明）      source-in 着色后
┌─────────────────────┐     ┌─────────────────────┐     ┌─────────────────────┐
│  ░░░░░░░░░░░░░░░░░  │     │  ████████████████   │     │  ████████████████   │
│  ░░░░████████░░░░░  │     │  ████████████████   │     │  ████ RED █████████ │
│  ░░████████████░░░  │ ──► │  ██████████████████ │ ──► │  ██████ RED ███████ │
│  ░░░░████████░░░░░  │     │  ████████████████   │     │  ████ RED █████████ │
│  ░░░░░░░░░░░░░░░░░  │     │  ████████████████   │     │  ████████████████   │
└─────────────────────┘     └─────────────────────┘     └─────────────────────┘
    半透明边缘                   完全不透明                 纯色填充（用于 ID）
```

**为什么需要反复绘制？**

图像边缘通常有抗锯齿产生的半透明像素（alpha < 255），这些像素在着色后可能与背景或相邻元素颜色混合，导致：
- 颜色值不精确
- 点击检测时颜色匹配失败

通过反复绘制自身（`ctx.drawImage(canvas, 0, 0)`），每次绘制都会让半透明像素变得更不透明，约 15 次后可以达到完全不透明。

### 5. 点击检测（pick 方法）

```typescript
pick(x: number, y: number) {
    const { zoom } = this;
    
    // 1. 读取点击位置的像素颜色（应用缩放）
    const rgba = this.hitCtx.getImageData(x * zoom, y * zoom, 1, 1).data;
    if (!rgba) return null;

    // 2. 转换为 hex 颜色值
    const tColor = tinycolor(`rgb(${rgba[0]},${rgba[1]},${rgba[2]})`);
    const hexColor = tColor.toHexString();

    // 3. 精确匹配
    let targetLayer = this.colorMap.get(hexColor)!;
    if (targetLayer) return targetLayer;

    // 4. 模糊匹配（处理颜色精度损失）
    let minDistance = Number.POSITIVE_INFINITY;
    for (const [key, layer] of this.colorMap) {
        const { r, g, b } = tinycolor(key).toRgb();
        // 计算颜色距离（欧几里得距离）
        const distance = Math.hypot(r - r0, g - g0, b - b0);
        if (distance < minDistance) {
            minDistance = distance;
            targetLayer = layer;
        }
    }

    // 5. 阈值判断（阈值 4 ≈ √(2² + 2² + 2²)）
    if (minDistance < 4) {
        this.colorMap.set(hexColor, targetLayer);  // 缓存模糊匹配结果
        return targetLayer;
    }
}
```

**模糊匹配的必要性：**

由于 Canvas 绘制、缩放、着色等过程中可能存在颜色精度损失，读取到的像素颜色可能与原始颜色略有偏差。因此采用颜色距离容差机制：

- 使用 RGB 空间的欧几里得距离衡量颜色差异
- 阈值设为 4，约等于 `√(2² + 2² + 2²) ≈ 3.46`
- 匹配成功后缓存结果，避免重复计算

### 6. 变换处理（transformLayer）

处理元素的旋转、缩放等变换：

```typescript
export function transformLayer(ctx: CanvasRenderingContext2D, options: Options) {
    const { transform, x, y, width, height, inputCanvas, color, effectedResult } = options;
    
    ctx.save();
    
    if (transform) {
        const { a = 1, b = 0, c = 0, d = 1, tx = 0, ty = 0 } = transform;
        const [midX, midY] = [x + width / 2, y + height / 2];
        
        // 以元素中心为基准点进行变换
        ctx.translate(midX, midY);
        ctx.transform(a, b, c, d, tx, ty);
        ctx.translate(-midX, -midY);
    }

    if (inputCanvas) {
        ctx.drawImage(inputCanvas, x + effectedResult.left, y + effectedResult.top);
    } else {
        ctx.fillStyle = color || '';
        ctx.fillRect(x, y, width, height);
    }
    
    ctx.restore();
}
```

## 性能优化策略

### 1. 缩放优化

hitCanvas 限制最大尺寸（默认 1500~2000px），通过缩放减少像素数量：

```typescript
const zoom = Math.min(defaultSize / width, defaultSize / height, 1);
this.hitCanvas.width = Math.ceil(width * zoom);
this.hitCanvas.height = Math.ceil(height * zoom);
```

**效果：**
- 4000×3000 的画布 → 缩放至 2000×1500
- 减少 75% 的像素处理量

### 2. 防抖更新

使用 lodash 的 debounce 避免频繁重绘：

```typescript
// 快速响应（100ms）- 用于即时性要求高的场景
lazyUpdatePickerFast = debounce(() => {
    const [layers, width, height] = getLayers(editor);
    $picker.update(layers, width, height);
}, 100);

// 慢速响应（500ms）- 用于布局切换等场景
lazyUpdatePickerSlow = debounce(() => {
    const [layers, width, height] = getLayers(editor);
    $picker.update(layers, width, height);
}, 500);
```

### 3. 内存管理

及时释放临时 Canvas：

```typescript
cleanCanvas() {
    // 快速释放内存
    canvas.width = 0;
    canvas.height = 0;
}
```

### 4. willReadFrequently 优化

创建 Canvas 时声明高频读取意图：

```typescript
this.hitCtx = this.hitCanvas.getContext('2d', { willReadFrequently: true })!;
```

这会提示浏览器优化 `getImageData` 操作，避免 GPU → CPU 的频繁数据传输。

## 元素类型处理

不同类型的元素采用不同的绘制策略：

| 元素类型 | 绘制方法 | 说明 |
|----------|----------|------|
| image | `drawImage()` | 图片元素，需要着色处理 |
| mask | `drawImage()` | 蒙版元素，与图片处理相同 |
| svg | `drawSvg()` | SVG 元素，序列化后加载并着色 |
| path | `drawImage()` | 路径元素，shadowBlur=6 增加边缘 |
| arrow/rect/ellipse/line/brush | `drawSvg()` | 形状元素，提取内部 SVG 处理 |
| effectText | `drawImage()` | 特效文字，使用专用 clickAreaCanvas |
| threeText | `drawImage()` | 3D 文字，使用 WebGL Canvas |
| watermark | `drawImage()` | 水印元素 |
| 其他（文字等） | `drawDefault()` | 使用包围盒矩形填充 |

## 插件集成

### 事件监听

```typescript
events(editor) {
    return {
        'element.loaded'() {
            lazyUpdatePickerFast?.();
        },
        'element.rectUpdate'(element) {
            element.$editing && lazyUpdatePickerFast?.();
        },
        'templet.loaded'() {
            // 模板加载完成，立即更新
            $picker.update(layers, width, height);
        },
        'imageRenderer.renderAfter'() {
            lazyUpdatePickerFast?.();
        },
        'base.anyChange'() {
            // 任意变更都触发更新
            lazyUpdatePickerFast?.();
        },
    };
}
```

### Hook 拦截

拦截 `focusElementByPoint` 实现精确点击选中：

```typescript
hooks(editor) {
    return {
        focusElementByPoint(next, x, y, layout, needFocus) {
            // 使用 LayerPicker 进行精确检测
            const layer = $picker.pick(x, y);
            if (!layer) return null;

            let element = layer.$element;
            
            // 处理组元素嵌套
            while (element.parent && isGroupElementModel(element.parent)) {
                element = element.parent;
            }

            // 设置当前选中元素
            if (needFocus) {
                editor.currentElement = element;
                editor.currentSubElement = subElement;
            }

            return element;
        },
    };
}
```

## 局限性与注意事项

### 1. 文字元素的点击检测

```typescript
// 文字的点击穿透依然效果不是很好，因为使用了文字 bbox 进行点击穿透检测，
// 而不是实际占用区域
this.drawDefault(layer, newColor);
```

文字元素目前使用包围盒检测，无法实现字符级别的精确点击。

### 2. 动图不支持

```typescript
// 动图的场景暂不支持点击穿透
if (element.isApng || element.isGif) {
    return { type: 'default', ...layerInfo };
}
```

### 3. 性能消耗

```typescript
// todo: layer-picker 每次更新都全部重绘，是否性能消耗过高？
```

目前每次更新都会完全重绘 hitCanvas，未来可考虑增量更新优化。

### 4. 阈值设定

```typescript
// todo 阈值是否合理？4 ~= Math.sqrt(2,2,2)
if (minDistance < 4) {
    // ...
}
```

颜色距离阈值 4 是经验值，可能需要根据实际情况调整。

## 改进思路

### 1. 反复绘制的性能问题分析

当前代码通过反复绘制自身来消除半透明像素：

```typescript
// 反复绘制自身，大概 15 下可以绘制达到不透明
for (let i = 0; i < repeatDrawCount; i++) {
    ctx.drawImage(canvas, 0, 0, width, height);
}
```

**性能问题：**

| 问题 | 影响 |
|------|------|
| 多次 drawImage 调用 | 每个元素默认 15 次，N 个图像元素需要 15N 次调用 |
| Canvas 合成开销 | 每次 drawImage 都涉及 alpha 混合计算 |
| 内存带宽压力 | 反复读写同一块显存区域 |
| 无法并行 | 循环是串行执行，无法利用 GPU 并行能力 |

**时间复杂度：** O(repeatDrawCount × width × height × N)

### 2. 优化方案：ImageData 直接像素操作

直接操作像素数据，将所有非透明像素的 alpha 值设为 255：

```typescript
function solidifyAlpha(
    image: HTMLCanvasElement | HTMLImageElement,
    options: { color: string; width: number; height: number }
): { canvas: HTMLCanvasElement; cleanCanvas: () => void } {
    const { width, height, color } = options;
    const canvas = createCanvas(width, height, true);
    const ctx = canvas.getContext('2d')!;

    // 1. 绘制原始图像
    ctx.drawImage(image, 0, 0, width, height);

    // 2. 获取像素数据
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;

    // 3. 遍历像素，将非零 alpha 设为 255
    for (let i = 3; i < data.length; i += 4) {
        if (data[i] > 0) {
            data[i] = 255;  // alpha 通道
        }
    }

    // 4. 写回像素数据
    ctx.putImageData(imageData, 0, 0);

    // 5. 使用 source-in 着色
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, width, height);

    return { canvas, cleanCanvas: () => { canvas.width = 0; canvas.height = 0; } };
}
```

**优势：**
- 只需一次 `drawImage`、一次 `getImageData`、一次 `putImageData`
- 时间复杂度降为 O(width × height)
- 消除循环开销

**劣势：**
- `getImageData`/`putImageData` 在大图像上可能有 GPU→CPU→GPU 的传输开销
- 需要配合 `willReadFrequently: true` 优化

### 3. 优化方案：WebGL Shader 处理

使用 WebGL fragment shader 在 GPU 上并行处理所有像素：

```glsl
// Fragment Shader
precision mediump float;
uniform sampler2D u_image;
uniform vec3 u_color;
varying vec2 v_texCoord;

void main() {
    vec4 texColor = texture2D(u_image, v_texCoord);
    // 如果 alpha > 0，则设为完全不透明并着色
    if (texColor.a > 0.0) {
        gl_FragColor = vec4(u_color, 1.0);
    } else {
        gl_FragColor = vec4(0.0);
    }
}
```

```typescript
class WebGLColorizer {
    private gl: WebGLRenderingContext;
    private program: WebGLProgram;

    colorize(image: TexImageSource, color: string, width: number, height: number): HTMLCanvasElement {
        const { gl, program } = this;
        
        // 1. 上传纹理
        const texture = this.createTexture(image);
        
        // 2. 设置颜色 uniform
        const { r, g, b } = tinycolor(color).toRgb();
        gl.uniform3f(gl.getUniformLocation(program, 'u_color'), r/255, g/255, b/255);
        
        // 3. 渲染
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        
        return gl.canvas as HTMLCanvasElement;
    }
}
```

**优势：**
- GPU 并行处理，性能最优
- 无 CPU-GPU 数据传输（除初始纹理上传）
- 可复用 WebGL 上下文

**劣势：**
- 实现复杂度高
- WebGL 上下文创建有开销，需要复用
- 部分老旧设备兼容性问题

### 4. 优化方案：OffscreenCanvas + Worker

将处理移到 Worker 线程，避免阻塞主线程：

```typescript
// main.ts
const worker = new Worker('colorize-worker.js');
const offscreen = canvas.transferControlToOffscreen();

worker.postMessage({ 
    canvas: offscreen, 
    imageBitmap: await createImageBitmap(image),
    color,
    width,
    height 
}, [offscreen, imageBitmap]);

// colorize-worker.js
self.onmessage = async ({ data }) => {
    const { canvas, imageBitmap, color, width, height } = data;
    const ctx = canvas.getContext('2d');
    
    ctx.drawImage(imageBitmap, 0, 0, width, height);
    const imageData = ctx.getImageData(0, 0, width, height);
    
    // 像素处理...
    for (let i = 3; i < imageData.data.length; i += 4) {
        if (imageData.data[i] > 0) imageData.data[i] = 255;
    }
    
    ctx.putImageData(imageData, 0, 0);
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, width, height);
    
    self.postMessage({ done: true });
};
```

**优势：**
- 不阻塞主线程，UI 保持响应
- 可并行处理多个图像

**劣势：**
- Worker 通信有序列化开销
- 架构复杂度增加
- OffscreenCanvas 兼容性（Safari 较晚支持）

### 5. 优化方案：混合模式组合

利用 Canvas 混合模式的组合效果，减少绘制次数：

```typescript
function colorImageOptimized(image: TexImageSource, color: string, width: number, height: number) {
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d')!;

    // 1. 绘制原始图像
    ctx.drawImage(image, 0, 0, width, height);
    
    // 2. 使用 copy 模式叠加自身 4 次（相当于 alpha^16 → 接近 1）
    ctx.globalCompositeOperation = 'copy';
    for (let i = 0; i < 4; i++) {  // 2^4 = 16 次效果
        ctx.drawImage(canvas, 0, 0);
    }
    
    // 3. 着色
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, width, height);

    return canvas;
}
```

> 注意：`copy` 模式并不能达到叠加效果，此方案需要进一步验证可行性。

### 6. 优化方案：增量更新

避免每次都重绘所有图层：

```typescript
class IncrementalLayerPicker {
    private layerCache = new Map<string, { color: string; canvas: HTMLCanvasElement }>();
    
    async update(layers: Layer[], changedIds: Set<string>) {
        for (const layer of layers) {
            const id = layer.$element.$id;
            
            if (changedIds.has(id) || !this.layerCache.has(id)) {
                // 只处理变更的图层
                const color = getNewColor(this.colorMap);
                const coloredCanvas = await this.colorizeLayer(layer, color);
                this.layerCache.set(id, { color, canvas: coloredCanvas });
            }
            
            // 复用缓存的着色结果
            const cached = this.layerCache.get(id)!;
            this.hitCtx.drawImage(cached.canvas, layer.x, layer.y);
        }
    }
}
```

**优势：**
- 大幅减少重复计算
- 只有变更元素需要重新着色

**劣势：**
- 需要精确追踪变更
- 缓存管理复杂度
- 内存占用增加

### 7. 方案对比与建议

| 方案 | 性能提升 | 实现复杂度 | 兼容性 | 推荐场景 |
|------|----------|------------|--------|----------|
| ImageData 像素操作 | ★★★☆☆ | 低 | 好 | **首选方案**，简单有效 |
| WebGL Shader | ★★★★★ | 高 | 中 | 图像数量多、追求极致性能 |
| OffscreenCanvas + Worker | ★★★★☆ | 中 | 中 | 主线程压力大、需保持 UI 流畅 |
| 混合模式组合 | ★★☆☆☆ | 低 | 好 | 需验证可行性 |
| 增量更新 | ★★★★☆ | 中 | 好 | 频繁小范围更新场景 |

**推荐实施路径：**

1. **短期**：将反复绘制替换为 ImageData 像素操作，预计可减少 70%+ 的处理时间
2. **中期**：实现增量更新机制，避免全量重绘
3. **长期**：考虑 WebGL 方案，实现统一的 GPU 加速着色器

### 8. 边缘扩展的替代方案

当前使用 `shadowBlur` 扩展边缘：

```typescript
ctx.shadowColor = 'black';
ctx.shadowBlur = shadowBlur;
ctx.drawImage(image, ...);
```

替代方案 - 使用形态学膨胀：

```typescript
function dilateAlpha(imageData: ImageData, radius: number): ImageData {
    const { width, height, data } = imageData;
    const result = new Uint8ClampedArray(data);
    
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = (y * width + x) * 4 + 3;
            if (data[idx] > 0) continue;
            
            // 检查周围像素
            for (let dy = -radius; dy <= radius; dy++) {
                for (let dx = -radius; dx <= radius; dx++) {
                    const nx = x + dx, ny = y + dy;
                    if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
                    const nidx = (ny * width + nx) * 4 + 3;
                    if (data[nidx] > 0) {
                        result[idx] = 255;
                        break;
                    }
                }
                if (result[idx] > 0) break;
            }
        }
    }
    
    return new ImageData(result, width, height);
}
```

这种方式可以更精确地控制边缘扩展范围，但计算量较大，建议配合 WebGL 实现。

## 总结

Layer Picker 通过 Color Picking 技术实现了精确的碰撞检测：

1. **唯一颜色标识**：每个元素分配唯一颜色 ID
2. **离屏渲染**：在 hitCanvas 上绘制颜色填充的元素轮廓
3. **像素采样**：点击时读取像素颜色，反向查找元素
4. **图像着色**：通过反复绘制和 source-in 混合模式消除透明度
5. **模糊匹配**：使用颜色距离容差处理精度损失

这种方案在保证检测精度的同时，通过缩放、防抖等策略优化了性能，是处理复杂图形元素碰撞检测的有效解决方案。
