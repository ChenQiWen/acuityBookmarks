# AcuityBookmarks

## Logo 使用说明

### SVG Logo 透明背景问题解决方案

如果您的 `logo.svg` 显示为白色背景或有白色边框，请按以下步骤解决：

#### 1. SVG 文件设置
确保 `logo.svg` 的根元素设置了透明背景：
```xml
<svg ... style="background-color: transparent;">
```

#### 2. CSS 样式覆盖
在组件中添加以下样式来确保透明显示：
```css
.custom-logo {
  background: transparent !important;
  border: none !important;
  outline: none !important;
}
```

#### 3. 容器样式
确保logo容器也没有背景色：
```css
.logo-container {
  background: transparent;
  border: none;
}
```

### 当前Logo使用位置

- **Popup页面头部**：替换原来的Material Design图标
- **管理页面顶部栏**：在应用标题旁边显示

### 自定义Logo

如果您想使用不同的logo：

1. 将您的SVG文件重命名为 `logo.svg`
2. 替换项目根目录下的 `logo.svg` 文件
3. 确保SVG设置了透明背景（如上所述）
4. 重新构建项目：`npm run build`

### 故障排除

如果仍然显示白色背景：

1. 检查SVG文件是否有内联样式设置背景色
2. 确认CSS中使用了 `!important` 来覆盖默认样式
3. 检查是否有父容器设置了背景色
4. 在浏览器开发者工具中检查元素的计算样式

---
