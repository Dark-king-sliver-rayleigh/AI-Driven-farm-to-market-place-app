import React from 'react';
import { useMarketCategories } from '../../hooks/usePriceInsight';
import { useAuth } from '../../context/AuthContext';
import { Link } from 'react-router-dom';

/**
 * Helper to map category names to Stitch UI 3D images and color themes.
 * Fallbacks are provided for unrecognized categories.
 */
const getCategoryStyle = (categoryName = '') => {
  const name = categoryName.toLowerCase();
  
  if (name.includes('vegetable') || name.includes('leaf') || name.includes('green')) {
    return {
      bgHover: 'hover:bg-emerald-900/10',
      shadowColor: 'rgba(134,254,167,0.3)',
      imgUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAgiq_O3OTJ1CIE1ikGk56Da6vmM4HZHyfYFgxHKU9WFcLzgetPD4lGQ39O-ZGsMZMjkVb_gO8-ppmtnE_9FWAJEVSZFAFlzs3_MQYexzyT2NsaemQnUcZmD5Kj_nZVHp-LQIMLFTCuJ09eRBIdok0BIZh_pacmcDEccom4o9ZeeFaLjhmoqDyxi-LGYtqbSxJ6LdLMspqtI8Gcv0PjVAoo8jMgRP28GpsTPueq6RJpQYEYsVrqwWSN41uOrNGZsiPe-MBFDoAyrOM',
      colorToken: 'text-primary',
      bgToken: 'bg-primary/20',
      label: 'Vegetables',
    };
  }
  if (name.includes('fruit') || name.includes('orchard')) {
    return {
      bgHover: 'hover:bg-red-950/10',
      shadowColor: 'rgba(255,113,108,0.2)',
      imgUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBi1p6DQsgICI1q3pg91vqYscG9oc0Qd7bNcnElW8K2fI0R2UGkmpFap1tGdVrM8PGyx8FiRPn5qR1sfHkkAvO4ja0AcYWNQIFy56kPqBy2nO6WUzMblVzTbPE21Skik8uBjzkLcG3a77cF-Z-dAT31zX6vLE6Xn-05T9xgWc4o9U89YSG24u3liT0ar7x_uFiYACS4IdnXnK6k1SNIveMIT_57_i6CwAfBVOQ9q3Ct5wBscs7HbRueqmBqDylZejNj_ZtWIHXwozs',
      colorToken: 'text-error',
      bgToken: 'bg-error/20',
      label: 'Fruits',
    };
  }
  if (name.includes('cereal') || name.includes('grain')) {
    return {
      bgHover: 'hover:bg-orange-900/10',
      shadowColor: 'rgba(255,159,74,0.3)',
      imgUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAxnceEjjK7TbabKMz8uYoo1WNKj7XPza9ubIqDP4_Kz9sKDHuWCzT5KhnEab2TKQMz-KJFWKgJ5bZCya4k9cRm51NdCn9c5tXQDLqAR_bLGQZ95mOJazdyiiuhcBTIxoZ7m89Dd1vvYutup_xmA0kScwT6Ph8basFVp0Hjc-pbZduJM4sFb9AgJqqcgWasKF2BTvODB9TUX2ljcRFw_6YYtj4Wrx7TTiXcA5KVl5Oct7X3LGnBaPBCReDtSfhYYdFmxPVCygKjFaE',
      colorToken: 'text-tertiary',
      bgToken: 'bg-tertiary/20',
      label: 'Cereals',
    };
  }
  if (name.includes('pulse') || name.includes('legume')) {
    return {
      bgHover: 'hover:bg-blue-950/10',
      shadowColor: 'rgba(111,155,255,0.2)',
      imgUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuD1sWSeeCiP0hlrQtREz8cdi0mUqmAngyQgJPql-VYuRN5PtR4nZKae2-xPnjDaX1lhOMI-bq536wHYAfN202K-dE8pXcVqbv3xVHKiIay1V0JhdBCxYOctsU2RBSap1z6btW0XwQ9BQ0IccnnCZX2798zZOyblYxEaBqaXckSJ9yn6UgPqAh8WE265t-z5mXadr_rmeKVZpW7DS5ciFTpLUwzquD7LoNeLwI2hthBGwrXsqIVGBW7Hj_B1OOurokzvCDk5OcdlMoo',
      colorToken: 'text-secondary',
      bgToken: 'bg-secondary/20',
      label: 'Pulses',
    };
  }
  if (name.includes('spice')) {
    return {
      bgHover: 'hover:bg-orange-950/10',
      shadowColor: 'rgba(253,139,0,0.3)',
      imgUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuChQnF5G5CCs3WfiT5WNkvOpJi-Mg8ur-XnCDXj91QXBSUrvwtY4I8ZAv8ejvaqdLSgf9Q4o-8krgKkZQZuwEB2XadGORf9bzaz9Ab8DrKS99Dr2GZPZ5M7MjNMBRoOoMVYG0eKNM1AhjFDOFKzgVvhNMXNo9R2uEG7ysB_Y4Ew4FcIrI7Rt9rZaH2ap4XI3DNeuZ7RTretFuRdJCoV_lra9BwxkF026WtVJEMC_OUyp4h-xuoZND0vPKkBxnBkpPZFGiBAIEfbxmU',
      colorToken: 'text-tertiary-fixed',
      bgToken: 'bg-tertiary-container/20',
      label: 'Spices',
    };
  }
  
  // Default / Others
  return {
    bgHover: 'hover:bg-white/5',
    shadowColor: 'rgba(255,255,255,0.1)',
    imgUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAgEfs5mEWIdkCIpDIXBB-U66TkgknH-ilPs8KPOjCpnTdVE9D7SEKhnvyn7fpheYmAFhs8UQyN3XM2fCHh-cgBBSj5Y8mA4JX7uFqAoOCv-aNmFDGWcEzfumd1Dvx4TXC1IRXXpQ_HgOg-MsVkSG9LJATgBgo8lcYvDTV0qx5jBYVcKGf9LUPiCXrhWiyt_3aVS8zKpVhSPiDJ3N-YQFPW7oPwGea5HzxPSYkCVHBkcsb5WxHWrxvcMsMa7d-r2vH1Ss1LWiIG8Cg',
    colorToken: 'text-on-surface-variant',
    bgToken: 'bg-surface-container-highest',
    label: 'Others',
  };
};

