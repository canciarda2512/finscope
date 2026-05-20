import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Shield } from 'lucide-react';
import { useAuth } from '../context/Authcontext';
import APIClient from '../services/APIClient';

export default function LoginPage() {
  const [formData, setFormData]       = useState({ email: '', password: '' });
  const [error, setError]             = useState('');
  const [loading, setLoading]         = useState(false);

  // 2FA state
  const [requires2FA, setRequires2FA] = useState(false);
  const [tempToken, setTempToken]     = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');
  const [otpCode, setOtpCode]         = useState('');

  const { login } = useAuth();

  const handleChange = e => setFormData({ ...formData, [e.target.name]: e.target.value });

  // Step 1 — password login
  const handleSubmit = async e => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await APIClient.post('/auth/login', formData);

      if (res.data.requires2FA) {
        setTempToken(res.data.tempToken);
        setMaskedEmail(res.data.maskedEmail || formData.email);
        setRequires2FA(true);
        return;
      }

      const { accessToken, refreshToken, user } = res.data;
      login(
        user || { email: formData.email, username: formData.email.split('@')[0] },
        accessToken,
        refreshToken
      );
    } catch {
      setError('Login failed. Please check your email and password.');
    } finally {
      setLoading(false);
    }
  };

  // Step 2 — 2FA OTP verification
  const handleVerifyOTP = async e => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await APIClient.post('/auth/2fa/login-verify', {
        tempToken,
        code: otpCode.trim(),
      });

      const { accessToken, refreshToken, user } = res.data;
      login(
        user || { email: formData.email, username: formData.email.split('@')[0] },
        accessToken,
        refreshToken
      );
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid or expired verification code.');
    } finally {
      setLoading(false);
    }
  };

  // ── 2FA step UI ─────────────────────────────────────────────────────────────
  if (requires2FA) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: 'var(--bg-primary)' }}>
        <div className="rounded-xl p-8 w-full max-w-md" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-primary)' }}>

          {/* Icon + header */}
          <div className="flex flex-col items-center mb-6">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
              style={{ backgroundColor: 'var(--accent-muted)', border: '1px solid var(--accent-ring)' }}>
              <Shield size={26} style={{ color: 'var(--accent-text)' }} />
            </div>
            <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Two-Factor Verification</h1>
            <p className="text-sm mt-1 text-center" style={{ color: 'var(--text-muted)' }}>
              A 6-digit code was sent to<br />
              <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{maskedEmail}</span>
            </p>
          </div>

          <form onSubmit={handleVerifyOTP} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                Verification Code
              </label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={otpCode}
                onChange={e => setOtpCode(e.target.value.replace(/\D/g, ''))}
                placeholder="000000"
                autoFocus
                required
                className="w-full rounded px-4 py-3 text-2xl text-center font-mono tracking-[0.5em] outline-none transition"
                style={{ backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-secondary)', color: 'var(--text-primary)' }}
              />
            </div>

            {error && (
              <div className="px-4 py-2 rounded text-sm" style={{ backgroundColor: 'var(--red-muted)', border: '1px solid var(--red)', color: 'var(--red)' }}>
                {error}
              </div>
            )}

            <button
              type="submit" disabled={loading || otpCode.length < 6}
              className="w-full disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-2.5 px-4 rounded transition"
              style={{ backgroundColor: 'var(--accent)' }}
            >
              {loading ? 'Verifying…' : 'Verify & Sign In'}
            </button>

            <button
              type="button"
              onClick={() => { setRequires2FA(false); setOtpCode(''); setError(''); }}
              className="w-full text-sm py-1 transition" style={{ color: 'var(--text-muted)' }}
            >
              Back to login
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ── Normal login UI ──────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <div className="rounded-xl p-8 w-full max-w-md" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-primary)' }}>
        <h1 className="text-2xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>Welcome Back</h1>
        <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>Sign in to your FinScope account</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Email</label>
            <input
              type="email" name="email" value={formData.email} onChange={handleChange} required
              className="w-full rounded px-3 py-2 outline-none transition" style={{ backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-secondary)', color: 'var(--text-primary)' }}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Password</label>
            <input
              type="password" name="password" value={formData.password} onChange={handleChange} required
              className="w-full rounded px-3 py-2 outline-none transition" style={{ backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-secondary)', color: 'var(--text-primary)' }}
            />
          </div>

          {error && (
            <div className="px-4 py-2 rounded text-sm" style={{ backgroundColor: 'var(--red-muted)', border: '1px solid var(--red)', color: 'var(--red)' }}>
              {error}
            </div>
          )}

          <button
            type="submit" disabled={loading}
            className="w-full disabled:opacity-50 text-white font-bold py-2 px-4 rounded transition"
            style={{ backgroundColor: 'var(--accent)' }}
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
          Don&apos;t have an account?{' '}
          <Link to="/register" style={{ color: 'var(--accent-text)' }}>Create Account</Link>
        </p>
      </div>
    </div>
  );
}
