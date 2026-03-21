import React, { createContext, useContext, useEffect, useReducer } from 'react'
import { loadFromStorage, saveToStorage } from '../utils/storage'
import { seedData } from '../utils/seedData'
import { fetchPriceSuggestion } from '../services/priceEngine'

// ----- State shape -----
// {
//   products: Product[]
//   orders: Order[]
//   farmers: Farmer[]
//   logistics: Logistics[]
//   users: User[]
//   cart: CartItem[]
//   ui: { currentUser: User | null, role: 'consumer' | 'farmer' | 'logistics', notifications: [] }
// }

const initialState = {
  products: [],
  orders: [],
  farmers: [],
  logistics: [],
  users: [],
  cart: [],
  ui: {
    currentUser: null,
    role: 'farmer',
    notifications: [],
  },
}
// ----- Reducers -----

function productsReducer(state, action) {
  switch (action.type) {
    case 'PRODUCTS_LOAD':
      return action.payload
    case 'PRODUCT_ADD':
      return [...state, action.payload]
    case 'PRODUCT_UPDATE':
      return state.map((p) =>
        p.id === action.payload.id ? { ...p, ...action.payload, updatedAt: new Date().toISOString() } : p
      )
    case 'PRODUCT_DELETE':
      return state.filter((p) => p.id !== action.payload)
    default:
      return state
  }
}

function ordersReducer(state, action) {
  switch (action.type) {
    case 'ORDERS_LOAD':
      return action.payload
    case 'ORDER_ADD':
      return [...state, action.payload]
    case 'ORDER_UPDATE':
      return state.map((o) => (o.id === action.payload.id ? { ...o, ...action.payload } : o))
    case 'ORDER_ADD_NEGOTIATION':
      return state.map((o) => {
        if (o.id !== action.payload.orderId) return o
        const negotiation = [...(o.negotiation || []), action.payload.message]
        return { ...o, negotiation }
      })
    case 'ORDER_ADD_DELIVERY_AUDIT':
      return state.map((o) => {
        if (o.id !== action.payload.orderId) return o
        const deliveryAudit = [...(o.deliveryAudit || []), action.payload.auditEntry]
        return { ...o, deliveryAudit }
      })
    default:
      return state
  }
}

export function cartReducer(state, action) {
  switch (action.type) {
    case 'CART_LOAD':
      return action.payload || []
    case 'CART_ADD_ITEM': {
      // Check availabilityConfidence - prevent adding if LOW
      if (action.payload.availabilityConfidence === 'LOW') {
        // Return state unchanged - item not added
        return state
      }
      const existing = state.find(
        (item) => item.productId === action.payload.productId && item.unit === action.payload.unit
      )
      if (existing) {
        const updated = {
          ...existing,
          quantity: existing.quantity + action.payload.quantity,
          totalPrice: existing.totalPrice + action.payload.totalPrice,
        }
        return state.map((item) => (item === existing ? updated : item))
      }
      return [...state, action.payload]
    }
    case 'CART_UPDATE_ITEM':
      return state.map((item) =>
        item.productId === action.payload.productId
          ? { ...item, ...action.payload, totalPrice: action.payload.quantity * action.payload.pricePerUnit }
          : item
      )
    case 'CART_REMOVE_ITEM':
      return state.filter((item) => item.productId !== action.payload.productId)
    case 'CART_CLEAR':
      return []
    default:
      return state
  }
}

function farmersReducer(state, action) {
  switch (action.type) {
    case 'FARMERS_LOAD':
      return action.payload
    case 'FARMER_UPDATE':
      return state.map((f) => (f.id === action.payload.id ? { ...f, ...action.payload } : f))
    case 'FARMER_ADD':
      return [...state, action.payload]
    default:
      return state
  }
}

function logisticsReducer(state, action) {
  switch (action.type) {
    case 'LOGISTICS_LOAD':
      return action.payload
    case 'LOGISTICS_UPDATE':
      return state.map((l) =>
        l.agentId === action.payload.agentId ? { ...l, ...action.payload } : l
      )
    case 'LOGISTICS_ADD':
      return [...state, action.payload]
    default:
      return state
  }
}

function usersReducer(state, action) {
  switch (action.type) {
    case 'USERS_LOAD':
      return action.payload
    case 'USER_UPDATE':
      return state.map((u) => (u.id === action.payload.id ? { ...u, ...action.payload } : u))
    case 'USER_ADD':
      return [...state, action.payload]
    default:
      return state
  }
}

function uiReducer(state, action) {
  switch (action.type) {
    case 'UI_SET_ROLE':
      return { ...state, role: action.payload }
    case 'UI_SET_CURRENT_USER':
      return { ...state, currentUser: action.payload }
    case 'UI_ADD_NOTIFICATION':
      return { ...state, notifications: [...(state.notifications || []), action.payload] }
    default:
      return state
  }
}

