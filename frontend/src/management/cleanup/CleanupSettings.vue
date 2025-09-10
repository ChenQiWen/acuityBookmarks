<script setup lang="ts">
import { computed } from 'vue'
import { useManagementStore } from '../../stores/management-store'
import { storeToRefs } from 'pinia'
import type { SettingItem } from '../../types/cleanup'

// === 使用 Pinia Store ===
const managementStore = useManagementStore()

// 解构清理相关状态
const { cleanupState } = storeToRefs(managementStore)

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
        key: 'userAgent',
        label: '用户代理',
        type: 'select',
        options: [
          { value: 'chrome', label: 'Chrome浏览器' },
          { value: 'firefox', label: 'Firefox浏览器' },
          { value: 'safari', label: 'Safari浏览器' },
          { value: 'custom', label: '自定义' }
        ],
        default: 'chrome',
        description: '模拟不同浏览器进行检测'
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
        key: 'ignoreDomain',
        label: '忽略域名差异',
        type: 'switch',
        default: false,
        description: '只比较路径部分，忽略域名差异'
      },
      {
        key: 'keepNewest',
        label: '保留最新书签',
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
      },
      {
        key: 'customPatterns',
        label: '自定义排除模式',
        type: 'textarea',
        placeholder: '每行一个正则表达式\n例如: ^chrome-extension://\n^file:///',
        default: '',
        description: '匹配这些模式的URL将被跳过检测'
      }
    ]
  }
}

// 当前活跃的设置标签
const activeTab = computed({
  get: () => cleanupState.value?.settingsTab || '404',
  set: (tab: string) => managementStore.setCleanupSettingsTab(tab)
})

// 获取设置值
const getSettingValue = (filterType: string, settingKey: string) => {
  if (!cleanupState.value?.settings) return undefined
  
  const typeKey = filterType as keyof typeof cleanupState.value.settings
  const settingValue = (cleanupState.value.settings[typeKey] as any)?.[settingKey]
  
  if (settingValue !== undefined) return settingValue
  
  return settingsConfig[filterType as keyof typeof settingsConfig]?.settings
         ?.find(s => s.key === settingKey)?.default
}

// 更新设置值
const updateSetting = (filterType: string, settingKey: string, value: any) => {
  managementStore.updateCleanupSetting(filterType, settingKey, value)
}

// 重置到默认值
const resetSettings = (filterType: string) => {
  managementStore.resetCleanupSettings(filterType)
}

// 检查设置依赖性
const isSettingEnabled = (filterType: string, setting: any) => {
  if (!setting.dependsOn) return true
  return getSettingValue(filterType, setting.dependsOn)
}

// 设置对话框显示状态
const showSettings = computed({
  get: () => cleanupState.value?.showSettings || false,
  set: (value: boolean) => {
    if (!value) {
      managementStore.hideCleanupSettings()
    }
  }
})
</script>

