# PixiJS 着色器能力边界分析

https://github.com/pixijs/pixijs

> 为什么 PixiJS 着色器如此简单？它的能力边界是什么？

---

## 1. 为什么 PixiJS 着色器简单

### 1.1 设计哲学：易用性优先

```typescript
// PixiJS 的简化设计
const filter = new PIXI.Filter(
    null,  // 顶点着色器（使用默认）
    fragmentShader,  // 只写片段着色器
    uniforms
);

sprite.filters = [filter];
```

**简化原因**：

#### A. 自动处理顶点着色器

```glsl
// PixiJS 默认顶点着色器（你不需要写）
attribute vec2 aVertexPosition;
attribute vec2 aTextureCoord;

uniform mat3 projectionMatrix;

varying vec2 vTextureCoord;

void main() {
    vTextureCoord = aTextureCoord;
    gl_Position = vec4((projectionMatrix * vec3(aVertexPosition, 1.0)).xy, 0.0, 1.0);
}
```

**你不需要写这些**，因为 2D 场景的顶点处理基本都一样：
- 顶点位置变换（投影矩阵）
- UV 坐标传递
- 2D 投影（z=0, w=1）

#### B. 自动传递常用变量

```glsl
// 自动提供的变量（无需手动声明）
varying vec2 vTextureCoord;    // UV 坐标
uniform sampler2D uSampler;    // 主纹理
uniform vec4 inputSize;        // 输入尺寸 (width, height, 1/width, 1/height)
uniform vec4 outputFrame;      // 输出帧 (x, y, width, height)
uniform vec2 resolution;       // 分辨率 (width, height)
```

**示例**：直接在片段着色器中使用：

```glsl
void main() {
    // 直接使用，无需声明
    vec4 color = texture2D(uSampler, vTextureCoord);

    // 使用分辨率进行像素级操作
    vec2 pixelCoord = vTextureCoord * resolution;

    gl_FragColor = color;
}
```

#### C. 封装常见操作

```javascript
// PixiJS 内置滤镜库
const blur = new PIXI.filters.BlurFilter(strength, quality);
const colorMatrix = new PIXI.filters.ColorMatrixFilter();
const displacement = new PIXI.filters.DisplacementFilter(sprite);
const noise = new PIXI.filters.NoiseFilter(intensity);

// 一行代码搞定，不需要写着色器
sprite.filters = [blur];

// 内置滤镜方法
colorMatrix.brightness(1.5);
colorMatrix.contrast(1.2);
colorMatrix.saturate(0.5);
```

---

## 2. PixiJS 着色器系统架构

### 2.1 层次结构

```
用户层（最简单）
    ├── 内置滤镜（BlurFilter, ColorMatrixFilter）
    └── 无需写着色器
        ↓
中间层（适度简单）
    ├── Filter 类
    └── 只需写片段着色器
        ↓
底层（完全控制）
    ├── Shader 类
    ├── Mesh 类
    └── 可写完整着色器（顶点+片段）
        ↓
WebGL API（最复杂）
    └── 直接操作 GL 上下文
```

### 2.2 实际对比

#### **PixiJS Filter（简单）**

```javascript
const filter = new PIXI.Filter(null, `
    precision mediump float;
    varying vec2 vTextureCoord;
    uniform sampler2D uSampler;

    void main() {
        vec4 color = texture2D(uSampler, vTextureCoord);
        color.rgb = 1.0 - color.rgb; // 反相
        gl_FragColor = color;
    }
`);

sprite.filters = [filter];
```

**代码量**：~10 行

---

#### **Three.js ShaderMaterial（复杂）**

```javascript
const material = new THREE.ShaderMaterial({
    // 必须写顶点着色器
    vertexShader: `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,

    // 必须写片段着色器
    fragmentShader: `
        uniform sampler2D map;
        varying vec2 vUv;

        void main() {
            vec4 color = texture2D(map, vUv);
            color.rgb = 1.0 - color.rgb;
            gl_FragColor = color;
        }
    `,

    uniforms: {
        map: { value: texture }
    }
});

const mesh = new THREE.Mesh(geometry, material);
```

**代码量**：~25 行

---

#### **原生 WebGL（最复杂）**

```javascript
// 1. 创建着色器
const vertexShader = gl.createShader(gl.VERTEX_SHADER);
gl.shaderSource(vertexShader, vertexShaderSource);
gl.compileShader(vertexShader);

