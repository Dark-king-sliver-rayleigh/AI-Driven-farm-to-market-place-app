import { useState, useEffect } from 'react'
import { WEIGHT_UNITS, convertUnit } from '../utils/units'

/**
 * Quantity + unit selector with conversion helper.
 * Props:
 * - value: { quantity, unit }
 * - maxQuantity: number (in product.baseUnit)
 * - baseUnit: string
 * - onChange({ quantity, unit })
 */
export function QuantityUnitSelector({ value, baseUnit = 'kg', maxQuantity, onChange }) {
  const [quantity, setQuantity] = useState(value?.quantity || 1)
  const [unit, setUnit] = useState(value?.unit || baseUnit)
  const [error, setError] = useState('')

  useEffect(() => {
    onChange?.({ quantity, unit })
  }, [quantity, unit, onChange])

  const handleQuantityChange = (next) => {
    const num = parseFloat(next) || 0
    setQuantity(num)

    if (maxQuantity != null) {
      try {
        const inBase = convertUnit(num, unit, baseUnit)
        if (inBase > maxQuantity) {
          setError(`Requested quantity exceeds available stock (${maxQuantity} ${baseUnit}).`)
        } else {
          setError('')
        }
      } catch {
        setError('')
      }
    }
  }

  const handleUnitChange = (e) => {
    const nextUnit = e.target.value
    try {
      const converted = convertUnit(quantity, unit, nextUnit)
      setUnit(nextUnit)
      setQuantity(parseFloat(converted.toFixed(2)))
      setError('')
    } catch {
      setUnit(nextUnit)
    }
  }

  return (
    <div className="space-y-1">
      <div className="flex gap-2">
        <input
          type="number"
          min="0"
          step="0.01"
          value={quantity}
          onChange={(e) => handleQuantityChange(e.target.value)}
          className="w-28 px-3 py-2 border border-gray-300 rounded-md"
        />
        <select
          value={unit}
          onChange={handleUnitChange}
          className="px-3 py-2 border border-gray-300 rounded-md bg-white text-sm"
        >
          {WEIGHT_UNITS.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </select>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}