<template>
  <v-dialog 
    v-model="showSettings" 
    persistent 
    max-width="800px"
    class="cleanup-settings-dialog"
  >
    <v-card class="cleanup-settings">
    <v-card-title class="d-flex align-center">
      <v-icon start>mdi-cog</v-icon>
      高级设置
      
      <v-spacer />
      
      <v-btn
        icon="mdi-close"
        variant="text"
        size="small"
        @click="managementStore.hideCleanupSettings"
      />
    </v-card-title>

    <v-divider />

    <!-- 设置标签页 -->
    <v-tabs v-model="activeTab" class="settings-tabs">
      <v-tab
        v-for="(config, key) in settingsConfig"
        :key="key"
        :value="key"
        class="settings-tab"
      >
        <v-icon :color="config.color" start size="16">
          {{ config.icon }}
        </v-icon>
        {{ config.label.replace('检测设置', '') }}
      </v-tab>
    </v-tabs>

    <!-- 设置内容 -->
    <v-card-text class="settings-content">
      <v-tabs-window v-model="activeTab">
        <v-tabs-window-item
          v-for="(config, filterType) in settingsConfig"
          :key="filterType"
          :value="filterType"
        >
          <div class="setting-group">
            <div class="setting-group-header">
              <v-icon :color="config.color" class="mr-2">
                {{ config.icon }}
              </v-icon>
              <h3>{{ config.label }}</h3>
              
              <v-spacer />
              
              <v-btn
                size="small"
                variant="text"
                @click="resetSettings(filterType)"
              >
                重置默认
              </v-btn>
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
                    <v-switch
                      v-if="setting.type === 'switch'"
                      :model-value="getSettingValue(filterType, setting.key)"
                      @update:model-value="updateSetting(filterType, setting.key, $event)"
                      :disabled="!isSettingEnabled(filterType, setting)"
                      color="primary"
                      density="compact"
                      hide-details
                    />
                    
                    <!-- 滑块 -->
                    <div v-else-if="setting.type === 'slider'" class="slider-container">
                      <v-slider
                        :model-value="getSettingValue(filterType, setting.key)"
                        @update:model-value="updateSetting(filterType, setting.key, $event)"
                        :min="setting.min"
                        :max="setting.max"
                        :step="setting.step"
                        :disabled="!isSettingEnabled(filterType, setting)"
                        thumb-label
                        class="setting-slider"
                        hide-details
                      />
                      <span class="slider-unit">{{ setting.unit }}</span>
                    </div>
                    
                    <!-- 选择器 -->
                    <v-select
                      v-else-if="setting.type === 'select'"
                      :model-value="getSettingValue(filterType, setting.key)"
                      @update:model-value="updateSetting(filterType, setting.key, $event)"
                      :items="setting.options"
                      :disabled="!isSettingEnabled(filterType, setting)"
                      density="compact"
                      hide-details
                      class="setting-select"
                    />
                    
                    <!-- 单选组 -->
                    <v-radio-group
                      v-else-if="setting.type === 'radio'"
                      :model-value="getSettingValue(filterType, setting.key)"
                      @update:model-value="updateSetting(filterType, setting.key, $event)"
                      :disabled="!isSettingEnabled(filterType, setting)"
                      density="compact"
                      hide-details
                    >
                      <v-radio
                        v-for="option in setting.options"
                        :key="option.value"
                        :value="option.value"
                        :label="option.label"
                        density="compact"
                      />
                    </v-radio-group>
                    
                    <!-- 文本域 -->
                    <v-textarea
                      v-else-if="setting.type === 'textarea'"
                      :model-value="getSettingValue(filterType, setting.key)"
                      @update:model-value="updateSetting(filterType, setting.key, $event)"
                      :placeholder="setting.placeholder"
                      :disabled="!isSettingEnabled(filterType, setting)"
                      rows="3"
                      density="compact"
                      hide-details
                    />
                  </div>
                </div>
                
                <div v-if="setting.description" class="setting-description">
                  {{ setting.description }}
                </div>
              </div>
            </div>
          </div>
        </v-tabs-window-item>
      </v-tabs-window>
    </v-card-text>

    <v-divider />
    
    <v-card-actions>
      <v-btn
        variant="text"
        @click="managementStore.hideCleanupSettings"
      >
        关闭
      </v-btn>
      
      <v-spacer />
      
      <v-btn
        color="primary"
        @click="managementStore.saveCleanupSettings"
      >
        保存设置
      </v-btn>
    </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.cleanup-settings {
  max-width: 600px;
  margin: 0 auto;
}

.settings-tabs {
  border-bottom: 1px solid rgba(0, 0, 0, 0.12);
}

.settings-tab {
  min-width: 120px;
}

.settings-content {
  max-height: 500px;
  overflow-y: auto;
}

.setting-group-header {
  display: flex;
  align-items: center;
  margin-bottom: 16px;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.12);
}

.setting-group-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 500;
}

.settings-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.setting-item {
  transition: opacity 0.2s ease;
}

.setting-disabled {
  opacity: 0.5;
}

.setting-header {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 4px;
}

.setting-label {
  font-weight: 500;
  min-width: 120px;
  padding-top: 8px;
}

.setting-control {
  flex: 1;
  max-width: 280px;
}

.slider-container {
  display: flex;
  align-items: center;
  gap: 8px;
}

.setting-slider {
  flex: 1;
}

.slider-unit {
  font-size: 12px;
  color: rgba(0, 0, 0, 0.6);
  min-width: 20px;
}

.setting-select {
  max-width: 200px;
}

.setting-description {
  font-size: 12px;
  color: rgba(0, 0, 0, 0.6);
  margin-left: 136px;
  margin-top: 4px;
  line-height: 1.3;
}
</style>