// 检查编译错误
if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
    console.error(gl.getShaderInfoLog(vertexShader));
}

const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
gl.shaderSource(fragmentShader, fragmentShaderSource);
gl.compileShader(fragmentShader);

// 2. 创建程序
const program = gl.createProgram();
gl.attachShader(program, vertexShader);
gl.attachShader(program, fragmentShader);
gl.linkProgram(program);

// 检查链接错误
if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error(gl.getProgramInfoLog(program));
}

// 3. 获取变量位置
const positionLocation = gl.getAttribLocation(program, 'position');
const uvLocation = gl.getAttribLocation(program, 'uv');
const textureLocation = gl.getUniformLocation(program, 'texture');
const mvpLocation = gl.getUniformLocation(program, 'mvpMatrix');

// 4. 创建缓冲区
const positionBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

const uvBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer);
gl.bufferData(gl.ARRAY_BUFFER, uvs, gl.STATIC_DRAW);

// 5. 设置顶点属性
gl.enableVertexAttribArray(positionLocation);
gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

gl.enableVertexAttribArray(uvLocation);
gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer);
gl.vertexAttribPointer(uvLocation, 2, gl.FLOAT, false, 0, 0);

// 6. 绑定纹理
gl.activeTexture(gl.TEXTURE0);
gl.bindTexture(gl.TEXTURE_2D, texture);
gl.uniform1i(textureLocation, 0);

// 7. 设置矩阵
gl.uniformMatrix4fv(mvpLocation, false, mvpMatrix);

// 8. 绘制
gl.useProgram(program);
gl.drawArrays(gl.TRIANGLES, 0, vertexCount);
```

**代码量**：~60+ 行

---

### 2.3 复杂度对比

| 方式 | 代码量 | 学习曲线 | 灵活性 | 适用场景 |
|------|--------|----------|--------|----------|
| **PixiJS Filter** | ⭐ (10行) | ⭐⭐⭐⭐⭐ 简单 | ⭐⭐⭐ 中等 | 2D 滤镜/后处理 |
| **Three.js ShaderMaterial** | ⭐⭐ (25行) | ⭐⭐⭐ 中等 | ⭐⭐⭐⭐ 高 | 3D 材质 |
| **原生 WebGL** | ⭐⭐⭐⭐⭐ (60+行) | ⭐ 困难 | ⭐⭐⭐⭐⭐ 最高 | 底层优化 |

---

## 3. PixiJS 的能力边界

### 3.1 ✅ PixiJS 擅长的场景

#### A. 2D 后处理滤镜

```javascript
// 示例 1：模糊滤镜
const blur = new PIXI.filters.BlurFilter(8, 4);

// 示例 2：自定义扫描线效果
const scanlineFilter = new PIXI.Filter(null, `
    precision mediump float;
    varying vec2 vTextureCoord;
    uniform sampler2D uSampler;
    uniform float time;

    void main() {
        vec4 color = texture2D(uSampler, vTextureCoord);

        // 扫描线效果
        float scanline = sin(vTextureCoord.y * 300.0 + time * 5.0);
        color.rgb *= 0.9 + scanline * 0.1;

        // 色彩偏移（CRT 效果）
        float offset = 0.002;
        color.r = texture2D(uSampler, vTextureCoord + vec2(offset, 0.0)).r;
        color.b = texture2D(uSampler, vTextureCoord - vec2(offset, 0.0)).b;

        gl_FragColor = color;
    }
`, { time: 0 });

// 动画更新
app.ticker.add(() => {
    scanlineFilter.uniforms.time += 0.016;
});
```

#### B. UV 纹理操作

```javascript
// 示例 1：波浪扭曲
const waveFilter = new PIXI.Filter(null, `
    precision mediump float;
    varying vec2 vTextureCoord;
    uniform sampler2D uSampler;
    uniform float time;

    void main() {
        vec2 uv = vTextureCoord;

        // 水平波浪
        uv.x += sin(uv.y * 10.0 + time) * 0.05;

        // 垂直波浪
        uv.y += cos(uv.x * 8.0 + time) * 0.03;

        gl_FragColor = texture2D(uSampler, uv);
    }
`, { time: 0 });

