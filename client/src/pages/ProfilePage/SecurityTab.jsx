import { useState } from 'react';
import {
  Lock, Smartphone, AlertTriangle, CheckCircle2,
  X, Check, ShieldCheck, ShieldOff, EyeOff,
} from 'lucide-react';
import APIClient from '../../services/APIClient';

// -- Password strength helpers -------------------------------------------------
const _UPPER   = /[A-Z]/;
const _DIGIT   = /[0-9]/;
const _SPECIAL = /[^A-Za-z0-9]/;

function pwStrength(p) {
  if (!p) return 0;
  let s = 0;
  if (p.length >= 8)      s++;
  if (_UPPER.test(p))     s++;
  if (_DIGIT.test(p))     s++;
  if (_SPECIAL.test(p))   s++;
  return s;
}

const PW_META = [
  null,
  { label: 'Weak',   bar: 'bg-red-500',    text: 'text-[var(--red)]'    },
  { label: 'Fair',   bar: 'bg-orange-500', text: 'text-orange-400' },
  { label: 'Good',   bar: 'bg-yellow-400', text: 'text-yellow-400' },
  { label: 'Strong', bar: 'bg-green-500',  text: 'text-[var(--green)]'  },
];

// -- Modal ---------------------------------------------------------------------
function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="rounded-2xl w-full max-w-md shadow-2xl" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-primary)' }}>
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--border-primary)' }}>
          <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{title}</h3>
          <button onClick={onClose} className="transition-colors" style={{ color: 'var(--text-muted)' }}>
            <X size={18} />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

