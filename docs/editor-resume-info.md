数据结构
1. 作图记录（json） -> 编辑器 Model -> VM -> Texture
2. 树型结构：优势、缺点，如何优化缺陷
3. 元素上的 version 版本号用处。比如 TypeTool 降级

渲染层
1. 编辑器完整渲染流程
2. 交互逻辑： 插件系统设计思路。用户操作后重绘流程
3. 渲染引擎： 渲染器系统。滤镜实现原理
4. 性能优化： 无限画布优化。视图裁剪等
5. 数据缓存： ResourceManager 缓存原图 -> 滤镜渲染结果图缓存 -> 纹理缓存等，多级缓存如何协同
6. PIXIjs 常见性能优化手段，在稿定编辑器内的实践
7. 基于实际代码列举 3 个具体问题点，以及解决思路

碰撞检测
1. 多边形、透明像素
2. 轴对称包围盒、方向包围盒
3. domains/editor/packages/editor/plugins/src/plugins/layer-picker/core/layer-picker.ts
4. 组元素的碰撞检测
