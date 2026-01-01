/**
 * Unit conversion utilities for weight units
 * Supports: kg, lb (pounds), quintal, ton
 */

const CONVERSION_FACTORS = {
  kg: {
    kg: 1,
    lb: 2.20462,
    quintal: 0.01,
    ton: 0.001,
  },
  lb: {
    kg: 0.453592,
    lb: 1,
    quintal: 0.00453592,
    ton: 0.000453592,
  },
  quintal: {
    kg: 100,
    lb: 220.462,
    quintal: 1,
    ton: 0.1,
  },
  ton: {
    kg: 1000,
    lb: 2204.62,
    quintal: 10,
    ton: 1,
  },
}

/**
 * Convert a value from one unit to another
 * @param {number} value - The value to convert
 * @param {string} fromUnit - Source unit (kg, lb, quintal, ton)
 * @param {string} toUnit - Target unit (kg, lb, quintal, ton)
 * @returns {number} Converted value
 */
export function convertUnit(value, fromUnit, toUnit) {
  if (fromUnit === toUnit) return value
  if (!CONVERSION_FACTORS[fromUnit] || !CONVERSION_FACTORS[fromUnit][toUnit]) {
    throw new Error(`Invalid unit conversion: ${fromUnit} to ${toUnit}`)
  }
  return value * CONVERSION_FACTORS[fromUnit][toUnit]
}

/**
 * Format currency value
 * @param {number} value - The amount to format
 * @param {string} currency - Currency code (INR, USD)
 * @returns {string} Formatted currency string
 */
export function formatCurrency(value, currency = 'INR') {
  const formatters = {
    INR: new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
    }),
    USD: new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }),
  }

  const formatter = formatters[currency] || formatters.INR
  return formatter.format(value)
}

/**
 * Get available weight units
 */
export const WEIGHT_UNITS = ['kg', 'lb', 'quintal', 'ton']

/**
 * Get available currencies
 */
export const CURRENCIES = ['INR', 'USD']