// 示例 2：放大镜效果
const magnifierFilter = new PIXI.Filter(null, `
    precision mediump float;
    varying vec2 vTextureCoord;
    uniform sampler2D uSampler;
    uniform vec2 center;
    uniform float radius;
    uniform float strength;

    void main() {
        vec2 uv = vTextureCoord;
        vec2 toCenter = uv - center;
        float dist = length(toCenter);

        if (dist < radius) {
            // 放大效果
            float magnify = 1.0 - (dist / radius) * strength;
            uv = center + toCenter * magnify;
        }

        gl_FragColor = texture2D(uSampler, uv);
    }
`, {
    center: [0.5, 0.5],
    radius: 0.3,
    strength: 0.5
});
```

#### C. 颜色处理

```javascript
// 示例 1：色调调整（HSV）
const hueFilter = new PIXI.Filter(null, `
    precision mediump float;
    varying vec2 vTextureCoord;
    uniform sampler2D uSampler;
    uniform float hueShift;
    uniform float saturation;
    uniform float brightness;

    // RGB 转 HSV
    vec3 rgb2hsv(vec3 c) {
        vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
        vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
        vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));

        float d = q.x - min(q.w, q.y);
        float e = 1.0e-10;
        return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
    }

    // HSV 转 RGB
    vec3 hsv2rgb(vec3 c) {
        vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
        vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
        return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
    }

    void main() {
        vec4 color = texture2D(uSampler, vTextureCoord);

        // 转换到 HSV
        vec3 hsv = rgb2hsv(color.rgb);

        // 调整色调、饱和度、亮度
        hsv.x = mod(hsv.x + hueShift, 1.0);
        hsv.y *= saturation;
        hsv.z *= brightness;

        // 转换回 RGB
        color.rgb = hsv2rgb(hsv);

        gl_FragColor = color;
    }
`, {
    hueShift: 0.0,
    saturation: 1.0,
    brightness: 1.0
});

// 示例 2：色彩分离（Chromatic Aberration）
const chromaticFilter = new PIXI.Filter(null, `
    precision mediump float;
    varying vec2 vTextureCoord;
    uniform sampler2D uSampler;
    uniform float amount;

    void main() {
        vec2 uv = vTextureCoord;
        vec2 direction = uv - 0.5;

        // 红色通道向外偏移
        float r = texture2D(uSampler, uv + direction * amount).r;

        // 绿色通道不偏移
        float g = texture2D(uSampler, uv).g;

        // 蓝色通道向内偏移
        float b = texture2D(uSampler, uv - direction * amount).b;

        gl_FragColor = vec4(r, g, b, 1.0);
    }
`, { amount: 0.003 });
```

#### D. 简单粒子效果（基于 Sprite）

```javascript
// 使用滤镜实现粒子效果
const particleFilter = new PIXI.Filter(null, `
    precision mediump float;
    varying vec2 vTextureCoord;
    uniform sampler2D uSampler;
    uniform float time;

    // 伪随机函数
    float random(vec2 st) {
        return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
    }

    void main() {
        vec2 uv = vTextureCoord;

        // 生成粒子
        vec3 color = vec3(0.0);
        for (int i = 0; i < 20; i++) {
            float id = float(i);
            vec2 pos = vec2(
                random(vec2(id, 0.0)),
                mod(random(vec2(id, 1.0)) + time * 0.1, 1.0)
            );

            float dist = distance(uv, pos);
            if (dist < 0.01) {
                color += vec3(1.0);
            }
        }

        vec4 tex = texture2D(uSampler, uv);
        gl_FragColor = vec4(tex.rgb + color, tex.a);
    }
`, { time: 0 });
```

---

### 3.2 ❌ PixiJS 不擅长的场景（能力边界）

#### 1. 复杂顶点操作

**问题**：PixiJS 的默认顶点着色器不可修改，难以实现需要大量顶点变形的效果。

```javascript
// ❌ PixiJS Filter：无法实现
// - 水面网格波动（需要修改大量顶点 Y 坐标）
// - 布料模拟（需要顶点物理计算）
// - 地形变形（需要顶点高度图）
// - 骨骼动画（需要顶点权重混合）

