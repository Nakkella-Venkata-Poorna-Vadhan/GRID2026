'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function Leaderboard({ isAdmin }) {
  const [entries, setEntries] = useState([])
  const [selectedGroup, setSelectedGroup] = useState(null)

  useEffect(() => {
    fetchLeaderboard()
    // Realtime updates for leaderboard
    const channel = supabase.channel('leaderboard-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'groups' }, () => fetchLeaderboard())
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [])

  const fetchLeaderboard = async () => {
    // Fetch all student groups, ordered by ID (G1, G2...)
    // Note: To sort 'G1', 'G10' correctly, we'd need complex SQL, 
    // but for now simple string sort or user_id sort is fine.
    const { data } = await supabase.from('groups')
      .select('*')
      .eq('role', 'student')
      .order('user_id', { ascending: true })
    setEntries(data || [])
  }

  return (
    <div className="bg-black/80 border border-white/10 rounded-xl p-6 backdrop-blur-md h-full overflow-hidden flex flex-col">
      <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500 mb-6 tracking-widest flex items-center gap-3">
        <span>🏆</span> LIVE STANDINGS
      </h2>

      <div className="overflow-y-auto flex-1 pr-2 space-y-3 custom-scrollbar">
        {entries.map((group) => (
          <div 
            key={group.id}
            onClick={() => setSelectedGroup(group)}
            className={`
              p-4 rounded-lg border transition-all cursor-pointer relative overflow-hidden group
              ${group.is_banned ? 'bg-red-900/20 border-red-500/50' : 'bg-white/5 border-white/10 hover:bg-white/10'}
            `}
          >
            {/* BANNED OVERLAY */}
            {group.is_banned && (
              <div className="absolute inset-0 bg-red-950/80 flex items-center justify-center z-10">
                <span className="text-red-500 font-black tracking-widest text-xl -rotate-12 border-4 border-red-500 px-4 py-1">BANNED</span>
              </div>
            )}

            <div className="flex justify-between items-center relative z-0">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center font-bold text-xs">
                  {group.user_id}
                </div>
                <div>
                  <h3 className="font-bold text-white text-sm">{group.member1_name || 'Unknown'} & {group.member2_name || '...'}</h3>
                  <p className="text-[10px] text-gray-500 font-mono mt-1">
                    QUERIES: <span className="text-yellow-500">{group.hand_raised_count || 0}</span>
                  </p>
                </div>
              </div>
              
              <div className="flex flex-col items-end gap-2">
                 {group.repo_link ? (
                    <a href={group.repo_link} target="_blank" onClick={(e) => e.stopPropagation()} className="text-[10px] bg-green-900/30 text-green-400 border border-green-500/30 px-2 py-1 rounded hover:bg-green-500 hover:text-black transition-colors">
                      REPO LINKED
                    </a>
                 ) : (
                    <span className="text-[10px] text-gray-600">NO REPO</span>
                 )}
                 {group.zip_url && (
                    <span className="text-[10px] bg-blue-900/30 text-blue-400 border border-blue-500/30 px-2 py-1 rounded">
                      ZIP UPLOADED
                    </span>
                 )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* DETAIL MODAL */}
      {selectedGroup && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={() => setSelectedGroup(null)}>
          <div className="bg-[#0a0a0a] border border-white/20 rounded-2xl p-8 max-w-lg w-full relative shadow-2xl" onClick={e => e.stopPropagation()}>
            <button onClick={() => setSelectedGroup(null)} className="absolute top-4 right-4 text-gray-500 hover:text-white">✕</button>
            
            <h2 className="text-3xl font-bold text-white mb-6 border-b border-white/10 pb-4">{selectedGroup.user_id} DETAILS</h2>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white/5 p-3 rounded">
                  <p className="text-xs text-gray-500">LEADER</p>
                  <p className="text-white font-mono">{selectedGroup.member1_name || 'N/A'}</p>
                </div>
                <div className="bg-white/5 p-3 rounded">
                  <p className="text-xs text-gray-500">MEMBER 2</p>
                  <p className="text-white font-mono">{selectedGroup.member2_name || 'N/A'}</p>
                </div>
              </div>

              <div className="bg-white/5 p-3 rounded">
                <p className="text-xs text-gray-500">REPO LINK</p>
                {selectedGroup.repo_link ? (
                  <a href={selectedGroup.repo_link} target="_blank" className="text-blue-400 underline break-all font-mono text-sm">{selectedGroup.repo_link}</a>
                ) : <span className="text-gray-600 text-sm">Not submitted</span>}
              </div>

              <div className="bg-white/5 p-3 rounded">
                <p className="text-xs text-gray-500">SUBMISSION ZIP</p>
                {selectedGroup.zip_url ? (
                  <a href={selectedGroup.zip_url} className="text-green-400 font-bold text-sm hover:underline">DOWNLOAD ZIP ARCHIVE</a>
                ) : <span className="text-gray-600 text-sm">No file uploaded</span>}
              </div>

              {/* ADMIN ONLY: PHOTOS */}
              {isAdmin && selectedGroup.team_photos && (
                <div className="mt-4">
                  <p className="text-xs text-gray-500 mb-2">VERIFICATION PHOTOS (ADMIN ONLY)</p>
                  <div className="flex gap-2">
                    {selectedGroup.team_photos.map((url, i) => (
                      <img key={i} src={url} className="w-24 h-24 object-cover rounded border border-white/20" />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}