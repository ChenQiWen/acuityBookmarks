<script setup lang="ts">
import { computed } from 'vue';
import { useManagementStore } from '../../stores/management-store';
import { storeToRefs } from 'pinia';
import { Dialog, Button, Icon, Spacer, Divider, Tabs } from '../../components/ui';
import type { SettingItem, CleanupSettings } from '../../types/cleanup';

// === 使用 Pinia Store ===
const managementStore = useManagementStore();

// 解构清理相关状态
const { cleanupState } = storeToRefs(managementStore);

// 设置项配置
const settingsConfig: Record<string, { 
  label: string; 
  icon: string; 
  color: string; 
  settings: SettingItem[] 
}> = {
  '404': {
    label: '404链接检测设置',
    icon: 'mdi-link-off',
    color: '#f44336',
    settings: [
      {
        key: 'timeout',
        label: '请求超时时间',
        type: 'slider',
        min: 3,
        max: 30,
        step: 1,
        unit: '秒',
        default: 10,
        description: '检测链接时的超时时间，时间越长检测越准确但速度越慢'
      },
      {
        key: 'skipHttps',
        label: '跳过HTTPS证书错误',
        type: 'switch',
        default: true,
        description: '忽略SSL证书过期或无效的网站'
      },
      {
        key: 'followRedirects',
        label: '跟随重定向',
        type: 'switch', 
        default: true,
        description: '检测301/302重定向链接是否有效'
      },
      {
        key: 'ignoreCors',
        label: '忽略CORS跨域错误',
        type: 'switch',
        default: true,
        description: '推荐开启：跳过由于跨域限制导致的检测失败，避免误判正常网站为404'
      }
    ]
  },
  duplicate: {
    label: '重复书签检测设置',
    icon: 'mdi-content-duplicate',
    color: '#ff9800',
    settings: [
      {
        key: 'compareUrl',
        label: '比较URL',
        type: 'switch',
        default: true,
        description: '基于完整URL查找重复书签'
      },
      {
        key: 'compareTitle',
        label: '比较标题',
        type: 'switch',
        default: false,
        description: '同时比较书签标题的相似度'
      },
      {
        key: 'titleSimilarity',
        label: '标题相似度阈值',
        type: 'slider',
        min: 0.5,
        max: 1.0,
        step: 0.1,
        unit: '',
        default: 0.8,
        description: '标题相似度超过此阈值才认为是重复',
        dependsOn: 'compareTitle'
      },
      {
        key: 'keepNewest',
        label: '保留策略',
        type: 'radio',
        options: [
          { value: 'newest', label: '保留最新添加的' },
          { value: 'oldest', label: '保留最早添加的' },
          { value: 'manual', label: '手动选择' }
        ],
        default: 'newest',
        description: '发现重复时的保留策略'
      }
    ]
  },
  empty: {
    label: '空文件夹检测设置',
    icon: 'mdi-folder-outline',
    color: '#2196f3',
    settings: [
      {
        key: 'recursive',
        label: '递归清理',
        type: 'switch',
        default: true,
        description: '清理空文件夹后，继续清理因此变空的父文件夹'
      },
      {
        key: 'preserveStructure',
        label: '保留重要文件夹',
        type: 'switch',
        default: true,
        description: '保留书签栏等重要的顶级文件夹结构'
      },
      {
        key: 'minDepth',
        label: '最小深度',
        type: 'slider',
        min: 1,
        max: 5,
        step: 1,
        unit: '层',
        default: 2,
        description: '只清理至少在此深度以下的空文件夹'
      }
    ]
  },
  invalid: {
    label: 'URL格式检测设置',
    icon: 'mdi-alert-circle',
    color: '#9c27b0',
    settings: [
      {
        key: 'checkProtocol',
        label: '检查协议',
        type: 'switch',
        default: true,
        description: '检测缺失或无效的协议(http/https)'
      },
      {
        key: 'checkDomain',
        label: '检查域名格式',
        type: 'switch',
        default: true,
        description: '检测域名格式是否正确'
      },
      {
        key: 'allowLocalhost',
        label: '允许本地地址',
        type: 'switch',
        default: false,
        description: '允许localhost和内网IP地址'
      }
    ]
  }
};

