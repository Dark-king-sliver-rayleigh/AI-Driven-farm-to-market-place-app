import { useStore, actions } from '../store/index'

/**
 * Role switcher component for demo purposes
 * Simulates authentication by switching between user roles
 */
export function RoleSwitcher() {
  const { state, dispatch } = useStore()
  const currentUser = state.ui.currentUser

  const switchRole = (role) => {
    const userIdMap = {
      farmer: 'farmer-1',
      consumer: 'consumer-1',
      logistics: 'logistics-1',
    }
    const userId = userIdMap[role] || `${role}-1`
    actions.setCurrentUser(dispatch, { id: userId, role })
    actions.setRole(dispatch, role)
  }

  return (
    <div className="fixed top-4 right-4 z-50 bg-white shadow-lg rounded-lg p-4 border">
      <div className="text-sm font-semibold mb-2">Demo Role Switcher</div>
      <div className="flex gap-2">
        <button
          onClick={() => switchRole('farmer')}
          className={`px-3 py-1 rounded text-sm ${
            currentUser?.role === 'farmer'
              ? 'bg-green-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          Farmer
        </button>
        <button
          onClick={() => switchRole('consumer')}
          className={`px-3 py-1 rounded text-sm ${
            currentUser?.role === 'consumer'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          Consumer
        </button>
        <button
          onClick={() => switchRole('logistics')}
          className={`px-3 py-1 rounded text-sm ${
            currentUser?.role === 'logistics'
              ? 'bg-purple-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          Logistics
        </button>
      </div>
      {currentUser && (
        <div className="mt-2 text-xs text-gray-600">
          Current: {currentUser.role} ({currentUser.id})
        </div>
      )}
    </div>
  )
}

