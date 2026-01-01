import { describe, it, expect } from 'vitest'
import { ordersReducer } from '../src/store/reducers'

describe('ordersReducer', () => {
  it('should create order with escrowStatus HELD', () => {
    const initialState = []
    const order = {
      id: 'order-1',
      productId: 'p1',
      consumerId: 'u1',
      quantity: 10,
      unit: 'kg',
      totalPrice: 1000,
      currency: 'INR',
      status: 'PENDING',
      escrowStatus: 'HELD',
      negotiation: [],
      assignedLogisticsId: null,
      deliveryAudit: [],
      createdAt: new Date().toISOString(),
    }

    const action = {
      type: 'ORDER_ADD',
      payload: order,
    }

    const result = ordersReducer(initialState, action)
    expect(result).toHaveLength(1)
    expect(result[0].escrowStatus).toBe('HELD')
  })
})

