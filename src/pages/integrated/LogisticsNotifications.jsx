import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../../hooks/useData';

/**
 * Logistics Notifications Page
 * Read-only display of all notifications
 */
export function LogisticsNotifications() {
  const navigate = useNavigate();
  const { notifications, loading } = useNotifications();

  // Categorize notifications
  const getNotificationIcon = (message) => {
    const msg = message?.toLowerCase() || '';
    if (msg.includes('assign')) return '📋';
    if (msg.includes('cancel')) return '🚫';
    if (msg.includes('reassign')) return '🔄';
    if (msg.includes('delay')) return '⏰';
    if (msg.includes('deliver')) return '✅';
    return '🔔';
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-purple-600 text-white px-4 py-4 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-purple-500 rounded-full">
            <span className="text-2xl">←</span>
          </button>
          <h1 className="text-xl font-bold">Notifications</h1>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}

        {/* Empty State */}
        {!loading && notifications.length === 0 && (
          <div className="bg-white rounded-xl p-8 text-center shadow-sm">
            <div className="text-5xl mb-3 opacity-50">🔔</div>
            <h3 className="text-lg font-semibold text-gray-900">No Notifications</h3>
            <p className="text-gray-500 mt-1">You'll be notified about deliveries here.</p>
          </div>
        )}

        {/* Notifications List */}
        {!loading && notifications.length > 0 && (
          <div className="space-y-3">
            {notifications.map(notif => (
              <div 
                key={notif._id}
                className={`bg-white rounded-xl p-4 shadow-sm ${!notif.isRead ? 'border-l-4 border-purple-500' : ''}`}
              >
                <div className="flex items-start gap-3">
                  <span className="text-2xl">{getNotificationIcon(notif.message)}</span>
                  <div className="flex-1">
                    <p className="text-gray-800">{notif.message}</p>
                    <p className="text-gray-400 text-sm mt-2">
                      {new Date(notif.createdAt).toLocaleString()}
                    </p>
                  </div>
                  {!notif.isRead && (
                    <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
