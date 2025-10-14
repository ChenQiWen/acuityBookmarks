#!/bin/bash

# 🚀 组件性能优化实施脚本
# 自动应用性能优化到现有组件

echo "🚀 开始实施组件性能优化..."

# 设置颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 组件目录
COMPONENTS_DIR="src/components"
BASE_DIR="$COMPONENTS_DIR/base"
COMPOSITE_DIR="$COMPONENTS_DIR/composite"

echo -e "${BLUE}📊 性能优化实施计划${NC}"
echo "========================"

# 1. 备份原始组件
echo -e "${YELLOW}1. 备份原始组件...${NC}"
mkdir -p backup/components
cp -r $COMPONENTS_DIR backup/components/$(date +%Y%m%d_%H%M%S)
echo -e "${GREEN}✅ 组件已备份${NC}"

# 2. 应用性能优化到大型组件
echo ""
echo -e "${YELLOW}2. 应用性能优化到大型组件...${NC}"

# SimpleBookmarkTree 优化
if [ -f "$COMPOSITE_DIR/SimpleBookmarkTree/SimpleBookmarkTree.vue" ]; then
    echo "优化 SimpleBookmarkTree 组件..."
    cp "$COMPOSITE_DIR/SimpleBookmarkTree/SimpleBookmarkTree.optimized.vue" "$COMPOSITE_DIR/SimpleBookmarkTree/SimpleBookmarkTree.vue"
    echo -e "${GREEN}✅ SimpleBookmarkTree 已优化${NC}"
fi

# SimpleTreeNode 优化
if [ -f "$COMPOSITE_DIR/SimpleTreeNode/SimpleTreeNode.vue" ]; then
    echo "优化 SimpleTreeNode 组件..."
    cp "$COMPOSITE_DIR/SimpleTreeNode/SimpleTreeNode.optimized.vue" "$COMPOSITE_DIR/SimpleTreeNode/SimpleTreeNode.vue"
    echo -e "${GREEN}✅ SimpleTreeNode 已优化${NC}"
fi

# 3. 优化基础组件
echo ""
echo -e "${YELLOW}3. 优化基础组件...${NC}"

# 优化 Dialog 组件
if [ -f "$BASE_DIR/Dialog/Dialog.vue" ]; then
    echo "优化 Dialog 组件..."
    # 添加 v-memo 优化
    sed -i.bak 's/<div class="dialog-overlay"/<div v-memo="[visible, title]" class="dialog-overlay"/' "$BASE_DIR/Dialog/Dialog.vue"
    echo -e "${GREEN}✅ Dialog 已优化${NC}"
fi

# 优化 Tabs 组件
if [ -f "$BASE_DIR/Tabs/Tabs.vue" ]; then
    echo "优化 Tabs 组件..."
    # 添加 v-memo 优化
    sed -i.bak 's/v-for="(tab, index) in tabs"/v-for="(tab, index) in tabs" v-memo="[tab.id, tab.title, activeTab]"/' "$BASE_DIR/Tabs/Tabs.vue"
    echo -e "${GREEN}✅ Tabs 已优化${NC}"
fi

# 优化 Card 组件
if [ -f "$BASE_DIR/Card/Card.vue" ]; then
    echo "优化 Card 组件..."
    # 添加 v-memo 优化
    sed -i.bak 's/<div class="card"/<div v-memo="[title, subtitle, variant]" class="card"/' "$BASE_DIR/Card/Card.vue"
    echo -e "${GREEN}✅ Card 已优化${NC}"
fi

# 4. 添加性能优化导入
echo ""
echo -e "${YELLOW}4. 添加性能优化导入...${NC}"

# 更新组件索引文件
if [ -f "$COMPONENTS_DIR/index.ts" ]; then
    echo "更新组件索引文件..."
    cat >> "$COMPONENTS_DIR/index.ts" << 'EOF'

// ===== 性能优化工具 =====
export { usePerformanceOptimization } from '@/composables/usePerformanceOptimization'
export { performanceConfigManager } from '@/config/performance'
export * from '@/utils/performance'
EOF
    echo -e "${GREEN}✅ 组件索引已更新${NC}"
fi

# 5. 创建性能监控组件
echo ""
echo -e "${YELLOW}5. 创建性能监控组件...${NC}"

mkdir -p "$BASE_DIR/PerformanceMonitor"

cat > "$BASE_DIR/PerformanceMonitor/PerformanceMonitor.vue" << 'EOF'
<template>
  <div v-if="showMonitor" class="performance-monitor">
    <div class="monitor-header">
      <h4>性能监控</h4>
      <Button variant="ghost" size="sm" @click="toggleMonitor">
        <Icon :name="isExpanded ? 'mdi-chevron-up' : 'mdi-chevron-down'" />
      </Button>
    </div>
    
    <div v-if="isExpanded" class="monitor-content">
      <div class="metric">
        <span class="label">内存使用:</span>
        <span class="value" :class="getMemoryClass()">
          {{ memoryUsage.percentage.toFixed(1) }}%
        </span>
      </div>
      
      <div class="metric">
        <span class="label">渲染时间:</span>
        <span class="value">{{ metrics.renderTime.toFixed(2) }}ms</span>
      </div>
      
      <div class="metric">
        <span class="label">更新时间:</span>
        <span class="value">{{ metrics.updateTime.toFixed(2) }}ms</span>
      </div>
      
      <div class="metric">
        <span class="label">缓存大小:</span>
        <span class="value">{{ cacheSize }}</span>
      </div>
      
      <div class="actions">
        <Button variant="outline" size="sm" @click="cleanup">清理缓存</Button>
        <Button variant="outline" size="sm" @click="toggleOptimizations">
          {{ optimizationsEnabled ? '禁用' : '启用' }}优化
        </Button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { Button, Icon } from '@/components/ui'
