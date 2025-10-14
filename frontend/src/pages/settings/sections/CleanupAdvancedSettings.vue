<template>
  <Card>
    <template #header>
      <div class="title-row">
        <Icon name="mdi-broom" />
        <span>清理 · 高级设置</span>
      </div>
    </template>

    <div class="settings-group">
      <h3 class="group-title">404 链接检测</h3>
      <div class="row">
        <div class="label">请求超时时间</div>
        <div class="field">
          <input
            type="range"
            min="3"
            max="30"
            step="1"
            :value="timeout"
            class="range-slider"
            @input="onTimeout($event)"
          />
          <span class="slider-value">{{ timeout }}秒</span>
        </div>
      </div>
      <div class="row">
        <div class="label">跳过HTTPS证书错误</div>
        <div class="field"><Switch v-model="skipHttps" /></div>
      </div>
      <div class="row">
        <div class="label">跟随重定向</div>
        <div class="field"><Switch v-model="followRedirects" /></div>
      </div>
      <div class="row">
        <div class="label">忽略CORS跨域错误</div>
        <div class="field"><Switch v-model="ignoreCors" /></div>
      </div>

      <Divider />

      <h3 class="group-title">重复书签</h3>
      <div class="row">
        <div class="label">比较URL</div>
        <div class="field"><Switch v-model="compareUrl" /></div>
      </div>
      <div class="row">
        <div class="label">比较标题</div>
        <div class="field"><Switch v-model="compareTitle" /></div>
      </div>
      <div class="row">
        <div class="label">标题相似度阈值</div>
        <div class="field">
          <input
            type="range"
            min="0.5"
            max="1.0"
            step="0.1"
            :value="titleSimilarity"
            class="range-slider"
            @input="onTitleSim($event)"
          />
          <span class="slider-value">{{ titleSimilarity }}</span>
        </div>
      </div>

      <div class="row">
        <div class="label">保留策略</div>
        <div class="field options">
          <label
            ><input v-model="keepStrategy" type="radio" value="newest" />
            保留最新</label
          >
          <label
            ><input v-model="keepStrategy" type="radio" value="oldest" />
            保留最早</label
          >
          <label
            ><input v-model="keepStrategy" type="radio" value="manual" />
            手动选择</label
          >
        </div>
      </div>

      <Divider />

      <h3 class="group-title">空文件夹</h3>
      <div class="row">
        <div class="label">递归清理</div>
        <div class="field"><Switch v-model="recursive" /></div>
      </div>
      <div class="row">
        <div class="label">保留重要文件夹</div>
        <div class="field"><Switch v-model="preserveStructure" /></div>
      </div>
      <div class="row">
        <div class="label">最小深度</div>
        <div class="field">
          <input
            type="range"
            min="1"
            max="5"
            step="1"
            :value="minDepth"
            class="range-slider"
            @input="onMinDepth($event)"
          />
          <span class="slider-value">{{ minDepth }}层</span>
        </div>
      </div>

      <Divider />

      <h3 class="group-title">URL 格式</h3>
      <div class="row">
        <div class="label">检查协议</div>
        <div class="field"><Switch v-model="checkProtocol" /></div>
      </div>
      <div class="row">
        <div class="label">检查域名格式</div>
        <div class="field"><Switch v-model="checkDomain" /></div>
      </div>
      <div class="row">
        <div class="label">允许本地地址</div>
        <div class="field"><Switch v-model="allowLocalhost" /></div>
      </div>

      <div class="actions">
        <Button variant="ghost" @click="resetAll">重置默认</Button>
        <Spacer />
        <Button color="primary" @click="saveAll">保存设置</Button>
      </div>
    </div>
  </Card>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Button, Card, Divider, Icon, Spacer, Switch } from '@/components/ui'
import { useCleanupStore } from '@/stores'

const cleanupStore = useCleanupStore()

const settings = computed(() => cleanupStore.cleanupState.settings)

// 404
const timeout = computed({
  get: () => settings.value?.['404'].timeout ?? 10,
  set: v =>
    cleanupStore.updateCleanupSettings({
      '404': {
        ...settings.value?.['404'],
        timeout: v
      }
    })
})
const skipHttps = computed({
  get: () => settings.value?.['404'].skipHttps ?? true,
  set: v =>
    cleanupStore.updateCleanupSettings({
      '404': {
        ...settings.value?.['404'],
        skipHttps: v
      }
    })
})
const followRedirects = computed({
  get: () => settings.value?.['404'].followRedirects ?? true,
  set: v =>
    cleanupStore.updateCleanupSettings({
      '404': {
        ...settings.value?.['404'],
        followRedirects: v
      }
    })
})
const ignoreCors = computed({
  get: () => settings.value?.['404'].ignoreCors ?? true,
  set: v =>
    cleanupStore.updateCleanupSettings({
      '404': {
        ...settings.value?.['404'],
        ignoreCors: v
      }
    })
})

