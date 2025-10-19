import { h } from 'vue'
import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent, screen } from '@testing-library/vue'
import Button from './Button.vue'

describe('Base/Button', () => {
  it('渲染传入的文案', () => {
    render(
      {
        render() {
          return h(Button, null, { default: () => '保存' })
        }
      },
      {
        global: {
          stubs: {
            AcuityIcon: true
          }
        }
      }
    )

    expect(screen.getByRole('button', { name: '保存' })).toBeInTheDocument()
  })

  it('点击时触发事件', async () => {
    const onClick = vi.fn()
    render(
      {
        render() {
          return h(Button, { onClick }, { default: () => '提交' })
        }
      },
      {
        global: {
          stubs: {
            AcuityIcon: true
          }
        }
      }
    )

    await fireEvent.click(screen.getByRole('button', { name: '提交' }))

    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('加载状态禁用交互', async () => {
    const onClick = vi.fn()
    render(
      {
        render() {
          return h(
            Button,
            { loading: true, onClick },
            { default: () => '处理中' }
          )
        }
      },
      {
        global: {
          stubs: {
            AcuityIcon: true
          }
        }
      }
    )

    const button = screen.getByRole('button', { name: '处理中' })
    expect(button).toBeDisabled()
    expect(button.querySelector('.btn__spinner')).toBeTruthy()

    await fireEvent.click(button)

    expect(onClick).not.toHaveBeenCalled()
  })
})
