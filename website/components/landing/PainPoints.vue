<template>
  <section class="py-24 bg-bg-surface/30 border-y border-white/5">
    <div class="container mx-auto px-4">
      <div class="grid grid-cols-1 md:grid-cols-3 gap-12">
        <div class="md:col-span-1">
          <p
            class="text-accent-400 text-sm tracking-widest uppercase mb-4 font-bold"
          >
            真实痛点
          </p>
          <h2 class="text-3xl font-bold mb-6 leading-tight">
            我们解决最难啃的问题
          </h2>
          <p class="text-content-muted">
            设计 AcuityBookmarks
            的初衷，就是解决「书签堆成山却找不到」、「跨设备无法同步」、「零上下文」等长期痛点。
          </p>
        </div>

        <div class="md:col-span-2 grid gap-6">
          <div v-for="pain in painPoints" :key="pain.title" class="flex gap-4">
            <div
              class="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center shrink-0 mt-1"
            >
              <X class="w-5 h-5 text-red-400" />
            </div>
            <div>
              <h3 class="text-lg font-bold mb-2">{{ pain.title }}</h3>
              <p class="text-content-muted mb-3">{{ pain.description }}</p>
              <div class="flex items-center text-primary-400 text-sm">
                <ArrowRight class="w-4 h-4 mr-2" />
                <span>{{ pain.solution }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { X, ArrowRight } from 'lucide-vue-next'

const painPoints = [
  {
    title: '搜索慢且无序',
    description: '默认书签管理缺乏模糊匹配与分层视图，大量收藏后几乎无法回忆。',
    solution:
      '多索引引擎：Fuse.js + 语义向量 + 标签过滤，一次输入获取上下文结果。'
  },
  {
    title: '同步易丢失',
    description: '浏览器同步经常冲突，团队无法共享最新的工作台与知识结构。',
    solution: 'Chrome storage + Supabase 双写，变更日志可回放，跨设备实时一致。'
  },
  {
    title: '没有推荐与提醒',
    description: '收藏只是起点，真正的难题在于何时、在何种场景提醒你使用。',
    solution: '本地 AI Agent 理解书签语义，结合上下文推荐最合适的链接。'
  }
]
</script>