// -- OTP input -----------------------------------------------------------------
function OTPInput({ value, onChange }) {
  return (
    <input
      type="text" inputMode="numeric" maxLength={6}
      value={value}
      onChange={e => onChange(e.target.value.replace(/\D/g, ''))}
      placeholder="000000"
      autoFocus
      className="w-full rounded-xl px-4 py-3 text-2xl text-center font-mono tracking-[0.5em] outline-none"
      style={{ backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-secondary)', color: 'var(--text-primary)' }}
    />
  );
}

// -- SecurityTab ---------------------------------------------------------------
export default function SecurityTab({ user, twoFAEnabled, onTwoFAChange }) {
  // Change Password modal state
  const [showPwModal, setShowPwModal] = useState(false);
  const [pwData, setPwData]           = useState({ current: '', next: '', confirm: '' });
  const [showPw, setShowPw]           = useState({ current: false, next: false });
  const [pwLoading, setPwLoading]     = useState(false);
  const [pwError, setPwError]         = useState('');
  const [pwSuccess, setPwSuccess]     = useState(false);

  // 2FA modal state
  const [tfaModal, setTfaModal]       = useState(null);
  const [tfaStep, setTfaStep]         = useState('send');
  const [tfaMasked, setTfaMasked]     = useState('');
  const [tfaCode, setTfaCode]         = useState('');
  const [tfaLoading, setTfaLoading]   = useState(false);
  const [tfaError, setTfaError]       = useState('');

  const nextStrength = pwStrength(pwData.next);
  const nextMeta     = PW_META[nextStrength];

  function openPwModal() {
    setPwData({ current: '', next: '', confirm: '' });
    setPwError(''); setPwSuccess(false);
    setShowPwModal(true);
  }

  async function handleChangePassword(e) {
    e.preventDefault();
    setPwError('');
    if (pwData.next !== pwData.confirm) { setPwError('New passwords do not match.'); return; }
    if (pwData.next.length < 8) { setPwError('Password must be at least 8 characters.'); return; }
    setPwLoading(true);
    try {
      await APIClient.post('/auth/change-password', {
        currentPassword: pwData.current,
        newPassword: pwData.next,
      });
      setPwSuccess(true);
    } catch (err) {
      setPwError(err.response?.data?.message || 'Failed to change password.');
    } finally {
      setPwLoading(false);
    }
  }

  function openTfaModal(action) {
    setTfaModal(action); setTfaStep('send');
    setTfaCode(''); setTfaError(''); setTfaMasked('');
  }

  function closeTfaModal() {
    setTfaModal(null); setTfaStep('send');
    setTfaCode(''); setTfaError('');
  }

  async function handleSendOTP() {
    setTfaError(''); setTfaLoading(true);
    try {
      const res = await APIClient.post('/auth/2fa/send');
      setTfaMasked(res.data.maskedEmail || user?.email || '');
      setTfaStep('verify');
    } catch (err) {
      setTfaError(err.response?.data?.message || 'Failed to send verification code.');
    } finally {
      setTfaLoading(false);
    }
  }

  async function handleVerifyOTP() {
    setTfaError(''); setTfaLoading(true);
    const endpoint = tfaModal === 'enable' ? '/auth/2fa/verify' : '/auth/2fa/disable';
    try {
      await APIClient.post(endpoint, { code: tfaCode.trim() });
      onTwoFAChange(tfaModal === 'enable');
      closeTfaModal();
    } catch (err) {
      setTfaError(err.response?.data?.message || 'Invalid or expired code.');
    } finally {
      setTfaLoading(false);
    }
  }

  return (
    <>
      <div className="space-y-6">
        {/* Account Security */}
        <div className="rounded-2xl p-6" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-primary)' }}>
          <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-1">Account Security</h3>
          <p className="text-xs text-[var(--text-dim)] mb-6">Manage your account security settings and authentication methods.</p>

          {/* Password row */}
          <div className="flex items-center justify-between py-5" style={{ borderBottom: '1px solid var(--border-primary)' }}>
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
                <Lock size={18} style={{ color: 'var(--text-muted)' }} />
              </div>
              <div>
                <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Password</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Update your account password</p>
              </div>
            </div>
            <button
              onClick={openPwModal}
              className="text-xs font-medium px-4 py-2 rounded-lg text-blue-400
                hover:bg-blue-500/10 border border-blue-500/20 transition-all"
            >
              Change Password
            </button>
          </div>

          {/* 2FA row */}
          <div className="flex items-center justify-between py-5" style={{ borderBottom: '1px solid var(--border-primary)' }}>
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: twoFAEnabled ? 'rgba(34,197,94,0.1)' : 'var(--bg-tertiary)' }}>
                <Smartphone size={18} className={twoFAEnabled ? 'text-[var(--green)]' : 'text-[var(--text-muted)]'} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Two-Factor Authentication</p>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                    twoFAEnabled ? 'bg-green-500/15 text-[var(--green)]' : 'bg-[var(--bg-tertiary)] text-[var(--text-muted)]'
                  }`}>
                    {twoFAEnabled ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
                <p className="text-xs text-[var(--text-dim)] mt-0.5">
                  {twoFAEnabled
                    ? 'Login requires a 6-digit code sent to your email'
                    : 'Add an extra layer of security with email verification'}
                </p>
              </div>
            </div>
            <button
              onClick={() => openTfaModal(twoFAEnabled ? 'disable' : 'enable')}
              className={`flex items-center gap-1.5 text-xs font-medium px-4 py-2 rounded-lg transition-all ${
                twoFAEnabled
                  ? 'text-[var(--red)] hover:bg-red-500/10 border border-red-500/20'
                  : 'text-blue-400 hover:bg-blue-500/10 border border-blue-500/20'
              }`}
            >
              {twoFAEnabled
                ? <><ShieldOff size={13} /> Disable 2FA</>
                : <><ShieldCheck size={13} /> Enable 2FA</>}
            </button>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="rounded-2xl p-6" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-primary)' }}>
          <h3 className="text-sm font-semibold text-[var(--red)] mb-1">Danger Zone</h3>
          <p className="text-xs text-[var(--text-dim)] mb-6">Irreversible actions — proceed with caution.</p>
          <div className="flex items-center justify-between py-4">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
                <AlertTriangle size={18} className="text-[var(--red)]" />
              </div>
              <div>
                <p className="text-sm font-semibold text-[var(--text-primary)]">Reset Demo Account</p>
                <p className="text-xs text-[var(--text-dim)] mt-0.5">Reset your portfolio balance to $100,000</p>
              </div>
            </div>
            <button className="text-xs font-medium px-4 py-2 rounded-lg text-[var(--red)]
              hover:bg-red-500/10 border border-red-500/20 transition-all">
              Reset Account
            </button>
          </div>
        </div>
      </div>

      {/* Change Password Modal */}
      {showPwModal && (
        <Modal title="Change Password" onClose={() => setShowPwModal(false)}>
          {pwSuccess ? (
            <div className="flex flex-col items-center py-4 gap-3">
              <div className="w-14 h-14 rounded-full bg-green-500/15 flex items-center justify-center">
                <Check size={28} className="text-[var(--green)]" />
              </div>
              <p className="text-[var(--text-primary)] font-semibold">Password changed!</p>
              <p className="text-[var(--text-dim)] text-sm text-center">Your password has been updated successfully.</p>
              <button onClick={() => setShowPwModal(false)}
                className="mt-2 px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition">
                Done
              </button>
            </div>
          ) : (
            <form onSubmit={handleChangePassword} className="space-y-4">
              {/* Current password */}
              <div>
                <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Current Password</label>
                <div className="relative">
                  <input
                    type={showPw.current ? 'text' : 'password'}
                    value={pwData.current}
                    onChange={e => setPwData(d => ({ ...d, current: e.target.value }))}
                    required
                    className="w-full rounded-lg px-3 py-2 pr-10 text-sm outline-none" style={{ backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-secondary)', color: 'var(--text-primary)' }}
                  />
                  <button type="button" onClick={() => setShowPw(s => ({ ...s, current: !s.current }))}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-dim)] hover:text-[var(--text-secondary)]">
                    {showPw.current ? <EyeOff size={14} /> : <Lock size={14} />}
                  </button>
                </div>
              </div>

              {/* New password */}
              <div>
                <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">New Password</label>
                <div className="relative">
                  <input
                    type={showPw.next ? 'text' : 'password'}
                    value={pwData.next}
                    onChange={e => setPwData(d => ({ ...d, next: e.target.value }))}
                    required
                    className="w-full rounded-lg px-3 py-2 pr-10 text-sm outline-none" style={{ backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-secondary)', color: 'var(--text-primary)' }}
                  />
                  <button type="button" onClick={() => setShowPw(s => ({ ...s, next: !s.next }))}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-dim)] hover:text-[var(--text-secondary)]">
                    {showPw.next ? <EyeOff size={14} /> : <Lock size={14} />}
                  </button>
                </div>
                {/* Strength bar */}
                {pwData.next && (
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex-1 flex gap-1">
                      {[1,2,3,4].map(i => (
                        <div key={i} className={`h-1 flex-1 rounded-full ${i <= nextStrength ? (nextMeta?.bar || 'bg-[var(--bg-tertiary)]') : 'bg-[var(--bg-tertiary)]'}`} />
                      ))}
                    </div>
                    {nextMeta && <span className={`text-[10px] font-semibold ${nextMeta.text}`}>{nextMeta.label}</span>}
                  </div>
                )}
              </div>

              {/* Confirm */}
              <div>
                <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Confirm New Password</label>
                <input
                  type="password"
                  value={pwData.confirm}
                  onChange={e => setPwData(d => ({ ...d, confirm: e.target.value }))}
                  required
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                  style={{
                    backgroundColor: 'var(--bg-input)',
                    border: pwData.confirm && pwData.next !== pwData.confirm ? '1px solid #ef4444' : '1px solid var(--border-secondary)',
                    color: 'var(--text-primary)',
                  }}
                />
                {pwData.confirm && pwData.next !== pwData.confirm && (
                  <p className="text-[11px] text-[var(--red)] mt-1">Passwords do not match</p>
                )}
              </div>

              {pwError && (
                <div className="bg-red-900/40 border border-red-700/50 text-red-300 px-3 py-2 rounded-lg text-xs">
                  {pwError}
                </div>
              )}

              <button type="submit" disabled={pwLoading}
                className="w-full disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg text-sm transition" style={{ backgroundColor: 'var(--accent)' }}>
                {pwLoading ? 'Updating...' : 'Update Password'}
              </button>
            </form>
          )}
        </Modal>
      )}

      {/* 2FA Modal */}
      {tfaModal && (
        <Modal
          title={tfaModal === 'enable' ? 'Enable Two-Factor Authentication' : 'Disable Two-Factor Authentication'}
          onClose={closeTfaModal}
        >
          {tfaStep === 'send' ? (
            <div className="space-y-5">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto ${
                tfaModal === 'enable' ? 'bg-green-500/15' : 'bg-red-500/15'
              }`}>
                {tfaModal === 'enable'
                  ? <ShieldCheck size={28} className="text-[var(--green)]" />
                  : <ShieldOff size={28} className="text-[var(--red)]" />}
              </div>

              <div className="text-center">
                <p className="text-[var(--text-primary)] font-semibold mb-1">
                  {tfaModal === 'enable' ? 'Secure your account' : 'Disable 2FA protection'}
                </p>
                <p className="text-[var(--text-muted)] text-sm">
                  {tfaModal === 'enable'
                    ? 'A 6-digit verification code will be sent to your email address each time you sign in.'
                    : 'To disable 2FA, we need to verify your identity. A code will be sent to your email.'}
                </p>
              </div>

              <div className="bg-[var(--bg-tertiary)] rounded-xl px-4 py-3 flex items-center gap-3">
                <CheckCircle2 size={16} className="text-blue-400 flex-shrink-0" />
                <span className="text-[var(--text-secondary)] text-sm">{user?.email}</span>
              </div>

              {tfaError && (
                <div className="bg-red-900/40 border border-red-700/50 text-red-300 px-3 py-2 rounded-lg text-xs">
                  {tfaError}
                </div>
              )}

              <button onClick={handleSendOTP} disabled={tfaLoading}
                className="w-full disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg text-sm transition" style={{ backgroundColor: 'var(--accent)' }}>
                {tfaLoading ? 'Sending...' : 'Send Verification Code'}
              </button>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="text-center">
                <p className="text-[var(--text-primary)] font-semibold mb-1">Enter verification code</p>
                <p className="text-[var(--text-muted)] text-sm">
                  Code sent to <span className="text-[var(--text-primary)]">{tfaMasked}</span>
                  <br />
                  <span className="text-[var(--text-dim)] text-xs">Valid for 5 minutes</span>
                </p>
              </div>

              <OTPInput value={tfaCode} onChange={setTfaCode} />

              {tfaError && (
                <div className="bg-red-900/40 border border-red-700/50 text-red-300 px-3 py-2 rounded-lg text-xs">
                  {tfaError}
                </div>
              )}

              <button
                onClick={handleVerifyOTP}
                disabled={tfaLoading || tfaCode.length < 6}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800/60
                  disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-lg text-sm transition"
              >
                {tfaLoading ? 'Verifying...' : tfaModal === 'enable' ? 'Enable 2FA' : 'Disable 2FA'}
              </button>

              <button onClick={() => { setTfaStep('send'); setTfaError(''); setTfaCode(''); }}
                className="w-full text-[var(--text-dim)] hover:text-[var(--text-secondary)] text-sm py-1 transition">
                Resend code
              </button>
            </div>
          )}
        </Modal>
      )}
    </>
  );
}
