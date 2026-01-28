# PixiJS 开源项目及替代方案

---

## 1. PixiJS 是开源项目吗？

**是的！PixiJS 是完全开源的项目。**

### 1.1 基本信息

- **GitHub 仓库**: https://github.com/pixijs/pixijs
- **开源协议**: MIT License
- **Star 数**: 46.5k ⭐
- **Fork 数**: 4.9k
- **主要语言**: TypeScript
- **最新版本**: v8.15.0 (2026年1月5日发布)
- **官方描述**: "The HTML5 Creation Engine" - 用于创建丰富交互式图形的 2D WebGL/WebGPU 渲染器

### 1.2 项目活跃度

- ✅ 持续活跃维护（截至 2026年1月）
- ✅ 定期发布新版本
- ✅ 活跃的社区支持
- ✅ 完善的文档和示例

### 1.3 PixiJS 生态系统

PixiJS 组织在 GitHub 上维护了 **40+ 个相关仓库**，构建了完整的生态系统：

| 仓库 | 说明 | 用途 |
|------|------|------|
| **pixijs/pixijs** | 核心渲染引擎 | 2D WebGL/WebGPU 渲染 |
| **pixijs/pixi-react** | React 集成 | 在 React 中使用 PixiJS |
| **pixijs/filters** | 自定义滤镜库 | 各种视觉效果滤镜 |
| **pixijs/ui** | UI 组件库 | 按钮、滑块等 UI 组件 |
| **pixijs/assetpack** | 资源管道工具 | 资源优化和打包 |
| **pixijs/layout** | 布局库 | 基于 Yoga 的布局系统 |
| **pixijs/sound** | 音频库 | WebAudio 音频播放 |
| **pixijs/spine** | Spine 动画支持 | 骨骼动画集成 |
| **pixijs/particle-emitter** | 粒子发射器 | 粒子系统 |

---

## 2. GitHub 上类似的开源项目

### 2.1 项目概览表

| 项目 | Star | 协议 | 技术栈 | 包体积 | 适用场景 |
|------|------|------|--------|--------|----------|
| **PixiJS** | 46.5k | MIT | WebGL/WebGPU | 500KB | 高性能 2D 渲染 |
| **Phaser** | 37k | MIT | WebGL (基于 PixiJS) | 1.2MB | 2D 游戏开发 |
| **Fabric.js** | 29k | MIT | Canvas 2D | 150KB | 图形编辑器 |
| **Konva** | 14k | MIT | Canvas 2D | 200KB | 交互式 2D 应用 |
| **Paper.js** | 14k | MIT | Canvas 2D | 200KB | 矢量图形 |
| **Two.js** | 8.3k | MIT | SVG/Canvas/WebGL | 100KB | 多渲染器支持 |
| **EaselJS** | 8.1k | MIT | Canvas 2D | 150KB | Flash 迁移 |
| **ZRender** | 6k | BSD-3 | Canvas/SVG | 300KB | 数据可视化 |
| **Stage.js** | 2.5k | MIT | Canvas 2D | 50KB | 轻量级游戏 |
| **Mesh.js** | 1.2k | MIT | Canvas/WebGL | 200KB | 高性能 2D |

---

## 3. 详细项目对比

### 3.1 Phaser - 完整的 2D 游戏框架

```
仓库: https://github.com/phaserjs/phaser
Star: 37k ⭐
协议: MIT License
官网: https://phaser.io
```

**核心特性**：

```javascript
// Phaser 示例代码
const config = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    physics: {
        default: 'arcade',  // 内置物理引擎
        arcade: {
            gravity: { y: 300 },
            debug: false
        }
    },
    scene: {
        preload: preload,
        create: create,
        update: update
    }
};

const game = new Phaser.Game(config);
```

**与 PixiJS 的关系**：
- Phaser 3 底层使用 PixiJS 作为渲染引擎
- Phaser = PixiJS + 游戏框架（物理、音频、场景管理、输入系统）

**优势**：
- ✅ 开箱即用的游戏开发功能
- ✅ 内置物理引擎（Arcade、Matter.js）
- ✅ 完整的音频系统
- ✅ 场景管理
- ✅ 瓦片地图支持
- ✅ 丰富的插件生态

**劣势**：
- ❌ 包体积较大（1.2MB）
- ❌ 灵活性不如 PixiJS
- ❌ 非游戏场景下可能过重

