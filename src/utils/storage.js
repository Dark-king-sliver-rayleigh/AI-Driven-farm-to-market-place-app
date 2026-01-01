/**
 * localStorage adapter for mock database
 * Stores all data under a single key: agrodirect:mockdb:v1
 */

const STORAGE_KEY = 'agrodirect:mockdb:v1'

/**
 * Load data from localStorage
 * @returns {Object} Database state
 */
export function loadFromStorage() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      return JSON.parse(stored)
    }
  } catch (error) {
    console.error('Error loading from localStorage:', error)
  }
  return null
}

/**
 * Save data to localStorage
 * @param {Object} data - Database state to save
 */
export function saveToStorage(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch (error) {
    console.error('Error saving to localStorage:', error)
  }
}

/**
 * Clear all stored data
 */
export function clearStorage() {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch (error) {
    console.error('Error clearing localStorage:', error)
  }
}

