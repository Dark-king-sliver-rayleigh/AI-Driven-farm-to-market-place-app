import { describe, it, expect } from 'vitest'
import { convertUnit, formatCurrency } from './units'

describe('Unit Conversion', () => {
  it('should convert kg to lb', () => {
    const result = convertUnit(1, 'kg', 'lb')
    expect(result).toBeCloseTo(2.20462, 5)
  })

  it('should convert lb to kg', () => {
    const result = convertUnit(1, 'lb', 'kg')
    expect(result).toBeCloseTo(0.453592, 5)
  })

  it('should convert kg to quintal', () => {
    const result = convertUnit(100, 'kg', 'quintal')
    expect(result).toBe(1)
  })

  it('should convert quintal to ton', () => {
    const result = convertUnit(10, 'quintal', 'ton')
    expect(result).toBe(1)
  })

  it('should return same value for same unit', () => {
    const result = convertUnit(100, 'kg', 'kg')
    expect(result).toBe(100)
  })

  it('should throw error for invalid units', () => {
    expect(() => convertUnit(100, 'kg', 'invalid')).toThrow()
  })
})

describe('Currency Formatting', () => {
  it('should format INR currency', () => {
    const result = formatCurrency(1000, 'INR')
    expect(result).toContain('₹')
    expect(result).toContain('1,000')
  })

  it('should format USD currency', () => {
    const result = formatCurrency(1000, 'USD')
    expect(result).toContain('$')
    expect(result).toContain('1,000')
  })

  it('should default to INR if currency not specified', () => {
    const result = formatCurrency(1000)
    expect(result).toContain('₹')
  })

  it('should handle decimal values', () => {
    const result = formatCurrency(1234.56, 'INR')
    expect(result).toContain('1,234.56')
  })
})