**适用场景**：
```
✅ 2D 游戏开发
  ├── 平台跳跃游戏
  ├── 射击游戏
  ├── 益智游戏
  └── RPG 游戏

❌ 不适合
  ├── 纯可视化场景
  ├── 轻量级应用
  └── 需要完全自定义的项目
```

---

### 3.2 Konva - 交互式 Canvas 框架

```
仓库: https://github.com/konvajs/konva
Star: 14k ⭐
协议: MIT License
官网: https://konvajs.org
```

**核心特性**：

```javascript
// Konva 示例代码
const stage = new Konva.Stage({
    container: 'container',
    width: 800,
    height: 600
});

const layer = new Konva.Layer();

const circle = new Konva.Circle({
    x: 100,
    y: 100,
    radius: 70,
    fill: 'red',
    draggable: true  // 开箱即用的拖拽
});

// 事件处理非常简单
circle.on('click', () => {
    console.log('Circle clicked!');
});

layer.add(circle);
stage.add(layer);
```

**技术特点**：
- 基于 Canvas 2D API（非 WebGL）
- 分层架构（Stage → Layer → Shape）
- 强大的事件系统
- 支持序列化/反序列化

**框架集成**：
```javascript
// React 集成
import { Stage, Layer, Rect, Circle } from 'react-konva';

function App() {
    return (
        <Stage width={800} height={600}>
            <Layer>
                <Circle x={100} y={100} radius={50} fill="red" />
                <Rect x={200} y={100} width={100} height={100} fill="blue" />
            </Layer>
        </Stage>
    );
}
```

支持的框架：
- React (`react-konva`)
- Vue (`vue-konva`)
- Angular (`ng2-konva`)
- Svelte (`svelte-konva`)

**优势**：
- ✅ 事件系统强大（点击、拖拽、缩放、旋转）
- ✅ API 简洁易懂
- ✅ 框架集成完善
- ✅ 适合需要精确交互的场景

**劣势**：
- ❌ 性能不如 WebGL（Canvas 2D 限制）
- ❌ 不适合大量对象渲染
- ❌ 不支持着色器特效

**性能对比**（8k 动画矩形）：
```
PixiJS: Chrome 60 fps, Firefox 48 fps, Safari 24 fps
Konva:  Chrome 23 fps, Firefox 7 fps,  Safari 19 fps
```

**适用场景**：
```
✅ 交互式图形应用
  ├── 图形编辑器（简单版）
  ├── 流程图/思维导图
  ├── 白板应用
  └── 可视化配置工具

❌ 不适合
  ├── 高性能游戏
  ├── 大量粒子效果
  └── 复杂着色器效果
```

---

### 3.3 Fabric.js - Canvas 图形编辑库

```
仓库: https://github.com/fabricjs/fabric.js
Star: 29k ⭐
协议: MIT License
官网: http://fabricjs.com
```

**核心特性**：

```javascript
// Fabric.js 示例代码
const canvas = new fabric.Canvas('canvas');

// 添加对象
const rect = new fabric.Rect({
    left: 100,
    top: 100,
    fill: 'red',
    width: 100,
    height: 100
});

canvas.add(rect);

// 对象选择、变换
canvas.on('object:selected', (e) => {
    const obj = e.target;
    obj.set({ fill: 'blue' });
    canvas.renderAll();
});

// SVG 导入
fabric.loadSVGFromURL('path/to/svg', (objects, options) => {
    const obj = fabric.util.groupSVGElements(objects, options);
    canvas.add(obj);
});

// 序列化
const json = canvas.toJSON();
const svg = canvas.toSVG();
```

**核心功能**：
- 对象选择和变换（拖拽、缩放、旋转）
- 分组和嵌套
- SVG 导入/导出
- 自由绘图（画笔、铅笔）
- 文本编辑
- 图像滤镜
- 序列化/反序列化

**优势**：
- ✅ 专为图形编辑设计
- ✅ SVG 支持完善
- ✅ 丰富的变换功能
- ✅ 包体积小（150KB）

**劣势**：
- ❌ 性能有限（Canvas 2D）
- ❌ 不适合游戏开发
- ❌ 大量对象时性能下降

**适用场景**：
```
✅ 图形编辑器
  ├── 海报设计工具
  ├── T恤设计器
  ├── Logo 编辑器
  └── 简单的在线 Photoshop

✅ 标注工具
  ├── 图片标注
  ├── PDF 标注
  └── 截图标注

❌ 不适合
  ├── 游戏开发
  ├── 高性能动画
  └── 实时数据可视化
```

