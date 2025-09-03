import { describe, it, expect } from 'vitest'

// 假设你有工具函数，这里是一个示例
const safeTrim = (value: any): string => {
  return String(value || '').trim()
}

const validateUrl = (url: string): boolean => {
  if (!url || typeof url !== 'string') return false
  try {
    const urlObj = new URL(url)
    return urlObj.protocol === 'http:' || urlObj.protocol === 'https:'
  } catch {
    return false
  }
}

describe('Helper Functions', () => {
  describe('safeTrim', () => {
    it('should trim string values', () => {
      expect(safeTrim('  hello  ')).toBe('hello')
      expect(safeTrim('')).toBe('')
      expect(safeTrim(null)).toBe('')
      expect(safeTrim(undefined)).toBe('')
    })

    it('should convert non-string values to string and trim', () => {
      expect(safeTrim(123)).toBe('123')
      expect(safeTrim({})).toBe('[object Object]')
    })
  })

  describe('validateUrl', () => {
    it('should validate correct URLs', () => {
      expect(validateUrl('https://example.com')).toBe(true)
      expect(validateUrl('http://example.com')).toBe(true)
      expect(validateUrl('https://example.com/path')).toBe(true)
    })

    it('should reject invalid URLs', () => {
      expect(validateUrl('')).toBe(false)
      expect(validateUrl(null as any)).toBe(false)
      expect(validateUrl('not-a-url')).toBe(false)
      expect(validateUrl('ftp://example.com')).toBe(false)
    })
  })
})
