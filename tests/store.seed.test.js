import { describe, it, expect } from 'vitest'
import { seedData } from '../src/utils/seedData'

describe('seedData', () => {
  it('should set farmer pendingSyncCount to 1', () => {
    const seed = seedData()
    const farmer = seed.farmers.find((f) => f.id === 'f1')
    expect(farmer).toBeDefined()
    expect(farmer.pendingSyncCount).toBe(1)
  })

  it('should include products with new fields', () => {
    const seed = seedData()
    const product = seed.products.find((p) => p.id === 'p1')
    expect(product).toBeDefined()
    expect(product.source).toBe('SMS')
    expect(product.availabilityConfidence).toBe('LOW')
    expect(product.priceSuggestion).toBeDefined()
    expect(product.priceSuggestion.value).toBe(26)
  })

  it('should include orders with escrowStatus', () => {
    const seed = seedData()
    const order = seed.orders.find((o) => o.id === 'order-1')
    expect(order).toBeDefined()
    expect(order.escrowStatus).toBe('HELD')
  })

  it('should include logistics data', () => {
    const seed = seedData()
    expect(seed.logistics).toBeDefined()
    expect(seed.logistics.length).toBeGreaterThan(0)
  })
})

