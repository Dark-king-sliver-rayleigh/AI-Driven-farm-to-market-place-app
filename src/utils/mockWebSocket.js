/**
 * Mock WebSocket implementation for local development
 * Simulates real-time messaging using an in-memory event bus
 */

class MockWebSocket {
  constructor(url) {
    this.url = url
    this.readyState = WebSocket.CONNECTING
    this.listeners = {
      open: [],
      message: [],
      error: [],
      close: [],
    }
    
    // Simulate connection
    setTimeout(() => {
      this.readyState = WebSocket.OPEN
      this.listeners.open.forEach(fn => fn())
    }, 100)
  }

  addEventListener(event, callback) {
    if (this.listeners[event]) {
      this.listeners[event].push(callback)
    }
  }

  removeEventListener(event, callback) {
    if (this.listeners[event]) {
      this.listeners[event] = this.listeners[event].filter(fn => fn !== callback)
    }
  }

  send(data) {
    // In a real implementation, this would send to a server
    // For mock, we'll just echo back after a delay
    setTimeout(() => {
      const message = typeof data === 'string' ? JSON.parse(data) : data
      this.listeners.message.forEach(fn => {
        fn({ data: JSON.stringify(message) })
      })
    }, 50)
  }

  close() {
    this.readyState = WebSocket.CLOSED
    this.listeners.close.forEach(fn => fn())
  }
}

// Global event bus for cross-component communication
const eventBus = {
  listeners: {},
  on(event, callback) {
    if (!this.listeners[event]) {
      this.listeners[event] = []
    }
    this.listeners[event].push(callback)
  },
  off(event, callback) {
    if (this.listeners[event]) {
      this.listeners[event] = this.listeners[event].filter(fn => fn !== callback)
    }
  },
  emit(event, data) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(callback => callback(data))
    }
  },
}

export { MockWebSocket, eventBus }

