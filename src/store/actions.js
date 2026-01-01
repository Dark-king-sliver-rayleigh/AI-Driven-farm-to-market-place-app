/**
 * Action creators for state management
 */

// Products actions
export const loadProducts = (products) => ({
  type: 'PRODUCTS_LOAD',
  payload: products,
})

export const addProduct = (product) => ({
  type: 'PRODUCT_ADD',
  payload: product,
})

export const updateProduct = (product) => ({
  type: 'PRODUCT_UPDATE',
  payload: product,
})

export const deleteProduct = (productId) => ({
  type: 'PRODUCT_DELETE',
  payload: productId,
})

// Orders actions
export const loadOrders = (orders) => ({
  type: 'ORDERS_LOAD',
  payload: orders,
})

export const addOrder = (order) => ({
  type: 'ORDER_ADD',
  payload: order,
})

export const updateOrder = (order) => ({
  type: 'ORDER_UPDATE',
  payload: order,
})

export const addNegotiationMessage = (orderId, message) => ({
  type: 'ORDER_ADD_NEGOTIATION',
  payload: { orderId, message },
})

// Farmers actions
export const loadFarmers = (farmers) => ({
  type: 'FARMERS_LOAD',
  payload: farmers,
})

export const updateFarmer = (farmer) => ({
  type: 'FARMER_UPDATE',
  payload: farmer,
})

// Transactions actions
export const loadTransactions = (transactions) => ({
  type: 'TRANSACTIONS_LOAD',
  payload: transactions,
})

export const addTransaction = (transaction) => ({
  type: 'TRANSACTION_ADD',
  payload: transaction,
})

export const updateTransaction = (transaction) => ({
  type: 'TRANSACTION_UPDATE',
  payload: transaction,
})

// UI actions
export const setCurrentUser = (user) => ({
  type: 'UI_SET_USER',
  payload: user,
})

export const clearCurrentUser = () => ({
  type: 'UI_CLEAR_USER',
})

