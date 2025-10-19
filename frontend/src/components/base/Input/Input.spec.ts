import { h } from 'vue'
import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent, screen } from '@testing-library/vue'
import Input from './Input.vue'

vi.mock('@/components', () => ({
  Icon: {
    render() {
      return h('span', { 'data-testid': 'input-clear-icon' }, '×')
    }
  }
}))

describe('Base/Input', () => {
  it('展示传入的标签与占位符', () => {
    render(Input, {
      props: {
        label: '邮箱',
        placeholder: 'name@example.com'
      }
    })

    expect(screen.getByLabelText('邮箱')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('name@example.com')).toBeInTheDocument()
  })

  it('输入时触发 update:modelValue 事件', async () => {
    const onUpdate = vi.fn()
    render(Input, {
      props: {
        modelValue: '',
        'onUpdate:modelValue': onUpdate
      }
    })

    await fireEvent.update(screen.getByRole('textbox'), 'Acuity')

    expect(onUpdate).toHaveBeenCalledWith('Acuity')
  })

  it('clearable 按钮会清空内容并触发 clear 事件', async () => {
    const onClear = vi.fn()
    const onUpdate = vi.fn()
    render(Input, {
      props: {
        modelValue: '内容',
        clearable: true,
        'onUpdate:modelValue': onUpdate,
        onClear
      }
    })

    const clear = screen.getByTestId('input-clear-icon')
    await fireEvent.click(clear)

    expect(onUpdate).toHaveBeenCalledWith('')
    expect(onClear).toHaveBeenCalled()
  })
})