// ✅ Three.js ShaderMaterial：很容易
const material = new THREE.ShaderMaterial({
    vertexShader: `
        uniform float time;
        varying vec2 vUv;

        void main() {
            vUv = uv;
            vec3 pos = position;

            // 水面波动：修改顶点 Z 坐标
            pos.z = sin(pos.x * 2.0 + time) * 0.5 + cos(pos.y * 2.0 + time) * 0.5;

            gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
    `,
    fragmentShader: `
        uniform sampler2D waterTexture;
        varying vec2 vUv;

        void main() {
            gl_FragColor = texture2D(waterTexture, vUv);
        }
    `
});
```

**PixiJS 的解决方案**（更复杂）：

```javascript
// 必须使用底层 Mesh + Shader 类
const geometry = new PIXI.Geometry()
    .addAttribute('aVertexPosition', vertices, 2)  // 顶点位置
    .addAttribute('aUvs', uvs, 2);                 // UV 坐标

const shader = PIXI.Shader.from(
    // 自定义顶点着色器
    `
    precision mediump float;
    attribute vec2 aVertexPosition;
    attribute vec2 aUvs;

    uniform mat3 translationMatrix;
    uniform mat3 projectionMatrix;
    uniform float time;

    varying vec2 vUvs;

    void main() {
        vUvs = aUvs;

        vec2 pos = aVertexPosition;
        // 波动效果
        pos.y += sin(pos.x * 0.05 + time) * 20.0;

        gl_Position = vec4((projectionMatrix * translationMatrix * vec3(pos, 1.0)).xy, 0.0, 1.0);
    }
    `,
    // 片段着色器
    `
    precision mediump float;
    varying vec2 vUvs;
    uniform sampler2D uSampler;

    void main() {
        gl_FragColor = texture2D(uSampler, vUvs);
    }
    `,
    // Uniforms
    {
        time: 0,
        uSampler: PIXI.Texture.from('water.jpg')
    }
);

const mesh = new PIXI.Mesh(geometry, shader);

// 每帧更新
app.ticker.add(() => {
    shader.uniforms.time += 0.016;
});
```

**问题**：
- 需要手动管理顶点数据
- 需要手动编写完整的顶点着色器
- 代码复杂度大幅提升

---

#### 2. 3D 渲染

**PixiJS 是纯 2D 引擎**，没有以下概念：

```javascript
// ❌ PixiJS 不支持
// - 3D 模型（.obj, .fbx, .gltf）
// - 透视投影（Perspective Projection）
// - 深度测试（Z-Buffer）
// - 3D 光照（Lambert, Phong, PBR）
// - 法线贴图（Normal Mapping）
// - 环境反射（Environment Mapping）
// - 阴影（Shadow Mapping）

// ✅ Three.js 核心功能
// 1. 加载 3D 模型
const loader = new THREE.GLTFLoader();
loader.load('model.gltf', (gltf) => {
    scene.add(gltf.scene);
});

// 2. 透视相机
const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);

// 3. 光照
const light = new THREE.DirectionalLight(0xffffff, 1);
light.castShadow = true;

// 4. PBR 材质
const material = new THREE.MeshStandardMaterial({
    map: colorTexture,
    normalMap: normalTexture,
    roughnessMap: roughnessTexture,
    metalnessMap: metalnessTexture
});
```

**原因**：
- PixiJS 使用正交投影（Orthographic），无深度概念
- 没有 Z 坐标（只有 X, Y）
- 没有 3D 变换矩阵

---

#### 3. 多 Pass 渲染

**问题**：PixiJS 没有内置的多 Pass 渲染管线，需要手动管理。

**典型场景**：
```
场景 → Pass 1: 高亮提取 → Pass 2: 模糊 → Pass 3: 混合 → 屏幕
```

**PixiJS 实现**（手动管理）：

```javascript
// Pass 1: 渲染场景到纹理 1
const renderTexture1 = PIXI.RenderTexture.create({ width: 800, height: 600 });
renderer.render(scene, { renderTexture: renderTexture1 });

// Pass 2: 提取高亮部分到纹理 2
const brightFilter = new PIXI.Filter(null, `
    precision mediump float;
    varying vec2 vTextureCoord;
    uniform sampler2D uSampler;

    void main() {
        vec4 color = texture2D(uSampler, vTextureCoord);
        float brightness = dot(color.rgb, vec3(0.299, 0.587, 0.114));
        if (brightness > 0.8) {
            gl_FragColor = color;
        } else {
            gl_FragColor = vec4(0.0);
        }
    }
`);

