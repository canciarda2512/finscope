import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { TrendingUp } from 'lucide-react';
import APIClient from '../services/APIClient';

function getPasswordStrength(password) {
  if (!password) return { label: '', color: '', width: '0%' };
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 1) return { label: 'Weak', color: 'bg-red-500', width: '20%' };
  if (score <= 2) return { label: 'Fair', color: 'bg-orange-500', width: '40%' };
  if (score <= 3) return { label: 'Medium', color: 'bg-yellow-500', width: '60%' };
  if (score <= 4) return { label: 'Strong', color: 'bg-emerald-500', width: '80%' };
  return { label: 'Very Strong', color: 'bg-emerald-400', width: '100%' };
}

export default function RegisterPage() {
  const [formData, setFormData] = useState({ username: '', email: '', password: '', confirmPassword: '', tcKimlikNo: '', phoneNumber: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.confirmPassword) { setError('Passwords do not match.'); return; }
    if (formData.password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (!/^\d{11}$/.test(formData.tcKimlikNo) || formData.tcKimlikNo[0] === '0') { setError('Turkish ID number must be 11 digits and cannot start with 0.'); return; }
    if (!/^\+?\d{10,15}$/.test(formData.phoneNumber.replace(/\s/g, ''))) { setError('Please enter a valid phone number.'); return; }

    setLoading(true);
    try {
      await APIClient.post('/auth/register', {
        email: formData.email,
        password: formData.password,
        tcKimlikNo: formData.tcKimlikNo,
        phoneNumber: formData.phoneNumber.replace(/\s/g, ''),
      });
      navigate('/login', { state: { registered: true } });
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const strength = getPasswordStrength(formData.password);

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'var(--accent)' }}>
            <TrendingUp size={18} className="text-white" />
          </div>
          <span className="font-bold text-xl tracking-tight" style={{ color: 'var(--text-primary)' }}>FinScope</span>
        </div>

        <div className="rounded-xl p-6" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-primary)' }}>
          <h1 className="text-lg font-bold mb-1" style={{ color: 'var(--text-primary)' }}>Create your account</h1>
          <p className="text-xs mb-5" style={{ color: 'var(--text-muted)' }}>Start paper trading with $100,000 demo balance</p>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-[11px] font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Email</label>
              <input
                type="email" name="email" value={formData.email} onChange={handleChange} required
                className="w-full rounded-lg px-3 py-2 text-sm outline-none transition" style={{ backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-secondary)', color: 'var(--text-primary)' }}
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Password</label>
              <input
                type="password" name="password" value={formData.password} onChange={handleChange} required
                className="w-full rounded-lg px-3 py-2 text-sm outline-none transition" style={{ backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-secondary)', color: 'var(--text-primary)' }}
                placeholder="Min. 8 characters"
              />
              {formData.password && (
                <div className="mt-1.5">
                  <div className="h-1 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
                    <div className={`h-full ${strength.color} rounded-full transition-all duration-300`} style={{ width: strength.width }} />
                  </div>
                  <p className={`text-[10px] mt-0.5 ${
                    strength.label === 'Weak' ? 'text-red-400' :
                    strength.label === 'Fair' ? 'text-orange-400' :
                    strength.label === 'Medium' ? 'text-yellow-400' : 'text-emerald-400'
                  }`}>
                    {strength.label} password
                  </p>
                </div>
              )}
            </div>
            <div>
              <label className="block text-[11px] font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Confirm Password</label>
              <input
                type="password" name="confirmPassword" value={formData.confirmPassword} onChange={handleChange} required
                className="w-full rounded-lg px-3 py-2 text-sm outline-none transition" style={{ backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-secondary)', color: 'var(--text-primary)' }}
                placeholder="Re-enter your password"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Turkish ID Number</label>
              <input
                type="text" name="tcKimlikNo" value={formData.tcKimlikNo} onChange={handleChange} required
                maxLength={11}
                className="w-full rounded-lg px-3 py-2 text-sm outline-none transition" style={{ backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-secondary)', color: 'var(--text-primary)' }}
                placeholder="Your 11-digit Turkish ID number"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Phone Number</label>
              <input
                type="tel" name="phoneNumber" value={formData.phoneNumber} onChange={handleChange} required
                className="w-full rounded-lg px-3 py-2 text-sm outline-none transition" style={{ backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-secondary)', color: 'var(--text-primary)' }}
                placeholder="+90 5XX XXX XX XX"
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
              {loading ? 'Creating account...' : 'Create Account'}
            </button>
          </form>

          <p className="mt-5 text-center text-xs" style={{ color: 'var(--text-muted)' }}>
            Already have an account?{' '}
            <Link to="/login" className="font-medium" style={{ color: 'var(--accent-text)' }}>Sign in</Link>
          </p>
        </div>

        <p className="text-center text-[10px] mt-4" style={{ color: 'var(--text-dim)' }}>
          Paper trading simulator. No real money involved.
        </p>
      </div>
    </div>
  );
}
