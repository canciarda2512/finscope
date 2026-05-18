import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/Authcontext';
import { TrendingUp } from 'lucide-react';
import APIClient from '../services/APIClient';

export default function LoginPage() {
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await APIClient.post('/auth/login', formData);
      const { accessToken, refreshToken } = res.data;
      login(
        { email: formData.email, username: formData.email.split('@')[0] },
        accessToken,
        refreshToken
      );
    } catch {
      setError('Login failed. Please check your email and password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <TrendingUp size={18} className="text-white" />
          </div>
          <span className="text-white font-bold text-xl tracking-tight">FinScope</span>
        </div>

        <div className="rounded-xl p-6" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-primary)' }}>
          <h1 className="text-lg font-bold mb-1" style={{ color: 'var(--text-primary)' }}>Welcome back</h1>
          <p className="text-xs mb-5" style={{ color: 'var(--text-muted)' }}>Sign in to access your trading dashboard</p>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">Email</label>
              <input
                type="email" name="email" value={formData.email} onChange={handleChange} required
                className="w-full rounded-lg px-3 py-2 text-sm outline-none transition" style={{ backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-secondary)', color: 'var(--text-primary)' }}
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">Password</label>
              <input
                type="password" name="password" value={formData.password} onChange={handleChange} required
                className="w-full rounded-lg px-3 py-2 text-sm outline-none transition" style={{ backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-secondary)', color: 'var(--text-primary)' }}
                placeholder="Enter your password"
              />
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-3 py-2 rounded-lg text-xs">
                {error}
              </div>
            )}

            <button type="submit" disabled={loading}
              className="w-full disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-2.5 px-4 rounded-lg transition text-sm"
              style={{ backgroundColor: 'var(--accent)' }}>
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <p className="mt-5 text-center text-xs text-slate-500">
            Don&apos;t have an account?{' '}
            <Link to="/register" className="text-blue-400 hover:text-blue-300 font-medium">Create account</Link>
          </p>
        </div>

        <p className="text-center text-[10px] mt-4" style={{ color: 'var(--text-dim)' }}>
          Paper trading simulator. No real money involved.
        </p>
      </div>
    </div>
  );
}
