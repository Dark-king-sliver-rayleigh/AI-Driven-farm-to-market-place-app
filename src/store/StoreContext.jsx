import React, { createContext, useContext, useReducer, useEffect } from 'react'
import { rootReducer } from './reducers'
import { loadFromStorage, saveToStorage } from '../utils/storage'
import { seedData } from '../utils/seedData'

const StoreContext = createContext()

const initialState = {
  products: [],
  orders: [],
  farmers: [],
  transactions: [],
  ui: { currentUser: null },
}

export function StoreProvider({ children }) {
  const [state, dispatch] = useReducer(rootReducer, initialState)

  // Load from localStorage on mount
  useEffect(() => {
    const stored = loadFromStorage()
    if (stored) {
      // Restore all slices
      if (stored.products) dispatch({ type: 'PRODUCTS_LOAD', payload: stored.products })
      if (stored.orders) dispatch({ type: 'ORDERS_LOAD', payload: stored.orders })
      if (stored.farmers) dispatch({ type: 'FARMERS_LOAD', payload: stored.farmers })
      if (stored.transactions) dispatch({ type: 'TRANSACTIONS_LOAD', payload: stored.transactions })
      if (stored.ui) dispatch({ type: 'UI_SET_USER', payload: stored.ui.currentUser })
    } else {
      // Initialize with seed data
      const seed = seedData()
      dispatch({ type: 'PRODUCTS_LOAD', payload: seed.products })
      dispatch({ type: 'ORDERS_LOAD', payload: seed.orders })
      dispatch({ type: 'FARMERS_LOAD', payload: seed.farmers })
      dispatch({ type: 'TRANSACTIONS_LOAD', payload: seed.transactions })
      dispatch({ type: 'UI_SET_USER', payload: seed.ui.currentUser })
    }
  }, [])

  // Persist to localStorage whenever state changes
  useEffect(() => {
    saveToStorage(state)
  }, [state])

  return (
    <StoreContext.Provider value={{ state, dispatch }}>
      {children}
    </StoreContext.Provider>
  )
}

export function useStore() {
  const context = useContext(StoreContext)
  if (!context) {
    throw new Error('useStore must be used within StoreProvider')
  }
  return context
}