---

### 3.4 Paper.js - 矢量图形脚本框架

```
仓库: https://github.com/paperjs/paper.js
Star: 14k ⭐
协议: MIT License
官网: http://paperjs.org
```

**核心特性**：

```javascript
// Paper.js 示例代码
// 创建路径
const path = new paper.Path({
    segments: [[100, 100], [200, 150], [300, 100]],
    strokeColor: 'black',
    strokeWidth: 2,
    closed: true
});

// 平滑路径
path.smooth();

// 布尔运算
const circle1 = new paper.Path.Circle(new paper.Point(100, 100), 50);
const circle2 = new paper.Path.Circle(new paper.Point(150, 100), 50);

const union = circle1.unite(circle2);        // 并集
const subtract = circle1.subtract(circle2);  // 差集
const intersect = circle1.intersect(circle2); // 交集
const exclude = circle1.exclude(circle2);    // 异或

// 贝塞尔曲线
const bezier = new paper.Path();
bezier.add(new paper.Point(100, 100));
bezier.cubicCurveTo(
    new paper.Point(150, 50),
    new paper.Point(200, 150),
    new paper.Point(250, 100)
);
```

**技术特点**：
- 基于 Scriptographer（Adobe Illustrator 脚本）
- 强大的矢量路径操作
- 精确的数学计算
- 场景图管理

**优势**：
- ✅ 矢量图形操作强大
- ✅ 布尔运算完善
- ✅ 贝塞尔曲线精确控制
- ✅ 适合创意编码

**劣势**：
- ❌ 性能不如 WebGL
- ❌ 不适合游戏
- ❌ 学习曲线较陡

**适用场景**：
```
✅ 矢量插画
  ├── 创意图形设计
  ├── 数据艺术
  └── 生成艺术

✅ 数据可视化
  ├── 复杂图表
  ├── 网络图
  └── 地图可视化

❌ 不适合
  ├── 位图处理
  ├── 游戏开发
  └── 实时性能要求高的场景
```

---

### 3.5 Two.js - 2D 渲染抽象层

```
仓库: https://github.com/jonobr1/two.js
Star: 8.3k ⭐
协议: MIT License
官网: https://two.js.org
```

**核心特性**：

```javascript
// Two.js 示例代码
// 支持多种渲染器
const two = new Two({
    type: Two.Types.webgl,  // 或 svg, canvas
    width: 800,
    height: 600
}).appendTo(document.body);

// 统一的 API
const circle = two.makeCircle(100, 100, 50);
const rect = two.makeRectangle(200, 100, 100, 100);

circle.fill = 'red';
rect.fill = 'blue';

// 可以在运行时切换渲染器
// SVG 适合矢量图形
// Canvas 适合位图
// WebGL 适合高性能

two.update();
```

**技术特点**：
- 统一的 API，支持多种渲染后端
- 自动选择最佳渲染器
- 场景图管理
- 动画系统

**支持的渲染器**：
```
├── SVG (矢量图形，无限缩放)
├── Canvas 2D (兼容性好)
└── WebGL (高性能)
```

**优势**：
- ✅ 渲染器无关的 API
- ✅ 可以根据需求切换渲染器
- ✅ 轻量级（100KB）

**劣势**：
- ❌ 功能不如专用引擎丰富
- ❌ 社区相对较小
- ❌ 高级特性有限

**适用场景**：
```
✅ 需要多渲染器支持
  ├── 矢量图形（SVG）
  ├── 性能要求高的场景（WebGL）
  └── 需要兼容性的场景（Canvas）

✅ 渐进增强
  ├── 根据设备能力选择渲染器
  └── 降级方案

❌ 不适合
  ├── 复杂游戏
  ├── 需要高级特性的场景
  └── 需要完整生态的项目
```

---

### 3.6 ZRender - ECharts 渲染引擎

```
仓库: https://github.com/ecomfe/zrender
Star: 6k ⭐
协议: BSD-3-Clause
官网: https://ecomfe.github.io/zrender-doc/public/
```

**核心特性**：

```javascript
// ZRender 示例代码
import * as zrender from 'zrender';

const zr = zrender.init(document.getElementById('main'));

// 添加图形
const circle = new zrender.Circle({
    shape: {
        cx: 150,
        cy: 150,
        r: 50
    },
    style: {
        fill: 'red',
        stroke: 'blue'
    }
});

zr.add(circle);

// 动画
circle.animateTo({
    shape: { r: 100 }
}, {
    duration: 1000,
    easing: 'cubicOut'
});
```

