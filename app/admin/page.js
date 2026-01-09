'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'
import Leaderboard from '@/components/Leaderboard'

export default function AdminDashboard() {
  const [groups, setGroups] = useState([])
  const [tickets, setTickets] = useState([])
  const [config, setConfig] = useState(null)
  const router = useRouter()

  // Creation State
  const [newId, setNewId] = useState(''); const [newPass, setNewPass] = useState('')
  const [newRole, setNewRole] = useState('student'); const [newName1, setNewName1] = useState('')
  const [newEmail, setNewEmail] = useState(''); const [isCreating, setIsCreating] = useState(false)
  
  // Controls
  const [showLeaderboard, setShowLeaderboard] = useState(false)

  useEffect(() => {
    fetchGroups(); fetchConfig(); fetchTickets()
    const channel = supabase.channel('admin-dashboard')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets' }, () => fetchTickets())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'groups' }, () => fetchGroups())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'global_config' }, (payload) => setConfig(payload.new))
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [])

  const fetchGroups = async () => { const { data } = await supabase.from('groups').select('*').eq('role', 'student').order('user_id'); setGroups(data || []) }
  const fetchConfig = async () => { const { data } = await supabase.from('global_config').select('*').single(); setConfig(data) }
  const fetchTickets = async () => { const { data } = await supabase.from('tickets').select('*, groups(*)').eq('status', 'open').order('created_at'); setTickets(data || []) }
  
  // THIS BUTTON RELEASES THE PROBLEM STATEMENT
  const releaseProblemStatement = async () => { 
      if(!confirm("Are you sure? This will show the problem statement to ALL students.")) return;
      await supabase.from('global_config').update({ is_active: true, start_time: new Date() }).eq('id', 1) 
  }
  
  const toggleFreeze = async () => { await supabase.from('global_config').update({ submissions_open: !config.submissions_open }).eq('id', 1) }
  const resolveTicket = async (ticketId) => { await supabase.from('tickets').update({ status: 'resolved' }).eq('id', ticketId) }
  
  const createUser = async (e) => {
    e.preventDefault(); setIsCreating(true)
    if (!newId || !newPass) { alert("ID & Pass required"); setIsCreating(false); return }
    const { error } = await supabase.from('groups').insert({ user_id: newId, password: newPass, role: newRole, member1_name: newName1, email: newEmail, status: 'lobby' })
    if (error) alert(error.message); else { alert("User Created"); setNewId(''); setNewPass(''); }
    setIsCreating(false)
  }

  const deleteUser = async (groupId) => {
    if (!confirm("Permanently delete user?")) return
    await supabase.from('tickets').delete().eq('group_id', groupId)
    await supabase.from('groups').delete().eq('id', groupId)
  }

  const toggleBan = async (groupId, status) => { await supabase.from('groups').update({ is_banned: !status }).eq('id', groupId) }

  return (
    <div className="min-h-screen bg-black text-white p-6 font-sans flex flex-col md:flex-row gap-6">
      
      {/* LEFT PANEL: CONTROLS */}
      <div className="flex-1 space-y-6">
        {/* HEADER */}
        <div className="bg-gray-900/50 border border-white/10 p-6 rounded-2xl backdrop-blur-md">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">ADMIN CONSOLE</h1>
            <button onClick={() => router.push('/')} className="text-red-400 text-xs font-bold border border-red-500/30 px-3 py-1 rounded hover:bg-red-500/10">LOGOUT</button>
          </div>
          <div className="grid grid-cols-1 gap-4">
             {/* RELEASE BUTTON */}
             <button 
                onClick={releaseProblemStatement} 
                disabled={config?.is_active}
                className={`p-4 rounded-lg font-bold border transition-all text-center ${config?.is_active ? 'bg-green-900/30 border-green-500 text-green-400 cursor-not-allowed' : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 border-white/20'}`}
             >
                {config?.is_active ? '✅ PROBLEM RELEASED (LIVE)' : '🚀 RELEASE PROBLEM STATEMENT'}
             </button>
             
             <button onClick={toggleFreeze} className={`p-3 rounded-lg font-bold border transition-all ${!config?.submissions_open ? 'bg-red-900/30 border-red-500 text-red-400 animate-pulse' : 'bg-gray-800 border-gray-600 text-gray-400'}`}>
                {config?.submissions_open ? '🔓 INTAKE OPEN' : '🔒 FREEZE INTAKE'}
             </button>
          </div>
        </div>

        {/* CREATE USER */}
        <div className="bg-gray-900/50 border border-white/10 p-6 rounded-2xl">
            <h3 className="font-bold text-gray-400 mb-4 tracking-widest text-sm">ADD PARTICIPANT</h3>
            <form onSubmit={createUser} className="space-y-3">
                <div className="grid grid-cols-2 gap-3"><input value={newId} onChange={e => setNewId(e.target.value.toUpperCase())} placeholder="Group ID (G88)" className="bg-black border border-white/20 p-2 rounded text-white" /><input value={newPass} onChange={e => setNewPass(e.target.value)} placeholder="Password" className="bg-black border border-white/20 p-2 rounded text-white" /></div>
                <div className="grid grid-cols-2 gap-3"><input value={newName1} onChange={e => setNewName1(e.target.value)} placeholder="Member 1 Name" className="bg-black border border-white/20 p-2 rounded text-white" /><input value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="Email" className="bg-black border border-white/20 p-2 rounded text-white" /></div>
                <button disabled={isCreating} className="w-full bg-white/10 hover:bg-white/20 border border-white/20 py-2 rounded font-bold">{isCreating ? 'ADDING...' : '+ ADD USER'}</button>
            </form>
        </div>

        {/* TICKETS */}
        {tickets.length > 0 && (
            <div className="bg-yellow-900/20 border border-yellow-500/50 p-4 rounded-2xl">
                <h3 className="text-yellow-500 font-bold mb-3 flex items-center gap-2">⚠️ RAISED HANDS ({tickets.length})</h3>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                    {tickets.map(t => (
                        <div key={t.id} className="bg-black/60 p-3 rounded flex justify-between items-center border border-yellow-500/20">
                            <div className="flex gap-3 items-center">
                                {t.groups?.team_photos?.[0] && <img src={t.groups.team_photos[0]} className="w-8 h-8 rounded-full object-cover" />}
                                <div><span className="font-bold text-white">{t.groups?.user_id}</span><p className="text-xs text-gray-400">{t.message}</p></div>
                            </div>
                            <button onClick={() => resolveTicket(t.id)} className="bg-yellow-500 text-black text-xs font-bold px-3 py-1 rounded hover:bg-white">SOLVED</button>
                        </div>
                    ))}
                </div>
            </div>
        )}
      </div>

      {/* RIGHT PANEL: GRID & LEADERBOARD */}
      <div className="flex-[2] flex flex-col gap-6">
        <div className="flex gap-4 border-b border-white/10 pb-4">
            <button onClick={() => setShowLeaderboard(false)} className={`text-sm font-bold pb-2 ${!showLeaderboard ? 'text-cyan-400 border-b-2 border-cyan-400' : 'text-gray-500'}`}>GRID VIEW</button>
            <button onClick={() => setShowLeaderboard(true)} className={`text-sm font-bold pb-2 ${showLeaderboard ? 'text-yellow-400 border-b-2 border-yellow-400' : 'text-gray-500'}`}>LEADERBOARD</button>
        </div>
        {showLeaderboard ? (<Leaderboard isAdmin={true} />) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 overflow-y-auto h-[80vh] pb-20">
                {groups.map(g => (
                    <div key={g.id} className={`p-4 rounded-xl border relative bg-gray-900/40 ${g.is_banned ? 'border-red-500' : 'border-white/10'}`}>
                        <div className="flex justify-between mb-2"><h3 className="font-bold text-lg">{g.user_id}</h3><div className="flex gap-1"><button onClick={() => toggleBan(g.id, g.is_banned)} className="text-[10px] border border-white/20 px-2 rounded hover:bg-white/10">{g.is_banned ? 'UNBAN' : 'BAN'}</button><button onClick={() => deleteUser(g.id)} className="text-[10px] bg-red-900/50 text-red-400 px-2 rounded hover:bg-red-900">DEL</button></div></div>
                        <div className="space-y-1 text-xs text-gray-400 font-mono"><p>MEMBERS: <span className="text-white">{g.member1_name}, {g.member2_name}</span></p><p>REPO: {g.repo_link ? <a href={g.repo_link} target="_blank" className="text-blue-400 underline">LINK</a> : '---'}</p><p>ZIP: {g.zip_url ? <a href={g.zip_url} className="text-green-400 underline">DOWNLOAD</a> : '---'}</p><p>UPDATED: {g.last_updated ? new Date(g.last_updated).toLocaleTimeString() : 'NEVER'}</p></div>
                    </div>
                ))}
            </div>
        )}
      </div>
    </div>
  )
}