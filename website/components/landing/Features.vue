<template>
  <section class="py-24 relative" id="features">
    <div class="container mx-auto px-4">
      <div class="text-center max-w-3xl mx-auto mb-16">
        <h2 class="text-3xl md:text-4xl font-bold mb-4">
          全能工具箱，<span class="text-primary-400">为效率而生</span>
        </h2>
        <p class="text-content-muted text-lg">
          从个体效率到团队协作，一套工具全部搞定。分层架构保证每个能力模块既可独立启用、也能组合成流畅的知识工作流。
        </p>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <!-- Feature 1: Fast Search (Large) -->
        <Card
          class="md:col-span-2 p-8 relative group overflow-hidden min-h-[300px] flex flex-col justify-between"
        >
          <div class="relative z-10">
            <div
              class="w-12 h-12 bg-primary-500/20 rounded-lg flex items-center justify-center mb-6 text-primary-400"
            >
              <Zap class="w-6 h-6" />
            </div>
            <h3 class="text-2xl font-bold mb-3">极速检索，毫秒级响应</h3>
            <p class="text-content-muted max-w-md">
              多引擎并行架构：关键词、模糊匹配、向量语义同步返回。20K+
              书签也能瞬间定位。
            </p>
            <div class="mt-6 flex gap-3 flex-wrap">
              <Badge variant="outline">Fuse.js</Badge>
              <Badge variant="outline">语义向量</Badge>
              <Badge variant="outline">拼写容错</Badge>
            </div>
          </div>
          <!-- Decorative background element -->
          <div
            class="absolute right-0 bottom-0 w-1/2 h-full bg-gradient-to-l from-primary-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"
          ></div>
        </Card>

        <!-- Feature 2: AI Recommendation (Small) -->
        <Card class="p-8 flex flex-col h-full relative group">
          <div
            class="w-12 h-12 bg-accent-500/20 rounded-lg flex items-center justify-center mb-6 text-accent-400"
          >
            <Brain class="w-6 h-6" />
          </div>
          <h3 class="text-xl font-bold mb-3">本地 AI 智能推荐</h3>
          <p class="text-content-muted mb-4">
            基于 embedding 的上下文推送，自动生成书签摘要与主题。
          </p>
          <div class="mt-auto pt-4 border-t border-white/5">
            <div class="text-xs text-content-subtle flex items-center">
              <Lock class="w-3 h-3 mr-1" /> 数据完全本地处理
            </div>
          </div>
        </Card>

        <!-- Feature 3: Privacy / Local First (Small) -->
        <Card class="p-8 flex flex-col h-full">
          <div
            class="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center mb-6 text-green-400"
          >
            <ShieldCheck class="w-6 h-6" />
          </div>
          <h3 class="text-xl font-bold mb-3">隐私优先设计</h3>
          <p class="text-content-muted">
            核心索引存储在 Chrome storage + IndexedDB，永不离开本机。
          </p>
        </Card>

        <!-- Feature 4: Sync & Collaboration (Large) -->
        <Card class="md:col-span-2 p-8 relative overflow-hidden min-h-[300px]">
          <div
            class="relative z-10 grid md:grid-cols-2 gap-8 items-center h-full"
          >
            <div>
              <div
                class="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center mb-6 text-blue-400"
              >
                <RefreshCw class="w-6 h-6" />
              </div>
              <h3 class="text-2xl font-bold mb-3">多端实时同步</h3>
              <p class="text-content-muted mb-6">
                Chrome storage + Supabase
                双写，变更日志可回放，跨设备实时一致。支持团队共享与协作。
              </p>
              <Badge variant="default">Cloudflare Worker</Badge>
            </div>
            <div
              class="bg-bg-depth/50 rounded-lg p-4 border border-white/5 h-full min-h-[150px]"
            >
              <!-- Abstract representation of sync -->
              <div class="flex items-center justify-between mb-3">
                <div class="flex items-center gap-2">
                  <div class="w-2 h-2 rounded-full bg-green-400"></div>
                  <span class="text-xs text-content-subtle"
                    >Sync Status: Active</span
                  >
                </div>
                <span class="text-xs text-content-muted">Just now</span>
              </div>
              <div class="space-y-2">
                <div class="h-2 bg-white/10 rounded w-3/4"></div>
                <div class="h-2 bg-white/10 rounded w-1/2"></div>
                <div class="h-2 bg-white/10 rounded w-5/6"></div>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { Zap, Brain, ShieldCheck, RefreshCw, Lock } from 'lucide-vue-next'
import Card from '@/components/ui/Card.vue'
import Badge from '@/components/ui/Badge.vue'
</script>
