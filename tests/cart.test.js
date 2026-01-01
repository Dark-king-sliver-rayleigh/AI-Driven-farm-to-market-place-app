import { describe, it, expect } from 'vitest'
import { cartReducer } from '../src/store/index'

describe('cartReducer', () => {
  it('should prevent adding to cart when availabilityConfidence is LOW', () => {
    const initialState = []
    const action = {
      type: 'CART_ADD_ITEM',
      payload: {
        productId: 'p1',
        quantity: 1,
        unit: 'kg',
        pricePerUnit: 25,
        currency: 'INR',
        totalPrice: 25,
        availabilityConfidence: 'LOW',
      },
    }

    const result = cartReducer(initialState, action)
    expect(result).toEqual([])
  })

  it('should allow adding to cart when availabilityConfidence is not LOW', () => {
    const initialState = []
    const action = {
      type: 'CART_ADD_ITEM',
      payload: {
        productId: 'p1',
        quantity: 1,
        unit: 'kg',
        pricePerUnit: 25,
        currency: 'INR',
        totalPrice: 25,
        availabilityConfidence: 'HIGH',
      },
    }

    const result = cartReducer(initialState, action)
    expect(result).toHaveLength(1)
    expect(result[0].productId).toBe('p1')
  })
})

