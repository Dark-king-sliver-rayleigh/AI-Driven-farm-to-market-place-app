/**
 * Reducers for global state management
 */

// Products reducer
export function productsReducer(state = [], action) {
  switch (action.type) {
    case 'PRODUCTS_LOAD':
      return action.payload
    case 'PRODUCT_ADD':
      return [...state, action.payload]
    case 'PRODUCT_UPDATE':
      return state.map(p => 
        p.id === action.payload.id 
          ? { ...p, ...action.payload, updatedAt: new Date().toISOString() }
          : p
      )
    case 'PRODUCT_DELETE':
      return state.filter(p => p.id !== action.payload)
    default:
      return state
  }
}

// Orders reducer
export function ordersReducer(state = [], action) {
  switch (action.type) {
    case 'ORDERS_LOAD':
      return action.payload
    case 'ORDER_ADD':
      return [...state, action.payload]
    case 'ORDER_UPDATE':
      return state.map(o => 
        o.id === action.payload.id 
          ? { ...o, ...action.payload }
          : o
      )
    case 'ORDER_ADD_NEGOTIATION':
      return state.map(o => {
        if (o.id === action.payload.orderId) {
          return {
            ...o,
            negotiation: [...(o.negotiation || []), action.payload.message],
          }
        }
        return o
      })
    default:
      return state
  }
}

// Farmers reducer
export function farmersReducer(state = [], action) {
  switch (action.type) {
    case 'FARMERS_LOAD':
      return action.payload
    case 'FARMER_UPDATE':
      return state.map(f => 
        f.id === action.payload.id 
          ? { ...f, ...action.payload }
          : f
      )
    default:
      return state
  }
}

// Transactions reducer
export function transactionsReducer(state = [], action) {
  switch (action.type) {
    case 'TRANSACTIONS_LOAD':
      return action.payload
    case 'TRANSACTION_ADD':
      return [...state, action.payload]
    case 'TRANSACTION_UPDATE':
      return state.map(t => 
        t.id === action.payload.id 
          ? { ...t, ...action.payload }
          : t
      )
    default:
      return state
  }
}

// UI reducer
export function uiReducer(state = { currentUser: null }, action) {
  switch (action.type) {
    case 'UI_SET_USER':
      return { ...state, currentUser: action.payload }
    case 'UI_CLEAR_USER':
      return { ...state, currentUser: null }
    default:
      return state
  }
}

// Root reducer
export function rootReducer(state, action) {
  return {
    products: productsReducer(state.products, action),
    orders: ordersReducer(state.orders, action),
    farmers: farmersReducer(state.farmers, action),
    transactions: transactionsReducer(state.transactions, action),
    ui: uiReducer(state.ui, action),
  }
}

