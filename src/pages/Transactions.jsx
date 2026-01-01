import { useStore } from '../store/index'
import { formatCurrency } from '../utils/units'

/**
 * Transactions page showing farmer's earnings and order history
 * Includes CSV export functionality
 */
export function Transactions() {
  const { state } = useStore()
  const currentUser = state.ui.currentUser

  const farmerTransactions = state.transactions.filter(
    t => t.farmerId === currentUser?.id
  )

  const handleExportCSV = () => {
    const headers = ['ID', 'Order ID', 'Amount', 'Currency', 'Date', 'Status', 'Fees', 'Net Amount']
    const rows = farmerTransactions.map(txn => [
      txn.id,
      txn.orderId,
      txn.amount,
      txn.currency,
      new Date(txn.date).toLocaleDateString(),
      txn.status,
      txn.fees || 0,
      txn.amount - (txn.fees || 0),
    ])

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(',')),
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `transactions-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  const totalEarnings = farmerTransactions
    .filter(t => t.status === 'PAID')
    .reduce((sum, t) => sum + (t.amount - (t.fees || 0)), 0)

  const pendingAmount = farmerTransactions
    .filter(t => t.status === 'PENDING')
    .reduce((sum, t) => sum + (t.amount - (t.fees || 0)), 0)

  // Simulate pending disbursements from completed orders
  const pendingDisbursements = state.orders
    .filter(o => {
      const product = state.products.find(p => p.id === o.productId)
      return product?.farmerId === currentUser?.id && o.status === 'DELIVERED' && o.escrowStatus === 'HELD'
    })
    .map(order => ({
      orderId: order.id,
      amount: order.totalPrice * 0.95, // 5% platform fee
      currency: order.currency,
      eta: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days
      reasonCode: 'DELIVERY_VERIFIED',
      status: 'PENDING',
    }))

  if (farmerTransactions.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6 text-center text-gray-500">
        No transactions yet. Your transaction history will appear here.
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Transaction History</h1>
          <p className="text-gray-600 mt-2">
            Complete ledger of your earnings and order history
          </p>
        </div>
        <button
          onClick={handleExportCSV}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          Export CSV
        </button>
      </div>

      {/* Pending Disbursements */}
      {pendingDisbursements.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <h2 className="text-lg font-semibold mb-3">Pending Disbursements</h2>
          <div className="space-y-2">
            {pendingDisbursements.map((disb) => (
              <div key={disb.orderId} className="flex justify-between items-center p-2 bg-white rounded">
                <div>
                  <div className="text-sm font-medium">Order {disb.orderId}</div>
                  <div className="text-xs text-gray-500">
                    ETA: {new Date(disb.eta).toLocaleDateString()} | Reason: {disb.reasonCode}
                  </div>
                </div>
                <div className="text-sm font-semibold">
                  {formatCurrency(disb.amount, disb.currency)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="text-sm text-gray-600">Total Earnings</div>
          <div className="text-2xl font-bold text-green-600 mt-2">
            {formatCurrency(totalEarnings, 'INR')}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="text-sm text-gray-600">Pending Amount</div>
          <div className="text-2xl font-bold text-yellow-600 mt-2">
            {formatCurrency(pendingAmount, 'INR')}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="text-sm text-gray-600">Total Transactions</div>
          <div className="text-2xl font-bold text-gray-800 mt-2">
            {farmerTransactions.length}
          </div>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Order ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Fees
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Net Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {farmerTransactions.map((txn) => (
                <tr key={txn.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {new Date(txn.date).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {txn.orderId}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatCurrency(txn.amount, txn.currency)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatCurrency(txn.fees || 0, txn.currency)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                    {formatCurrency(txn.amount - (txn.fees || 0), txn.currency)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 py-1 text-xs font-semibold rounded-full ${
                        txn.status === 'PAID'
                          ? 'bg-green-100 text-green-800'
                          : txn.status === 'PENDING'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {txn.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