**技术特点**：
- ECharts 的底层渲染引擎
- 支持 Canvas 和 SVG
- 事件系统完善
- 分层渲染

**优势**：
- ✅ 专为数据可视化设计
- ✅ ECharts 验证的稳定性
- ✅ 中文文档完善
- ✅ 国内社区活跃

**劣势**：
- ❌ 国际社区较小
- ❌ 不适合游戏开发
- ❌ 专注可视化，通用性有限

**适用场景**：
```
✅ 数据可视化
  ├── 图表库开发
  ├── 自定义可视化
  └── 实时数据展示

✅ 需要中文支持的项目

❌ 不适合
  ├── 游戏开发
  ├── 通用 2D 渲染
  └── 国际化项目
```

---

### 3.7 EaselJS - CreateJS 套件

```
仓库: https://github.com/CreateJS/EaselJS
Star: 8.1k ⭐
协议: MIT License
官网: https://createjs.com/easeljs
```

**核心特性**：

```javascript
// EaselJS 示例代码（类似 Flash API）
const stage = new createjs.Stage("canvas");

// 显示对象
const circle = new createjs.Shape();
circle.graphics.beginFill("red").drawCircle(0, 0, 50);
circle.x = 100;
circle.y = 100;

stage.addChild(circle);

// 补间动画
createjs.Tween.get(circle)
    .to({ x: 300 }, 1000, createjs.Ease.getPowInOut(2));

// Tick 循环
createjs.Ticker.addEventListener("tick", stage);
```

**技术特点**：
- API 设计类似 Adobe Flash
- 专为 Flash 开发者设计
- 显示列表模型
- 补间动画系统

**CreateJS 套件**：
```
├── EaselJS (Canvas 渲染)
├── TweenJS (动画)
├── SoundJS (音频)
└── PreloadJS (资源加载)
```

**优势**：
- ✅ Flash 迁移友好
- ✅ API 熟悉（Flash 开发者）
- ✅ 完整的多媒体套件

**劣势**：
- ❌ 维护不如 PixiJS 活跃
- ❌ 性能一般
- ❌ Flash 已过时，新项目不推荐

**适用场景**：
```
✅ Flash 项目迁移
  ├── AS3 项目转 HTML5
  └── Flash 动画转换

❌ 不适合
  ├── 新项目（推荐 PixiJS）
  ├── 高性能需求
  └── 现代化开发
```

---

### 3.8 Mesh.js - 字节跳动高性能引擎

```
仓库: https://github.com/mesh-js/mesh.js
Star: 1.2k ⭐
协议: MIT License
官网: https://meshjs.webgl.group
```

**核心特性**：

```javascript
// Mesh.js 示例代码
import { Scene, Layer, Sprite } from '@mesh.js/core';

const scene = new Scene({
    container: '#container',
    width: 800,
    height: 600
});

const layer = new Layer();
scene.appendChild(layer);

const sprite = new Sprite({
    texture: 'path/to/image.png',
    x: 100,
    y: 100
});

layer.appendChild(sprite);
```

**技术特点**：
- 支持多渲染后端（Canvas2D、WebGL）
- 高性能渲染
- 轻量级设计
- 现代化 API

**优势**：
- ✅ 字节跳动团队维护
- ✅ 性能优化良好
- ✅ 现代化设计

**劣势**：
- ❌ 社区较小
- ❌ 生态不如 PixiJS
- ❌ 文档相对较少

**适用场景**：
```
✅ 高性能 2D 渲染
  ├── H5 游戏
  ├── 互动广告
  └── 数据可视化

❌ 不适合
  ├── 需要完整生态的项目
  └── 需要丰富文档的场景
```

---

### 3.9 Stage.js - 轻量级游戏引擎

```
仓库: https://github.com/shakiba/stage.js
Star: 2.5k ⭐
协议: MIT License
官网: https://piqnt.com/stage.js
```

**核心特性**：

```javascript
// Stage.js 示例代码
Stage(function(stage) {
    // 创建精灵
    const sprite = Stage.image('image').pin('center');
    stage.append(sprite);

    // 纹理图集
    Stage.atlas({
        name: 'game',
        url: 'spritesheet.png',
        textures: {
            player: { x: 0, y: 0, width: 64, height: 64 }
        }
    });

    // 动画
    sprite.tween(500).pin({ x: 200 }).then(function() {
        console.log('Animation complete');
    });
});
```

