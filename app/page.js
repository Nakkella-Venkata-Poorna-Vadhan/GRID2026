'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'

export default function Login() {
  const [id, setId] = useState('')
  const [pass, setPass] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleLogin = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { data, error } = await supabase
      .from('groups')
      .select('*')
      .eq('user_id', id)
      .eq('password', pass)
      .single()

    if (error || !data) {
      setError('ACCESS DENIED // INVALID CREDENTIALS')
      setLoading(false)
      return
    }

    // Save session (basic)
    if (typeof window !== 'undefined') localStorage.setItem('user', JSON.stringify(data))

    if (data.role === 'admin') router.push('/admin')
    if (data.role === 'student') router.push(`/student?id=${data.id}`)
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-gray-900 via-[#0a0a0a] to-black text-white flex items-center justify-center font-sans overflow-hidden relative">
      
      {/* Background Ambience */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-600/20 rounded-full blur-[120px] animate-pulse"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-cyan-600/20 rounded-full blur-[120px] animate-pulse delay-1000"></div>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="z-10 w-full max-w-md"
      >
        <form onSubmit={handleLogin} className="backdrop-blur-xl bg-white/5 border border-white/10 p-8 rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.5)] relative overflow-hidden group">
          
          {/* Scanning Line Animation */}
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-500 to-transparent opacity-50 group-hover:animate-scan"></div>

          <div className="text-center mb-10">
            <h1 className="text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-purple-500 tracking-tighter mb-2">
              HACK_OS
            </h1>
            <p className="text-gray-400 text-xs tracking-[0.3em] uppercase">Secure Event Protocol v2.0</p>
          </div>
          
          <div className="space-y-6">
            <div className="relative group">
              <input 
                className="w-full bg-black/30 border border-white/10 rounded-lg p-4 text-white focus:outline-none focus:border-cyan-500/50 focus:bg-black/50 transition-all placeholder-transparent peer"
                value={id} onChange={(e) => setId(e.target.value.toUpperCase())} 
                placeholder="Unit ID"
                id="unit_id"
              />
              <label htmlFor="unit_id" className="absolute left-4 top-4 text-gray-500 text-sm transition-all peer-focus:-top-2 peer-focus:text-xs peer-focus:text-cyan-400 peer-focus:bg-black/80 peer-focus:px-1 peer-placeholder-shown:top-4 peer-placeholder-shown:text-sm">
                UNIT ID
              </label>
            </div>

            <div className="relative group">
              <input 
                type="password"
                className="w-full bg-black/30 border border-white/10 rounded-lg p-4 text-white focus:outline-none focus:border-purple-500/50 focus:bg-black/50 transition-all placeholder-transparent peer"
                value={pass} onChange={(e) => setPass(e.target.value)} 
                placeholder="Passcode"
                id="passcode"
              />
              <label htmlFor="passcode" className="absolute left-4 top-4 text-gray-500 text-sm transition-all peer-focus:-top-2 peer-focus:text-xs peer-focus:text-purple-400 peer-focus:bg-black/80 peer-focus:px-1 peer-placeholder-shown:top-4 peer-placeholder-shown:text-sm">
                PASSCODE
              </label>
            </div>
          </div>

          {error && (
            <div className="mt-6 p-3 bg-red-500/10 border border-red-500/50 rounded text-red-400 text-xs text-center font-mono">
              {error}
            </div>
          )}

          <button 
            disabled={loading}
            className="w-full mt-8 bg-gradient-to-r from-cyan-600 to-purple-600 hover:from-cyan-500 hover:to-purple-500 text-white font-bold p-4 rounded-lg shadow-lg shadow-purple-500/20 transition-all transform hover:scale-[1.02] active:scale-[0.98]"
          >
            {loading ? 'AUTHENTICATING...' : 'INITIALIZE UPLINK'}
          </button>
        </form>

        <div className="mt-6 text-center text-[10px] text-gray-600 font-mono">
          SYSTEM INTEGRITY: 100% // ENCRYPTION: AES-256
        </div>
      </motion.div>
    </div>
  )
}