const sprite1 = new PIXI.Sprite(renderTexture1);
sprite1.filters = [brightFilter];

const renderTexture2 = PIXI.RenderTexture.create({ width: 800, height: 600 });
renderer.render(sprite1, { renderTexture: renderTexture2 });

// Pass 3: 模糊到纹理 3
const blurFilter = new PIXI.filters.BlurFilter(8);
const sprite2 = new PIXI.Sprite(renderTexture2);
sprite2.filters = [blurFilter];

const renderTexture3 = PIXI.RenderTexture.create({ width: 800, height: 600 });
renderer.render(sprite2, { renderTexture: renderTexture3 });

// Pass 4: 混合到屏幕
const combineFilter = new PIXI.Filter(null, `
    precision mediump float;
    varying vec2 vTextureCoord;
    uniform sampler2D uSampler;
    uniform sampler2D blurTexture;

    void main() {
        vec4 original = texture2D(uSampler, vTextureCoord);
        vec4 bloom = texture2D(blurTexture, vTextureCoord);
        gl_FragColor = original + bloom * 0.5;
    }
`, {
    blurTexture: renderTexture3
});

const finalSprite = new PIXI.Sprite(renderTexture1);
finalSprite.filters = [combineFilter];
stage.addChild(finalSprite);
```

**比较**：Unity/Unreal 的多 Pass 自动管理：

```csharp
// Unity Shader（自动多 Pass）
SubShader {
    // Pass 1: 基础渲染
    Pass {
        CGPROGRAM
        #pragma vertex vert
        #pragma fragment frag
        // ...
        ENDCG
    }

    // Pass 2: 轮廓线
    Pass {
        Cull Front
        CGPROGRAM
        #pragma vertex vert
        #pragma fragment frag
        // ...
        ENDCG
    }
}
```

---

#### 4. 复杂材质系统

**PixiJS 无内置材质系统**：

```javascript
// ❌ PixiJS 没有
// - PBR 材质（金属度、粗糙度）
// - 法线贴图
// - 置换贴图
// - 环境反射
// - 菲涅尔效果
// - 次表面散射（SSS）

// ✅ Unity 完整材质系统
Material material = new Material(Shader.Find("Standard"));
material.SetTexture("_MainTex", albedoMap);
material.SetTexture("_BumpMap", normalMap);
material.SetTexture("_MetallicGlossMap", metallicMap);
material.SetTexture("_OcclusionMap", aoMap);
material.SetTexture("_EmissionMap", emissionMap);
material.SetFloat("_Metallic", 0.8f);
material.SetFloat("_Glossiness", 0.6f);
```

---

#### 5. 几何着色器

```javascript
// ❌ PixiJS 不支持
// WebGL 1.0 不支持几何着色器
// WebGL 2.0 支持，但 PixiJS v7 主要使用 WebGL 1.0

// ✅ Three.js (WebGL 2.0)
const material = new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3,

    vertexShader: `...`,

    // 几何着色器：从点生成四边形
    geometryShader: `
        #version 300 es
        layout(points) in;
        layout(triangle_strip, max_vertices = 4) out;

        void main() {
            vec4 pos = gl_in[0].gl_Position;

            // 生成 4 个顶点
            gl_Position = pos + vec4(-0.1, -0.1, 0.0, 0.0);
            EmitVertex();

            gl_Position = pos + vec4(0.1, -0.1, 0.0, 0.0);
            EmitVertex();

            gl_Position = pos + vec4(-0.1, 0.1, 0.0, 0.0);
            EmitVertex();

            gl_Position = pos + vec4(0.1, 0.1, 0.0, 0.0);
            EmitVertex();

            EndPrimitive();
        }
    `,

    fragmentShader: `...`
});
```

---

#### 6. 计算着色器（Compute Shader）

```javascript
// ❌ PixiJS 不支持
// Compute Shader 需要 WebGL 2.0 Compute 或 WebGPU

