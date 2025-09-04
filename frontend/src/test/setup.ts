import { beforeAll, afterAll, vi } from 'vitest'

// Mock Chrome API for testing
const mockChrome = {
  runtime: {
    sendMessage: vi.fn(),
    onMessage: {
      addListener: vi.fn(),
      removeListener: vi.fn()
    }
  },
  storage: {
    local: {
      get: vi.fn(),
      set: vi.fn(),
      remove: vi.fn()
    },
    sync: {
      get: vi.fn(),
      set: vi.fn(),
      remove: vi.fn()
    }
  },
  bookmarks: {
    getTree: vi.fn(),
    create: vi.fn(),
    remove: vi.fn(),
    update: vi.fn(),
    move: vi.fn(),
    search: vi.fn()
  },
  tabs: {
    query: vi.fn(),
    create: vi.fn(),
    update: vi.fn()
  },
  windows: {
    create: vi.fn(),
    update: vi.fn()
  }
}

// Setup global mocks
Object.defineProperty(window, 'chrome', {
  value: mockChrome,
  writable: true
})

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))

// Mock CSS files
vi.mock('*.css', () => ({}))

// Mock Vue files for components not being tested
vi.mock('*.vue', () => ({
  default: {
    name: 'MockComponent',
    template: '<div>Mock Component</div>'
  }
}))

// Global test setup
beforeAll(() => {
  // Any global setup can go here
})

afterAll(() => {
  // Cleanup after all tests
  vi.clearAllMocks()
})
