import { beforeAll, afterAll, vi } from 'vitest'

// Mock environment variables
process.env.NODE_ENV = 'test'
process.env.GEMINI_API_KEY = 'test-api-key'

// Mock external services
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

// Mock file system for testing
vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  access: vi.fn(),
  mkdir: vi.fn(),
  readdir: vi.fn(),
  stat: vi.fn()
}))

// Mock path module
vi.mock('path', () => ({
  join: vi.fn((...args) => args.join('/')),
  dirname: vi.fn((path) => path.split('/').slice(0, -1).join('/')),
  resolve: vi.fn((...args) => args.join('/'))
}))

// Mock URL and fileURLToPath
vi.mock('url', () => ({
  fileURLToPath: vi.fn((url) => url.replace('file://', '')),
  URL: vi.fn()
}))

// Global test setup
beforeAll(() => {
  // Any global setup can go here
})

afterAll(() => {
  // Cleanup after all tests
  vi.clearAllMocks()
})
