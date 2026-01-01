import { useOnlineStatus } from '../utils/useOnlineStatus'
import { useStore } from '../store/index'

/**
 * Offline banner component
 * Shows when device is offline with pending sync count
 */
export function OfflineBanner() {
  const { isOnline, wasOffline } = useOnlineStatus()
  const { state } = useStore()
  const pendingCount = state.ui.offlineQueue?.length || 0

  if (isOnline && !wasOffline) return null

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-50 px-4 py-3 text-center text-sm font-medium ${
        isOnline
          ? 'bg-green-500 text-white'
          : 'bg-yellow-500 text-yellow-900'
      }`}
    >
      <div className="flex items-center justify-center gap-2">
        {isOnline ? (
          <>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span>Back online — syncing changes...</span>
          </>
        ) : (
          <>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 010 12.728M5.636 5.636a9 9 0 000 12.728M12 12v.01" />
            </svg>
            <span>
              Offline — changes will sync automatically
              {pendingCount > 0 && ` (${pendingCount} pending)`}
            </span>
          </>
        )}
      </div>
    </div>
  )
}