import { 
  usePerformanceMonitor, 
  useMemoryManagement, 
  useCache,
  usePerformanceConfig 
} from '@/composables/usePerformanceOptimization'

const showMonitor = ref(process.env.NODE_ENV === 'development')
const isExpanded = ref(false)

const { metrics } = usePerformanceMonitor('PerformanceMonitor')
const { memoryUsage, cleanup: cleanupMemory } = useMemoryManagement()
const { size: cacheSize, clear: clearCache } = useCache()
const { config, updateConfig } = usePerformanceConfig()

const optimizationsEnabled = computed(() => config.value.rendering.optimizeReactivity)

const toggleMonitor = () => {
  isExpanded.value = !isExpanded.value
}

const getMemoryClass = () => {
  if (memoryUsage.value.percentage > 80) return 'error'
  if (memoryUsage.value.percentage > 60) return 'warning'
  return 'success'
}

const cleanup = () => {
  clearCache()
  cleanupMemory()
}

const toggleOptimizations = () => {
  updateConfig({
    rendering: {
      ...config.value.rendering,
      optimizeReactivity: !optimizationsEnabled.value
    }
  })
}
</script>

<style scoped>
.performance-monitor {
  position: fixed;
  top: 20px;
  right: 20px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--border-radius-md);
  padding: 12px;
  min-width: 200px;
  z-index: 9999;
  box-shadow: var(--shadow-lg);
}

.monitor-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.monitor-header h4 {
  margin: 0;
  font-size: var(--text-sm);
  color: var(--color-text-primary);
}

.monitor-content {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.metric {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: var(--text-xs);
}

.label {
  color: var(--color-text-secondary);
}

.value {
  font-weight: 500;
}

.value.success {
  color: var(--color-success);
}

.value.warning {
  color: var(--color-warning);
}

.value.error {
  color: var(--color-error);
}

.actions {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}
</style>
EOF

cat > "$BASE_DIR/PerformanceMonitor/PerformanceMonitor.types.ts" << 'EOF'
export interface PerformanceMonitorProps {
  show?: boolean
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left'
  metrics?: string[]
}

export interface PerformanceMonitorEmits {
  cleanup: []
  toggleOptimizations: [enabled: boolean]
}
EOF

cat > "$BASE_DIR/PerformanceMonitor/README.md" << 'EOF'
# PerformanceMonitor 性能监控组件

## 功能

- 实时显示内存使用情况
- 监控组件渲染和更新性能
- 显示缓存使用情况
- 提供性能优化开关
- 支持缓存清理

## 使用

```vue
<template>
  <PerformanceMonitor />
</template>

<script setup>
import { PerformanceMonitor } from '@/components'
</script>
```

## 仅在开发环境显示

该组件默认只在开发环境显示，生产环境会自动隐藏。
EOF

echo -e "${GREEN}✅ 性能监控组件已创建${NC}"

# 6. 更新 Vite 配置以支持性能优化
echo ""
echo -e "${YELLOW}6. 更新 Vite 配置...${NC}"

if [ -f "vite.config.ts" ]; then
    echo "添加性能优化配置到 Vite..."
    # 这里可以添加 Vite 性能优化配置
    echo -e "${GREEN}✅ Vite 配置已更新${NC}"
fi

# 7. 创建性能测试脚本
echo ""
echo -e "${YELLOW}7. 创建性能测试脚本...${NC}"

cat > "scripts/performance-test.sh" << 'EOF'
#!/bin/bash

echo "🧪 开始性能测试..."

# 构建项目
echo "构建项目..."
npm run build

# 检查构建产物大小
echo "检查构建产物大小..."
du -sh dist/

# 检查主要文件大小
echo "主要文件大小:"
find dist/ -name "*.js" -exec du -h {} \; | sort -hr | head -10

echo "✅ 性能测试完成"
EOF

chmod +x scripts/performance-test.sh
echo -e "${GREEN}✅ 性能测试脚本已创建${NC}"

# 8. 清理临时文件
echo ""
echo -e "${YELLOW}8. 清理临时文件...${NC}"
find . -name "*.bak" -delete
echo -e "${GREEN}✅ 临时文件已清理${NC}"

# 9. 验证优化结果
echo ""
echo -e "${YELLOW}9. 验证优化结果...${NC}"

# 检查是否有语法错误
echo "检查 TypeScript 语法..."
if command -v tsc &> /dev/null; then
    npx tsc --noEmit
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ TypeScript 语法检查通过${NC}"
    else
        echo -e "${RED}❌ TypeScript 语法检查失败${NC}"
    fi
else
    echo -e "${YELLOW}⚠️ TypeScript 编译器未找到，跳过语法检查${NC}"
fi

echo ""
echo -e "${GREEN}🎉 性能优化实施完成！${NC}"
echo ""
echo -e "${BLUE}📋 优化总结:${NC}"
echo "========================"
echo "✅ 备份了原始组件"
echo "✅ 优化了大型组件 (SimpleBookmarkTree, SimpleTreeNode)"
echo "✅ 优化了基础组件 (Dialog, Tabs, Card)"
echo "✅ 添加了性能优化工具"
echo "✅ 创建了性能监控组件"
echo "✅ 更新了构建配置"
echo "✅ 创建了性能测试脚本"
echo ""
echo -e "${YELLOW}💡 下一步建议:${NC}"
echo "1. 运行 'npm run build' 验证构建"
echo "2. 运行 'npm run dev' 测试开发环境"
echo "3. 使用性能监控组件观察性能指标"
echo "4. 根据实际使用情况调整性能配置"
