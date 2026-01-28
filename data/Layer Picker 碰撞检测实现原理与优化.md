# Layer Picker 碰撞检测实现原理与优化

## 核心知识点

### 1. Color Picking 技术原理
- **核心思想**：为每个可交互元素分配唯一颜色 ID，将所有元素绘制到离屏 Canvas（hitCanvas），点击时读取像素颜色反向查找元素
- **优势**：精确、统一、高效，可处理不规则形状和透明区域
- **关键组件**：LayerPicker 类、colorImage 着色函数、transformLayer 变换函数、getLayers 图层提取

### 2. 图像着色算法（colorImage）
- 通过 **反复绘制自身**（默认15次）消除半透明像素，使 alpha 趋近于 1
- 使用 `source-in` 混合模式将图像着色为指定颜色
- 添加 `shadowBlur` 扩展边缘，提高边缘检测精度

### 3. 反复绘制的性能问题
- 每个元素需要 15 次 `drawImage` 调用，N 个图像需要 15N 次
- 时间复杂度：O(repeatDrawCount × width × height × N)

### 4. 优化方案对比

| 方案 | 原理 | 性能提升 | 复杂度 |
|------|------|----------|--------|
| **ImageData 像素操作** | 直接遍历像素，alpha > 0 设为 255 | ★★★☆☆ | 低 |
| **lighter 混合模式** | alpha 直接相加，5次即可达到1.0 | ★★★☆☆ | 低 |
| **WebGL Shader** | GPU 并行处理，fragment shader 着色 | ★★★★★ | 高 |
| **增量更新** | 缓存已着色结果，只处理变更图层 | ★★★★☆ | 中 |

### 5. Canvas 混合模式的 Alpha 计算

| 模式 | Alpha 公式 | α=0.5 结果 | 效果 |
|------|------------|------------|------|
| source-over | `α + α × (1 - α)` | 0.75 | 增加 |
| **lighter** | `α + α` (clamp to 1) | 1.0 | **增加最快** |
| screen | `α + α - α × α` | 0.75 | 增加 |
| multiply | `α × α` | 0.25 | 减少 |

- **lighter 模式最高效**：5次即可将 α=0.1 提升到 1.0（source-over 需要15+次）
- **无法直接实现 alpha 二值化**：标准混合模式都是连续函数，需配合 ImageData 或 Shader

### 6. 模糊匹配机制

**触发原因**（读取像素颜色与存储颜色不匹配）：
- 半透明像素与背景混合导致颜色偏移
- 抗锯齿产生边缘中间色
- zoom 缩放时浏览器颜色插值
- 多图层边缘重叠混合
- `getImageData` 采样边界像素

**保留必要性**：
- 即使 colorImage 输出完美纯色，后续绘制/采样环节仍可能引入偏差
- 模糊匹配是整个流程中颜色精度损失的**兜底机制**
- 配合 `imageSmoothingEnabled = false` 可大幅减少触发频率

### 7. 推荐优化路径
1. **短期**：将反复绘制替换为 lighter 模式（5次）或 ImageData 像素操作
2. **中期**：实现增量更新机制，避免全量重绘
3. **长期**：考虑 WebGL 统一方案

## 源对话记录 (Q&A)

**Q**: 分析 domains/editor/packages/editor/plugins/src/plugins/layer-picker 描述碰撞检测实现原理，输出文档到 domains/editor/tmp

**A**: 我来分析 layer-picker 的碰撞检测实现原理。首先让我探索目录结构并阅读相关代码。

阅读了 layer-picker.ts、utils.ts、layer-picker-rules.js、color-image.ts 等核心文件后，分析了 Color Picking 技术的实现原理，包括：
- 唯一颜色标识生成（getNewColor）
- 图层更新流程（update 方法）
- 图像着色算法（colorImage）
- 点击检测与模糊匹配（pick 方法）
- 变换处理（transformLayer）
- 性能优化策略（缩放、防抖、内存管理）

文档已输出到 `domains/editor/tmp/layer-picker-collision-detection.md`。

---

