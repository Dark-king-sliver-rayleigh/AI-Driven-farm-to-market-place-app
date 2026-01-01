import { describe, it, expect } from 'vitest'
import {
  productsReducer,
  ordersReducer,
  farmersReducer,
  transactionsReducer,
  uiReducer,
} from './reducers'

describe('Products Reducer', () => {
  it('should load products', () => {
    const products = [{ id: '1', name: 'Tomato' }]
    const action = { type: 'PRODUCTS_LOAD', payload: products }
    const result = productsReducer([], action)
    expect(result).toEqual(products)
  })

  it('should add a product', () => {
    const product = { id: '1', name: 'Tomato' }
    const action = { type: 'PRODUCT_ADD', payload: product }
    const result = productsReducer([], action)
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual(product)
  })

  it('should update a product', () => {
    const initialState = [{ id: '1', name: 'Tomato', quantity: 100 }]
    const action = {
      type: 'PRODUCT_UPDATE',
      payload: { id: '1', name: 'Organic Tomato', quantity: 150 },
    }
    const result = productsReducer(initialState, action)
    expect(result[0].name).toBe('Organic Tomato')
    expect(result[0].quantity).toBe(150)
    expect(result[0].updatedAt).toBeDefined()
  })

  it('should delete a product', () => {
    const initialState = [
      { id: '1', name: 'Tomato' },
      { id: '2', name: 'Wheat' },
    ]
    const action = { type: 'PRODUCT_DELETE', payload: '1' }
    const result = productsReducer(initialState, action)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('2')
  })
})

describe('Orders Reducer', () => {
  it('should load orders', () => {
    const orders = [{ id: '1', status: 'PENDING' }]
    const action = { type: 'ORDERS_LOAD', payload: orders }
    const result = ordersReducer([], action)
    expect(result).toEqual(orders)
  })

  it('should add an order', () => {
    const order = { id: '1', status: 'PENDING' }
    const action = { type: 'ORDER_ADD', payload: order }
    const result = ordersReducer([], action)
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual(order)
  })

  it('should update an order', () => {
    const initialState = [{ id: '1', status: 'PENDING' }]
    const action = {
      type: 'ORDER_UPDATE',
      payload: { id: '1', status: 'ACCEPTED' },
    }
    const result = ordersReducer(initialState, action)
    expect(result[0].status).toBe('ACCEPTED')
  })

  it('should add negotiation message', () => {
    const initialState = [{ id: '1', negotiation: [] }]
    const message = { from: 'consumer', message: 'Can we negotiate?' }
    const action = {
      type: 'ORDER_ADD_NEGOTIATION',
      payload: { orderId: '1', message },
    }
    const result = ordersReducer(initialState, action)
    expect(result[0].negotiation).toHaveLength(1)
    expect(result[0].negotiation[0]).toEqual(message)
  })
})

describe('Farmers Reducer', () => {
  it('should load farmers', () => {
    const farmers = [{ id: '1', name: 'John' }]
    const action = { type: 'FARMERS_LOAD', payload: farmers }
    const result = farmersReducer([], action)
    expect(result).toEqual(farmers)
  })

  it('should update a farmer', () => {
    const initialState = [{ id: '1', name: 'John', phone: '123' }]
    const action = {
      type: 'FARMER_UPDATE',
      payload: { id: '1', name: 'John Doe', phone: '456' },
    }
    const result = farmersReducer(initialState, action)
    expect(result[0].name).toBe('John Doe')
    expect(result[0].phone).toBe('456')
  })
})

describe('Transactions Reducer', () => {
  it('should load transactions', () => {
    const transactions = [{ id: '1', amount: 1000 }]
    const action = { type: 'TRANSACTIONS_LOAD', payload: transactions }
    const result = transactionsReducer([], action)
    expect(result).toEqual(transactions)
  })

  it('should add a transaction', () => {
    const transaction = { id: '1', amount: 1000 }
    const action = { type: 'TRANSACTION_ADD', payload: transaction }
    const result = transactionsReducer([], action)
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual(transaction)
  })
})

describe('UI Reducer', () => {
  it('should set current user', () => {
    const user = { id: '1', role: 'farmer' }
    const action = { type: 'UI_SET_USER', payload: user }
    const result = uiReducer({ currentUser: null }, action)
    expect(result.currentUser).toEqual(user)
  })

  it('should clear current user', () => {
    const initialState = { currentUser: { id: '1', role: 'farmer' } }
    const action = { type: 'UI_CLEAR_USER' }
    const result = uiReducer(initialState, action)
    expect(result.currentUser).toBeNull()
  })
})


