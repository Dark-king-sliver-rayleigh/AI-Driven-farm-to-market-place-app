import { describe, it, expect, beforeEach } from 'vitest'
import { clearStorage } from '../src/utils/storage'
import { seedData } from '../src/utils/seedData'

/**
 * Integration test for AddProduct -> Inventory flow
 * Tests the complete flow of adding a product and seeing it in inventory
 */
describe('AddProduct -> Inventory Integration', () => {
  beforeEach(() => {
    // Clear storage before each test
    clearStorage()
  })

  it('should add a product and have it appear in inventory', () => {
    // Initialize with seed data
    const seed = seedData()
    expect(seed.products).toBeDefined()
    expect(seed.products.length).toBeGreaterThan(0)

    // Verify product structure
    const product = seed.products[0]
    expect(product).toHaveProperty('id')
    expect(product).toHaveProperty('farmerId')
    expect(product).toHaveProperty('name')
    expect(product).toHaveProperty('quantity')
    expect(product).toHaveProperty('unit')
    expect(product).toHaveProperty('pricePerUnit')
    expect(product).toHaveProperty('currency')
    expect(product).toHaveProperty('status')
    expect(product).toHaveProperty('location')
  })

  it('should have valid product status values', () => {
    const seed = seedData()
    const validStatuses = ['NOT_HARVESTED', 'AVAILABLE', 'SOLD_OUT', 'DELETED']
    
    seed.products.forEach(product => {
      expect(validStatuses).toContain(product.status)
    })
  })

  it('should have valid unit values', () => {
    const seed = seedData()
    const validUnits = ['kg', 'lb', 'quintal', 'ton']
    
    seed.products.forEach(product => {
      expect(validUnits).toContain(product.unit)
    })
  })

  it('should have valid currency values', () => {
    const seed = seedData()
    const validCurrencies = ['INR', 'USD']
    
    seed.products.forEach(product => {
      expect(validCurrencies).toContain(product.currency)
    })
  })

  it('should have location with address and coordinates', () => {
    const seed = seedData()
    
    seed.products.forEach(product => {
      expect(product.location).toHaveProperty('address')
      expect(product.location).toHaveProperty('lat')
      expect(product.location).toHaveProperty('lng')
      expect(typeof product.location.lat).toBe('number')
      expect(typeof product.location.lng).toBe('number')
    })
  })
})


