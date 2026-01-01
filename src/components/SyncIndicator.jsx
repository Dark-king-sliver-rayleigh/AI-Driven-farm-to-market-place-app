import { useState } from 'react'
import { useStore, processSyncQueue } from '../store/index'

/**
 * Sync indicator component showing pending offline actions
 * TODO: Reconcile offline queue using server-side reconciliation endpoints and conflict resolution
 */
export function SyncIndicator() {
  const { state, dispatch } = useStore()
  const [showHistory, setShowHistory] = useState(false)
  
  const queue = state.ui?.offlineQueue || []
  const count = queue.length

  if (count === 0) return null

  const handleSync = () => {
    processSyncQueue(dispatch, state)
  }

  return (
    <>
      <button
        onClick={() => setShowHistory(true)}
        className="fixed bottom-4 right-4 bg-yellow-500 text-white px-4 py-2 rounded-full shadow-lg hover:bg-yellow-600 flex items-center gap-2 z-40"
      >
        <span>🔄</span>
        <span>{count} pending</span>
      </button>

      {showHistory && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
            <div className="p-4 border-b flex justify-between items-center">
              <h3 className="text-lg font-semibold">Sync History</h3>
              <button
                onClick={() => setShowHistory(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ×
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {queue.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No pending actions</p>
              ) : (
                <div className="space-y-2">
                  {queue.map((action, index) => (
                    <div key={action.id || index} className="p-3 bg-gray-50 rounded border">
                      <div className="text-sm font-medium">{action.type}</div>
                      <div className="text-xs text-gray-500 mt-1">
                        {new Date(action.timestamp).toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="p-4 border-t flex gap-2">
              <button
                onClick={handleSync}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
              >
                Sync Now
              </button>
              <button
                onClick={() => setShowHistory(false)}
                className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

