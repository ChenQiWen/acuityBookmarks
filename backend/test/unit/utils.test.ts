import { describe, it, expect } from 'vitest'

// Test utility functions that would be used in the backend
const validateUrl = (url: string): boolean => {
  if (!url || typeof url !== 'string') return false
  try {
    const urlObj = new URL(url)
    return urlObj.protocol === 'http:' || urlObj.protocol === 'https:'
  } catch {
    return false
  }
}

const sanitizeString = (str: string, maxLength: number = 1000): string => {
  if (!str || typeof str !== 'string') return ''
  return str.trim().substring(0, maxLength).replace(/[<>\"'&]/g, '')
}

const validateBookmark = (bookmark: any): boolean => {
  if (!bookmark || typeof bookmark !== 'object') return false
  return !!(bookmark.title && typeof bookmark.title === 'string' &&
         bookmark.url && typeof bookmark.url === 'string' &&
         validateUrl(bookmark.url))
}

describe('Backend Utilities', () => {
  describe('validateUrl', () => {
    it('should validate correct URLs', () => {
      expect(validateUrl('https://example.com')).toBe(true)
      expect(validateUrl('http://example.com')).toBe(true)
      expect(validateUrl('https://example.com/path?query=value')).toBe(true)
    })

    it('should reject invalid URLs', () => {
      expect(validateUrl('')).toBe(false)
      expect(validateUrl('not-a-url')).toBe(false)
      expect(validateUrl(null as any)).toBe(false)
      expect(validateUrl('ftp://example.com')).toBe(false)
    })
  })

  describe('sanitizeString', () => {
    it('should sanitize string input', () => {
      expect(sanitizeString('<script>alert("xss")</script>')).toBe('scriptalert(xss)/script')
      expect(sanitizeString('  hello world  ')).toBe('hello world')
      expect(sanitizeString('')).toBe('')
    })

    it('should handle edge cases', () => {
      expect(sanitizeString(null as any)).toBe('')
      expect(sanitizeString(undefined as any)).toBe('')
      expect(sanitizeString('a'.repeat(2000))).toHaveLength(1000) // Default max length
    })

    it('should respect max length', () => {
      expect(sanitizeString('hello world', 5)).toBe('hello')
    })
  })

  describe('validateBookmark', () => {
    it('should validate correct bookmarks', () => {
      const validBookmark = {
        title: 'Test Bookmark',
        url: 'https://example.com'
      }
      expect(validateBookmark(validBookmark)).toBe(true)
    })

    it('should reject invalid bookmarks', () => {
      expect(validateBookmark(null)).toBe(false)
      expect(validateBookmark({})).toBe(false)
      expect(validateBookmark({ title: 'Test' })).toBe(false) // Missing URL
      expect(validateBookmark({ url: 'https://example.com' })).toBe(false) // Missing title
      expect(validateBookmark({ title: 'Test', url: 'not-a-url' })).toBe(false) // Invalid URL
    })
  })
})
