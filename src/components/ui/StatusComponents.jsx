/**
 * Loading spinner component
 */
export function LoadingSpinner({ size = 'md', message = 'Loading...' }) {
  const sizeClasses = {
    sm: 'w-6 h-6 border-2',
    md: 'w-10 h-10 border-3',
    lg: 'w-16 h-16 border-4'
  };

  return (
    <div className="flex flex-col items-center justify-center py-8">
      <div 
        className={`${sizeClasses[size]} border-green-500 border-t-transparent rounded-full animate-spin`}
      />
      {message && <p className="text-gray-600 mt-3 text-sm">{message}</p>}
    </div>
  );
}

/**
 * Full page loading state
 */
export function PageLoading({ message = 'Loading...' }) {
  return (
    <div className="min-h-[400px] flex items-center justify-center">
      <LoadingSpinner size="lg" message={message} />
    </div>
  );
}

/**
 * Error message component
 */
export function ErrorMessage({ message, onRetry }) {
  return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
      <div className="flex items-start gap-3">
        <div className="text-red-500 text-xl">⚠️</div>
        <div className="flex-1">
          <h3 className="font-medium text-red-800">Error</h3>
          <p className="text-red-600 text-sm mt-1">{message}</p>
          {onRetry && (
            <button
              onClick={onRetry}
              className="mt-3 px-4 py-2 bg-red-600 text-white text-sm rounded-md hover:bg-red-700"
            >
              Try Again
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Empty state component
 */
export function EmptyState({ icon = '📦', title, message, action }) {
  return (
    <div className="bg-white rounded-xl p-8 text-center border border-gray-100">
      <div className="text-5xl mb-4">{icon}</div>
      <h3 className="text-lg font-medium text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-500 text-sm mb-4">{message}</p>
      {action && (
        <button
          onClick={action.onClick}
          className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

/**
 * Access denied component
 */
export function AccessDenied() {
  return (
    <div className="min-h-[400px] flex items-center justify-center">
      <div className="text-center">
        <div className="text-6xl mb-4">🚫</div>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Access Denied</h2>
        <p className="text-gray-600">You do not have permission to view this page.</p>
      </div>
    </div>
  );
}