function rootReducer(state, action) {
  return {
    products: productsReducer(state.products || [], action),
    orders: ordersReducer(state.orders || [], action),
    farmers: farmersReducer(state.farmers || [], action),
    logistics: logisticsReducer(state.logistics || [], action),
    users: usersReducer(state.users || [], action),
    cart: cartReducer(state.cart || [], action),
    ui: uiReducer(state.ui || { currentUser: null, role: 'farmer', notifications: [] }, action),
  }
}

// ----- Context -----

const StoreContext = createContext()

export function StoreProvider({ children }) {
  const [state, dispatch] = useReducer(rootReducer, initialState)

  // Initial load (localStorage or seed)
  useEffect(() => {
    const stored = loadFromStorage()
    if (stored) {
      if (stored.products) dispatch({ type: 'PRODUCTS_LOAD', payload: stored.products })
      if (stored.orders) dispatch({ type: 'ORDERS_LOAD', payload: stored.orders })
      if (stored.farmers) dispatch({ type: 'FARMERS_LOAD', payload: stored.farmers })
      if (stored.logistics) dispatch({ type: 'LOGISTICS_LOAD', payload: stored.logistics })
      if (stored.users) dispatch({ type: 'USERS_LOAD', payload: stored.users })
      if (stored.cart) dispatch({ type: 'CART_LOAD', payload: stored.cart })
      if (stored.ui) {
        if (stored.ui.role) dispatch({ type: 'UI_SET_ROLE', payload: stored.ui.role })
        if (stored.ui.currentUser) dispatch({ type: 'UI_SET_CURRENT_USER', payload: stored.ui.currentUser })
        if (stored.ui.notifications) {
          stored.ui.notifications.forEach((notif) =>
            dispatch({ type: 'UI_ADD_NOTIFICATION', payload: notif })
          )
        }
      }
    } else {
      const seed = seedData()
      dispatch({ type: 'PRODUCTS_LOAD', payload: seed.products })
      dispatch({ type: 'ORDERS_LOAD', payload: seed.orders })
      if (seed.farmers) dispatch({ type: 'FARMERS_LOAD', payload: seed.farmers })
      if (seed.logistics) dispatch({ type: 'LOGISTICS_LOAD', payload: seed.logistics })
      dispatch({ type: 'USERS_LOAD', payload: seed.users })
      dispatch({ type: 'CART_LOAD', payload: [] })
      dispatch({
        type: 'UI_SET_CURRENT_USER',
        payload: seed.ui.currentUser,
      })
      dispatch({ type: 'UI_SET_ROLE', payload: seed.ui.currentUser.role })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Persist to localStorage
  useEffect(() => {
    saveToStorage(state)
  }, [state])

  return <StoreContext.Provider value={{ state, dispatch }}>{children}</StoreContext.Provider>
}

export function useStore() {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used within StoreProvider')
  return ctx
}

// ----- Action helpers -----

export const actions = {
  addToCart: (dispatch, payload) => dispatch({ type: 'CART_ADD_ITEM', payload }),
  updateCartItem: (dispatch, payload) => dispatch({ type: 'CART_UPDATE_ITEM', payload }),
  removeCartItem: (dispatch, payload) => dispatch({ type: 'CART_REMOVE_ITEM', payload }),
  clearCart: (dispatch) => dispatch({ type: 'CART_CLEAR' }),
  addOrder: (dispatch, order) => dispatch({ type: 'ORDER_ADD', payload: order }),
  updateOrder: (dispatch, order) => dispatch({ type: 'ORDER_UPDATE', payload: order }),
  addNegotiationMessage: (dispatch, orderId, message) =>
    dispatch({ type: 'ORDER_ADD_NEGOTIATION', payload: { orderId, message } }),
  addDeliveryAudit: (dispatch, orderId, auditEntry) =>
    dispatch({ type: 'ORDER_ADD_DELIVERY_AUDIT', payload: { orderId, auditEntry } }),
  setRole: (dispatch, role) => dispatch({ type: 'UI_SET_ROLE', payload: role }),
  setCurrentUser: (dispatch, user) => dispatch({ type: 'UI_SET_CURRENT_USER', payload: user }),
  addNotification: (dispatch, notification) =>
    dispatch({ type: 'UI_ADD_NOTIFICATION', payload: notification }),
}

// ----- Helper functions -----

/**
 * Get availability confidence for a product
 * Computed from product.lastSyncedAt and source
 */
export function getAvailabilityConfidence(product) {
  if (!product) return 'LOW'
  
  // If product already has availabilityConfidence, use it
  if (product.availabilityConfidence) return product.availabilityConfidence
  
  // Compute based on source and lastSyncedAt
  if (product.source === 'WEB') return 'HIGH'
  if (product.source === 'MOBILE') return 'MEDIUM'
  
  return 'MEDIUM'
}



/**
 * Live price suggestion endpoint
 * Calls the backend Price Insight API, falls back to local calculation.
 */
export async function getPriceSuggestionForProduct(productId, state) {
  const product = state.products.find((p) => p.id === productId)
  if (!product) return null
  return fetchPriceSuggestion(product)
}

export { seedData } from '../utils/seedData'