**技术特点**：
- 轻量级（50KB）
- 纹理图集支持
- 简单的动画系统
- 模块化设计

**优势**：
- ✅ 包体积极小
- ✅ API 简洁
- ✅ 适合小游戏

**劣势**：
- ❌ 功能有限
- ❌ 社区较小
- ❌ 文档较少

**适用场景**：
```
✅ 轻量级游戏
  ├── H5 小游戏
  ├── 简单互动
  └── 包体积敏感的项目

❌ 不适合
  ├── 复杂游戏
  ├── 需要高级特性
  └── 需要完整生态
```

---

## 4. 性能对比

### 4.1 基准测试（8k 动画矩形）

来源：https://github.com/slaylines/canvas-engines-comparison

| 引擎 | Chrome (fps) | Firefox (fps) | Safari (fps) | 技术栈 |
|------|--------------|---------------|--------------|--------|
| **PixiJS** | 60 | 48 | 24 | WebGL |
| **Phaser 3** | ~50 | ~40 | ~20 | WebGL (PixiJS) |
| **Konva** | 23 | 7 | 19 | Canvas 2D |
| **Fabric.js** | ~20 | ~10 | ~15 | Canvas 2D |
| **Paper.js** | ~18 | ~12 | ~14 | Canvas 2D |
| **Two.js (WebGL)** | ~55 | ~45 | ~22 | WebGL |
| **Two.js (Canvas)** | ~20 | ~10 | ~15 | Canvas 2D |
| **ZRender** | ~22 | ~12 | ~16 | Canvas 2D |

### 4.2 性能结论

```
高性能（WebGL）
  ├── PixiJS        ⭐⭐⭐⭐⭐  (60 fps Chrome)
  ├── Phaser 3      ⭐⭐⭐⭐    (~50 fps Chrome)
  └── Two.js (WebGL) ⭐⭐⭐⭐   (~55 fps Chrome)

中等性能（Canvas 2D）
  ├── Konva         ⭐⭐⭐      (23 fps Chrome)
  ├── ZRender       ⭐⭐⭐      (~22 fps Chrome)
  ├── Fabric.js     ⭐⭐       (~20 fps Chrome)
  └── Paper.js      ⭐⭐       (~18 fps Chrome)
```

**关键发现**：
- WebGL 引擎性能显著优于 Canvas 2D（~3倍）
- PixiJS 是最快的 2D 渲染引擎
- Canvas 2D 引擎在 Firefox 上性能损失严重

---

## 5. 综合对比矩阵

### 5.1 特性对比

| 特性 | PixiJS | Phaser | Konva | Fabric.js | Paper.js | Two.js |
|------|--------|--------|-------|-----------|----------|--------|
| **WebGL 渲染** | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ |
| **Canvas 2D** | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| **SVG 渲染** | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ |
| **着色器支持** | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **滤镜/后处理** | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ |
| **粒子系统** | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **物理引擎** | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **音频系统** | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **矢量操作** | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| **事件系统** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **动画系统** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **React 集成** | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| **TypeScript** | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |

### 5.2 评分对比（满分 5 星）

| 维度 | PixiJS | Phaser | Konva | Fabric.js | Paper.js | Two.js |
|------|--------|--------|-------|-----------|----------|--------|
| **性能** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐ |
| **易用性** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ |
| **功能丰富度** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ |
| **生态系统** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ |
| **文档质量** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ |
| **社区活跃度** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ |
| **包体积** | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **学习曲线** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ |

---

## 6. 选择建议决策树