// 当前活跃的设置标签
const activeTab = computed({
  get: () => cleanupState.value?.settingsTab || '404',
  set: (tab: string) => managementStore.setCleanupSettingsTab(tab)
});

// 获取设置值
const getSettingValue = (filterType: string, settingKey: string) => {
  if (!cleanupState.value?.settings) return undefined;
  
  const typeKey = filterType as keyof typeof cleanupState.value.settings;
  const settingValue = (cleanupState.value.settings[typeKey] as any)?.[settingKey];
  
  if (settingValue !== undefined) return settingValue;
  
  return settingsConfig[filterType as keyof typeof settingsConfig]?.settings
         ?.find(s => s.key === settingKey)?.default;
};

// 更新设置值
const updateSetting = (filterType: string, settingKey: string, value: any) => {
  managementStore.updateCleanupSetting(filterType as keyof CleanupSettings, value, settingKey);
};

// 重置到默认值
const resetSettings = (filterType: string) => {
  managementStore.resetCleanupSettings(filterType as keyof CleanupSettings);
};

// 检查设置依赖性
const isSettingEnabled = (filterType: string, setting: any) => {
  if (!setting.dependsOn) return true;
  return getSettingValue(filterType, setting.dependsOn);
};

// 设置对话框显示状态
const showSettings = computed({
  get: () => cleanupState.value?.showSettings || false,
  set: (value: boolean) => {
    if (!value) {
      managementStore.hideCleanupSettings();
    }
  }
});

// 生成标签页数据
const tabItems = computed(() => {
  return Object.entries(settingsConfig).map(([key, config]) => ({
    key,
    label: config.label.replace('检测设置', ''),
    icon: config.icon,
    color: config.color
  }));
});
</script>

<template>
  <Dialog 
    v-model:show="showSettings" 
    minWidth="500px"
    maxWidth="800px"
    title="高级设置"
    icon="mdi-cog"
  >
    <div class="cleanup-settings">
      <!-- 设置标签页 -->
      <Tabs 
        v-model="activeTab" 
        :items="tabItems"
        class="settings-tabs"
      >
        <template #tab="{ item }">
          <div class="tab-content">
            <Icon :name="item.icon" :style="{ color: item.color }" :size="16" />
            <span>{{ item.label }}</span>
          </div>
        </template>
      </Tabs>

      <Divider />

      <!-- 设置内容 -->
      <div class="settings-content">
        <div
          v-for="(config, filterType) in settingsConfig"
          :key="filterType"
          v-show="activeTab === filterType"
          class="setting-group"
        >
          <div class="setting-group-header">
            <Icon :name="config.icon" :style="{ color: config.color }" />
            <h3>{{ config.label }}</h3>
            
            <Spacer />
            
            <Button
              size="sm"
              variant="ghost"
              @click="resetSettings(filterType)"
            >
              重置默认
            </Button>
          </div>

          <!-- 设置项列表 -->
          <div class="settings-list">
            <div
              v-for="setting in config.settings"
              :key="setting.key"
              class="setting-item"
              :class="{ 'setting-disabled': !isSettingEnabled(filterType, setting) }"
            >
              <div class="setting-header">
                <label class="setting-label">{{ setting.label }}</label>
                
                <!-- 不同类型的设置控件 -->
                <div class="setting-control">
                  <!-- 开关 -->
                  <label v-if="setting.type === 'switch'" class="switch">
                    <input
                      type="checkbox"
                      :checked="getSettingValue(filterType, setting.key)"
                      @change="updateSetting(filterType, setting.key, ($event.target as HTMLInputElement).checked)"
                      :disabled="!isSettingEnabled(filterType, setting)"
                    />
                    <span class="slider"></span>
                  </label>
                  
                  <!-- 滑块 -->
                  <div v-else-if="setting.type === 'slider'" class="slider-container">
                    <input
                      type="range"
                      :value="getSettingValue(filterType, setting.key)"
                      @input="updateSetting(filterType, setting.key, Number(($event.target as HTMLInputElement).value))"
                      :min="setting.min"
                      :max="setting.max"
                      :step="setting.step"
                      :disabled="!isSettingEnabled(filterType, setting)"
                      class="range-slider"
                    />
                    <span class="slider-value">{{ getSettingValue(filterType, setting.key) }}{{ setting.unit }}</span>
                  </div>
                  
                  <!-- 单选组 -->
                  <div v-else-if="setting.type === 'radio'" class="radio-group">
                    <label
                      v-for="option in setting.options"
                      :key="option.value"
                      class="radio-option"
                    >
                      <input
                        type="radio"
                        :name="`${filterType}-${setting.key}`"
                        :value="option.value"
                        :checked="getSettingValue(filterType, setting.key) === option.value"
                        @change="updateSetting(filterType, setting.key, option.value)"
                        :disabled="!isSettingEnabled(filterType, setting)"
                      />
                      <span class="radio-label">{{ option.label }}</span>
                    </label>
                  </div>
                </div>
              </div>
              
              <div v-if="setting.description" class="setting-description">
                {{ setting.description }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <template #actions>
      <Button
        variant="ghost"
        @click="managementStore.hideCleanupSettings"
      >
        关闭
      </Button>
      
      <Button
        color="primary"
        @click="managementStore.saveCleanupSettings"
      >
        保存设置
      </Button>
    </template>
  </Dialog>
</template>

<style scoped>
.cleanup-settings {
  max-width: 100%;
}

.settings-tabs {
  margin-bottom: var(--spacing-md);
}

.tab-content {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  font-size: var(--text-sm);
}

.settings-content {
  max-height: 500px;
  overflow-y: auto;
  padding: var(--spacing-lg);
}

.setting-group {
  width: 100%;
}

.setting-group-header {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-lg);
  padding-bottom: var(--spacing-md);
  border-bottom: 1px solid var(--color-border);
}