export function FarmerHomePage() {
  const { user, logout } = useAuth();
  const { categories, loading, error, refetch } = useMarketCategories();

  // If there are no dynamic categories, we supply a dummy fallback to match the original static cards briefly if API fails.
  const displayCategories = categories && categories.length > 0 ? categories : [
    { id: 1, name: 'Vegetables', commodityCount: 55, trendMsg: 'Demand Spike', trendVal: '+12.4%' },
    { id: 2, name: 'Fruits', commodityCount: 38, trendMsg: 'Stable Volume', trendVal: '-2.1%' },
    { id: 3, name: 'Cereals', commodityCount: 12, trendMsg: 'Futures Up', trendVal: '+8.7%' },
    { id: 4, name: 'Pulses', commodityCount: 20, trendMsg: 'Supply Chain Log', trendVal: 'SECURE' },
    { id: 5, name: 'Spices', commodityCount: 15, trendMsg: 'Luxury Trend', trendVal: '+15.2%' }
  ];

  return (
    <div className="bg-surface-dim text-on-surface font-body selection:bg-primary selection:text-on-primary-container min-h-[calc(100vh-4rem)] overflow-x-hidden relative -mt-6 -mx-4 sm:-mx-6 lg:-mx-8">
      
      {/* Environmental Overlay (HUD) */}
      <div className="absolute inset-0 pointer-events-none z-0">
        <div className="absolute inset-0 hud-glow-tl"></div>
        <div className="absolute inset-0 hud-glow-br"></div>
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "url('https://lh3.googleusercontent.com/aida-public/AB6AXuAHUetmVGaZBUvmveYZz9Ap8P0TvWQm0Qhhw9bTBQr1smFG9flHr8_4T2ELLos-sw4Xx28QYSQryBWMqjfC1yLiVEOcwiuzm2l5wbqE7f2LXeZklATJuXegGAU7SWhNh_nXp4jKcCG5xPTJdvooxhTVoe1gmllAR4fiNJJhy1jV7c4g08Cg98IMF8NUiXvyVW1ZRmjW4Fx_pdw6EAXIZWqT87-MwRe9TrcvLm88-qzZ2KvMkE_fw_zRq-YoyzbcOFSNxFQZ231PVTo')" }}></div>
      </div>

      {/* Ambient Particle Effect Container */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden mix-blend-screen opacity-30 z-0">
        <div className="absolute top-1/4 left-1/4 w-1 h-1 bg-white rounded-full animate-pulse shadow-[0_0_10px_white]"></div>
        <div className="absolute top-1/2 left-3/4 w-0.5 h-0.5 bg-white rounded-full animate-pulse shadow-[0_0_8px_white]"></div>
        <div className="absolute bottom-1/4 right-1/2 w-1.5 h-1.5 bg-primary/40 rounded-full animate-pulse shadow-[0_0_12px_rgba(134,254,167,0.5)]"></div>
      </div>



      {/* Main Content Area */}
      <main className="pl-6 md:pl-28 pr-6 md:pr-10 pb-20 pt-12 max-w-screen-2xl mx-auto z-10 relative">
        <section className="mb-20">
          <div className="flex flex-col md:flex-row justify-between items-end mb-12">
            <div className="max-w-2xl">
              <span className="text-tertiary font-label font-bold tracking-widest text-sm uppercase block mb-2">Ecosystem Overview</span>
              <h1 className="text-4xl md:text-5xl font-black font-headline text-on-surface tracking-tight">
                Welcome, {user?.name || 'Farmer'}!
              </h1>
              <p className="text-on-surface-variant mt-4 text-lg">Real-time biometrics and market synchronization for your product nodes.</p>
            </div>
            <div className="hidden lg:block text-right">
              <p className="text-4xl font-bold font-headline text-primary">Active</p>
              <p className="text-xs font-label text-on-surface-variant uppercase tracking-widest">Market Status</p>
            </div>
          </div>

          {/* Quick Actions (mapped from old app actions) transformed into 3D Glassmorphic Action Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Add Product */}
            <Link to="/farmer/add-product" className="group relative overflow-hidden glass-panel rounded-3xl p-8 border-t border-primary/20 shadow-2xl hover:scale-[1.02] transition-all duration-500 text-left block cursor-pointer">
              <div className="absolute -right-4 -bottom-4 w-32 h-32 bg-primary/10 blur-3xl group-hover:bg-primary/20 transition-all"></div>
              <div className="relative z-10">
                <div className="w-14 h-14 rounded-2xl bg-primary/20 flex items-center justify-center text-primary mb-6 group-hover:shadow-[0_0_20px_rgba(134,254,167,0.4)] transition-all">
                  <span className="material-symbols-outlined text-3xl">add_box</span>
                </div>
                <h3 className="text-xl font-bold font-headline text-white mb-1">Add Product</h3>
                <p className="text-on-surface-variant text-sm font-label">Register new cultivation</p>
              </div>
            </Link>

            {/* Inventory */}
            <Link to="/farmer/dashboard" className="group relative overflow-hidden glass-panel rounded-3xl p-8 border-t border-secondary/20 shadow-2xl hover:scale-[1.02] transition-all duration-500 text-left block cursor-pointer">
              <div className="absolute -right-4 -bottom-4 w-32 h-32 bg-secondary/10 blur-3xl group-hover:bg-secondary/20 transition-all"></div>
              <div className="relative z-10">
                <div className="w-14 h-14 rounded-2xl bg-secondary/20 flex items-center justify-center text-secondary mb-6 group-hover:shadow-[0_0_20px_rgba(111,155,255,0.4)] transition-all">
                  <span className="material-symbols-outlined text-3xl">inventory</span>
                </div>
                <h3 className="text-xl font-bold font-headline text-white mb-1">Inventory</h3>
                <p className="text-on-surface-variant text-sm font-label">Real-time stock analytics</p>
              </div>
            </Link>

            {/* Orders */}
            <Link to="/farmer/dashboard" className="group relative overflow-hidden glass-panel rounded-3xl p-8 border-t border-tertiary/20 shadow-2xl hover:scale-[1.02] transition-all duration-500 text-left block cursor-pointer">
              <div className="absolute -right-4 -bottom-4 w-32 h-32 bg-tertiary/10 blur-3xl group-hover:bg-tertiary/20 transition-all"></div>
              <div className="relative z-10">
                <div className="w-14 h-14 rounded-2xl bg-tertiary/20 flex items-center justify-center text-tertiary mb-6 group-hover:shadow-[0_0_20px_rgba(255,159,74,0.4)] transition-all">
                  <span className="material-symbols-outlined text-3xl">shopping_bag</span>
                </div>
                <h3 className="text-xl font-bold font-headline text-white mb-1">Orders</h3>
                <p className="text-on-surface-variant text-sm font-label">Active trade fulfillment</p>
              </div>
            </Link>

            {/* Settings */}
            <Link to="/farmer/settings" className="group relative overflow-hidden glass-panel rounded-3xl p-8 border-t border-outline/20 shadow-2xl hover:scale-[1.02] transition-all duration-500 text-left block cursor-pointer">
              <div className="absolute -right-4 -bottom-4 w-32 h-32 bg-outline/10 blur-3xl group-hover:bg-outline/20 transition-all"></div>
              <div className="relative z-10">
                <div className="w-14 h-14 rounded-2xl bg-surface-container-highest flex items-center justify-center text-on-surface mb-6 group-hover:shadow-[0_0_20px_rgba(255,255,255,0.2)] transition-all">
                  <span className="material-symbols-outlined text-3xl">tune</span>
                </div>
                <h3 className="text-xl font-bold font-headline text-white mb-1">Settings</h3>
                <p className="text-on-surface-variant text-sm font-label">System calibration</p>
              </div>
            </Link>
          </div>
        </section>

        {/* Market Insights Section */}
        <section>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-10 gap-4">
            <h2 className="text-3xl font-bold font-headline text-white tracking-tight">Market Insights</h2>
            <div className="flex gap-2">
              {loading && <span className="px-4 py-1.5 rounded-full bg-surface-container-high border border-outline-variant/30 text-xs font-label text-on-surface-variant">Loading...</span>}
              <button onClick={refetch} disabled={loading} className="px-4 py-1.5 hover:bg-primary/20 rounded-full bg-primary/10 border border-primary/20 text-xs font-label text-primary cursor-pointer disabled:opacity-50">
                ↻ Refresh Live Data
              </button>
            </div>
          </div>

          {error && <div className="p-4 bg-error-container/20 border border-error/50 text-error rounded-xl mb-4 text-sm">{error.message || 'Failed to load insights.'}</div>}

          {/* Bento Grid layout applied to dynamic categories */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {displayCategories.map((cat, idx) => {
              const theme = getCategoryStyle(cat.name);
              const trendMsg = cat.trendMsg || 'Monitored';
              const trendVal = cat.trendVal || `${cat.commodityCount || 0} items`;

              // Introduce hover animation uniqueness based on index to replicate original slightly
              const hoverRotation = idx % 2 === 0 ? 'group-hover:rotate-6' : 'group-hover:-rotate-6';

              return (
                <Link key={cat.id || cat.name} to={`/farmer/market/${cat.id || cat.name.toLowerCase()}`} className={`group relative glass-panel rounded-[2rem] p-8 overflow-visible h-80 flex flex-col justify-end border border-white/5 transition-all duration-500 ${theme.bgHover} block cursor-pointer`}>
                  <div className={`absolute -top-12 -right-8 w-44 h-44 md:w-48 md:h-48 transition-transform duration-700 group-hover:scale-110 ${hoverRotation} group-hover:-translate-y-2 pointer-events-none`} style={{ filter: `drop-shadow(0 35px 35px ${theme.shadowColor})` }}>
                    <img 
                      alt={theme.label} 
                      className="w-full h-full object-contain" 
                      src={theme.imgUrl} 
                    />
                  </div>
                  <div className="relative z-10 pointer-events-none">
                    <span className={`${theme.colorToken} font-label text-xs font-bold uppercase tracking-widest mb-2 block`}>{theme.label}</span>
                    <h4 className="text-2xl font-bold font-headline text-white break-words pr-12">{cat.name}</h4>
                    <div className="flex items-center gap-4 mt-4">
                      <div className={`${theme.bgToken} px-3 py-1 rounded-md`}>
                        <span className={`${theme.colorToken} font-label font-bold text-sm`}>{trendVal}</span>
                      </div>
                      <span className="text-on-surface-variant text-xs font-label truncate">{trendMsg}</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      </main>


    </div>
  );
}
