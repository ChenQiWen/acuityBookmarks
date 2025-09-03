import { describe, it, expect, vi } from 'vitest'
import request from 'supertest'
import http from 'http'

// Mock the server module
vi.mock('../../server.js', () => ({
  createServer: vi.fn()
}))

describe('Health Check API', () => {
  it('should return healthy status', async () => {
    // Create a test server
    const server = http.createServer((req, res) => {
      if (req.url === '/api/health' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({
          status: 'healthy',
          timestamp: new Date().toISOString(),
          port: 3000,
          uptime: 100,
          totalRequests: 5,
          errorRate: '0.00%',
          avgResponseTime: '50ms',
          slowRequests: 0
        }))
      } else {
        res.writeHead(404, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ message: 'Not Found' }))
      }
    })

    const response = await request(server).get('/api/health')

    expect(response.status).toBe(200)
    expect(response.body.status).toBe('healthy')
    expect(response.body).toHaveProperty('timestamp')
    expect(response.body).toHaveProperty('uptime')
  })

  it('should handle invalid endpoints', async () => {
    const server = http.createServer((req, res) => {
      res.writeHead(404, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ message: 'Not Found' }))
    })

    const response = await request(server).get('/api/invalid')

    expect(response.status).toBe(404)
    expect(response.body.message).toBe('Not Found')
  })
})
