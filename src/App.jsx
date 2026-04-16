import { BrowserRouter as Router, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'

// Import integrated pages (API-connected)
import { FarmerDashboardIntegrated } from './pages/integrated/FarmerDashboardIntegrated'
import { FarmerHomePage } from './pages/integrated/FarmerHomePage'
import { FarmerSettingsPage } from './pages/integrated/FarmerSettingsPage'
import { FarmerProfilePage } from './pages/integrated/FarmerProfilePage'
import { CategoryInsightsPage } from './pages/integrated/CategoryInsightsPage'
import { ConsumerHomeIntegrated } from './pages/integrated/ConsumerHomeIntegrated'
import { OrderListIntegrated } from './pages/integrated/OrderListIntegrated'
import { ConsumerProductDetail } from './pages/integrated/ConsumerProductDetail'
import { ConsumerProfile } from './pages/integrated/ConsumerProfile'
import { LogisticsDashboardIntegrated } from './pages/integrated/LogisticsDashboardIntegrated'
import { LogisticsHome } from './pages/integrated/LogisticsHome'
import { LogisticsActiveDelivery } from './pages/integrated/LogisticsActiveDelivery'
import { LogisticsHistory } from './pages/integrated/LogisticsHistory'
import { LogisticsNotifications } from './pages/integrated/LogisticsNotifications'
import { LogisticsProfile } from './pages/integrated/LogisticsProfile'
import { LogisticsEarnings } from './pages/integrated/LogisticsEarnings'
import { ConsumerOrderTracking } from './pages/integrated/ConsumerOrderTracking'

// Import new feature pages
import { RoutePlanningPage } from './pages/integrated/RoutePlanningPage'
import { RouteDetailPage } from './pages/integrated/RouteDetailPage'
import { KPIDashboardPage } from './pages/integrated/KPIDashboardPage'
import { PlatformPricesPage } from './pages/integrated/PlatformPricesPage'
import { DemandForecastPage } from './pages/integrated/DemandForecastPage'

// Import farmer components
import { AddProductEnhanced } from './components/farmer/AddProductEnhanced'

// Import auth pages
import { Login } from './pages/Login'
import { Register } from './pages/Register'

// Import AI components
import AIChatWidget from './components/AIChatWidget'

/**
 * Navigation component for Farmer
 */
function FarmerNavigation() {
  const { logout } = useAuth()
  
  return (
    <>
      {/* SideNavBar - completely replaces the top navigation for farmers */}
      <aside className="hidden md:flex fixed left-0 top-0 h-screen w-20 hover:w-64 transition-all duration-500 rounded-r-3xl bg-emerald-950/40 backdrop-blur-3xl shadow-[40px_0_80px_rgba(0,0,0,0.2)] bg-gradient-to-r from-emerald-900/10 to-transparent z-50 overflow-hidden group">
        <div className="flex flex-col items-center py-8 space-y-4 h-full w-full">
          <div className="flex flex-col items-center space-y-2 px-4 w-full opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center text-green-400">
              <span className="material-symbols-outlined">science</span>
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold font-sans text-emerald-100 whitespace-nowrap">Laboratory Alpha</p>
              <p className="text-[10px] font-mono text-emerald-400 whitespace-nowrap">Node 01</p>
            </div>
          </div>
          
          <nav className="flex flex-col w-full space-y-1 mt-4 flex-1">
            <Link to="/farmer/home" className="flex items-center px-6 py-4 text-emerald-100/60 hover:bg-emerald-500/10 hover:text-emerald-100 transition-all group/item">
              <span className="material-symbols-outlined text-2xl">home</span>
              <span className="ml-4 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap text-sm font-medium">Home</span>
            </Link>
            <Link to="/farmer/add-product" className="flex items-center px-6 py-4 text-emerald-100/60 hover:bg-emerald-500/10 hover:text-emerald-100 transition-all group/item">
              <span className="material-symbols-outlined text-2xl">add_circle</span>
              <span className="ml-4 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap text-sm font-medium">Add Product</span>
            </Link>
            <Link to="/farmer/dashboard" className="flex items-center px-6 py-4 text-emerald-100/60 hover:bg-emerald-500/10 hover:text-emerald-100 transition-all group/item">
              <span className="material-symbols-outlined text-2xl">inventory_2</span>
              <span className="ml-4 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap text-sm font-medium">Inventory</span>
            </Link>
            <Link to="/farmer/dashboard" className="flex items-center px-6 py-4 text-emerald-100/60 hover:bg-emerald-500/10 hover:text-emerald-100 transition-all group/item">
              <span className="material-symbols-outlined text-2xl">shopping_cart</span>
              <span className="ml-4 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap text-sm font-medium">Orders</span>
            </Link>
            <Link to="/farmer/prices" className="flex items-center px-6 py-4 text-emerald-100/60 hover:bg-emerald-500/10 hover:text-emerald-100 transition-all group/item">
              <span className="material-symbols-outlined text-2xl">monitoring</span>
              <span className="ml-4 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap text-sm font-medium">Prices</span>
            </Link>
            <Link to="/farmer/forecast" className="flex items-center px-6 py-4 text-emerald-100/60 hover:bg-emerald-500/10 hover:text-emerald-100 transition-all group/item">
              <span className="material-symbols-outlined text-2xl">query_stats</span>
              <span className="ml-4 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap text-sm font-medium">Forecast</span>
            </Link>
            <Link to="/farmer/settings" className="flex items-center px-6 py-4 text-emerald-100/60 hover:bg-emerald-500/10 hover:text-emerald-100 transition-all group/item">
              <span className="material-symbols-outlined text-2xl">settings</span>
              <span className="ml-4 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap text-sm font-medium">Settings</span>
            </Link>
          </nav>
          
          <div className="mt-auto px-4 w-full opacity-0 group-hover:opacity-100 transition-opacity pb-6">
            <button onClick={logout} className="w-full bg-red-950/40 text-red-400 border border-red-900/50 hover:bg-red-900/40 py-3 rounded-xl font-bold shadow-lg hover:scale-105 transition-transform active:scale-95">
              Logout
            </button>
          </div>
        </div>
      </aside>

      {/* Bottom Navigation (Mobile Only) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-20 bg-emerald-950/90 backdrop-blur-3xl flex items-center justify-around px-2 z-50 rounded-t-[2rem] border-t border-emerald-900/30">
        <Link to="/farmer/home" className="text-emerald-400 flex flex-col items-center gap-1 hover:text-emerald-300">
          <span className="material-symbols-outlined text-2xl">home</span>
        </Link>
        <Link to="/farmer/dashboard" className="text-emerald-100/50 flex flex-col items-center gap-1 hover:text-emerald-100">
          <span className="material-symbols-outlined text-2xl">inventory_2</span>
        </Link>
        <div className="relative -top-6">
          <Link to="/farmer/add-product" className="w-14 h-14 bg-green-500 text-white rounded-full shadow-lg shadow-green-500/40 flex items-center justify-center hover:scale-105 transition-transform">
            <span className="material-symbols-outlined text-3xl">add</span>
          </Link>
        </div>
        <Link to="/farmer/prices" className="text-emerald-100/50 flex flex-col items-center gap-1 hover:text-emerald-100">
          <span className="material-symbols-outlined text-2xl">monitoring</span>
        </Link>
        <Link to="/farmer/forecast" className="text-emerald-100/50 flex flex-col items-center gap-1 hover:text-emerald-100">
          <span className="material-symbols-outlined text-2xl">query_stats</span>
        </Link>
      </nav>
    </>
  )
}

function ConsumerNavigation() {
  const location = useLocation()

  const navItems = [
    { path: '/consumer/home', label: '\u{1F3E0} Home' },
    { path: '/consumer/orders', label: '\u{1F4E6} Orders' },
    { path: '/consumer/profile', label: '\u{1F464} Profile' },
  ]

  return (
    <nav className="sticky top-0 z-40 w-full bg-white/80 backdrop-blur-md border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex w-full">
            <div className="flex-shrink-0 flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
                 <span className="text-white font-bold text-lg">A</span>
              </div>
              <Link to="/consumer/home" className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-700 to-blue-500">
                AgroDirect
              </Link>
            </div>
            <div className="hidden sm:ml-auto sm:flex sm:space-x-8">
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium transition-colors duration-200 ${
                    location.pathname === item.path
                      ? 'border-blue-500 text-blue-700'
                      : 'border-transparent text-gray-500 hover:text-blue-600 hover:border-blue-300'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </nav>
  )
}

/**
 * Navigation component - renders based on role
 */
function Navigation() {
  const { user } = useAuth()
  const role = user?.role?.toUpperCase()

  if (role === 'FARMER') {
    return <FarmerNavigation />
  }

  if (role === 'CONSUMER') {
    return <ConsumerNavigation />
  }

  // Logistics has its own built-in navigation
  return null
}

/**
 * Protected route component for farmer interface
 */
function FarmerRoute({ children }) {
  const { user } = useAuth()
  const role = user?.role?.toUpperCase()

  if (role !== 'FARMER') {
    if (role === 'LOGISTICS') {
      return <Navigate to="/logistics/home" replace />
    }
    return <Navigate to="/consumer/home" replace />
  }

  return children
}

/**
 * Protected route component for logistics interface
 */
function LogisticsRoute({ children }) {
  const { user } = useAuth()
  const role = user?.role?.toUpperCase()

  if (role !== 'LOGISTICS') {
    if (role === 'FARMER') {
      return <Navigate to="/farmer/home" replace />
    }
    return <Navigate to="/consumer/home" replace />
  }

  return children
}

/**
 * Protected route component for consumer interface
 */
function ConsumerRoute({ children }) {
  const { user } = useAuth()
  const role = user?.role?.toUpperCase()

  if (role !== 'CONSUMER') {
    if (role === 'FARMER') {
      return <Navigate to="/farmer/home" replace />
    }
    return <Navigate to="/logistics/home" replace />
  }

  return children
}

/**
 * Component to handle default redirect based on role
 */
function RoleBasedRedirect() {
  const { user } = useAuth()
  const role = user?.role?.toUpperCase()

  if (role === 'CONSUMER') {
    return <Navigate to="/consumer/home" replace />
  }

  if (role === 'LOGISTICS') {
    return <Navigate to="/logistics/home" replace />
  }

  // Default to farmer home
  return <Navigate to="/farmer/home" replace />
}

/**
 * Main App component with routing
 */
function AppContent() {
  const { isAuthenticated, loading, user } = useAuth()
  const isFarmer = user?.role?.toUpperCase() === 'FARMER'

  // Show loading while checking auth
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  // Not authenticated - show auth routes only
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </div>
    )
  }

  // Authenticated - show full app
  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <AIChatWidget />
      
      <main className={isFarmer ? 'md:pl-20 pb-20 md:pb-0' : ''}>
        <Routes>
          <Route path="/" element={<RoleBasedRedirect />} />
          
          {/* Farmer Routes */}
          <Route
            path="/farmer/home"
            element={
              <FarmerRoute>
                <FarmerHomePage />
              </FarmerRoute>
            }
          />
          <Route
            path="/farmer/dashboard"
            element={
              <FarmerRoute>
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                  <FarmerDashboardIntegrated />
                </div>
              </FarmerRoute>
            }
          />
          <Route
            path="/farmer/add-product"
            element={
              <FarmerRoute>
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                  <AddProductEnhanced 
                    onSuccess={() => window.location.href = '/farmer/dashboard'}
                    onCancel={() => window.location.href = '/farmer/home'}
                  />
                </div>
              </FarmerRoute>
            }
          />
          <Route
            path="/farmer/settings"
            element={
              <FarmerRoute>
                <FarmerSettingsPage />
              </FarmerRoute>
            }
          />
          <Route
            path="/farmer/profile"
            element={
              <FarmerRoute>
                <FarmerProfilePage />
              </FarmerRoute>
            }
          />
          <Route
            path="/farmer/market/:categoryId"
            element={
              <FarmerRoute>
                <CategoryInsightsPage />
              </FarmerRoute>
            }
          />
          <Route
            path="/farmer/prices"
            element={
              <FarmerRoute>
                <PlatformPricesPage />
              </FarmerRoute>
            }
          />
          <Route
            path="/farmer/forecast"
            element={
              <FarmerRoute>
                <DemandForecastPage />
              </FarmerRoute>
            }
          />

          {/* Consumer Routes */}
          <Route
            path="/consumer/home"
            element={
              <ConsumerRoute>
                <ConsumerHomeIntegrated />
              </ConsumerRoute>
            }
          />

          <Route
            path="/consumer/orders"
            element={
              <ConsumerRoute>
                <OrderListIntegrated />
              </ConsumerRoute>
            }
          />

          <Route
            path="/consumer/product/:id"
            element={
              <ConsumerRoute>
                <ConsumerProductDetail />
              </ConsumerRoute>
            }
          />

          <Route
            path="/consumer/orders/:orderId/track"
            element={
              <ConsumerRoute>
                <ConsumerOrderTracking />
              </ConsumerRoute>
            }
          />
          <Route
            path="/consumer/profile"
            element={
              <ConsumerRoute>
                <ConsumerProfile />
              </ConsumerRoute>
            }
          />
          
          {/* Logistics Routes */}
          <Route
            path="/logistics/home"
            element={
              <LogisticsRoute>
                <LogisticsHome />
              </LogisticsRoute>
            }
          />
          <Route
            path="/logistics/orders"
            element={
              <LogisticsRoute>
                <LogisticsDashboardIntegrated />
              </LogisticsRoute>
            }
          />
          <Route
            path="/logistics/dashboard"
            element={
              <LogisticsRoute>
                <LogisticsDashboardIntegrated />
              </LogisticsRoute>
            }
          />
          <Route
            path="/logistics/delivery/:orderId"
            element={
              <LogisticsRoute>
                <LogisticsActiveDelivery />
              </LogisticsRoute>
            }
          />
          <Route
            path="/logistics/history"
            element={
              <LogisticsRoute>
                <LogisticsHistory />
              </LogisticsRoute>
            }
          />
          <Route
            path="/logistics/notifications"
            element={
              <LogisticsRoute>
                <LogisticsNotifications />
              </LogisticsRoute>
            }
          />
          <Route
            path="/logistics/profile"
            element={
              <LogisticsRoute>
                <LogisticsProfile />
              </LogisticsRoute>
            }
          />
          <Route
            path="/logistics/earnings"
            element={
              <LogisticsRoute>
                <LogisticsEarnings />
              </LogisticsRoute>
            }
          />
          <Route
            path="/logistics/routes"
            element={
              <LogisticsRoute>
                <RoutePlanningPage />
              </LogisticsRoute>
            }
          />
          <Route
            path="/logistics/routes/:id"
            element={
              <LogisticsRoute>
                <RouteDetailPage />
              </LogisticsRoute>
            }
          />
          <Route
            path="/logistics/kpi"
            element={
              <LogisticsRoute>
                <KPIDashboardPage />
              </LogisticsRoute>
            }
          />
          
          <Route path="*" element={<RoleBasedRedirect />} />
        </Routes>
      </main>
    </div>
  )
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </Router>
  )
}

export default App