// ✅ WebGPU（未来）
const computePipeline = device.createComputePipeline({
    layout: 'auto',
    compute: {
        module: device.createShaderModule({
            code: `
                @group(0) @binding(0) var<storage, read_write> particles: array<Particle>;

                @compute @workgroup_size(64)
                fn main(@builtin(global_invocation_id) id: vec3<u32>) {
                    let index = id.x;

                    // GPU 并行计算粒子物理
                    particles[index].velocity.y -= 9.8 * deltaTime;
                    particles[index].position += particles[index].velocity * deltaTime;
                }
            `
        }),
        entryPoint: 'main'
    }
});
```

**用途**：
- 粒子物理模拟（百万级粒子）
- 流体模拟
- 布料模拟
- GPU 加速的通用计算

---

## 4. 能力边界总结表

| 功能类别 | PixiJS | Three.js | Unity | 说明 |
|---------|--------|----------|-------|------|
| **2D 精灵渲染** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ | PixiJS 最强 |
| **2D 滤镜/后处理** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | PixiJS 简单高效 |
| **UV 纹理操作** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | 都很强 |
| **自定义顶点着色器** | ⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | PixiJS 需要底层 API |
| **3D 渲染** | ❌ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | PixiJS 不支持 |
| **PBR 材质** | ❌ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | 需要 3D 引擎 |
| **多 Pass 渲染** | ⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | PixiJS 手动管理 |
| **几何着色器** | ❌ | ⭐⭐⭐ | ⭐⭐⭐⭐ | WebGL 1.0 限制 |
| **计算着色器** | ❌ | ❌ | ⭐⭐⭐⭐ | 需要 WebGPU/原生 |
| **粒子系统（2D）** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | PixiJS 适合简单粒子 |
| **粒子系统（3D/物理）** | ❌ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | 需要 3D 引擎 |
| **学习曲线** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ | PixiJS 最简单 |
| **包体积** | ⭐⭐⭐⭐⭐ (~500KB) | ⭐⭐⭐ (~600KB) | ⭐ (几十MB) | PixiJS 最轻量 |
| **性能（2D）** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | PixiJS 专注 2D |
| **性能（3D）** | ❌ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | Unity 最强 |

---

## 5. 适用场景

### 5.1 ✅ PixiJS 最适合

```
2D 场景
├── 2D 游戏
│   ├── 横版动作游戏
│   ├── 卡牌游戏
│   ├── 休闲益智游戏
│   └── 简单物理游戏
│
├── 数据可视化
│   ├── 实时图表
│   ├── 交互式地图
│   ├── 网络拓扑图
│   └── 粒子数据展示
│
├── H5 互动
│   ├── 互动广告
│   ├── 节日活动页
│   ├── 抽奖/游戏化营销
│   └── 品牌互动
│
├── Web UI 动效
│   ├── 复杂过渡动画
│   ├── Canvas 图形编辑器
│   ├── 富文本渲染
│   └── 图像滤镜工具
│
└── 简单粒子效果
    ├── 烟花
    ├── 雪花/雨滴
    ├── 星空
    └── 轨迹特效
```

### 5.2 ❌ PixiJS 不适合

```
复杂场景
├── 3D 游戏
│   ├── 第一人称射击
│   ├── 第三人称动作
│   ├── 3D 赛车
│   └── 开放世界
│
├── 复杂物理模拟
│   ├── 流体模拟
│   ├── 布料模拟
│   ├── 刚体碰撞
│   └── 软体物理
│
├── 需要自定义顶点动画
│   ├── 骨骼动画
│   ├── 网格变形
│   ├── 水面模拟
│   └── 地形编辑
│
├── AAA 级光照效果
│   ├── 实时全局光照
│   ├── 体积光
│   ├── 屏幕空间反射
│   └── 光线追踪
│
└── VR/AR 应用
    ├── 需要立体渲染
    ├── 需要深度感知
    └── 需要 3D 空间交互
```

---

## 6. 突破边界的方案

### 6.1 方案 1：混合使用（PixiJS + Three.js）

```javascript
// 场景 1：Three.js 渲染 3D 背景
const threeCanvas = document.createElement('canvas');
const threeRenderer = new THREE.WebGLRenderer({ canvas: threeCanvas, alpha: true });
threeRenderer.setSize(width, height);

// 渲染 3D 场景到纹理
const threeTexture = new THREE.WebGLRenderTarget(width, height);
threeRenderer.setRenderTarget(threeTexture);
threeRenderer.render(threeScene, threeCamera);
threeRenderer.setRenderTarget(null);

// PixiJS 使用这个纹理作为背景
const bgTexture = PIXI.Texture.from(threeTexture.texture);
const bgSprite = new PIXI.Sprite(bgTexture);
pixiStage.addChildAt(bgSprite, 0); // 作为背景层

