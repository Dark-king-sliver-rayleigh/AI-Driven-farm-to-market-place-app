import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * Login Page
 * Allows users to login with phone and password
 */
export function Login() {
  const navigate = useNavigate();
  const { login, error: authError } = useAuth();
  
  const [formData, setFormData] = useState({
    phone: '',
    password: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await login(formData.phone, formData.password);
      
      // Redirect based on role
      switch (response.user.role) {
        case 'FARMER':
          navigate('/farmer/home');
          break;
        case 'CONSUMER':
          navigate('/consumer/home');
          break;
        case 'LOGISTICS':
          navigate('/logistics/home');
          break;
        default:
          navigate('/');
      }
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex h-screen w-full font-sans antialiased overflow-hidden bg-white text-zinc-900">
      {/* Left Panel */}
      <section className="relative hidden md:flex md:w-[55%] h-full overflow-hidden border-r border-zinc-200">
        <img 
          alt="AgroDirect Farmland" 
          className="absolute inset-0 w-full h-full object-cover" 
          src="https://lh3.googleusercontent.com/aida-public/AB6AXuCx9NmaORAZg4Im8mstPJm8txtF9tZuQxDxxFpSUNmFTBF3rgrjqXYhryiyDwpChaNfOw-0LtEnnjWwwbHx1cqOzNmpDCpT7bRyqM_NtkwiFinnOLdfw1aP9J5K2ZY_BpOPTrrXRDv1ayGMJhZc7HcovWi8vyRXcPWhABsZGdY6vYmicvObFVCj8robIzxCHNId0H9xHs223hkaYcZI2BMfYddh5I7WxMisa7zcA3TBIZIzmcdyfxa_dVdG2R1x_G3u1zTOU69hTtk"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/60"></div>
        {/* Branding */}
        <div className="absolute top-12 left-12 z-10">
          <span className="text-[32px] font-bold text-white tracking-tight leading-none">AgroDirect</span>
        </div>
        {/* Contextual Badge */}
        <div className="absolute top-12 right-12 z-10">
          <div className="flex items-center gap-3 bg-white/10 backdrop-blur-md px-4 py-2 border border-white/20">
            <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="text-[10px] font-bold text-white uppercase tracking-widest leading-none">47,280+ farmers connected</span>
          </div>
        </div>
        {/* Testimonial */}
        <div className="absolute bottom-12 left-12 z-10 max-w-sm">
          <blockquote className="text-white/70 italic text-sm tracking-wide mb-2 uppercase" style={{ fontVariant: 'small-caps' }}>
            "Direct from the farm. No middlemen."
          </blockquote>
          <div className="h-px w-8 bg-emerald-500"></div>
        </div>
      </section>

      {/* Right Panel */}
      <section className="w-full md:w-[45%] h-full bg-[#f9fafb] flex flex-col justify-center px-8 md:px-24 relative overflow-y-auto">
        <div className="max-w-md w-full mx-auto my-auto py-12">
          {/* Header */}
          <header className="mb-12">
            <h1 className="text-[36px] font-bold text-zinc-900 tracking-tight leading-tight">Welcome back</h1>
            <p className="text-zinc-500 text-base mt-2">Sign in to your account</p>
          </header>

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {(error || authError) && (
              <div className="bg-red-50 border border-red-200 px-4 py-3">
                <p className="text-red-600 text-[13px] font-medium leading-relaxed">{error || authError}</p>
              </div>
            )}

            {/* Phone Field */}
            <div className="space-y-2">
              <label className="block text-[12px] font-semibold text-zinc-600 uppercase tracking-wider" htmlFor="phone">Phone Number</label>
              <div className="relative">
                <input
                  type="tel"
                  id="phone"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="+91"
                  required
                  className="w-full h-[48px] bg-zinc-100 border border-zinc-200 px-4 text-zinc-900 focus:ring-0 focus:border-emerald-500 focus:bg-white transition-all duration-200 outline-none placeholder:text-zinc-400 rounded-none shadow-sm"
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="block text-[12px] font-semibold text-zinc-600 uppercase tracking-wider" htmlFor="password">Password</label>
              </div>
              <div className="relative">
                <input
                  type="password"
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="••••••••"
                  required
                  className="w-full h-[48px] bg-zinc-100 border border-zinc-200 px-4 text-zinc-900 focus:ring-0 focus:border-emerald-500 focus:bg-white transition-all duration-200 outline-none placeholder:text-zinc-400 rounded-none shadow-sm"
                />
              </div>
            </div>

            {/* Action Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="relative overflow-hidden w-full h-[48px] bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] transition-all duration-200 text-white font-bold text-sm uppercase tracking-widest rounded-none flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed group shimmer-btn"
              >
                {loading ? (
                  <span className="flex items-center gap-2 relative z-10">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Signing in...
                  </span>
                ) : (
                  <span className="relative z-10">Sign In</span>
                )}
              </button>
            </div>

            {/* Footer Link */}
            <p className="text-center md:text-left text-zinc-500 text-sm mt-6">
              Don't have an account? 
              <Link to="/register" className="text-emerald-600 font-bold hover:underline ml-1">
                Register here
              </Link>
            </p>
          </form>

          {/* Footer Legal */}
          <footer className="mt-24 pt-8 border-t border-zinc-200/50">
            <div className="flex gap-6">
              <span className="text-[10px] text-zinc-400 font-semibold uppercase tracking-tighter hover:text-zinc-600 cursor-pointer">Privacy Policy</span>
              <span className="text-[10px] text-zinc-400 font-semibold uppercase tracking-tighter hover:text-zinc-600 cursor-pointer">Terms of Service</span>
            </div>
          </footer>
        </div>
      </section>
    </main>
  );
}