```
你的项目需求是什么？
├── 高性能 2D 渲染 + 灵活性
│   └── ✅ PixiJS
│       ├── 优势：最快、最灵活、生态最好
│       └── 适用：可视化、H5 互动、轻量游戏
│
├── 完整的游戏开发
│   └── ✅ Phaser
│       ├── 优势：开箱即用、物理引擎、场景管理
│       └── 适用：2D 游戏（平台、射击、RPG）
│
├── 图形编辑器/设计工具
│   ├── ✅ Fabric.js（推荐）
│   │   ├── 优势：SVG 支持、变换功能强
│   │   └── 适用：海报设计、Logo 编辑
│   │
│   └── ✅ Konva（备选）
│       ├── 优势：事件系统强、框架集成好
│       └── 适用：流程图、白板、标注工具
│
├── 矢量图形/创意编码
│   └── ✅ Paper.js
│       ├── 优势：矢量操作强、布尔运算
│       └── 适用：插画、数据艺术、生成艺术
│
├── 数据可视化
│   ├── ✅ PixiJS（高性能需求）
│   ├── ✅ ZRender（国内项目）
│   └── ✅ Paper.js（矢量图表）
│
├── 需要多渲染器支持
│   └── ✅ Two.js
│       ├── 优势：SVG/Canvas/WebGL 统一 API
│       └── 适用：需要渐进增强的场景
│
├── 轻量级需求（包体积敏感）
│   ├── ✅ Stage.js（最轻 50KB）
│   ├── ✅ Two.js（轻量 100KB）
│   └── ✅ Fabric.js（轻量 150KB）
│
└── Flash 项目迁移
    └── ✅ EaselJS
        ├── 优势：API 类似 Flash
        └── 注意：不推荐新项目使用
```

---

## 7. 实战选型指南

### 7.1 按场景选择

#### 场景 1：在线设计工具（类 Canva/Figma）

```
推荐方案：Fabric.js + PixiJS 混合

Fabric.js：
  ├── 处理矢量图形编辑
  ├── 对象选择和变换
  └── SVG 导入/导出

PixiJS：
  ├── 处理位图渲染
  ├── 滤镜效果
  └── 高性能预览

理由：
  - Fabric.js 专为图形编辑设计
  - PixiJS 提供高性能位图渲染
  - 两者可以共存，各司其职
```

#### 场景 2：数据可视化平台

```
推荐方案：PixiJS

理由：
  ✅ 高性能（适合大量数据点）
  ✅ WebGL 加速
  ✅ 自定义着色器（高级视觉效果）
  ✅ 良好的事件系统
  ✅ 成熟的生态

备选：ZRender（如果是国内项目）
```

#### 场景 3：H5 小游戏

```
推荐方案：

简单游戏 → PixiJS
  ├── 休闲游戏
  ├── 卡牌游戏
  └── 简单物理

复杂游戏 → Phaser
  ├── 平台跳跃
  ├── 射击游戏
  └── 需要物理引擎

理由：
  - PixiJS 更轻量、灵活
  - Phaser 功能完整、开发快
```

#### 场景 4：白板/流程图/思维导图

```
推荐方案：Konva

理由：
  ✅ 事件系统强大
  ✅ 拖拽、连线操作简单
  ✅ React/Vue 集成完善
  ✅ API 简洁易懂
  ✅ 序列化/反序列化方便

备选：Fabric.js（需要更多编辑功能）
```

#### 场景 5：H5 互动广告

```
推荐方案：PixiJS

理由：
  ✅ 高性能（流畅动画）
  ✅ 包体积可控（500KB）
  ✅ 滤镜/特效丰富
  ✅ 加载速度快
```

#### 场景 6：创意编码/艺术项目

```
推荐方案：Paper.js

理由：
  ✅ 矢量操作强大
  ✅ 布尔运算
  ✅ 精确的贝塞尔控制
  ✅ 适合实验性项目

备选：Two.js（需要多渲染器）
```

---

### 7.2 按技术栈选择

#### 技术栈：React

```
推荐：
├── 1. PixiJS + @pixi/react
├── 2. Konva + react-konva
└── 3. Fabric.js（手动集成）

示例：
// PixiJS + React
import { Stage, Container, Sprite } from '@pixi/react';

function App() {
    return (
        <Stage width={800} height={600}>
            <Container>
                <Sprite image="path/to/image.png" x={100} y={100} />
            </Container>
        </Stage>
    );
}

// Konva + React
import { Stage, Layer, Rect, Circle } from 'react-konva';

function App() {
    return (
        <Stage width={800} height={600}>
            <Layer>
                <Circle x={100} y={100} radius={50} fill="red" />
            </Layer>
        </Stage>
    );
}
```

#### 技术栈：Vue

```
推荐：
├── 1. Konva + vue-konva
├── 2. PixiJS（手动集成）
└── 3. Fabric.js（手动集成）
```

#### 技术栈：Angular

```
推荐：
├── 1. Konva + ng2-konva
└── 2. PixiJS（手动集成）
```

#### 技术栈：原生 JavaScript

```
推荐：
├── 1. PixiJS（最佳选择）
├── 2. Phaser（游戏）
├── 3. Fabric.js（编辑器）
└── 4. Konva（交互应用）
```