.setting-group-header h3 {
  margin: 0;
  font-size: var(--text-lg);
  font-weight: var(--font-medium);
  color: var(--color-text-primary);
}

.settings-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
}

.setting-item {
  transition: opacity 0.2s ease;
}

.setting-disabled {
  opacity: 0.5;
  pointer-events: none;
}

.setting-header {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-lg);
  margin-bottom: var(--spacing-sm);
}

.setting-label {
  font-weight: var(--font-medium);
  color: var(--color-text-primary);
  min-width: 140px;
  padding-top: var(--spacing-sm);
  font-size: var(--text-sm);
}

.setting-control {
  flex: 1;
  max-width: 300px;
}

/* 开关样式 */
.switch {
  position: relative;
  display: inline-block;
  width: 50px;
  height: 24px;
}

.switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.switch .slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: var(--color-border);
  transition: 0.3s;
  border-radius: 24px;
}

.switch .slider:before {
  position: absolute;
  content: "";
  height: 18px;
  width: 18px;
  left: 3px;
  bottom: 3px;
  background-color: white;
  transition: 0.3s;
  border-radius: 50%;
  box-shadow: var(--shadow-sm);
}

.switch input:checked + .slider {
  background-color: var(--color-primary);
}

.switch input:checked + .slider:before {
  transform: translateX(26px);
}

/* 滑块样式 */
.slider-container {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
}

.range-slider {
  flex: 1;
  height: 6px;
  border-radius: 3px;
  background: var(--color-border);
  outline: none;
  -webkit-appearance: none;
}

.range-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--color-primary);
  cursor: pointer;
  box-shadow: var(--shadow-sm);
}

.range-slider::-moz-range-thumb {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--color-primary);
  cursor: pointer;
  border: none;
  box-shadow: var(--shadow-sm);
}

.slider-value {
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
  min-width: 60px;
  text-align: right;
}

/* 单选组样式 */
.radio-group {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.radio-option {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  cursor: pointer;
  font-size: var(--text-sm);
}

.radio-option input[type="radio"] {
  accent-color: var(--color-primary);
}

.radio-label {
  color: var(--color-text-primary);
}

.setting-description {
  font-size: var(--text-xs);
  color: var(--color-text-secondary);
  margin-left: calc(140px + var(--spacing-lg));
  line-height: var(--line-height-relaxed);
}
</style>