// duplicate
const compareUrl = computed({
  get: () => settings.value?.duplicate.compareUrl ?? true,
  set: v =>
    cleanupStore.updateCleanupSettings({
      duplicate: {
        ...settings.value?.duplicate,
        compareUrl: v
      }
    })
})
const compareTitle = computed({
  get: () => settings.value?.duplicate.compareTitle ?? false,
  set: v =>
    cleanupStore.updateCleanupSettings({
      duplicate: {
        ...settings.value?.duplicate,
        compareTitle: v
      }
    })
})
const titleSimilarity = computed({
  get: () => settings.value?.duplicate.titleSimilarity ?? 0.8,
  set: v =>
    cleanupStore.updateCleanupSettings({
      duplicate: {
        ...settings.value?.duplicate,
        titleSimilarity: v
      }
    })
})
const keepStrategy = computed({
  get: () => settings.value?.duplicate.keepNewest ?? 'newest',
  set: (v: 'newest' | 'oldest' | 'manual') => {
    cleanupStore.updateCleanupSettings({
      duplicate: {
        ...settings.value?.duplicate,
        keepNewest: v
      }
    })
  }
})

// empty
const recursive = computed({
  get: () => settings.value?.empty.recursive ?? true,
  set: v =>
    cleanupStore.updateCleanupSettings({
      empty: {
        ...settings.value?.empty,
        recursive: v
      }
    })
})
const preserveStructure = computed({
  get: () => settings.value?.empty.preserveStructure ?? true,
  set: v =>
    cleanupStore.updateCleanupSettings({
      empty: {
        ...settings.value?.empty,
        preserveStructure: v
      }
    })
})
const minDepth = computed({
  get: () => settings.value?.empty.minDepth ?? 2,
  set: v =>
    cleanupStore.updateCleanupSettings({
      empty: {
        ...settings.value?.empty,
        minDepth: v
      }
    })
})

// invalid
const checkProtocol = computed({
  get: () => settings.value?.invalid.checkProtocol ?? true,
  set: v =>
    cleanupStore.updateCleanupSettings({
      invalid: {
        ...settings.value?.invalid,
        checkProtocol: v
      }
    })
})
const checkDomain = computed({
  get: () => settings.value?.invalid.checkDomain ?? true,
  set: v =>
    cleanupStore.updateCleanupSettings({
      invalid: {
        ...settings.value?.invalid,
        checkDomain: v
      }
    })
})
const allowLocalhost = computed({
  get: () => settings.value?.invalid.allowLocalhost ?? false,
  set: v =>
    cleanupStore.updateCleanupSettings({
      invalid: {
        ...settings.value?.invalid,
        allowLocalhost: v
      }
    })
})

function onTimeout(e: Event) {
  cleanupStore.updateCleanupSettings({
    '404': {
      ...settings.value?.['404'],
      timeout: Number((e.target as HTMLInputElement).value)
    }
  })
}
function onTitleSim(e: Event) {
  cleanupStore.updateCleanupSettings({
    duplicate: {
      ...settings.value?.duplicate,
      titleSimilarity: Number((e.target as HTMLInputElement).value)
    }
  })
}
function onMinDepth(e: Event) {
  cleanupStore.updateCleanupSettings({
    empty: {
      ...settings.value?.empty,
      minDepth: Number((e.target as HTMLInputElement).value)
    }
  })
}

function resetAll() {
  cleanupStore.resetCleanupState()
}
function saveAll() {
  /* store 管理自身持久化，调用 reset/update 已同步到本地存储 */
}
</script>

<style scoped>
.title-row {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 600;
}
.settings-group {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.group-title {
  font-size: 1.05rem;
  margin: var(--spacing-sm) 0;
  color: var(--color-text-primary);
}
.row {
  display: flex;
  align-items: center;
  gap: 20px;
}
.label {
  width: 160px;
  color: var(--color-text-secondary);
}
.field {
  display: flex;
  align-items: center;
  gap: 12px;
}
.field.options {
  gap: 18px;
}
.actions {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 12px;
}
.range-slider {
  width: 220px;
}
.slider-value {
  color: var(--color-text-secondary);
}
</style>
