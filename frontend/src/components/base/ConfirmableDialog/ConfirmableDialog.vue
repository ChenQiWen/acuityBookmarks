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
import { computed } from 'vue'
import Dialog from '../Dialog/Dialog.vue'
import type {
  ConfirmableDialogProps,
  ConfirmableDialogEmits
} from './ConfirmableDialog.d'

const props = defineProps<ConfirmableDialogProps>()

const emit = defineEmits<ConfirmableDialogEmits>()

const show = computed({
  get: () => (props.show !== undefined ? props.show : props.modelValue),
  set: value => {
    emit('update:modelValue', value)
    emit('update:show', value)
  }
})

const requestClose = (value: boolean) => {
  if (value) {
    show.value = true
    return
  }
  if (props.isDirty) {
    const ok = window.confirm(
      props.confirmMessage || '您有更改尚未提交，确定取消吗？'
    )
    if (!ok) {
      show.value = true
      return
    }
  }
  show.value = false
}

const onUpdateShow = (value: boolean) => {
  requestClose(value)
}

const onConfirm = () => {
  emit('confirm')
}
</script>
