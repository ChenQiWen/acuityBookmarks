/**
 * Immer 辅助函数测试
 */

import { describe, it, expect } from 'vitest'
import { ref } from 'vue'
import { updateRef, updateMap, updateArray } from '../immer-helpers'

describe('Immer Helpers', () => {
  describe('updateRef', () => {
    it('应该更新嵌套对象', () => {
      const state = ref({
        user: {
          profile: {
            name: 'Alice',
            age: 30
          }
        }
      })

      updateRef(state, draft => {
        draft.user.profile.age = 31
      })

      expect(state.value.user.profile.age).toBe(31)
      expect(state.value.user.profile.name).toBe('Alice')
    })

    it('应该保持未修改部分的引用不变', () => {
      const state = ref({
        a: { value: 1 },
        b: { value: 2 }
      })

      const originalB = state.value.b

      updateRef(state, draft => {
        draft.a.value = 10
      })

      expect(state.value.a.value).toBe(10)
      expect(state.value.b).toBe(originalB) // 引用未变
    })
  })

  describe('updateMap', () => {
    it('应该更新 Map 中的值', () => {
      const map = ref(
        new Map([
          ['key1', { title: 'Item 1' }],
          ['key2', { title: 'Item 2' }]
        ])
      )

      updateMap(map, draft => {
        const item = draft.get('key1')
        if (item) {
          item.title = 'Updated Item 1'
        }
      })

      expect(map.value.get('key1')?.title).toBe('Updated Item 1')
      expect(map.value.get('key2')?.title).toBe('Item 2')
    })

    it('应该支持添加和删除 Map 项', () => {
      const map = ref(
        new Map<string, number>([
          ['a', 1],
          ['b', 2]
        ])
      )

      updateMap(map, draft => {
        draft.set('c', 3)
        draft.delete('a')
      })

      expect(map.value.has('a')).toBe(false)
      expect(map.value.get('c')).toBe(3)
      expect(map.value.size).toBe(2)
    })
  })

  describe('updateArray', () => {
    it('应该更新数组元素', () => {
      const list = ref([
        { id: 1, completed: false },
        { id: 2, completed: false }
      ])

      updateArray(list, draft => {
        draft[0].completed = true
      })

      expect(list.value[0].completed).toBe(true)
      expect(list.value[1].completed).toBe(false)
    })

    it('应该支持数组操作（push/splice）', () => {
      const list = ref([1, 2, 3])

      updateArray(list, draft => {
        draft.push(4)
        draft.splice(1, 1) // 删除索引 1 的元素
      })

      expect(list.value).toEqual([1, 3, 4])
    })

    it('应该支持数组排序', () => {
      const list = ref([3, 1, 2])

      updateArray(list, draft => {
        draft.sort((a, b) => a - b)
      })

      expect(list.value).toEqual([1, 2, 3])
    })
  })

  describe('复杂场景', () => {
    it('应该处理深层嵌套的树形结构', () => {
      const tree = ref({
        id: '1',
        title: 'Root',
        children: [
          {
            id: '2',
            title: 'Child 1',
            children: [{ id: '3', title: 'Grandchild 1' }]
          }
        ]
      })

      updateRef(tree, draft => {
        draft.children[0].children[0].title = 'Updated Grandchild'
      })

      expect(tree.value.children[0].children[0].title).toBe(
        'Updated Grandchild'
      )
    })
  })
})
