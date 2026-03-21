import { useState } from 'react';
import { productAPI } from '../../services/api';

/**
 * API-integrated inventory table for managing farmer's products
 * Includes: status change, delete product, restock quantity
 */
export function InventoryTableIntegrated({ products, loading, error, onRefresh }) {
  const [updating, setUpdating] = useState(null);
  const [updateError, setUpdateError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  
  // Modal states
  const [deleteModal, setDeleteModal] = useState(null);
  const [restockModal, setRestockModal] = useState(null);
  const [restockQuantity, setRestockQuantity] = useState('');

  const statusColors = {
    AVAILABLE: 'bg-green-100 text-green-800',
    NOT_HARVESTED: 'bg-gray-100 text-gray-800',
    PRE_ORDER: 'bg-blue-100 text-blue-800'
  };

  const statusLabels = {
    AVAILABLE: 'Available',
    NOT_HARVESTED: 'Not Harvested',
    PRE_ORDER: 'Pre-Order'
  };

  const showSuccess = (message) => {
    setSuccessMessage(message);
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  const handleStatusChange = async (productId, newStatus) => {
    try {
      setUpdating(productId);
      setUpdateError(null);
      await productAPI.updateStatus(productId, newStatus);
      if (onRefresh) onRefresh();
    } catch (err) {
      setUpdateError(err.message);
    } finally {
      setUpdating(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteModal) return;
    try {
      setUpdating(deleteModal._id);
      setUpdateError(null);
      await productAPI.delete(deleteModal._id);
      showSuccess(`${deleteModal.name} deleted successfully`);
      setDeleteModal(null);
      if (onRefresh) onRefresh();
    } catch (err) {
      setUpdateError(err.message);
    } finally {
      setUpdating(null);
    }
  };

  const handleRestock = async () => {
    if (!restockModal) return;
    const qty = parseInt(restockQuantity, 10);
    if (isNaN(qty) || qty <= 0) {
      setUpdateError('Quantity must be a positive number');
      return;
    }
    try {
      setUpdating(restockModal._id);
      setUpdateError(null);
      await productAPI.addQuantity(restockModal._id, qty);
      showSuccess(`Added ${qty} ${restockModal.unit} to ${restockModal.name}`);
      setRestockModal(null);
      setRestockQuantity('');
      if (onRefresh) onRefresh();
    } catch (err) {
      setUpdateError(err.message);
    } finally {
      setUpdating(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-10 h-10 border-4 border-green-500 border-t-transparent rounded-full animate-spin"></div>
        <span className="ml-3 text-gray-600">Loading products...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-600">{error}</p>
        <button 
          onClick={onRefresh}
          className="mt-2 px-4 py-2 bg-red-600 text-white rounded-md text-sm"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!products || products.length === 0) {
    return (
      <div className="bg-gray-50 rounded-lg p-8 text-center">
        <div className="text-5xl mb-4">🌾</div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">No Products Yet</h3>
        <p className="text-gray-500">Start by adding your first product.</p>
      </div>
    );
  }

  return (
    <div>
      {/* Success Message */}
      {successMessage && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md text-green-700 text-sm flex items-center">
          <span className="mr-2">✓</span> {successMessage}
        </div>
      )}

      {/* Error Message */}
      {updateError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-600 text-sm">
          {updateError}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
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
            {products.map((product) => (
              <tr key={product._id} className={updating === product._id ? 'opacity-50' : ''}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="font-medium text-gray-900">{product.name}</div>
                  <div className="text-sm text-gray-500">
                    {new Date(product.createdAt).toLocaleDateString()}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-gray-900">{product.quantity}</span>
                  <span className="text-gray-500 ml-1">{product.unit}</span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-gray-900">
                  ₹{product.price}/{product.unit}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusColors[product.status]}`}>
                    {statusLabels[product.status] || product.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    {/* Status Dropdown */}
                    <select
                      value={product.status}
                      onChange={(e) => handleStatusChange(product._id, e.target.value)}
                      disabled={updating === product._id}
                      className="text-sm border border-gray-300 rounded-md px-2 py-1 focus:ring-2 focus:ring-green-500"
                    >
                      <option value="AVAILABLE">Available</option>
                      <option value="NOT_HARVESTED">Not Harvested</option>
                      <option value="PRE_ORDER">Pre-Order</option>
                    </select>
                    
                    {/* Restock Button */}
                    <button
                      onClick={() => setRestockModal(product)}
                      disabled={updating === product._id}
                      className="px-2 py-1 text-sm text-blue-600 border border-blue-300 rounded hover:bg-blue-50 disabled:opacity-50"
                      title="Add more quantity"
                    >
                      ➕
                    </button>
                    
                    {/* Delete Button */}
                    <button
                      onClick={() => setDeleteModal(product)}
                      disabled={updating === product._id}
                      className="px-2 py-1 text-sm text-red-600 border border-red-300 rounded hover:bg-red-50 disabled:opacity-50"
                      title="Delete product"
                    >
                      🗑️
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Delete Product?</h3>
            <p className="text-gray-600 mb-4">
              Are you sure you want to delete <strong>{deleteModal.name}</strong>? 
              This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteModal(null)}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={updating}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {updating ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Restock Modal */}
      {restockModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Add Stock</h3>
            <p className="text-gray-600 mb-4">
              Add more quantity to <strong>{restockModal.name}</strong>
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Quantity to add ({restockModal.unit})
              </label>
              <input
                type="number"
                min="1"
                value={restockQuantity}
                onChange={(e) => setRestockQuantity(e.target.value)}
                placeholder="Enter quantity"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
              />
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => { setRestockModal(null); setRestockQuantity(''); }}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleRestock}
                disabled={updating || !restockQuantity}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {updating ? 'Adding...' : 'Add Stock'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

