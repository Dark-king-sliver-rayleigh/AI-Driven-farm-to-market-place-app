import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * Register Page
 * Allows new users to create an account with role selection
 */
export function Register() {
  const navigate = useNavigate();
  const { register, error: authError } = useAuth();
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    vehicleCapacity: '',
    vehicleNumber: '',
    role: 'FARMER',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const roles = [
    { id: 'FARMER', label: 'Farmer', icon: '🌾', description: 'Sell your produce' },
    { id: 'CONSUMER', label: 'Consumer', icon: '🛒', description: 'Buy fresh produce' },
    { id: 'LOGISTICS', label: 'Delivery Partner', icon: '🚚', description: 'Deliver orders' },
  ];

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError('');
  };

  const handleRoleSelect = (roleId) => {
    setFormData({ ...formData, role: roleId });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Validation
    if (!formData.role) {
      setError('Please select a role');
      setLoading(false);
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      setLoading(false);
      return;
    }

    try {
      const response = await register(
        formData.name,
        formData.phone,
        formData.password,
        formData.role
      );
      
      // Redirect based on role
      switch (response.user.role) {
        case 'FARMER':
          navigate('/farmer/dashboard');
          break;
        case 'CONSUMER':
          navigate('/consumer/home');
          break;
        case 'LOGISTICS':
          navigate('/logistics/dashboard');
          break;
        default:
          navigate('/');
      }
    } catch (err) {
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const renderLogisticsElite = () => (
    <main className="relative bg-zinc-950 text-white overflow-hidden min-h-screen">
      {/* Scroll-Synced Cinematic Background Layer */}
      <div className="fixed inset-0 z-0 pointer-events-none w-full h-full">
        <img 
          alt="Cinematic Logistics" 
          className="absolute w-full h-full object-cover opacity-60 mix-blend-luminosity scale-105" 
          src="https://lh3.googleusercontent.com/aida-public/AB6AXuDenyhMGKwU_m0WJXkFSQ_AMWUfnD_crBSJouWXcZH0DosVcNY8V_j9MVGuUtSBLa8tmCBeNEsWxioDJlh67-lJ7bpIZ4DXjILau8sShzbHBR5VYDPvnVVnDqyVDYS8_49m1wJAkNRaOZUivRTZw6FN14Qf6pjlNoBzMMm_6-JBlgm9Hm6ukXQAS-1VX0bIXcD_Ps6L3r7R0wFS82PfMsnivgxJpScy0WduGs_ByVkE8gIT8IXHwH22GpkfdWXfm6tnFsZTC7_P0nU"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-zinc-950/80 via-transparent to-zinc-950"></div>
      </div>

      {/* TopNavBar */}
      <nav className="absolute top-0 w-full z-50 flex justify-between items-center px-8 py-6 max-w-full font-['Satoshi'] tracking-tight bg-white/5 backdrop-blur-md">
        <div className="text-xl font-bold tracking-tighter text-white">Logistics Elite</div>
        <div className="flex items-center gap-4">
          <button 
             onClick={() => setFormData({...formData, role: 'FARMER'})}
             className="px-6 py-2 rounded-full border border-white/20 text-white font-semibold hover:bg-white/10 transition-all active:scale-95 text-sm"
             type="button"
          >
            ← Back to Roles
          </button>
        </div>
      </nav>

      {/* Main Content Canvas */}
      <div className="relative z-10 w-full flex flex-col items-center pt-32 pb-40 px-6 font-sans h-full overflow-y-auto">
        <div className="max-w-xl w-full backdrop-blur-2xl bg-white/10 border border-white/10 rounded-xl md:rounded-full p-8 md:p-16 shadow-[0_40px_80px_-15px_rgba(0,0,0,0.5)] transition-all duration-700 hover:bg-white/[0.12] group">
          
          <div className="mb-12 space-y-4 text-center">
            <h1 className="text-5xl md:text-6xl font-bold leading-[1.1] tracking-tighter text-white">
                                Partner with <br/><span className="text-emerald-500">the Harvest</span>
            </h1>
            <p className="text-zinc-400 text-lg font-medium leading-relaxed max-w-sm mx-auto">
                                Join our logistics network connecting farms to tables.
                            </p>
          </div>

          {/* Registration Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {(error || authError) && (
              <div className="bg-red-500/20 border border-red-500/50 px-4 py-3 rounded-xl mb-6 text-sm font-medium text-red-200 text-center">
                {error || authError}
              </div>
            )}

            <div className="relative group/input">
              <input 
                 type="text" 
                 name="name" 
                 value={formData.name} 
                 onChange={handleChange} 
                 required 
                 className="w-full bg-zinc-100/10 border-none rounded-full px-8 py-4 text-white placeholder:text-zinc-500 focus:ring-2 focus:ring-emerald-600 focus:bg-zinc-100/20 transition-all duration-300 font-medium outline-none" 
                 placeholder="Full Name" 
              />
            </div>

            <div className="relative group/input">
              <input 
                 type="tel" 
                 name="phone" 
                 value={formData.phone} 
                 onChange={handleChange} 
                 required 
                 className="w-full bg-zinc-100/10 border-none rounded-full px-8 py-4 text-white placeholder:text-zinc-500 focus:ring-2 focus:ring-emerald-600 focus:bg-zinc-100/20 transition-all duration-300 font-medium outline-none" 
                 placeholder="Phone Number" 
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="relative flex items-center">
                <input 
                   type="password" 
                   name="password" 
                   value={formData.password} 
                   onChange={handleChange} 
                   required 
                   className="w-full bg-zinc-100/10 border-none rounded-full px-8 py-4 text-white placeholder:text-zinc-500 focus:ring-2 focus:ring-emerald-600 focus:bg-zinc-100/20 transition-all duration-300 font-medium outline-none" 
                   placeholder="Password" 
                />
              </div>
              <div className="relative flex items-center">
                <input 
                   type="password" 
                   name="confirmPassword" 
                   value={formData.confirmPassword} 
                   onChange={handleChange} 
                   required 
                   className="w-full bg-zinc-100/10 border-none rounded-full px-8 py-4 text-white placeholder:text-zinc-500 focus:ring-2 focus:ring-emerald-600 focus:bg-zinc-100/20 transition-all duration-300 font-medium outline-none" 
                   placeholder="Confirm Password" 
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="relative">
                <input 
                   type="text" 
                   name="vehicleCapacity" 
                   value={formData.vehicleCapacity} 
                   onChange={handleChange} 
                   className="w-full bg-zinc-100/10 border-none rounded-full px-8 py-4 text-white placeholder:text-zinc-500 focus:ring-2 focus:ring-emerald-600 focus:bg-zinc-100/20 transition-all duration-300 font-medium outline-none" 
                   placeholder="Vehicle Capacity" 
                />
              </div>
              <div className="relative">
                <input 
                   type="text" 
                   name="vehicleNumber" 
                   value={formData.vehicleNumber} 
                   onChange={handleChange} 
                   className="w-full bg-zinc-100/10 border-none rounded-full px-8 py-4 text-white placeholder:text-zinc-500 focus:ring-2 focus:ring-emerald-600 focus:bg-zinc-100/20 transition-all duration-300 font-medium outline-none" 
                   placeholder="Vehicle Number" 
                />
              </div>
            </div>

            {/* Upload Area Visual Only */}
            <div className="relative group/upload">
              <label className="flex flex-col items-center justify-center w-full h-32 px-8 py-4 bg-zinc-100/5 border-2 border-dashed border-white/20 rounded-xl md:rounded-full cursor-pointer hover:bg-zinc-100/10 hover:border-emerald-600/50 transition-all duration-300">
                <div className="flex items-center gap-3">
                  <span className="text-emerald-500 text-2xl font-bold">+</span>
                  <span className="text-sm font-semibold text-zinc-300">Upload Driver's License</span>
                </div>
                <p className="mt-1 text-[10px] text-zinc-500 uppercase tracking-widest">JPG, PNG, or PDF</p>
                <input className="hidden" type="file" />
              </label>
            </div>

            <div className="pt-6">
              <button 
                 type="submit" 
                 disabled={loading}
                 className="w-full py-5 bg-emerald-600 text-white rounded-full font-bold text-sm uppercase tracking-widest hover:bg-emerald-500 transition-all active:scale-[0.98] shadow-[0_20px_40px_-10px_rgba(0,105,72,0.4)] disabled:opacity-50"
              >
                {loading ? 'Processing...' : 'Create Account'}
              </button>
            </div>
          </form>

          <div className="mt-8 text-center">
            <p className="text-zinc-500 text-sm">
                                Already a partner? <Link className="text-emerald-500 font-bold hover:underline" to="/login">Log in here</Link>
            </p>
          </div>
        </div>

        {/* Scroll Indicator */}
        <div className="mt-8 flex flex-col items-center animate-bounce opacity-50">
          <span className="text-[10px] uppercase tracking-widest text-zinc-500 mb-2">Scroll to explore</span>
        </div>

        {/* Asymmetric Detail Section */}
        <section className="mt-20 max-w-5xl w-full grid md:grid-cols-12 gap-12 items-center pb-20">
          <div className="md:col-span-5 space-y-6">
            <p className="text-zinc-400 font-medium leading-relaxed">We don't just move freight. We preserve freshness. Our proprietary routing algorithms ensure that every harvest reaches its destination at peak quality.</p>
            <div className="flex gap-4">
              <div className="p-4 bg-zinc-800/50 rounded-lg">
                <p className="text-emerald-500 text-3xl font-black">98%</p>
                <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">On-Time Delivery</p>
              </div>
              <div className="p-4 bg-zinc-800/50 rounded-lg">
                <p className="text-emerald-500 text-3xl font-black">1.2M</p>
                <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">Tons Shipped</p>
              </div>
            </div>
          </div>
          <div className="md:col-span-7 flex justify-end">
            <img 
               alt="Cargo Trailer" 
               className="w-full h-80 md:h-[500px] object-cover rounded-lg shadow-2xl grayscale hover:grayscale-0 transition-all duration-700" 
               src="https://lh3.googleusercontent.com/aida-public/AB6AXuDauFT9GXDp3TRU0CDi1v7jaipM-cFV4lC9LwPaWg2YJx1KmyEavAYCxB5oOKhIj9ed0OauOPMIePgDPFoAiuu0wcVQgAqzpRPjKOJAq59VTUykeCJvFmyYXxgk805KQpk02l53nZOeL9cRZ3KCyxknjnal9o5z5efEqb6406XV2xg1ofg1KpBXMm2XV06RaqS2WIIMb8GK0yHiJgkOAZYX0CQ-9pMIS6ZfONE_813UfVBbQsStjQLvh4KFvLdHvzajzwMflyq9PKk"
            />
          </div>
        </section>

        {/* Footer Visual */}
        <footer className="w-full py-12 px-8 flex justify-between items-center text-zinc-600 border-t border-white/5 bg-zinc-950/80 backdrop-blur-xl rounded-xl">
          <div className="text-[10px] font-bold uppercase tracking-widest">© 2024 Logistics Elite Editorial</div>
          <div className="flex gap-8 text-[10px] font-bold uppercase tracking-widest">
            <a className="hover:text-emerald-500 transition-colors" href="#">Privacy</a>
            <a className="hover:text-emerald-500 transition-colors" href="#">Terms</a>
          </div>
        </footer>
      </div>
    </main>
  );

  const renderEditorialHarvest = () => (
    <main className="flex h-screen w-full font-sans antialiased overflow-hidden bg-[#f8f9fa] text-zinc-900" style={{ fontFamily: '"Manrope", sans-serif' }}>
      {/* Left Sidebar: Anchor */}
      <aside className="fixed left-0 top-0 h-full w-full md:w-[40%] bg-zinc-950 flex flex-col justify-between p-12 z-50 hidden md:flex">
        {/* Brand Wordmark */}
        <div className="flex flex-col gap-1">
          <span className="text-2xl font-bold text-white tracking-tighter" style={{ fontFamily: '"Epilogue", sans-serif' }}>AgroDirect</span>
          <span className="text-[11px] uppercase tracking-wider font-semibold text-zinc-500">AI-driven Farm to Consumer Marketplace</span>
        </div>

        {/* Cinematic Visual */}
        <div className="relative w-full h-[45%] overflow-hidden rounded-lg group">
          <img 
            alt="Farmer's Market" 
            className="w-full h-full object-cover grayscale-[20%] group-hover:grayscale-0 transition-all duration-700" 
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuCwfV5Xgtm0WYD9UidiPNxAU9p7-zFaRqPXRt6-EC3rV4KQFh2h8_mWsB0X4R97LeLc1HKh9Wt4rhWUDXSaaP03pd_lYpzvuDu_dmr11m3ob9m1AzTprRKw0sdxP2rLPhepXihJkEHMxXzJichwAEY5veNAuPoctOxfqrfjmnOBJ_2k8V9dKCLNJN4lNXpbop7Kp8SsXvGVdl8guC2NlDN3FtSK4X7LdleE-Q3-ucxiZ2D2gUOOQ-Spa7wQOIoxHno6t2EMlD7zb60"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-transparent to-transparent"></div>
        </div>

        {/* Role-Benefit Lines & Footer */}
        <div className="flex flex-col gap-12">
          <div className="space-y-6">
            <div className="flex flex-col">
              <span className="text-emerald-400 font-bold text-lg" style={{ fontFamily: '"Epilogue", sans-serif' }}>Farmer</span>
              <p className="text-zinc-400 text-sm leading-relaxed">List produce, set prices, grow direct sales</p>
            </div>
            <div className="flex flex-col">
              <span className="text-emerald-400 font-bold text-lg" style={{ fontFamily: '"Epilogue", sans-serif' }}>Consumer</span>
              <p className="text-zinc-400 text-sm leading-relaxed">Order farm-fresh goods, track every delivery</p>
            </div>
            <div className="flex flex-col">
              <span className="text-emerald-400 font-bold text-lg" style={{ fontFamily: '"Epilogue", sans-serif' }}>Delivery Partner</span>
              <p className="text-zinc-400 text-sm leading-relaxed">Accept routes, earn per trip, full flexibility</p>
            </div>
          </div>

          {/* Footer */}
          <div className="flex gap-6 items-center justify-start text-[11px] font-medium text-zinc-500">
            <span>AgroDirect · Farm to Consumer</span>
            <span className="hover:text-emerald-600 underline transition-all cursor-pointer">Privacy Policy</span>
            <span className="hover:text-emerald-600 underline transition-all cursor-pointer">Terms of Service</span>
          </div>
        </div>
      </aside>

      {/* Right Content: Stage */}
      <section className="w-full md:ml-[40%] md:w-[60%] h-full bg-[#f8f9fa] overflow-y-auto flex flex-col items-center md:items-start justify-center px-8 md:px-24 py-16">
        <div className="w-full max-w-[480px]">
          <header className="mb-12">
            <h1 className="text-4xl font-bold tracking-tight text-zinc-900 mb-2" style={{ fontFamily: '"Epilogue", sans-serif' }}>Join the Harvest</h1>
            <p className="text-zinc-500 text-sm">Empowering direct trade between land and table.</p>
          </header>

          <form onSubmit={handleSubmit} className="space-y-8">
            {(error || authError) && (
              <div className="bg-red-50 border border-red-200 px-4 py-3 rounded-xl mb-6 text-sm font-medium text-red-600">
                {error || authError}
              </div>
            )}

            {/* Role Selection Tabs */}
            <div className="space-y-3">
              <label className="text-[11px] uppercase tracking-wider font-semibold text-zinc-500 block">Select Your Role</label>
              <div className="flex p-1 bg-zinc-100 rounded-full w-full">
                {roles.map((role) => (
                  <button
                    key={role.id}
                    type="button"
                    onClick={() => handleRoleSelect(role.id)}
                    className={`flex-1 py-3 px-2 md:px-4 rounded-full text-xs md:text-sm font-semibold transition-all duration-200 ${
                        formData.role === role.id
                          ? 'bg-emerald-600 text-white shadow-sm'
                          : 'text-zinc-600 hover:bg-zinc-200'
                      }`}
                  >
                    {role.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Flat Pill Inputs */}
            <div className="space-y-2">
              <label className="text-[11px] uppercase tracking-wider font-semibold text-zinc-500 block" htmlFor="full-name">Full Name</label>
              <input 
                 type="text" 
                 id="full-name" 
                 name="name" 
                 placeholder="E.g. Julian Rivers" 
                 value={formData.name} 
                 onChange={handleChange} 
                 required 
                 className="w-full h-[48px] bg-zinc-100 border border-zinc-200 border-opacity-20 rounded-full px-6 text-zinc-900 placeholder:text-zinc-400 focus:ring-0 focus:border-emerald-500 transition-all outline-none text-sm" 
              />
            </div>

            {formData.role === 'CONSUMER' && (
              <div className="space-y-2">
                <label className="text-[11px] uppercase tracking-wider font-semibold text-zinc-500 block" htmlFor="email">Email Address</label>
                <input 
                   type="email" 
                   id="email" 
                   name="email" 
                   placeholder="julian.rivers@example.com" 
                   value={formData.email} 
                   onChange={handleChange} 
                   required 
                   className="w-full h-[48px] bg-zinc-100 border border-zinc-200 border-opacity-20 rounded-full px-6 text-zinc-900 placeholder:text-zinc-400 focus:ring-0 focus:border-emerald-500 transition-all outline-none text-sm" 
                />
              </div>
            )}

            <div className="space-y-2">
              <label className="text-[11px] uppercase tracking-wider font-semibold text-zinc-500 block" htmlFor="phone">Phone Number</label>
              <input 
                 type="tel" 
                 id="phone" 
                 name="phone" 
                 placeholder="+91" 
                 value={formData.phone} 
                 onChange={handleChange} 
                 required 
                 className="w-full h-[48px] bg-zinc-100 border border-zinc-200 border-opacity-20 rounded-full px-6 text-zinc-900 placeholder:text-zinc-400 focus:ring-0 focus:border-emerald-500 transition-all outline-none text-sm" 
              />
            </div>

            <div className="space-y-2">
              <label className="text-[11px] uppercase tracking-wider font-semibold text-zinc-500 block" htmlFor="password">Password</label>
              <div className="relative">
                <input 
                   type="password" 
                   id="password" 
                   name="password" 
                   value={formData.password} 
                   onChange={handleChange} 
                   required 
                   className="w-full h-[48px] bg-zinc-100 border border-zinc-200 border-opacity-20 rounded-full px-6 text-zinc-900 placeholder:text-zinc-400 focus:ring-0 focus:border-emerald-500 transition-all outline-none text-sm" 
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[11px] uppercase tracking-wider font-semibold text-zinc-500 block" htmlFor="confirm-password">Confirm Password</label>
              <div className="relative">
                <input 
                   type="password" 
                   id="confirm-password" 
                   name="confirmPassword" 
                   value={formData.confirmPassword} 
                   onChange={handleChange} 
                   required 
                   className="w-full h-[48px] bg-zinc-100 border border-zinc-200 border-opacity-20 rounded-full px-6 text-zinc-900 placeholder:text-zinc-400 focus:ring-0 focus:border-emerald-500 transition-all outline-none text-sm" 
                />
              </div>
            </div>

            {/* CTA Button */}
            <div className="pt-4 space-y-6">
              <button 
                 type="submit" 
                 disabled={loading}
                 className="w-full h-[48px] bg-emerald-600 text-white rounded-full font-semibold text-sm tracking-wide flex items-center justify-center relative overflow-hidden transition-all active:scale-[0.98] disabled:opacity-50 group" 
                 style={{ fontFamily: '"Epilogue", sans-serif' }}
              >
                <div className="absolute inset-0 shimmer-bg opacity-0 group-hover:opacity-100 transition-opacity"></div>
                {loading ? (
                    <span className="flex items-center gap-2 relative z-10">
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Creating...
                    </span>
                ) : (
                    <span className="relative z-10">Create Account</span>
                )}
              </button>
              
              <div className="text-center">
                <span className="text-zinc-500 text-sm">Already have an account? </span>
                <Link to="/login" className="text-emerald-600 font-semibold text-sm hover:text-emerald-700 transition-colors">Sign in here</Link>
              </div>
            </div>
          </form>
        </div>
      </section>

      {/* Top Navigation (Subtle) */}
      <nav className="absolute top-0 right-0 w-full md:w-[60%] h-20 flex items-center justify-end px-12 z-40 hidden md:flex">
        <span className="text-zinc-500 text-xs font-medium hover:text-emerald-700 transition-opacity opacity-80 hover:opacity-100 cursor-pointer">
          Contact Support
        </span>
      </nav>
    </main>
  );

  return (formData.role === 'FARMER' || formData.role === 'CONSUMER') ? renderEditorialHarvest() : renderLogisticsElite();
}