---

### 7.3 按性能要求选择

#### 高性能需求（60fps+）

```
推荐顺序：
1. PixiJS        ⭐⭐⭐⭐⭐
2. Phaser        ⭐⭐⭐⭐
3. Two.js (WebGL) ⭐⭐⭐⭐

关键因素：
  ✅ 必须使用 WebGL
  ✅ 避免 Canvas 2D（性能差 3 倍）
  ✅ 使用对象池
  ✅ 批量渲染
```

#### 中等性能需求（30-60fps）

```
可选：
├── Konva
├── Fabric.js
├── ZRender
└── Paper.js

注意：
  - 适合对象数量 < 1000
  - 避免频繁重绘
  - 使用分层优化
```

#### 低性能需求（<30fps）

```
任何引擎都可以
```

---

### 7.4 按包体积要求选择

#### 严格限制（< 100KB）

```
推荐：
└── Stage.js (50KB)

备选：无其他合适引擎，需要自己实现或使用原生 Canvas
```

#### 适度限制（100-200KB）

```
推荐：
├── Two.js (100KB)
├── Fabric.js (150KB)
└── Konva (200KB)
```

#### 无严格限制（> 500KB）

```
推荐：
├── PixiJS (500KB)
├── Phaser (1.2MB)
└── 任何引擎
```

---

## 8. 迁移指南

### 8.1 从 Canvas 2D 迁移到 PixiJS

```javascript
// Canvas 2D 代码
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

ctx.fillStyle = 'red';
ctx.fillRect(100, 100, 100, 100);

ctx.beginPath();
ctx.arc(300, 100, 50, 0, Math.PI * 2);
ctx.fill();

// PixiJS 等价代码
const app = new PIXI.Application({ width: 800, height: 600 });
document.body.appendChild(app.view);

const rect = new PIXI.Graphics();
rect.beginFill(0xff0000);
rect.drawRect(100, 100, 100, 100);
rect.endFill();
app.stage.addChild(rect);

const circle = new PIXI.Graphics();
circle.beginFill(0xff0000);
circle.drawCircle(300, 100, 50);
circle.endFill();
app.stage.addChild(circle);
```

**主要变化**：
- 从过程式 API 到对象式 API
- 从立即绘制到场景图管理
- 性能提升 3-5 倍

---

### 8.2 从 Konva 迁移到 PixiJS

```javascript
// Konva 代码
const stage = new Konva.Stage({ container: 'container', width: 800, height: 600 });
const layer = new Konva.Layer();
const circle = new Konva.Circle({ x: 100, y: 100, radius: 50, fill: 'red' });
layer.add(circle);
stage.add(layer);

// PixiJS 等价代码
const app = new PIXI.Application({ width: 800, height: 600 });
document.getElementById('container').appendChild(app.view);

const circle = new PIXI.Graphics();
circle.beginFill(0xff0000);
circle.drawCircle(100, 100, 50);
circle.endFill();
app.stage.addChild(circle);
```

**主要变化**：
- Layer 概念 → Container
- Shape → Graphics/Sprite
- 性能提升显著

---

### 8.3 从 Fabric.js 迁移到 PixiJS

```javascript
// Fabric.js 代码
const canvas = new fabric.Canvas('canvas');
const rect = new fabric.Rect({ left: 100, top: 100, width: 100, height: 100, fill: 'red' });
canvas.add(rect);

// PixiJS 等价代码
const app = new PIXI.Application({ width: 800, height: 600 });
document.body.appendChild(app.view);

const rect = new PIXI.Graphics();
rect.beginFill(0xff0000);
rect.drawRect(0, 0, 100, 100);
rect.endFill();
rect.x = 100;
rect.y = 100;
app.stage.addChild(rect);
```

**注意**：
- Fabric.js 的编辑功能需要自己实现
- PixiJS 专注渲染，交互需要额外处理

---

## 9. 总结与建议

### 9.1 快速决策表

| 你的需求 | 最佳选择 | 备选 |
|---------|---------|------|
| **高性能 2D 渲染** | PixiJS | Phaser, Two.js |
| **游戏开发** | Phaser | PixiJS |
| **图形编辑器** | Fabric.js | Konva |
| **白板/流程图** | Konva | Fabric.js |
| **数据可视化** | PixiJS | ZRender, Paper.js |
| **矢量图形** | Paper.js | Two.js |
| **包体积敏感** | Stage.js | Two.js |
| **React 项目** | PixiJS + @pixi/react | Konva + react-konva |
| **Flash 迁移** | EaselJS | PixiJS |

