import { useState } from 'react'
import { Link } from 'react-router-dom'

export default function RegisterPage() {
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  function handleRegister() {
    console.log('Registering user:', { username, email, password })
  }

  return (
    <div className="bg-slate-950 min-h-screen flex items-center justify-center p-4">
      <div className="bg-slate-900 p-8 rounded-2xl w-full max-w-md border border-slate-800 shadow-2xl">
        
        <div className="mb-8">
          <h1 className="text-white text-3xl font-bold mb-2">Create Account</h1>
          <p className="text-slate-500 text-sm">Join FinScope to start tracking assets</p>
        </div>

        <div className="flex flex-col gap-5">
          <div>
            <label className="text-slate-400 text-xs font-bold uppercase mb-2 block ml-1">Username</label>
            <input
              type="text"
              placeholder="e.g. crypto_trader"
              value={username}
              onChange={e => setUsername(e.target.value)}
              className="w-full bg-slate-800 text-white px-4 py-3 rounded-xl outline-none border border-slate-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
            />
          </div>

          <div>
            <label className="text-slate-400 text-xs font-bold uppercase mb-2 block ml-1">Email Address</label>
            <input
              type="email"
              placeholder="name@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full bg-slate-800 text-white px-4 py-3 rounded-xl outline-none border border-slate-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
            />
          </div>

          <div>
            <label className="text-slate-400 text-xs font-bold uppercase mb-2 block ml-1">Password</label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full bg-slate-800 text-white px-4 py-3 rounded-xl outline-none border border-slate-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
            />
          </div>

          <button
            onClick={handleRegister}
            className="bg-blue-600 hover:bg-blue-500 text-white py-4 rounded-xl font-bold shadow-lg shadow-blue-900/20 transition-all active:scale-[0.98] mt-2"
          >
            Get Started
          </button>
        </div>

        <div className="mt-8 pt-6 border-t border-slate-800">
          <p className="text-slate-500 text-sm text-center">
            Already have an account?{' '}
            <Link to="/login" className="text-blue-400 hover:text-blue-300 font-bold transition">Sign In</Link>
          </p>
        </div>

      </div>
    </div>
  )
}