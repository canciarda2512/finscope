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

      const { accessToken, refreshToken } = res.data;
      login(
        { email: formData.email, username: formData.email.split('@')[0] },
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
      <div className="min-h-screen bg-[#020617] flex items-center justify-center p-4">
        <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-8 w-full max-w-md">

          {/* Icon + header */}
          <div className="flex flex-col items-center mb-6">
            <div className="w-14 h-14 rounded-2xl bg-blue-500/15 border border-blue-500/30
              flex items-center justify-center mb-4">
              <Shield size={26} className="text-blue-400" />
            </div>
            <h1 className="text-xl font-bold text-white">Two-Factor Verification</h1>
            <p className="text-slate-400 text-sm mt-1 text-center">
              A 6-digit code was sent to<br />
              <span className="text-slate-200 font-medium">{maskedEmail}</span>
            </p>
          </div>

          <form onSubmit={handleVerifyOTP} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
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
                className="w-full bg-slate-800 border border-slate-700 rounded px-4 py-3
                  text-white text-2xl text-center font-mono tracking-[0.5em]
                  outline-none focus:border-blue-500 placeholder:text-slate-600"
              />
            </div>

            {error && (
              <div className="bg-red-900/50 border border-red-700 text-red-200 px-4 py-2 rounded text-sm">
                {error}
              </div>
            )}

            <button
              type="submit" disabled={loading || otpCode.length < 6}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800/60
                disabled:cursor-not-allowed text-white font-bold py-2.5 px-4 rounded transition"
            >
              {loading ? 'Verifying…' : 'Verify & Sign In'}
            </button>

            <button
              type="button"
              onClick={() => { setRequires2FA(false); setOtpCode(''); setError(''); }}
              className="w-full text-slate-500 hover:text-slate-300 text-sm py-1 transition"
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
    <div className="min-h-screen bg-[#020617] flex items-center justify-center p-4">
      <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-8 w-full max-w-md">
        <h1 className="text-2xl font-bold text-white mb-2">Welcome Back</h1>
        <p className="text-slate-400 text-sm mb-6">Sign in to your FinScope account</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Email</label>
            <input
              type="email" name="email" value={formData.email} onChange={handleChange} required
              className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-white outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Password</label>
            <input
              type="password" name="password" value={formData.password} onChange={handleChange} required
              className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-white outline-none focus:border-blue-500"
            />
          </div>

          {error && (
            <div className="bg-red-900/50 border border-red-700 text-red-200 px-4 py-2 rounded text-sm">
              {error}
            </div>
          )}

          <button
            type="submit" disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white font-bold py-2 px-4 rounded transition"
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-400">
          Don&apos;t have an account?{' '}
          <Link to="/register" className="text-blue-400 hover:text-blue-300">Create Account</Link>
        </p>
      </div>
    </div>
  );
}
