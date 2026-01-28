# 着色器（Shader）概念详解

> 从固定管线到可编程渲染：理解 GPU 编程的核心

## 目录

1. [着色器的本质](#1-着色器的本质)
2. [历史背景：为什么需要着色器](#2-历史背景为什么需要着色器)
3. [着色器的工作原理](#3-着色器的工作原理)
4. [着色器的类型](#4-着色器的类型)
5. [GLSL 语言入门](#5-glsl-语言入门)
6. [实战案例](#6-实战案例)
7. [各引擎中的着色器](#7-各引擎中的着色器)

---

## 1. 着色器的本质

### 1.1 简单定义

**着色器（Shader）= 运行在 GPU 上的小程序**

```
CPU 程序：运行在处理器上，用 JavaScript/C++/Python 编写
GPU 程序：运行在显卡上，用 GLSL/HLSL/WGSL 编写 ← 这就是着色器
```

### 1.2 核心职责

着色器决定：
- **每个顶点**的位置、颜色、纹理坐标
- **每个像素**的最终颜色

```
简单比喻：

画家绘画：
  ├── 先打草稿（顶点着色器：定位）
  └── 再上色（片段着色器：着色）

GPU 渲染：
  ├── 顶点着色器：计算顶点位置
  └── 片段着色器：计算像素颜色
```

### 1.3 与普通代码的区别

| 特性 | CPU 代码 | GPU 着色器 |
|------|---------|-----------|
| **运行位置** | 处理器 | 显卡 |
| **编程语言** | JavaScript/C++ | GLSL/HLSL |
| **执行方式** | 串行（一个接一个） | 并行（同时处理数百万像素） |
| **性能** | 慢 | 极快（专为图形优化） |
| **用途** | 通用计算 | 图形渲染 |

---

## 2. 历史背景：为什么需要着色器

### 2.1 固定管线时代（1990s-2001）

**问题**：早期 GPU 功能是固定的，不可编程。

```c
// OpenGL 1.x 固定管线（无法自定义）

// 1. 设置材质（只能用预设参数）
glMaterialfv(GL_FRONT, GL_AMBIENT, ambient);
glMaterialfv(GL_FRONT, GL_DIFFUSE, diffuse);
glMaterialfv(GL_FRONT, GL_SPECULAR, specular);

// 2. 设置光源（只能用预设光照模型）
glLightfv(GL_LIGHT0, GL_POSITION, lightPos);
glLightfv(GL_LIGHT0, GL_DIFFUSE, lightColor);

// 3. 绘制
glBegin(GL_TRIANGLES);
glVertex3f(x, y, z);
glEnd();

// 限制：
// ❌ 不能自定义光照算法
// ❌ 不能实现特殊效果（卡通渲染、辉光等）
// ❌ 不能优化性能（固定流程）
```

**能做的效果**：
- ✅ 基础光照（Phong 模型）
- ✅ 简单纹理映射
- ✅ 基础雾效

**做不到的效果**：
- ❌ 卡通渲染（Toon Shading）
- ❌ 水面波纹
- ❌ 体积雾
- ❌ 皮肤次表面散射
- ❌ 自定义后处理

### 2.2 可编程管线时代（2001-现在）

**解决方案**：引入着色器，让开发者可以编写 GPU 程序。

```glsl
// 现代 OpenGL/WebGL 可编程管线

// 顶点着色器（自定义顶点处理）
attribute vec3 position;
uniform mat4 mvp;
void main() {
    // 你可以写任何代码！
    gl_Position = mvp * vec4(position, 1.0);
}

// 片段着色器（自定义像素颜色）
uniform sampler2D texture;
varying vec2 uv;
void main() {
    // 你可以实现任何效果！
    vec4 color = texture2D(texture, uv);
    gl_FragColor = color;
}

// 优势：
// ✅ 完全自定义渲染逻辑
// ✅ 可以实现任何视觉效果
// ✅ 充分发挥 GPU 并行能力
```

**里程碑**：

```
2001: NVIDIA GeForce 3
    └── 第一款支持可编程着色器的显卡

2004: OpenGL 2.0 / DirectX 9.0
    └── 标准化着色器语言（GLSL/HLSL）

2011: WebGL 1.0
    └── 浏览器支持着色器

2020: WebGPU
    └── 新一代 Web 图形 API（WGSL）
```

---

## 3. 着色器的工作原理

### 3.1 渲染管线

```
应用程序（CPU）
    ↓ 发送数据
┌─────────────────────────────────────┐
│         GPU 渲染管线                 │
├─────────────────────────────────────┤
│                                     │
│  1. 顶点着色器（Vertex Shader）      │
│     输入：顶点数据（位置、颜色、UV）   │
│     输出：裁剪空间坐标                │
│     并行：每个顶点一个线程             │
│     ↓                               │
│                                     │
│  2. 图元装配（Primitive Assembly）   │
│     组装三角形                       │
│     ↓                               │
│                                     │
│  3. 光栅化（Rasterization）          │
│     将三角形转换为像素（片段）         │
│     ↓                               │
│                                     │
│  4. 片段着色器（Fragment Shader）     │
│     输入：插值后的顶点数据             │
│     输出：像素颜色                    │
│     并行：每个像素一个线程             │
│     ↓                               │
│                                     │
│  5. 帧缓冲（Framebuffer）            │
│     写入屏幕                         │
│                                     │
└─────────────────────────────────────┘
```

### 3.2 并行执行

**关键特性**：着色器是**大规模并行**执行的。

```
场景：渲染一个 1920×1080 的全屏四边形

CPU 串行执行：
    for (let y = 0; y < 1080; y++) {
        for (let x = 0; x < 1920; x++) {
            color = calculatePixelColor(x, y);
            setPixel(x, y, color);
        }
    }
    耗时：1920 × 1080 = 2,073,600 次循环
    假设每次 0.001ms → 总计 2073ms（2 秒）

GPU 并行执行：
    // 2,073,600 个线程同时运行片段着色器
    void main() {
        vec4 color = calculatePixelColor();
        gl_FragColor = color;
    }
    耗时：1-2ms（快 1000 倍！）
```

**GPU 并行能力**：

| 显卡 | 流处理器数量 | 同时处理像素数 |
|------|------------|--------------|
| NVIDIA GTX 1060 | 1280 | 1280 |
| NVIDIA RTX 3080 | 8704 | 8704 |
| NVIDIA RTX 4090 | 16384 | 16384 |

现代 GPU 可以同时处理**数千到数万个像素**！

---

## 4. 着色器的类型

### 4.1 顶点着色器（Vertex Shader）

**职责**：处理每个顶点，计算最终位置。

```glsl
// 顶点着色器示例

// 输入（Attributes）：每个顶点的数据
attribute vec3 position;      // 顶点位置
attribute vec2 uv;            // 纹理坐标
attribute vec3 normal;        // 法线

// 输出（Varyings）：传递给片段着色器
varying vec2 vUv;
varying vec3 vNormal;

// 统一变量（Uniforms）：所有顶点共享
uniform mat4 modelMatrix;     // 模型矩阵
uniform mat4 viewMatrix;      // 视图矩阵
uniform mat4 projectionMatrix; // 投影矩阵

void main() {
    // 1. 变换顶点位置（本地空间 → 世界空间 → 裁剪空间）
    mat4 mvp = projectionMatrix * viewMatrix * modelMatrix;
    gl_Position = mvp * vec4(position, 1.0);

    // 2. 传递数据给片段着色器
    vUv = uv;
    vNormal = normal;
}
```

**应用场景**：
1. **顶点动画**（水波、旗帜飘动）
2. **骨骼动画**（角色蒙皮）
3. **顶点变形**（爆炸效果）

### 4.2 片段着色器（Fragment Shader / Pixel Shader）

**职责**：计算每个像素的最终颜色。

```glsl
// 片段着色器示例

// 输入（从顶点着色器传来）
varying vec2 vUv;
varying vec3 vNormal;

// 纹理
uniform sampler2D mainTexture;

// 光照
uniform vec3 lightDirection;
uniform vec3 lightColor;

void main() {
    // 1. 采样纹理
    vec4 texColor = texture2D(mainTexture, vUv);

    // 2. 计算光照（简单 Lambert 漫反射）
    float diffuse = max(dot(vNormal, lightDirection), 0.0);
    vec3 lighting = lightColor * diffuse;

    // 3. 组合最终颜色
    gl_FragColor = vec4(texColor.rgb * lighting, texColor.a);
}
```

**应用场景**：
1. **纹理采样**（贴图）
2. **光照计算**（Phong、PBR）
3. **特效**（发光、溶解、扭曲）
4. **后处理**（模糊、调色、景深）

### 4.3 几何着色器（Geometry Shader）

**职责**：生成新的图元（可选，较少使用）。

```glsl
// 几何着色器示例：粒子系统

#version 330 core
layout (points) in;
layout (triangle_strip, max_vertices = 4) out;

out vec2 texCoord;

void main() {
    vec4 pos = gl_in[0].gl_Position;

    // 从 1 个点生成 4 个顶点（一个四边形）
    gl_Position = pos + vec4(-0.1, -0.1, 0.0, 0.0);
    texCoord = vec2(0.0, 0.0);
    EmitVertex();

    gl_Position = pos + vec4(0.1, -0.1, 0.0, 0.0);
    texCoord = vec2(1.0, 0.0);
    EmitVertex();

    gl_Position = pos + vec4(-0.1, 0.1, 0.0, 0.0);
    texCoord = vec2(0.0, 1.0);
    EmitVertex();

    gl_Position = pos + vec4(0.1, 0.1, 0.0, 0.0);
    texCoord = vec2(1.0, 1.0);
    EmitVertex();

    EndPrimitive();
}
```

**应用场景**：
1. **粒子系统**（CPU 发送点，GPU 生成四边形）
2. **草地渲染**（从点生成草叶）
3. **轮廓线**（从三角形生成边缘线）

### 4.4 计算着色器（Compute Shader）

**职责**：通用计算（不限于图形）。

```glsl
// 计算着色器示例：粒子物理

#version 430

layout(local_size_x = 256) in;

struct Particle {
    vec3 position;
    vec3 velocity;
};

layout(std430, binding = 0) buffer Particles {
    Particle particles[];
};

uniform float deltaTime;

void main() {
    uint id = gl_GlobalInvocationID.x;

    // 更新粒子位置
    particles[id].velocity.y -= 9.8 * deltaTime; // 重力
    particles[id].position += particles[id].velocity * deltaTime;

    // 碰撞检测
    if (particles[id].position.y < 0.0) {
        particles[id].position.y = 0.0;
        particles[id].velocity.y *= -0.8; // 反弹
    }
}
```

**应用场景**：
1. **物理模拟**（粒子、布料）
2. **图像处理**（模糊、边缘检测）
3. **AI 计算**（神经网络推理）

---

## 5. GLSL 语言入门

### 5.1 基础语法

```glsl
// GLSL 类似 C 语言

// 1. 数据类型
float a = 1.0;           // 浮点数
int b = 1;               // 整数
bool c = true;           // 布尔值

vec2 v2 = vec2(1.0, 2.0);        // 2D 向量
vec3 v3 = vec3(1.0, 2.0, 3.0);   // 3D 向量
vec4 v4 = vec4(1.0, 2.0, 3.0, 4.0); // 4D 向量

mat4 m = mat4(1.0); // 4×4 矩阵

sampler2D tex; // 2D 纹理

// 2. 向量操作
vec3 a = vec3(1.0, 2.0, 3.0);
vec3 b = vec3(4.0, 5.0, 6.0);

vec3 sum = a + b;        // 加法
vec3 product = a * b;    // 逐分量乘法
float dot_product = dot(a, b); // 点积
vec3 cross_product = cross(a, b); // 叉积

// 3. 分量访问
vec4 color = vec4(1.0, 0.5, 0.0, 1.0);
float r = color.r; // 或 color.x
float g = color.g; // 或 color.y
float b = color.b; // 或 color.z
float a = color.a; // 或 color.w

vec2 rg = color.rg;   // Swizzle
vec3 bgr = color.bgr; // 重排分量

// 4. 内置函数
float len = length(v3);        // 长度
vec3 normalized = normalize(v3); // 归一化
float mixed = mix(a, b, 0.5);  // 线性插值
float clamped = clamp(x, 0.0, 1.0); // 限制范围
float smoothed = smoothstep(0.0, 1.0, x); // 平滑插值
```

### 5.2 变量类型

```glsl
// Attributes（属性）
// - 每个顶点不同
// - 只在顶点着色器中使用
attribute vec3 position;
attribute vec2 uv;
attribute vec3 normal;

// Uniforms（统一变量）
// - 所有顶点/片段共享
// - CPU 传递给 GPU
uniform mat4 modelMatrix;
uniform vec3 lightPosition;
uniform sampler2D texture;
uniform float time;

// Varyings（变化变量）
// - 顶点着色器输出 → 片段着色器输入
// - 自动插值
varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vWorldPosition;
```

### 5.3 完整示例：纹理映射

**JavaScript（CPU）**：

```javascript
// 1. 创建着色器程序
const vertexShaderSource = `
    attribute vec3 position;
    attribute vec2 uv;

    uniform mat4 mvpMatrix;

    varying vec2 vUv;

    void main() {
        vUv = uv;
        gl_Position = mvpMatrix * vec4(position, 1.0);
    }
`;

const fragmentShaderSource = `
    precision mediump float;

    uniform sampler2D mainTexture;
    varying vec2 vUv;

    void main() {
        gl_FragColor = texture2D(mainTexture, vUv);
    }
`;

// 2. 编译着色器
const program = createShaderProgram(gl, vertexShaderSource, fragmentShaderSource);

// 3. 传递数据
gl.useProgram(program);
gl.uniformMatrix4fv(mvpMatrixLocation, false, mvpMatrix);
gl.uniform1i(textureLocation, 0);

// 4. 绘制
gl.drawArrays(gl.TRIANGLES, 0, vertexCount);
```

---

## 6. 实战案例

### 6.1 案例 1：水波纹效果

```glsl
// 顶点着色器
attribute vec3 position;
attribute vec2 uv;

uniform mat4 mvpMatrix;
uniform float time;

varying vec2 vUv;

void main() {
    vec3 pos = position;

    // 添加正弦波动画
    float wave = sin(pos.x * 3.0 + time) * cos(pos.z * 3.0 + time) * 0.1;
    pos.y += wave;

    vUv = uv;
    gl_Position = mvpMatrix * vec4(pos, 1.0);
}

// 片段着色器
precision mediump float;

uniform sampler2D waterTexture;
uniform float time;

varying vec2 vUv;

void main() {
    // 扭曲 UV 坐标
    vec2 distortedUv = vUv;
    distortedUv.x += sin(vUv.y * 10.0 + time) * 0.02;
    distortedUv.y += cos(vUv.x * 10.0 + time) * 0.02;

    // 采样纹理
    vec4 color = texture2D(waterTexture, distortedUv);

    // 添加蓝色调
    color.rgb = mix(color.rgb, vec3(0.2, 0.5, 1.0), 0.3);

    gl_FragColor = color;
}
```

**效果**：水面波纹 + 颜色扭曲

### 6.2 案例 2：溶解效果

```glsl
// 片段着色器
precision mediump float;

uniform sampler2D mainTexture;
uniform sampler2D noiseTexture;
uniform float dissolveAmount; // 0.0 - 1.0

varying vec2 vUv;

void main() {
    // 采样主纹理
    vec4 color = texture2D(mainTexture, vUv);

    // 采样噪声纹理
    float noise = texture2D(noiseTexture, vUv).r;

    // 溶解逻辑
    if (noise < dissolveAmount) {
        discard; // 丢弃这个片段（透明）
    }

    // 边缘发光
    float edge = 0.05;
    if (noise < dissolveAmount + edge) {
        float t = (noise - dissolveAmount) / edge;
        vec3 glowColor = vec3(1.0, 0.5, 0.0); // 橙色
        color.rgb = mix(glowColor, color.rgb, t);
    }

    gl_FragColor = color;
}
```

**效果**：角色溶解消失，边缘发光

### 6.3 案例 3：卡通渲染（Toon Shading）

```glsl
// 片段着色器
precision mediump float;

varying vec3 vNormal;
varying vec3 vWorldPosition;

uniform vec3 lightDirection;
uniform vec3 viewPosition;
uniform sampler2D toonRamp; // 色阶纹理

void main() {
    // 1. 漫反射
    float diffuse = max(dot(normalize(vNormal), lightDirection), 0.0);

    // 2. 量化光照（卡通化）
    float toonDiffuse = floor(diffuse * 4.0) / 4.0; // 4 个色阶

    // 或使用查找表
    // float toonDiffuse = texture2D(toonRamp, vec2(diffuse, 0.5)).r;

    // 3. 边缘光（Rim Light）
    vec3 viewDir = normalize(viewPosition - vWorldPosition);
    float rim = 1.0 - max(dot(viewDir, vNormal), 0.0);
    rim = smoothstep(0.6, 1.0, rim);

    // 4. 组合
    vec3 baseColor = vec3(0.8, 0.6, 0.4);
    vec3 finalColor = baseColor * toonDiffuse + vec3(1.0) * rim * 0.5;

    gl_FragColor = vec4(finalColor, 1.0);
}
```

**效果**：类似动漫的分层光照

### 6.4 案例 4：后处理 - 模糊

```glsl
// 高斯模糊片段着色器
precision mediump float;

uniform sampler2D sceneTexture;
uniform vec2 resolution; // 屏幕分辨率

varying vec2 vUv;

void main() {
    vec2 texelSize = 1.0 / resolution;
    vec4 result = vec4(0.0);

    // 9x9 高斯核
    float weights[9];
    weights[0] = 0.0625; weights[1] = 0.125; weights[2] = 0.0625;
    weights[3] = 0.125;  weights[4] = 0.25;  weights[5] = 0.125;
    weights[6] = 0.0625; weights[7] = 0.125; weights[8] = 0.0625;

    int index = 0;
    for (int y = -1; y <= 1; y++) {
        for (int x = -1; x <= 1; x++) {
            vec2 offset = vec2(float(x), float(y)) * texelSize;
            result += texture2D(sceneTexture, vUv + offset) * weights[index];
            index++;
        }
    }

    gl_FragColor = result;
}
```

**效果**：模糊整个场景

### 6.5 案例 5：粒子系统

```glsl
// 顶点着色器
attribute vec3 position;
attribute vec2 uv;
attribute float particleId; // 粒子 ID

uniform mat4 viewMatrix;
uniform mat4 projectionMatrix;
uniform float time;

varying vec2 vUv;
varying float vAlpha;

// 伪随机函数
float random(float seed) {
    return fract(sin(seed * 12.9898) * 43758.5453);
}

void main() {
    // 1. 基于 ID 生成随机参数
    float life = mod(time + random(particleId) * 10.0, 5.0); // 生命周期
    float speed = 1.0 + random(particleId + 1.0) * 2.0;
    float angle = random(particleId + 2.0) * 6.28318; // 0-2π

    // 2. 计算位置
    vec3 pos = position;
    pos.x += cos(angle) * life * speed;
    pos.z += sin(angle) * life * speed;
    pos.y += life * 2.0 - life * life * 0.5; // 抛物线

    // 3. 计算透明度
    vAlpha = 1.0 - life / 5.0;

    // 4. 广告牌效果（粒子始终面向摄像机）
    vec3 cameraRight = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
    vec3 cameraUp = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);

    vec3 billboardPos = pos;
    billboardPos += cameraRight * (uv.x - 0.5) * 0.5;
    billboardPos += cameraUp * (uv.y - 0.5) * 0.5;

    vUv = uv;
    gl_Position = projectionMatrix * viewMatrix * vec4(billboardPos, 1.0);
}

// 片段着色器
precision mediump float;

uniform sampler2D particleTexture;

varying vec2 vUv;
varying float vAlpha;

void main() {
    vec4 color = texture2D(particleTexture, vUv);
    color.a *= vAlpha;

    if (color.a < 0.01) discard;

    gl_FragColor = color;
}
```

**效果**：爆炸粒子效果

---

## 7. 各引擎中的着色器

### 7.1 PixiJS

**特点**：简单，基于 WebGL。

```javascript
// PixiJS 自定义着色器
const filter = new PIXI.Filter(
    // 顶点着色器（可选，使用默认）
    null,

    // 片段着色器
    `
    precision mediump float;

    varying vec2 vTextureCoord;
    uniform sampler2D uSampler;
    uniform float time;

    void main() {
        vec2 uv = vTextureCoord;
        uv.x += sin(uv.y * 10.0 + time) * 0.02;
        gl_FragColor = texture2D(uSampler, uv);
    }
    `,

    // Uniforms
    {
        time: 0.0
    }
);

sprite.filters = [filter];

// 动画更新
app.ticker.add((delta) => {
    filter.uniforms.time += delta * 0.1;
});
```

### 7.2 Three.js

**特点**：功能强大，支持复杂材质。

```javascript
// Three.js 自定义着色器材质
const material = new THREE.ShaderMaterial({
    uniforms: {
        time: { value: 0.0 },
        texture1: { value: texture }
    },

    vertexShader: `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,

    fragmentShader: `
        uniform float time;
        uniform sampler2D texture1;
        varying vec2 vUv;

        void main() {
            vec2 uv = vUv;
            uv.x += sin(uv.y * 10.0 + time) * 0.02;
            gl_FragColor = texture2D(texture1, uv);
        }
    `
});

const mesh = new THREE.Mesh(geometry, material);
scene.add(mesh);

// 更新
function animate() {
    material.uniforms.time.value += 0.01;
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
}
```

### 7.3 Unity

**特点**：ShaderLab 语法，集成材质系统。

```glsl
// Unity Shader
Shader "Custom/WaterShader" {
    Properties {
        _MainTex ("Texture", 2D) = "white" {}
        _Speed ("Speed", Float) = 1.0
    }

    SubShader {
        Pass {
            CGPROGRAM
            #pragma vertex vert
            #pragma fragment frag

            #include "UnityCG.cginc"

            struct appdata {
                float4 vertex : POSITION;
                float2 uv : TEXCOORD0;
            };

            struct v2f {
                float2 uv : TEXCOORD0;
                float4 vertex : SV_POSITION;
            };

            sampler2D _MainTex;
            float _Speed;

            v2f vert (appdata v) {
                v2f o;
                // 波浪动画
                v.vertex.y += sin(v.vertex.x * 3.0 + _Time.y * _Speed) * 0.1;
                o.vertex = UnityObjectToClipPos(v.vertex);
                o.uv = v.uv;
                return o;
            }

            fixed4 frag (v2f i) : SV_Target {
                // UV 扭曲
                float2 uv = i.uv;
                uv.x += sin(uv.y * 10.0 + _Time.y * _Speed) * 0.02;

                fixed4 col = tex2D(_MainTex, uv);
                return col;
            }
            ENDCG
        }
    }
}
```

### 7.4 Unreal Engine

**特点**：节点编辑器 + HLSL 代码。

```
材质编辑器（节点图）：
    TextureSample (水纹理)
        ↓
    Panner (UV 滚动)
        ↓
    Multiply (颜色调整)
        ↓
    Base Color

    Normal Map
        ↓
    Panner (法线动画)
        ↓
    Normal

自定义节点（HLSL）：
    return sin(UV.x * 10 + Time) * 0.02;
```

---

## 8. 性能优化技巧

### 8.1 减少计算

```glsl
// ❌ 每个片段都计算（慢）
void main() {
    float result = sin(uv.x * 100.0);
    // ...
}

// ✅ 在顶点着色器计算，插值传递（快）
// 顶点着色器
varying float vResult;
void main() {
    vResult = sin(uv.x * 100.0);
    // ...
}

// 片段着色器
varying float vResult;
void main() {
    // 直接使用插值后的值
    // ...
}
```

### 8.2 避免分支

```glsl
// ❌ 分支（GPU 不擅长）
if (condition) {
    color = vec3(1.0, 0.0, 0.0);
} else {
    color = vec3(0.0, 1.0, 0.0);
}

// ✅ 数学运算（GPU 擅长）
color = mix(vec3(0.0, 1.0, 0.0), vec3(1.0, 0.0, 0.0), float(condition));
```

### 8.3 降低精度

```glsl
// ❌ 高精度（慢，移动端尤其明显）
precision highp float;

// ✅ 中精度（快，通常够用）
precision mediump float;

// ✅ 低精度（更快，用于颜色）
precision lowp float;
```

---

## 9. 常见问题

### Q1: 着色器和材质的区别？

```
着色器（Shader）= 代码（如何渲染）
材质（Material）= 着色器 + 参数（实例化配置）

比喻：
    着色器 = 炒菜的步骤（食谱）
    材质 = 一道具体的菜（加了具体调料的实例）
```

### Q2: 为什么片段着色器比顶点着色器慢？

```
顶点数量：通常几千到几万
片段数量：通常几百万（1920×1080 = 200 万像素）

顶点着色器：执行 1 万次
片段着色器：执行 200 万次

因此，复杂计算尽量放在顶点着色器。
```

### Q3: 着色器可以访问其他像素吗？

```
在片段着色器中：
- ✅ 可以采样纹理的任意位置
- ❌ 不能直接读取其他片段的输出

解决方案：
- 多次渲染（Render Pass）
- 使用 RenderTexture 作为中间结果
```

---

## 总结

### 核心要点

1. **着色器是什么**
   - 运行在 GPU 上的小程序
   - 用 GLSL/HLSL/WGSL 编写
   - 并行处理数百万像素

2. **为什么需要着色器**
   - 固定管线太受限
   - 可编程管线灵活强大
   - 充分发挥 GPU 并行能力

3. **着色器类型**
   - 顶点着色器：处理顶点位置
   - 片段着色器：计算像素颜色
   - 几何着色器：生成新图元
   - 计算着色器：通用计算

4. **应用场景**
   - 特效（水波、溶解、发光）
   - 光照（PBR、卡通渲染）
   - 后处理（模糊、调色、景深）
   - 粒子系统

### 学习路径

```
1. 基础（1-2 周）
   └── GLSL 语法、向量运算

2. 初级（1 个月）
   └── 纹理采样、简单光照

3. 中级（2-3 个月）
   └── 复杂特效、后处理

4. 高级（6 个月+）
   └── PBR、体积渲染、优化
```

### 推荐资源

- **The Book of Shaders**（免费在线书）
- **ShaderToy**（着色器分享网站）
- **Shadertoy 中文教程**
- **Unity Shader 入门精要**（书）

---

**文档版本**: v1.0
**更新日期**: 2026-01-22
**作者**: AI Assistant