// PixiJS 在上面渲染 2D UI
const uiSprite = new PIXI.Sprite(uiTexture);
pixiStage.addChild(uiSprite);

// 每帧更新
function animate() {
    // 1. Three.js 渲染 3D
    threeRenderer.setRenderTarget(threeTexture);
    threeRenderer.render(threeScene, threeCamera);
    threeRenderer.setRenderTarget(null);

    // 2. 更新 PixiJS 纹理
    bgSprite.texture.update();

    // 3. PixiJS 渲染 2D
    pixiRenderer.render(pixiStage);

    requestAnimationFrame(animate);
}
```

**优势**：
- 利用 Three.js 的 3D 能力
- 利用 PixiJS 的 2D 高效渲染
- 适合 2D + 3D 混合场景

**劣势**：
- 需要管理两个引擎
- 性能开销较大（两次渲染）

---

### 6.2 方案 2：使用底层 API（Mesh + Shader）

```javascript
// 创建自定义网格
const geometry = new PIXI.Geometry()
    .addAttribute('aVertexPosition', [
        -100, -100,  // 左上
        100, -100,   // 右上
        100, 100,    // 右下
        -100, 100    // 左下
    ], 2)
    .addAttribute('aUvs', [
        0, 0,
        1, 0,
        1, 1,
        0, 1
    ], 2)
    .addIndex([0, 1, 2, 0, 2, 3]); // 两个三角形

// 自定义着色器（完全控制）
const shader = PIXI.Shader.from(
    // 顶点着色器
    `
    precision mediump float;
    attribute vec2 aVertexPosition;
    attribute vec2 aUvs;

    uniform mat3 translationMatrix;
    uniform mat3 projectionMatrix;
    uniform float time;

    varying vec2 vUvs;

    void main() {
        vUvs = aUvs;

        vec2 pos = aVertexPosition;

        // 自定义顶点动画
        pos.y += sin(pos.x * 0.05 + time) * 20.0;

        gl_Position = vec4((projectionMatrix * translationMatrix * vec3(pos, 1.0)).xy, 0.0, 1.0);
    }
    `,
    // 片段着色器
    `
    precision mediump float;
    varying vec2 vUvs;
    uniform sampler2D uSampler;
    uniform float time;

    void main() {
        vec2 uv = vUvs;
        uv.x += sin(uv.y * 10.0 + time) * 0.05;

        gl_FragColor = texture2D(uSampler, uv);
    }
    `,
    // Uniforms
    {
        time: 0,
        uSampler: PIXI.Texture.from('texture.jpg')
    }
);

const mesh = new PIXI.Mesh(geometry, shader);
stage.addChild(mesh);

// 动画更新
app.ticker.add(() => {
    shader.uniforms.time += 0.016;
});
```

**优势**：
- 完全控制顶点和片段着色器
- 仍然使用 PixiJS 生态

**劣势**：
- 代码复杂度大幅提升
- 失去了 PixiJS 简洁性的优势

---

### 6.3 方案 3：切换到其他引擎

```
项目复杂度 → 推荐引擎
───────────────────────────────────────

轻量 2D 互动
  ├── H5 小游戏
  ├── 数据可视化
  └── 简单动画
  → PixiJS ⭐⭐⭐⭐⭐

复杂 2D 游戏
  ├── 物理引擎
  ├── 瓦片地图
  └── 粒子系统
  → Phaser ⭐⭐⭐⭐

2D + 简单 3D
  ├── 2.5D 游戏
  ├── 简单 3D 场景
  └── 3D UI
  → Three.js ⭐⭐⭐⭐

复杂 3D 游戏
  ├── FPS/TPS
  ├── 开放世界
  └── 高级光照
  → Babylon.js ⭐⭐⭐⭐

重度 3D 游戏/应用
  ├── 跨平台发布
  ├── 物理/AI
  └── 编辑器工具
  → Unity ⭐⭐⭐⭐⭐
