# 纹理（Texture）概念详解

> 从本质到实践，深入理解计算机图形学中的纹理

## 目录

1. [纹理的本质](#1-纹理的本质)
2. [纹理与普通图片的区别](#2-纹理与普通图片的区别)
3. [纹理在 GPU 中的表现](#3-纹理在-gpu-中的表现)
4. [PixiJS 中的纹理体系](#4-pixijs-中的纹理体系)
5. [纹理的生命周期](#5-纹理的生命周期)
6. [实战案例](#6-实战案例)

---

## 1. 纹理的本质

### 1.1 简单理解

**纹理就是贴在 3D 物体或 2D 精灵上的"皮肤"。**

想象你在玩游戏：
- 一个立方体 = 几何形状（顶点、边、面）
- 立方体上的木纹、金属质感 = 纹理
- 将纹理"贴"到立方体上 = 纹理映射

在 2D 图形中：
- 一个矩形精灵 = 几何形状（4 个顶点）
- 矩形上显示的图片 = 纹理

### 1.2 计算机图形学定义

```
纹理（Texture）是一个 2D 图像数据，用于：
1. 存储在 GPU 显存中
2. 在渲染时映射到几何图形表面
3. 通过采样（Sampling）获取像素颜色
```

### 1.3 形象比喻

| 现实世界 | 计算机图形 |
|---------|----------|
| 墙壁 | 矩形几何体 |
| 壁纸 | 纹理图像 |
| 贴壁纸 | 纹理映射 |
| 壁纸花纹 | 纹理像素（Texel） |

---

## 2. 纹理与普通图片的区别

### 2.1 概念对比

```
┌─────────────────────────────────────────────────────┐
│              图片文件（磁盘/网络）                      │
│         formats: .jpg, .png, .webp, .svg            │
│              存储在：文件系统/网络                      │
└─────────────────────────────────────────────────────┘
                         ↓ 加载
                    解码 + 解压
                         ↓
┌─────────────────────────────────────────────────────┐
│              Image 对象（内存）                        │
│            HTMLImageElement / Canvas                │
│              存储在：浏览器内存（RAM）                  │
└─────────────────────────────────────────────────────┘
                         ↓ 上传
                    GPU 数据传输
                         ↓
┌─────────────────────────────────────────────────────┐
│              纹理（GPU 显存）                          │
│              BaseTexture / Texture                  │
│              存储在：GPU 显存（VRAM）                  │
└─────────────────────────────────────────────────────┘
```

### 2.2 核心差异

| 特性 | 普通图片 | 纹理 |
|------|---------|------|
| **存储位置** | CPU 内存（RAM） | GPU 显存（VRAM） |
| **访问速度** | 慢（需要 CPU-GPU 传输） | 快（GPU 直接访问） |
| **用途** | 显示、编辑、存储 | 渲染到屏幕 |
| **格式** | JPEG/PNG/WebP 等压缩格式 | RGBA 原始像素数据 |
| **大小** | 压缩后较小（如 100KB） | 未压缩大（如 4MB） |
| **操作** | 可以编辑、保存 | 只能读取、采样 |

### 2.3 数据格式对比

**普通图片（PNG）**：
```
文件头：PNG 标识、元数据
图像数据：DEFLATE 压缩的像素数据
大小：100KB（压缩后）
```

**纹理（GPU）**：
```
原始像素数组：
[R, G, B, A, R, G, B, A, R, G, B, A, ...]
每个像素 4 字节（RGBA）
大小：width × height × 4 字节
例如：1024×1024 纹理 = 4MB
```

---

## 3. 纹理在 GPU 中的表现

### 3.1 内存模型

```
┌─────────────────────────────────────┐
│          GPU 显存（VRAM）             │
├─────────────────────────────────────┤
│  BaseTexture 1:                     │
│  ┌───────────────────────────────┐  │
│  │  Width: 1024                  │  │
│  │  Height: 1024                 │  │
│  │  Format: RGBA8888             │  │
│  │  Size: 4MB                    │  │
│  │  Data: [RGBA, RGBA, RGBA...] │  │
│  └───────────────────────────────┘  │
│                                     │
│  BaseTexture 2:                     │
│  ┌───────────────────────────────┐  │
│  │  Width: 512                   │  │
│  │  Height: 512                  │  │
│  │  Format: RGBA8888             │  │
│  │  Size: 1MB                    │  │
│  │  Data: [RGBA, RGBA, RGBA...] │  │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘
```

### 3.2 像素数据结构

**一个像素（Texel）**：

```typescript
// 在 GPU 中，每个像素是 4 个字节
type Pixel = {
    R: uint8;  // 红色通道 (0-255)
    G: uint8;  // 绿色通道 (0-255)
    B: uint8;  // 蓝色通道 (0-255)
    A: uint8;  // 透明度通道 (0-255)
}

// 例如：纯红色 = { R: 255, G: 0, B: 0, A: 255 }
// 在内存中表示为：[0xFF, 0x00, 0x00, 0xFF]
```

**纹理数据数组**：

```typescript
// 一个 2×2 的纹理
const textureData = new Uint8Array([
    // 像素 (0,0): 红色
    255, 0, 0, 255,
    // 像素 (1,0): 绿色
    0, 255, 0, 255,
    // 像素 (0,1): 蓝色
    0, 0, 255, 255,
    // 像素 (1,1): 白色
    255, 255, 255, 255,
]);

// 视觉表示：
// ┌─────┬─────┐
// │ 红  │ 绿  │
// ├─────┼─────┤
// │ 蓝  │ 白  │
// └─────┴─────┘
```

### 3.3 纹理坐标系统（UV 坐标）

纹理使用归一化坐标系（0.0 - 1.0）：

```
(0,0) ─────────────────── (1,0)
  │                         │
  │                         │
  │      纹理图像            │
  │                         │
  │                         │
(0,1) ─────────────────── (1,1)

UV 坐标：
- U: 横向（0.0 = 左边, 1.0 = 右边）
- V: 纵向（0.0 = 上边, 1.0 = 下边）
```

**映射示例**：

```typescript
// 将纹理映射到矩形精灵
const sprite = new Sprite(texture);

// 矩形的 4 个顶点对应纹理的 4 个角
顶点位置 (x, y)         UV 坐标 (u, v)
─────────────────────────────────────
左上角 (0, 0)        →   (0.0, 0.0)
右上角 (width, 0)    →   (1.0, 0.0)
左下角 (0, height)   →   (0.0, 1.0)
右下角 (width, height) → (1.0, 1.0)
```

---

## 4. PixiJS 中的纹理体系

### 4.1 双层结构

PixiJS 使用 **BaseTexture** 和 **Texture** 双层结构：

```typescript
┌──────────────────────────────────────────┐
│         BaseTexture（基础纹理）            │
│  - GPU 上的实际纹理资源                    │
│  - 对应一个完整的图像数据                  │
│  - 占用 GPU 显存                          │
│  - 可以被多个 Texture 共享                │
└──────────────────────────────────────────┘
                  ↑
                  │ 引用
        ┌─────────┴─────────┐
        │                   │
┌───────────────┐   ┌───────────────┐
│  Texture 1    │   │  Texture 2    │
│  - 引用 Base  │   │  - 引用 Base  │
│  - 裁剪区域A  │   │  - 裁剪区域B  │
│  - 不占显存   │   │  - 不占显存   │
└───────────────┘   └───────────────┘
```

### 4.2 BaseTexture - 基础纹理

**定义**：GPU 显存中的实际纹理数据。

```typescript
class BaseTexture {
    // 纹理资源（图片、Canvas、Video 等）
    resource: Resource;

    // 纹理尺寸
    width: number;          // 纹理宽度（像素）
    height: number;         // 纹理高度（像素）
    realWidth: number;      // 实际宽度（考虑缩放）
    realHeight: number;     // 实际高度（考虑缩放）

    // GPU 相关
    scaleMode: SCALE_MODES; // 缩放模式
    // - LINEAR: 线性插值（平滑）
    // - NEAREST: 最近邻（像素风格）

    mipmap: MIPMAP_MODES;   // Mipmap 设置
    // - POW2: 2 的幂次方尺寸
    // - ON: 开启 mipmap
    // - OFF: 关闭 mipmap

    wrapMode: WRAP_MODES;   // 环绕模式
    // - CLAMP: 夹取到边缘
    // - REPEAT: 重复平铺
    // - MIRRORED_REPEAT: 镜像重复

    // 状态
    valid: boolean;         // 是否已上传到 GPU
    resolution: number;     // 分辨率（用于高清屏）
}
```

**创建方式**：

```typescript
// 方式 1：从图片元素创建
const img = new Image();
img.src = 'avatar.jpg';
img.onload = () => {
    const baseTexture = BaseTexture.from(img);
};

// 方式 2：从 Canvas 创建
const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d')!;
ctx.fillStyle = 'red';
ctx.fillRect(0, 0, 100, 100);
const baseTexture = BaseTexture.from(canvas);

// 方式 3：从 URL 创建
const baseTexture = BaseTexture.from('https://example.com/image.jpg');
```

### 4.3 Texture - 纹理视图

**定义**：BaseTexture 的引用 + 裁剪区域。

```typescript
class Texture {
    // 引用的基础纹理
    baseTexture: BaseTexture;

    // 裁剪区域（相对于 BaseTexture）
    frame: Rectangle;
    // - x, y: 起始坐标
    // - width, height: 裁剪尺寸

    // 原始尺寸（未裁剪前）
    orig: Rectangle;

    // 修剪区域（透明区域裁剪）
    trim: Rectangle | null;

    // 旋转信息
    rotate: number;
    // - 0: 不旋转
    // - 2: 顺时针 90°
    // - 4: 顺时针 180°
    // - 6: 顺时针 270°

    // UV 坐标（计算得出）
    uvs: TextureUvs;
}
```

**精灵图（Sprite Sheet）应用**：

```typescript
// 一张大图包含多个小图
// 精灵图: 1024×1024
const baseTexture = BaseTexture.from('spritesheet.png');

// 裁剪出不同区域创建多个 Texture
const iconTexture = new Texture(
    baseTexture,
    new Rectangle(0, 0, 64, 64)      // 左上角 64×64
);

const avatarTexture = new Texture(
    baseTexture,
    new Rectangle(64, 0, 128, 128)   // 右边 128×128
);

const buttonTexture = new Texture(
    baseTexture,
    new Rectangle(0, 64, 256, 64)    // 下方 256×64
);

// 使用 Texture
const icon = new Sprite(iconTexture);
const avatar = new Sprite(avatarTexture);
const button = new Sprite(buttonTexture);

// 内存占用：
// - BaseTexture: 1024×1024×4 = 4MB（GPU 显存）
// - 3 个 Texture: 仅引用，不额外占用显存
// - 3 个 Sprite: 少量 CPU 内存（几何数据）
```

### 4.4 RenderTexture - 渲染纹理

**定义**：可以作为渲染目标的纹理（Framebuffer）。

```typescript
class RenderTexture extends Texture {
    // 可以将场景渲染到这个纹理上
    framebuffer: Framebuffer;
}
```

**用途**：

1. **离屏渲染**：渲染到纹理而非屏幕
2. **后处理特效**：滤镜、模糊、辉光等
3. **缓存复杂场景**：提升性能
4. **镜像/反射效果**

**示例**：

```typescript
// 创建 RenderTexture
const renderTexture = RenderTexture.create({
    width: 512,
    height: 512,
});

// 将容器渲染到纹理
const container = new Container();
container.addChild(sprite1, sprite2, sprite3);

renderer.render(container, {
    renderTexture: renderTexture,
});

// 使用渲染结果
const result = new Sprite(renderTexture);
stage.addChild(result);
```

---

## 5. 纹理的生命周期

### 5.1 完整生命周期

```
1. 创建阶段
   ────────────────────────────────
   new Image() / Canvas / URL
           ↓
   BaseTexture.from(source)
           ↓
   [CPU 内存] Image 对象

2. 上传阶段
   ────────────────────────────────
   首次使用时自动上传
           ↓
   WebGL: gl.texImage2D()
           ↓
   [GPU 显存] 纹理数据

3. 使用阶段
   ────────────────────────────────
   new Texture(baseTexture)
           ↓
   new Sprite(texture)
           ↓
   renderer.render(sprite)
           ↓
   GPU 采样纹理并绘制

4. 更新阶段（可选）
   ────────────────────────────────
   修改 Canvas 内容
           ↓
   texture.update()
           ↓
   WebGL: gl.texSubImage2D()
           ↓
   [GPU 显存] 更新纹理数据

5. 销毁阶段
   ────────────────────────────────
   texture.destroy()
           ↓
   baseTexture.destroy()
           ↓
   WebGL: gl.deleteTexture()
           ↓
   [GPU 显存] 释放
```

### 5.2 内存管理

**自动缓存机制**：

```typescript
// PixiJS 自动缓存 BaseTexture
const texture1 = Texture.from('avatar.jpg'); // 首次加载
const texture2 = Texture.from('avatar.jpg'); // 使用缓存

// texture1.baseTexture === texture2.baseTexture
// 只占用一份 GPU 显存
```

**手动销毁**：

```typescript
// 销毁 Texture（不销毁 BaseTexture）
texture.destroy(false);

// 销毁 Texture 和 BaseTexture
texture.destroy(true);

// 从缓存中移除
Texture.removeFromCache('avatar.jpg');
BaseTexture.removeFromCache('avatar.jpg');
```

### 5.3 性能考虑

**显存占用计算**：

```typescript
// 公式：显存占用 = 宽度 × 高度 × 字节数/像素

// RGBA8888 格式（最常用）
const size = width * height * 4; // 字节

// 例如：
// 512×512 = 1MB
// 1024×1024 = 4MB
// 2048×2048 = 16MB
// 4096×4096 = 64MB
```

**最佳实践**：

1. **复用 BaseTexture**：同一图片只创建一个 BaseTexture
2. **及时销毁**：不再使用的纹理要销毁
3. **使用精灵图**：多个小图合并成一张大图
4. **压缩纹理**：使用 WebP 等压缩格式
5. **按需加载**：离屏纹理可以延迟上传

---

## 6. 实战案例

### 6.1 案例 1：图片加载和显示

```typescript
// 1. 加载图片（网络请求）
const img = new Image();
img.crossOrigin = 'anonymous';
img.src = 'https://example.com/avatar.jpg';

img.onload = () => {
    // 2. 创建 BaseTexture（上传到 GPU）
    const baseTexture = BaseTexture.from(img, {
        scaleMode: SCALE_MODES.LINEAR,  // 线性插值
        mipmap: MIPMAP_MODES.ON,        // 开启 mipmap
        resolution: window.devicePixelRatio, // 高清屏适配
    });

    // 3. 创建 Texture
    const texture = new Texture(baseTexture);

    // 4. 创建 Sprite
    const sprite = new Sprite(texture);
    sprite.x = 100;
    sprite.y = 100;
    sprite.width = 200;
    sprite.height = 200;

    // 5. 添加到场景
    stage.addChild(sprite);

    // 6. 渲染
    renderer.render(stage);
};

img.onerror = (error) => {
    console.error('加载失败', error);
};
```

**流程图**：

```
网络 → Image 对象 → BaseTexture → Texture → Sprite → 渲染
       (CPU 内存)   (GPU 显存)    (引用)    (几何)   (屏幕)
```

### 6.2 案例 2：Canvas 动态纹理

```typescript
// 1. 创建 Canvas
const canvas = document.createElement('canvas');
canvas.width = 256;
canvas.height = 256;
const ctx = canvas.getContext('2d')!;

// 2. 创建 BaseTexture
const baseTexture = BaseTexture.from(canvas, {
    scaleMode: SCALE_MODES.LINEAR,
});

// 3. 创建 Texture
const texture = new Texture(baseTexture);

// 4. 创建 Sprite
const sprite = new Sprite(texture);
stage.addChild(sprite);

// 5. 动态更新纹理
function animate() {
    // 清空画布
    ctx.clearRect(0, 0, 256, 256);

    // 绘制动态内容
    const time = Date.now() * 0.001;
    ctx.fillStyle = `hsl(${time * 50 % 360}, 100%, 50%)`;
    ctx.fillRect(0, 0, 256, 256);

    ctx.fillStyle = 'white';
    ctx.font = '48px Arial';
    ctx.fillText(`${Math.floor(time)}s`, 50, 128);

    // 通知 PixiJS 更新纹理
    baseTexture.update();

    // 渲染
    renderer.render(stage);

    requestAnimationFrame(animate);
}

animate();
```

### 6.3 案例 3：精灵图（Sprite Sheet）

```typescript
// 1. 加载精灵图
const baseTexture = await BaseTexture.from('characters.png');

// 2. 定义角色帧
const frames = {
    idle: new Texture(baseTexture, new Rectangle(0, 0, 64, 64)),
    walk1: new Texture(baseTexture, new Rectangle(64, 0, 64, 64)),
    walk2: new Texture(baseTexture, new Rectangle(128, 0, 64, 64)),
    walk3: new Texture(baseTexture, new Rectangle(192, 0, 64, 64)),
    jump: new Texture(baseTexture, new Rectangle(0, 64, 64, 64)),
};

// 3. 创建角色精灵
const character = new Sprite(frames.idle);
stage.addChild(character);

// 4. 动画切换
let frameIndex = 0;
const walkFrames = [frames.walk1, frames.walk2, frames.walk3, frames.walk2];

setInterval(() => {
    character.texture = walkFrames[frameIndex % walkFrames.length];
    frameIndex++;
}, 100);

// 内存优势：
// - 1 个 BaseTexture: 256×128×4 = 128KB（GPU）
// - 5 个 Texture: 0KB（仅引用）
// vs.
// - 5 张独立图片: 64×64×4×5 = 80KB（GPU）
// 但精灵图避免了纹理切换开销，渲染更快！
```

### 6.4 案例 4：离屏渲染（RenderTexture）

```typescript
// 1. 创建复杂场景
const scene = new Container();
for (let i = 0; i < 100; i++) {
    const star = new Graphics();
    star.beginFill(0xFFFFFF);
    star.drawStar(
        Math.random() * 512,
        Math.random() * 512,
        5,
        20,
        10
    );
    star.endFill();
    scene.addChild(star);
}

// 2. 创建 RenderTexture
const renderTexture = RenderTexture.create({
    width: 512,
    height: 512,
});

// 3. 渲染场景到纹理（一次性）
renderer.render(scene, { renderTexture });

// 4. 使用渲染结果
const cachedSprite = new Sprite(renderTexture);
stage.addChild(cachedSprite);

// 性能优势：
// - 渲染 100 个图形 → 1 次批量渲染 → 缓存到纹理
// - 后续每帧只需渲染 1 个 Sprite（纹理）
// - Draw Call: 100 → 1
```

### 6.5 案例 5：纹理管理器（编辑器场景）

```typescript
class TextureManager {
    private cache = new Map<string, BaseTexture>();
    private loading = new Map<string, Promise<BaseTexture>>();

    async load(url: string): Promise<Texture> {
        // 检查缓存
        if (this.cache.has(url)) {
            return new Texture(this.cache.get(url)!);
        }

        // 检查是否正在加载
        if (this.loading.has(url)) {
            const baseTexture = await this.loading.get(url)!;
            return new Texture(baseTexture);
        }

        // 开始加载
        const promise = this.loadBaseTexture(url);
        this.loading.set(url, promise);

        try {
            const baseTexture = await promise;
            this.cache.set(url, baseTexture);
            return new Texture(baseTexture);
        } finally {
            this.loading.delete(url);
        }
    }

    private async loadBaseTexture(url: string): Promise<BaseTexture> {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';

            img.onload = () => {
                const baseTexture = BaseTexture.from(img, {
                    scaleMode: SCALE_MODES.LINEAR,
                    mipmap: MIPMAP_MODES.ON,
                });
                resolve(baseTexture);
            };

            img.onerror = reject;
            img.src = url;
        });
    }

    unload(url: string): void {
        const baseTexture = this.cache.get(url);
        if (baseTexture) {
            baseTexture.destroy();
            this.cache.delete(url);
        }
    }

    clear(): void {
        this.cache.forEach(baseTexture => baseTexture.destroy());
        this.cache.clear();
        this.loading.clear();
    }

    getStats() {
        let totalSize = 0;
        this.cache.forEach(baseTexture => {
            totalSize += baseTexture.width * baseTexture.height * 4;
        });

        return {
            count: this.cache.size,
            totalSize: totalSize,
            totalSizeMB: (totalSize / 1024 / 1024).toFixed(2),
        };
    }
}

// 使用
const textureManager = new TextureManager();

const texture1 = await textureManager.load('avatar1.jpg');
const texture2 = await textureManager.load('avatar2.jpg');
const texture3 = await textureManager.load('avatar1.jpg'); // 使用缓存

console.log(textureManager.getStats());
// { count: 2, totalSize: 8388608, totalSizeMB: "8.00" }
```

---

## 总结

### 核心要点

1. **纹理 = GPU 显存中的图像数据**
   - 存储：GPU 显存（VRAM）
   - 格式：RGBA 原始像素数组
   - 用途：渲染到屏幕

2. **BaseTexture vs Texture**
   - BaseTexture：实际 GPU 资源
   - Texture：引用 + 裁剪区域
   - 多个 Texture 可共享一个 BaseTexture

3. **纹理生命周期**
   - 创建：Image/Canvas/URL
   - 上传：自动上传到 GPU
   - 使用：Sprite 采样渲染
   - 销毁：释放 GPU 显存

4. **性能优化**
   - 复用 BaseTexture（缓存机制）
   - 使用精灵图（减少纹理切换）
   - 及时销毁（避免内存泄漏）
   - 按需加载（离屏元素延迟）

### 形象比喻总结

```
纹理就像相册里的照片：

1. 照片原件（BaseTexture）
   - 存放在相册里（GPU 显存）
   - 占用空间（显存大小）
   - 可以被多次引用

2. 照片的查看方式（Texture）
   - 完整查看 or 裁剪查看
   - 不占额外空间（仅引用）
   - 可以旋转、翻转

3. 相框（Sprite）
   - 装载照片（Texture）
   - 决定显示位置和大小
   - 可以移动、缩放

4. 墙面（屏幕）
   - 挂上相框（渲染）
   - 一次可以挂多个相框
   - 批量挂效率更高（批量渲染）
```

---

**文档版本**: v1.0
**更新日期**: 2026-01-22
**作者**: AI Assistant
