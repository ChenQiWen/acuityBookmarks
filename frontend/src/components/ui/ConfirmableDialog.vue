<template>
  <Dialog
    v-bind="$attrs"
    :show="show"
    @update:show="onUpdateShow"
    @confirm="onConfirm"
  >
    <slot />
    <template #actions>
      <slot name="actions" :requestClose="requestClose" />
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import { defineEmits, defineProps } from 'vue'
import { Dialog } from './index'

const props = defineProps<{
  show: boolean
  confirmMessage?: string
  isDirty?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:show', value: boolean): void
  (e: 'confirm'): void
}>()

const requestClose = (value: boolean) => {
  if (value) {
    emit('update:show', true)
    return
  }
  if (props.isDirty) {
    const ok = window.confirm(
      props.confirmMessage || '您有更改尚未提交，确定取消吗？'
    )
    if (!ok) {
      emit('update:show', true)
      return
    }
  }
  emit('update:show', false)
}

const onUpdateShow = (value: boolean) => {
  requestClose(value)
}

const onConfirm = () => {
  emit('confirm')
}
</script>