**Q**: 这个方式有性能问题吗，有其他更高效的方式吗。新增一节「改进思路」用于记录后续改进方案

（指反复绘制消除半透明像素的代码）
```typescript
for (let i = 0; i < repeatDrawCount; i++) {
    ctx.drawImage(canvas, 0, 0, width, height);
}
```

**A**: 这个反复绘制的方式确实存在性能问题。分析并添加了改进思路章节，包括：

**性能问题分析**：
- 当前方案每个元素需要 15 次 drawImage 调用，N 个图像元素需要 15N 次
- 存在 Canvas 合成开销、内存带宽压力，且无法并行

**6 个替代方案**：
1. ImageData 像素操作（推荐首选）
2. WebGL Shader（性能最优）
3. OffscreenCanvas + Worker
4. 混合模式组合
5. 增量更新
6. 形态学膨胀替代 shadowBlur

---

**Q**: 有没有哪种 globalCompositeOperation 配置能做到两张同样的图混合后，半透明像素的不透明度越来越大

**A**: 分析了 Canvas 各种 globalCompositeOperation 对 alpha 通道的影响。

**可以增加 alpha 的模式**：
- source-over：`α + α × (1 - α)`
- **lighter**：`α + α`（clamp to 1）- **增加最快**
- screen：`α + α - α × α`

**推荐 lighter 模式**：对于 α=0.1 的像素，lighter 只需 5 次即可达到 1.0，而 source-over 需要 15+ 次。

虽然 lighter 也会累加 RGB 值可能导致过曝，但由于后续会用 source-in 统一着色，RGB 会被覆盖，不影响最终结果。

---

**Q**: 哪种混合模式可以做到：新色值 alpha 为 1 时，旧色值 alpha 不为 0 则得到 alpha 为 1，否则为 0

**A**: 这本质上是 **alpha 通道的二值化**：`result_alpha = (dest_alpha > 0) ? 1 : 0`

**标准 Canvas 混合模式无法直接实现这个阶跃函数**，因为所有混合模式的 alpha 计算都是连续函数（乘法、加法、取大小等）。

**实现方案**：
1. 先用 lighter 放大 alpha，再用 source-in
2. **ImageData 直接二值化**（最精确）：遍历像素，`data[i] = data[i] > 0 ? 255 : 0`
3. WebGL Shader：`float alpha = texColor.a > 0.0 ? 1.0 : 0.0`

---

**Q**: 这个分支什么情况下会走到，如果采用「方案 2：ImageData 直接二值化」是否还有该分支的可能性

（指模糊匹配分支）
```typescript
} else {
    let minDistance = Number.POSITIVE_INFINITY;
    for (const [key, layer] of this.colorMap) {
        const { r, g, b } = tinycolor(key).toRgb();
        const distance = Math.hypot(r - r0, g - g0, b - b0);
        ...
    }
}
```

**A**: **触发原因**：读取像素颜色与 colorMap 存储颜色不匹配，由以下因素导致：
- 半透明混合
- 抗锯齿插值
- 缩放采样
- 图层重叠
- 坐标精度

**采用 ImageData 二值化后**：
- ✅ 可消除：半透明混合导致的颜色偏移
- ❌ 仍存在：绘制到 hitCanvas 时的缩放插值、多图层边缘重叠、pick 时坐标精度

**结论**：ImageData 二值化可显著减少模糊匹配触发，但**建议保留作为安全兜底**。

---

**Q**: 结论中的「当前方案（反复绘制）」为何必须保留

**A**: 之前说"必须保留"确实过于绝对。更精确的解释：

**模糊匹配的真正原因**不仅是反复绘制不足，而是**后续环节**引入的颜色偏差：
- transformLayer 中的 zoom 缩放导致插值
- 多图层边缘在 hitCanvas 上重叠混合
- getImageData 采样边界像素

**修正结论**：模糊匹配是对**整个流程中各环节颜色精度损失的兜底机制**，不仅仅是针对反复绘制这一步。配合 `imageSmoothingEnabled = false` 可大幅减少触发频率，此时可考虑移除。
