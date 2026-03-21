import { useState } from 'react'
import { useStore } from '../store/index'
import { updateProduct, deleteProduct } from '../store/actions'
import { formatCurrency, convertUnit, WEIGHT_UNITS } from '../utils/units'

/**
 * Inventory table component for managing products
 * Supports edit, status update (NOT_HARVESTED/AVAILABLE), and delete
 */
export function InventoryTable() {
  const { state, dispatch } = useStore()
  const currentUser = state.ui.currentUser

  const farmerProducts = state.products.filter(
    p => p.farmerId === currentUser?.id
  )

  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [displayUnit, setDisplayUnit] = useState('')  // '' means per-product unit

  // Helper: convert a product's price+quantity into the chosen display unit
  const toDisplay = (product) => {
    const target = displayUnit || product.unit
    if (target === product.unit) {
      return { price: product.pricePerUnit, quantity: product.quantity, unit: product.unit }
    }
    try {
      const factor = convertUnit(1, product.unit, target)
      return {
        price: product.pricePerUnit / factor,
        quantity: parseFloat(convertUnit(product.quantity, product.unit, target).toFixed(2)),
        unit: target,
      }
    } catch {
      return { price: product.pricePerUnit, quantity: product.quantity, unit: product.unit }
    }
  }

  const handleEdit = (product) => {
    setEditingId(product.id)
    setEditForm({
      name: product.name,
      quantity: product.quantity,
      pricePerUnit: product.pricePerUnit,
      status: product.status,
    })
  }

  const handleSave = (productId) => {
    const product = farmerProducts.find(p => p.id === productId)
    if (!product) return

    dispatch(updateProduct({
      ...product,
      ...editForm,
      quantity: parseFloat(editForm.quantity),
      pricePerUnit: parseFloat(editForm.pricePerUnit),
    }))

    setEditingId(null)
    setEditForm({})
  }

  const handleCancel = () => {
    setEditingId(null)
    setEditForm({})
  }

  const handleStatusChange = (productId, newStatus) => {
    const product = farmerProducts.find(p => p.id === productId)
    if (product) {
      dispatch(updateProduct({ ...product, status: newStatus }))
    }
  }

  const handleDelete = (productId) => {
    if (window.confirm('Are you sure you want to delete this product?')) {
      dispatch(deleteProduct(productId))
    }
  }

  if (farmerProducts.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6 text-center text-gray-500">
        No products in inventory. Add your first product to get started!
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="p-6 border-b">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Manage Inventory</h2>
            <p className="text-sm text-gray-600 mt-1">
              View, edit, and manage all your listed products
            </p>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Display Unit:
            </label>
            <select
              value={displayUnit}
              onChange={(e) => setDisplayUnit(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-green-500 outline-none"
            >
              <option value="">Per Product Unit</option>
              {WEIGHT_UNITS.map((u) => (
                <option key={u} value={u}>
                  {u === 'kg' ? '⚖️ kg' : u === 'quintal' ? '📦 quintal' : u === 'ton' ? '🏗️ ton' : '🔢 lb'}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Product
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Quantity
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Price
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {farmerProducts.map((product) => {
              const disp = toDisplay(product)
              return (
              <tr key={product.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  {editingId === product.id ? (
                    <input
                      type="text"
                      value={editForm.name}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                      className="w-full px-2 py-1 border border-gray-300 rounded"
                    />
                  ) : (
                    <div>
                      <div className="text-sm font-medium text-gray-900">{product.name}</div>
                      <div className="text-xs text-gray-500">{product.location.address}</div>
                    </div>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {editingId === product.id ? (
                    <input
                      type="number"
                      value={editForm.quantity}
                      onChange={(e) => setEditForm({ ...editForm, quantity: e.target.value })}
                      step="0.01"
                      className="w-24 px-2 py-1 border border-gray-300 rounded"
                    />
                  ) : (
                    <div>
                      <span className="text-sm text-gray-900">
                        {disp.quantity} {disp.unit}
                      </span>
                      {disp.unit !== product.unit && (
                        <div className="text-xs text-gray-400">
                          ({product.quantity} {product.unit})
                        </div>
                      )}
                    </div>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {editingId === product.id ? (
                    <input
                      type="number"
                      value={editForm.pricePerUnit}
                      onChange={(e) => setEditForm({ ...editForm, pricePerUnit: e.target.value })}
                      step="0.01"
                      className="w-24 px-2 py-1 border border-gray-300 rounded"
                    />
                  ) : (
                    <div>
                      <span className="text-sm text-gray-900">
                        {formatCurrency(disp.price, product.currency)}/{disp.unit}
                      </span>
                      {disp.unit !== product.unit && (
                        <div className="text-xs text-gray-400">
                          ({formatCurrency(product.pricePerUnit, product.currency)}/{product.unit})
                        </div>
                      )}
                    </div>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {editingId === product.id ? (
                    <select
                      value={editForm.status}
                      onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                      className="px-2 py-1 border border-gray-300 rounded text-sm"
                    >
                      <option value="NOT_HARVESTED">Not Harvested Yet</option>
                      <option value="AVAILABLE">Available</option>
                      <option value="PRE_ORDER">Pre-Order</option>
                      <option value="OUT_OF_STOCK">Out of Stock</option>
                    </select>
                  ) : (
                    <>
                      <span
                        className={`px-2 py-1 text-xs font-semibold rounded-full ${
                          product.status === 'AVAILABLE'
                            ? 'bg-green-100 text-green-800'
                            : product.status === 'NOT_HARVESTED'
                            ? 'bg-yellow-100 text-yellow-800'
                            : product.status === 'PRE_ORDER'
                            ? 'bg-blue-100 text-blue-800'
                            : product.status === 'OUT_OF_STOCK'
                            ? 'bg-gray-100 text-gray-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {product.status === 'NOT_HARVESTED'
                          ? 'Not Harvested Yet'
                          : product.status}
                      </span>
                      {product.source && (
                        <span className="ml-2 text-xs" title={`Source: ${product.source}`}>
                          {product.source === 'MOBILE' ? '📲' : '💻'}
                        </span>
                      )}
                      {product.priceSuggestion && (
                        <div className="mt-1 text-xs text-gray-600">
                          Suggested: {product.priceSuggestion.value} {product.priceSuggestion.currency}
                          {' '}({Math.round(product.priceSuggestion.confidence * 100)}%)
                        </div>
                      )}
                    </>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  {editingId === product.id ? (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleSave(product.id)}
                        className="text-green-600 hover:text-green-900"
                      >
                        Save
                      </button>
                      <button
                        onClick={handleCancel}
                        className="text-gray-600 hover:text-gray-900"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEdit(product)}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        Edit
                      </button>
                      {product.status !== 'NOT_HARVESTED' ? (
                        <button
                          onClick={() => handleStatusChange(product.id, 'NOT_HARVESTED')}
                          className="text-yellow-600 hover:text-yellow-900"
                        >
                          Mark Not Harvested
                        </button>
                      ) : (
                        <button
                          onClick={() => handleStatusChange(product.id, 'AVAILABLE')}
                          className="text-green-600 hover:text-green-900"
                        >
                          Mark Available
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(product.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            )})}  
          </tbody>
        </table>
      </div>
    </div>
  )
}

