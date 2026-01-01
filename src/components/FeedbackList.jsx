import { useStore } from '../store/index'

/**
 * Feedback list component showing ratings and reviews
 * Displays consumer and logistics partner feedback
 */
export function FeedbackList() {
  const { state } = useStore()
  const currentUser = state.ui.currentUser

  const farmer = state.farmers.find(f => f.id === currentUser?.id)

  // Mock feedback data (in production, this would come from orders/ratings)
  const mockFeedback = [
    {
      id: 'fb-1',
      from: 'consumer',
      consumerName: 'Priya Sharma',
      rating: 5,
      comment: 'Excellent quality produce! Fresh and exactly as described.',
      date: new Date().toISOString(),
    },
    {
      id: 'fb-2',
      from: 'consumer',
      consumerName: 'Amit Kumar',
      rating: 4,
      comment: 'Good quality, timely delivery. Would order again.',
      date: new Date(Date.now() - 86400000).toISOString(),
    },
    {
      id: 'fb-3',
      from: 'logistics',
      logisticsName: 'Fast Delivery Co.',
      rating: 5,
      comment: 'Easy pickup, well-packaged products.',
      date: new Date(Date.now() - 172800000).toISOString(),
    },
  ]

  if (!farmer) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6 text-center text-gray-500">
        Farmer profile not found.
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Feedback & Ratings</h2>
        <p className="text-gray-600 mt-2">
          See what consumers and logistics partners say about you
        </p>
      </div>

      {/* Rating Summary */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="flex items-center gap-4">
          <div className="text-5xl font-bold text-gray-800">
            {farmer.ratings?.avg?.toFixed(1) || '0.0'}
          </div>
          <div>
            <div className="flex items-center gap-1 mb-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <span
                  key={star}
                  className={`text-2xl ${
                    star <= (farmer.ratings?.avg || 0)
                      ? 'text-yellow-400'
                      : 'text-gray-300'
                  }`}
                >
                  ★
                </span>
              ))}
            </div>
            <div className="text-sm text-gray-600">
              Based on {farmer.ratings?.count || 0} reviews
            </div>
          </div>
        </div>
      </div>

      {/* Feedback List */}
      <div className="space-y-4">
        {mockFeedback.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-6 text-center text-gray-500">
            No feedback yet. Your ratings will appear here.
          </div>
        ) : (
          mockFeedback.map((feedback) => (
            <div
              key={feedback.id}
              className="bg-white rounded-lg shadow-md p-6 border-l-4 border-blue-500"
            >
              <div className="flex justify-between items-start mb-2">
                <div>
                  <div className="font-semibold text-gray-800">
                    {feedback.from === 'consumer'
                      ? feedback.consumerName
                      : feedback.logisticsName}
                  </div>
                  <div className="text-sm text-gray-600">
                    {feedback.from === 'consumer' ? 'Consumer' : 'Logistics Partner'}
                  </div>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-1 mb-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <span
                        key={star}
                        className={`${
                          star <= feedback.rating ? 'text-yellow-400' : 'text-gray-300'
                        }`}
                      >
                        ★
                      </span>
                    ))}
                  </div>
                  <div className="text-xs text-gray-500">
                    {new Date(feedback.date).toLocaleDateString()}
                  </div>
                </div>
              </div>
              <div className="text-gray-700 mt-2">{feedback.comment}</div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

