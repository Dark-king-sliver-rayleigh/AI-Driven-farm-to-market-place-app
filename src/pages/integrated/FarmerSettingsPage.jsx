import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

/**
 * Farmer Settings Page
 * Settings menu with links to profile and other settings
 */
export function FarmerSettingsPage() {
  const { user, logout } = useAuth();

  const settingsItems = [
    {
      id: 'profile',
      title: 'My Profile',
      description: 'Update your name, address, and photo',
      icon: '👤',
      link: '/farmer/profile',
      color: 'from-blue-500 to-blue-600'
    },
    {
      id: 'logout',
      title: 'Logout',
      description: 'Sign out of your account',
      icon: '🚪',
      action: logout,
      color: 'from-red-500 to-red-600'
    }
  ];

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Link
          to="/farmer/home"
          className="text-2xl text-gray-600 hover:text-gray-800"
        >
          ←
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">⚙️ Settings</h1>
          <p className="text-gray-600 text-sm">{user?.name}</p>
        </div>
      </div>

      {/* Settings List */}
      <div className="space-y-4">
        {settingsItems.map((item) => {
          const content = (
            <div className="flex items-center gap-4 p-5 bg-white rounded-2xl shadow-md hover:shadow-lg transition-all group">
              <div className={`w-14 h-14 bg-gradient-to-br ${item.color} rounded-xl flex items-center justify-center text-2xl text-white shadow-md`}>
                {item.icon}
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-gray-800 group-hover:text-green-700 transition-colors">
                  {item.title}
                </h3>
                <p className="text-sm text-gray-600">{item.description}</p>
              </div>
              <span className="text-2xl text-gray-400 group-hover:text-gray-600">→</span>
            </div>
          );

          if (item.link) {
            return (
              <Link key={item.id} to={item.link}>
                {content}
              </Link>
            );
          }

          return (
            <button
              key={item.id}
              onClick={item.action}
              className="w-full text-left"
            >
              {content}
            </button>
          );
        })}
      </div>

      {/* App Info */}
      <div className="mt-12 text-center text-sm text-gray-500">
        <p>AgroDirect v1.0</p>
        <p className="mt-1">Farm-to-Consumer Marketplace</p>
      </div>
    </div>
  );
}
