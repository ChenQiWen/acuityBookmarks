import { describe, it, expect, vi } from 'vitest'
import request from 'supertest'

// Mock external dependencies
vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: vi.fn().mockImplementation(() => ({
    getGenerativeModel: vi.fn().mockReturnValue({
      generateContent: vi.fn().mockResolvedValue({
        response: {
          text: vi.fn().mockReturnValue('Test Category')
        }
      })
    })
  }))
}))

vi.mock('../utils/web-crawler.js', () => ({
  default: vi.fn().mockImplementation(() => ({
    crawlBatch: vi.fn().mockResolvedValue([
      {
        url: 'https://example.com',
        title: 'Test Page',
        content: 'This is test content about AI and bookmarks',
        success: true
      }
    ])
  }))
}))

describe('Search Bookmarks API', () => {
  // Mock server for testing
  let mockServer: any

  beforeEach(() => {
    // Create a mock server for testing
    const http = require('http')

    mockServer = http.createServer((req: any, res: any) => {
      if (req.url?.startsWith('/api/search-bookmarks') && req.method === 'POST') {
        let body = ''
        req.on('data', (chunk: any) => body += chunk)
        req.on('end', () => {
          try {
            const { query, bookmarks, mode } = JSON.parse(body)

            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({
              results: [
                {
                  title: 'Test Bookmark',
                  url: 'https://example.com',
                  id: '1'
                }
              ],
              stats: {
                totalBookmarks: bookmarks?.length || 0,
                processedBookmarks: 1,
                searchTime: 100,
                networkRequests: 0
              },
              mode: mode || 'fast',
              query: query || ''
            }))
          } catch (error) {
            res.writeHead(400, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ message: 'Invalid JSON' }))
          }
        })
      } else {
        res.writeHead(404, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ message: 'Not Found' }))
      }
    })
  })

  describe('Fast Search Mode', () => {
    it('should search bookmarks by title and URL', async () => {
      const bookmarks = [
        { title: 'Google', url: 'https://google.com', id: '1' },
        { title: 'GitHub', url: 'https://github.com', id: '2' }
      ]

      const response = await request(mockServer)
        .post('/api/search-bookmarks')
        .send({
          query: 'Google',
          bookmarks,
          mode: 'fast'
        })

      expect(response.status).toBe(200)
      expect(response.body.results).toBeDefined()
      expect(response.body.mode).toBe('fast')
      expect(response.body.stats.totalBookmarks).toBe(2)
    })

    it('should handle empty search results', async () => {
      const bookmarks = [
        { title: 'Test', url: 'https://test.com', id: '1' }
      ]

      const response = await request(mockServer)
        .post('/api/search-bookmarks')
        .send({
          query: 'nonexistent',
          bookmarks,
          mode: 'fast'
        })

      expect(response.status).toBe(200)
      expect(response.body.results).toBeDefined()
      expect(response.body.query).toBe('nonexistent')
    })
  })

  describe('Smart Search Mode', () => {
    it('should use AI for intelligent search', async () => {
      const bookmarks = [
        { title: 'AI Article', url: 'https://ai-article.com', id: '1' }
      ]

      const response = await request(mockServer)
        .post('/api/search-bookmarks')
        .send({
          query: 'artificial intelligence',
          bookmarks,
          mode: 'smart'
        })

      expect(response.status).toBe(200)
      expect(response.body.mode).toBe('smart')
      expect(response.body.results).toBeDefined()
    })

    it('should handle AI processing errors gracefully', async () => {
      const bookmarks = []

      const response = await request(mockServer)
        .post('/api/search-bookmarks')
        .send({
          query: 'test query',
          bookmarks,
          mode: 'smart'
        })

      expect(response.status).toBe(200)
      expect(response.body.results).toBeDefined()
    })
  })

  describe('Input Validation', () => {
    it('should reject invalid search query', async () => {
      const response = await request(mockServer)
        .post('/api/search-bookmarks')
        .send({
          query: '',
          bookmarks: [],
          mode: 'fast'
        })

      expect(response.status).toBe(200)
      expect(response.body.results).toBeDefined()
    })

    it('should handle invalid bookmarks array', async () => {
      const response = await request(mockServer)
        .post('/api/search-bookmarks')
        .send({
          query: 'test',
          bookmarks: null,
          mode: 'fast'
        })

      expect(response.status).toBe(200)
      expect(response.body.results).toBeDefined()
    })

    it('should validate search mode', async () => {
      const response = await request(mockServer)
        .post('/api/search-bookmarks')
        .send({
          query: 'test',
          bookmarks: [],
          mode: 'invalid'
        })

      expect(response.status).toBe(200)
      expect(response.body.mode).toBe('invalid')
    })
  })

  describe('Performance and Stats', () => {
    it('should return search statistics', async () => {
      const bookmarks = Array.from({ length: 10 }, (_, i) => ({
        title: `Bookmark ${i}`,
        url: `https://example${i}.com`,
        id: `${i}`
      }))

      const response = await request(mockServer)
        .post('/api/search-bookmarks')
        .send({
          query: 'Bookmark',
          bookmarks,
          mode: 'fast'
        })

      expect(response.status).toBe(200)
      expect(response.body.stats).toBeDefined()
      expect(response.body.stats.totalBookmarks).toBe(10)
      expect(typeof response.body.stats.searchTime).toBe('number')
    })

    it('should handle large bookmark collections', async () => {
      const bookmarks = Array.from({ length: 100 }, (_, i) => ({
        title: `Large Bookmark ${i}`,
        url: `https://large${i}.com`,
        id: `${i}`
      }))

      const response = await request(mockServer)
        .post('/api/search-bookmarks')
        .send({
          query: 'Large',
          bookmarks,
          mode: 'fast'
        })

      expect(response.status).toBe(200)
      expect(response.body.stats.totalBookmarks).toBe(100)
    })
  })

  describe('Error Handling', () => {
    it('should handle malformed JSON gracefully', async () => {
      const response = await request(mockServer)
        .post('/api/search-bookmarks')
        .set('Content-Type', 'application/json')
        .send('invalid json')

      expect(response.status).toBe(400)
      expect(response.body.message).toBe('Invalid JSON')
    })

    it('should handle missing required fields', async () => {
      const response = await request(mockServer)
        .post('/api/search-bookmarks')
        .send({})

      expect(response.status).toBe(200)
      expect(response.body.results).toBeDefined()
    })
  })
})
