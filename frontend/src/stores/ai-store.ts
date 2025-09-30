import { defineStore } from 'pinia';

export interface AIStatusState {
  provider: 'unknown' | 'chrome' | 'cloudflare';
  model: string;
  lastUpdated: number;
  availability: 'unknown' | 'unsupported' | 'after_download' | 'readily';
  downloading: boolean;
  latencyMs?: number;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

export const useAIStore = defineStore('ai', {
  state: (): AIStatusState => ({
    provider: 'unknown',
    model: '',
    lastUpdated: 0,
    availability: 'unknown',
    downloading: false,
    latencyMs: undefined,
    promptTokens: undefined,
    completionTokens: undefined,
    totalTokens: undefined,
  }),
  getters: {
    displayName(state): string {
      if (state.provider === 'unknown') {
        switch (state.availability) {
          case 'unsupported':
            return 'Chrome内置AI（不可用）';
          case 'after_download':
            return 'Chrome内置AI（下载中）';
          default:
            return 'AI状态未知';
        }
      }
      const providerLabel = state.provider === 'chrome' ? 'Chrome内置AI' : 'Cloudflare AI';
      const modelLabel = state.model ? ` · ${state.model}` : '';
      return `${providerLabel}${modelLabel}`;
    },
    providerColor(state): string {
      switch (state.provider) {
        case 'chrome':
          return '#007aff';
        case 'cloudflare':
          return '#5c6bc0';
        default:
          return '#9e9e9e';
      }
    },
    tooltip(state): string {
      const lines: string[] = [];
      lines.push(`提供方: ${state.provider === 'chrome' ? 'Chrome内置AI' : state.provider === 'cloudflare' ? 'Cloudflare AI' : '未知'}`);
      if (state.model) lines.push(`模型: ${state.model}`);
      if (state.availability && state.provider !== 'cloudflare') {
        const map: Record<string, string> = { unsupported: '不可用', after_download: '下载中', readily: '已就绪', unknown: '未知' };
        lines.push(`可用性: ${map[state.availability] || '未知'}`);
      }
      if (typeof state.latencyMs === 'number') lines.push(`延迟: ${Math.round(state.latencyMs)} ms`);
      const tokens = [state.promptTokens, state.completionTokens, state.totalTokens].filter(v => typeof v === 'number').length;
      if (tokens > 0) {
        lines.push(`Tokens: prompt=${state.promptTokens ?? '-'}, completion=${state.completionTokens ?? '-'}, total=${state.totalTokens ?? '-'}`);
      }
      return lines.join('\n');
    }
  },
  actions: {
    setStatus(provider: AIStatusState['provider'], model: string) {
      this.provider = provider;
      this.model = model;
      this.lastUpdated = Date.now();
    },
    setAvailability(status: AIStatusState['availability']) {
      this.availability = status;
      this.downloading = status === 'after_download';
    },
    updateMetrics(detail: any) {
      try {
        const usage = detail?.usage || null;
        this.latencyMs = typeof detail?.latencyMs === 'number' ? detail.latencyMs : undefined;
        this.promptTokens = usage?.prompt_tokens ?? undefined;
        this.completionTokens = usage?.completion_tokens ?? undefined;
        this.totalTokens = usage?.total_tokens ?? undefined;
        // 若事件包含provider/model，也更新状态
        if (detail?.provider && detail?.model) {
          this.setStatus(detail.provider, detail.model);
        }
      } catch {}
    },
    initListener() {
      // 监听统一AI接口分发的提供方变更事件
      window.addEventListener('ai:providerChanged', (evt: Event) => {
        try {
          const detail = (evt as CustomEvent).detail || {};
          const provider = (detail.provider as AIStatusState['provider']) ?? 'unknown';
          const model = (detail.model as string) ?? '';
          this.setStatus(provider, model);
        } catch {
          // 忽略解析错误
        }
      });
      // 监听指标事件（延迟与token用量）
      window.addEventListener('ai:metrics', (evt: Event) => {
        const detail = (evt as CustomEvent).detail || {};
        this.updateMetrics(detail);
      });
    },
    async initAvailability() {
      const ai = (window as any).ai || (globalThis as any).chrome?.ai;
      try {
        const status: string | undefined = await ai?.availability?.();
        if (status && (status === 'unsupported' || status === 'after_download' || status === 'readily')) {
          this.setAvailability(status as AIStatusState['availability']);
          if (status === 'readily') {
            // 已就绪，若尚未设置provider，默认显示chrome
            if (this.provider === 'unknown') {
              this.setStatus('chrome', '');
            }
          }
        } else {
          this.setAvailability('unknown');
        }
      } catch {
        this.setAvailability('unknown');
      }
    },
    startAvailabilityMonitor() {
      const ai = (window as any).ai || (globalThis as any).chrome?.ai;
      try {
        const handler = (state: string) => {
          if (state === 'unsupported' || state === 'after_download' || state === 'readily') {
            this.setAvailability(state as AIStatusState['availability']);
            if (state === 'readily') this.setStatus('chrome', this.model);
            window.dispatchEvent(new CustomEvent('ai:availabilityChanged', { detail: { state } }));
          }
        };
        const subscription = ai?.monitor?.(handler);
        // 可选：保存取消句柄（此处略）
        return subscription;
      } catch {
        // 监控不可用时忽略
        return null;
      }
    },
  },
});