```

**选择建议**：

1. **从 PixiJS 开始**（如果你的项目是 2D 为主）
   - 快速开发
   - 性能优秀
   - 包体小

2. **发现能力不足时再迁移**
   - 需要 3D → 迁移到 Three.js
   - 需要复杂物理 → 迁移到 Phaser
   - 需要跨平台 → 迁移到 Unity

3. **避免过度设计**
   - 不要一开始就选择最强大的引擎
   - 根据实际需求选择合适的工具

---

## 7. 实战建议

### 7.1 充分利用 PixiJS 的优势

```javascript
// ✅ 好的做法：使用内置滤镜
const blur = new PIXI.filters.BlurFilter();
const colorMatrix = new PIXI.filters.ColorMatrixFilter();
sprite.filters = [blur, colorMatrix];

// ❌ 不好的做法：自己实现模糊（重复造轮子）
const customBlur = new PIXI.Filter(null, `
    // ... 手动实现高斯模糊（复杂且慢）
`);
```

### 7.2 合理使用 RenderTexture

```javascript
// ✅ 静态内容缓存到 RenderTexture
const renderTexture = PIXI.RenderTexture.create({ width: 800, height: 600 });
renderer.render(complexScene, { renderTexture });

const cachedSprite = new PIXI.Sprite(renderTexture);
stage.addChild(cachedSprite);

// 减少每帧渲染开销
```

### 7.3 避免不必要的着色器

```javascript
// ❌ 过度使用着色器
sprite.filters = [filter1, filter2, filter3, filter4]; // 性能开销大

// ✅ 合并着色器
const combinedFilter = new PIXI.Filter(null, `
    // 在一个着色器中完成所有操作
`);
sprite.filters = [combinedFilter];
```

### 7.4 性能优化

```javascript
// 1. 使用 Sprite Sheet
const texture = PIXI.Texture.from('spritesheet.png');
const sprite1 = new PIXI.Sprite(new PIXI.Texture(texture.baseTexture, new PIXI.Rectangle(0, 0, 64, 64)));

// 2. 对象池
const pool = [];
function getSprite() {
    return pool.pop() || new PIXI.Sprite();
}
function releaseSprite(sprite) {
    pool.push(sprite);
}

// 3. 批量绘制
const container = new PIXI.ParticleContainer(10000, { position: true });
// ParticleContainer 专为大量精灵优化
```

---

## 8. 总结

### 8.1 PixiJS 简单的原因

1. **自动化默认流程**
   - 顶点着色器自动处理
   - 常用变量自动传递

2. **封装常见操作**
   - 内置滤镜库
   - 简化 API

3. **聚焦 2D 场景**
   - 不做 3D（减少复杂度）
   - 专注做好 2D

4. **牺牲灵活性换易用性**
   - Filter 只需写片段着色器
   - 隐藏底层细节

### 8.2 能力边界

```
强项（⭐⭐⭐⭐⭐）
  ├── 2D 精灵渲染
  ├── 2D 滤镜/后处理
  ├── UV 纹理操作
  ├── 颜色处理
  └── 学习成本低

中项（⭐⭐）
  ├── 自定义顶点着色器（需要底层 API）
  └── 多 Pass 渲染（需要手动管理）

弱项（❌）
  ├── 3D 渲染
  ├── PBR 材质
  ├── 几何着色器
  └── 计算着色器
```

### 8.3 设计哲学

> **PixiJS 的核心理念**：在 2D 领域做到**极致简单**和**极致高效**，而不是追求大而全。

这就是为什么 PixiJS 着色器如此简单，同时也定义了它的能力边界！

---

## 附录：PixiJS vs 其他引擎对比

| 特性 | PixiJS | Three.js | Babylon.js | Phaser | Unity WebGL |
|------|--------|----------|------------|--------|-------------|
| **2D 渲染** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| **3D 渲染** | ❌ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ❌ | ⭐⭐⭐⭐⭐ |
| **学习曲线** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐ |
| **包体积** | 500KB | 600KB | 2MB | 1.2MB | 10-50MB |
| **着色器复杂度** | 简单 | 中等 | 中等 | 简单 | 中等-复杂 |
| **社区/生态** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **适用场景** | 2D 游戏/可视化 | Web 3D | 3D 游戏/可视化 | 2D 游戏 | 任何游戏 |

---

**最终建议**：

- **2D 项目首选 PixiJS** - 简单、快速、轻量
- **需要 3D 时考虑 Three.js** - Web 3D 的事实标准
- **复杂游戏考虑 Unity** - 完整的游戏引擎

根据项目需求选择合适的工具，而不是盲目追求最强大的引擎！