### 9.2 最终建议

#### 💎 通用推荐：PixiJS

```
选择 PixiJS 的理由：
✅ 性能最强（WebGL）
✅ 生态最好（40+ 仓库）
✅ 社区最活跃（46.5k stars）
✅ 文档最完善
✅ 持续维护（最新版本 2026年1月）
✅ 灵活性高
✅ MIT 协议

适用场景：
- 80% 的 2D 渲染需求
- 除非有特殊需求，否则首选 PixiJS
```

#### 🎮 游戏开发：Phaser

```
选择 Phaser 的理由：
✅ 完整的游戏框架
✅ 物理引擎、音频、场景管理
✅ 开箱即用
✅ 学习资源丰富

适用场景：
- 需要快速开发游戏
- 需要完整的游戏功能
- 不想从零搭建架构
```

#### ✏️ 图形编辑：Fabric.js

```
选择 Fabric.js 的理由：
✅ 专为图形编辑设计
✅ SVG 支持完善
✅ 对象变换功能强

适用场景：
- 在线设计工具
- 图片编辑器
- Logo 设计器
```

#### 🎨 矢量图形：Paper.js

```
选择 Paper.js 的理由：
✅ 矢量操作强大
✅ 布尔运算
✅ 创意编码友好

适用场景：
- 矢量插画
- 创意编码
- 数据艺术
```

---

## 10. 资源链接汇总

### 10.1 官方仓库

| 项目 | GitHub | 官网 | Star |
|------|--------|------|------|
| **PixiJS** | https://github.com/pixijs/pixijs | https://pixijs.com | 46.5k |
| **Phaser** | https://github.com/phaserjs/phaser | https://phaser.io | 37k |
| **Fabric.js** | https://github.com/fabricjs/fabric.js | http://fabricjs.com | 29k |
| **Konva** | https://github.com/konvajs/konva | https://konvajs.org | 14k |
| **Paper.js** | https://github.com/paperjs/paper.js | http://paperjs.org | 14k |
| **Two.js** | https://github.com/jonobr1/two.js | https://two.js.org | 8.3k |
| **EaselJS** | https://github.com/CreateJS/EaselJS | https://createjs.com | 8.1k |
| **ZRender** | https://github.com/ecomfe/zrender | https://ecomfe.github.io/zrender-doc | 6k |
| **Stage.js** | https://github.com/shakiba/stage.js | https://piqnt.com/stage.js | 2.5k |
| **Mesh.js** | https://github.com/mesh-js/mesh.js | https://meshjs.webgl.group | 1.2k |

### 10.2 性能对比

- Canvas Engines Comparison: https://github.com/slaylines/canvas-engines-comparison
- WebGL Frameworks List: https://gist.github.com/thysultan/3ff1757ea6b6193beed3b00a4b625a53

### 10.3 学习资源

**PixiJS**:
- 官方文档: https://pixijs.com/8.x/guides
- 示例集合: https://pixijs.com/8.x/examples
- Playground: https://pixijs.com/playground

**Phaser**:
- 官方文档: https://phaser.io/docs
- 示例集合: https://phaser.io/examples
- 教程: https://phaser.io/tutorials

**Konva**:
- 官方文档: https://konvajs.org/docs
- React 集成: https://konvajs.org/docs/react

**Fabric.js**:
- 官方文档: http://fabricjs.com/docs
- 示例: http://fabricjs.com/demos

---

## 11. 结论

### PixiJS 是开源的！

- ✅ **完全开源**（MIT 协议）
- ✅ **GitHub 地址**: https://github.com/pixijs/pixijs
- ✅ **社区活跃**（46.5k stars）
- ✅ **持续维护**（最新版本 2026年1月）

### 选择建议

```
如果你不确定选哪个，就选 PixiJS！

PixiJS 是：
  ├── 性能最强的 2D 渲染引擎
  ├── 生态最完善的开源项目
  ├── 社区最活跃的 Canvas 库
  └── 80% 场景的最佳选择

除非你有特殊需求：
  ├── 需要完整游戏框架 → Phaser
  ├── 需要图形编辑功能 → Fabric.js
  ├── 需要事件系统强大 → Konva
  └── 需要矢量图形操作 → Paper.js
```

**最终建议**：从 PixiJS 开始，遇到瓶颈再考虑其他引擎！
