import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff, RefreshCw, Check, X } from 'lucide-react';
import APIClient from '../services/APIClient';

const SPECIAL = /[^A-Za-z0-9]/;
const UPPER   = /[A-Z]/;
const DIGIT   = /[0-9]/;

const REQUIREMENTS = [
  { label: 'At least 8 characters',         test: p => p.length >= 8    },
  { label: 'At least one uppercase letter', test: p => UPPER.test(p)    },
  { label: 'At least one number',           test: p => DIGIT.test(p)    },
  { label: 'At least one special character',test: p => SPECIAL.test(p)  },
];

function getStrength(pwd) {
  if (!pwd) return 0;
  return REQUIREMENTS.filter(r => r.test(pwd)).length;
}

const STRENGTH_META = [
  null,
  { label: 'Weak',      color: 'bg-red-500',    text: 'text-red-400'    },
  { label: 'Fair',      color: 'bg-orange-500',  text: 'text-orange-400' },
  { label: 'Good',      color: 'bg-yellow-400',  text: 'text-yellow-400' },
  { label: 'Strong',    color: 'bg-green-500',   text: 'text-green-400'  },
];

const CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';

function generatePassword() {
  const arr = new Uint32Array(16);
  crypto.getRandomValues(arr);
  return Array.from(arr, n => CHARS[n % CHARS.length]).join('');
}

export default function RegisterPage() {
  const [formData, setFormData] = useState({ email: '', password: '', confirmPassword: '' });
  const [showPwd, setShowPwd]   = useState(false);
  const [showCfm, setShowCfm]   = useState(false);
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const navigate = useNavigate();

  const strength = getStrength(formData.password);
  const meta     = STRENGTH_META[strength];

  const handleChange = e => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleGenerate = () => {
    const pwd = generatePassword();
    setFormData(f => ({ ...f, password: pwd, confirmPassword: pwd }));
    setShowPwd(true);
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setLoading(true);
    try {
      await APIClient.post('/auth/register', {
        email: formData.email,
        password: formData.password,
      });
      window.alert('Registration successful. You can now sign in.');
      navigate('/login');
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#020617] flex items-center justify-center p-4">
      <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-8 w-full max-w-md">
        <h1 className="text-2xl font-bold text-white mb-2">Create Account</h1>
        <p className="text-slate-400 text-sm mb-6">Join FinScope</p>

        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Email</label>
            <input
              type="email" name="email" value={formData.email} onChange={handleChange} required
              className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-white outline-none focus:border-blue-500"
            />
          </div>

          {/* Password */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm font-medium text-slate-300">Password</label>
              <button
                type="button" onClick={handleGenerate}
                className="flex items-center gap-1 text-[11px] text-blue-400 hover:text-blue-300 transition-colors"
              >
                <RefreshCw size={11} /> Suggest strong password
              </button>
            </div>

            <div className="relative">
              <input
                type={showPwd ? 'text' : 'password'}
                name="password" value={formData.password} onChange={handleChange} required
                className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 pr-10 text-white outline-none focus:border-blue-500"
              />
              <button type="button" onClick={() => setShowPwd(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            {/* Strength bar */}
            {formData.password && (
              <div className="mt-2 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="flex-1 flex gap-1">
                    {[1, 2, 3, 4].map(i => (
                      <div key={i}
                        className={`h-1.5 flex-1 rounded-full transition-all ${
                          i <= strength
                            ? (meta?.color || 'bg-slate-700')
                            : 'bg-slate-700'
                        }`}
                      />
                    ))}
                  </div>
                  {meta && (
                    <span className={`text-[11px] font-semibold ${meta.text}`}>{meta.label}</span>
                  )}
                </div>

                {/* Requirements checklist */}
                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                  {REQUIREMENTS.map((req, i) => {
                    const ok = req.test(formData.password);
                    return (
                      <div key={i} className={`flex items-center gap-1.5 text-[11px] ${ok ? 'text-green-400' : 'text-slate-500'}`}>
                        {ok ? <Check size={11} /> : <X size={11} />}
                        {req.label}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Confirm Password */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Confirm Password</label>
            <div className="relative">
              <input
                type={showCfm ? 'text' : 'password'}
                name="confirmPassword" value={formData.confirmPassword} onChange={handleChange} required
                className={`w-full bg-slate-800 border rounded px-3 py-2 pr-10 text-white outline-none focus:border-blue-500 ${
                  formData.confirmPassword && formData.password !== formData.confirmPassword
                    ? 'border-red-500'
                    : formData.confirmPassword && formData.password === formData.confirmPassword
                    ? 'border-green-500'
                    : 'border-slate-700'
                }`}
              />
              <button type="button" onClick={() => setShowCfm(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                {showCfm ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {formData.confirmPassword && formData.password !== formData.confirmPassword && (
              <p className="text-[11px] text-red-400 mt-1 flex items-center gap-1">
                <X size={10} /> Passwords do not match
              </p>
            )}
            {formData.confirmPassword && formData.password === formData.confirmPassword && (
              <p className="text-[11px] text-green-400 mt-1 flex items-center gap-1">
                <Check size={10} /> Passwords match
              </p>
            )}
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
            {loading ? 'Creating account…' : 'Create Account'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-400">
          Already have an account?{' '}
          <Link to="/login" className="text-blue-400 hover:text-blue-300">Sign In</Link>
        </p>
      </div>
    </div>
  );
}
