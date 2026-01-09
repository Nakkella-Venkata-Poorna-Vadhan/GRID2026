'use client'
import { useEffect, useState, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { motion, AnimatePresence } from 'framer-motion'
import Leaderboard from '@/components/Leaderboard'

export default function StudentDashboard() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const id = searchParams.get('id')
  
  // --- DATA STATES ---
  const [groupData, setGroupData] = useState(null)
  const [config, setConfig] = useState(null)
  
  // --- INPUT STATES ---
  const [names, setNames] = useState({ member1: '', member2: '' })
  const [githubInput, setGithubInput] = useState('')
  const [repoError, setRepoError] = useState('')
  const [uploadingZip, setUploadingZip] = useState(false)

  // --- UI STATES ---
  const [localPhotos, setLocalPhotos] = useState([null, null])
  const [cameraStream, setCameraStream] = useState(null)
  const [activeCamIndex, setActiveCamIndex] = useState(null)
  const videoRef = useRef(null)
  const [showLeaderboard, setShowLeaderboard] = useState(false)
  const [helpRequested, setHelpRequested] = useState(false)

  // --- SUBMISSION WIZARD STATES ---
  const [submissionStage, setSubmissionStage] = useState('idle') // idle, terms, review, done
  const [captcha, setCaptcha] = useState({ a: 0, b: 0 })
  const [captchaInput, setCaptchaInput] = useState('')
  const [termsAccepted, setTermsAccepted] = useState(false)

  useEffect(() => {
    if (!id) return
    fetchData(); fetchConfig(); generateCaptcha()

    const channel = supabase.channel('student-realtime')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'groups', filter: `id=eq.${id}` }, (payload) => {
         setGroupData(payload.new)
         if (payload.new.team_photos) setLocalPhotos(payload.new.team_photos)
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'global_config' }, (payload) => setConfig(payload.new))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tickets', filter: `group_id=eq.${id}` }, (payload) => {
         if (payload.new.status === 'resolved') setHelpRequested(false)
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [id])

  const fetchData = async () => {
    const { data } = await supabase.from('groups').select('*').eq('id', id).single()
    setGroupData(data)
    setNames({ member1: data.member1_name || '', member2: data.member2_name || '' })
    if (data.team_photos) setLocalPhotos(data.team_photos)
    if (data.repo_link) setGithubInput(data.repo_link)
    const { data: ticket } = await supabase.from('tickets').select('*').eq('group_id', id).eq('status', 'open').maybeSingle()
    if (ticket) setHelpRequested(true)
  }
  const fetchConfig = async () => { const { data } = await supabase.from('global_config').select('*').single(); setConfig(data) }

  // --- UTILS ---
  const generateCaptcha = () => setCaptcha({ a: Math.floor(Math.random() * 10), b: Math.floor(Math.random() * 10) })
  
  const isReadyToSubmit = () => {
      // Logic: Must have names, 2 photos, a valid repo link in DB, and a zip url in DB
      return (
          groupData?.member1_name && 
          groupData?.member2_name && 
          groupData?.team_photos?.length === 2 &&
          !groupData?.team_photos.includes(null) &&
          groupData?.repo_link &&
          groupData?.zip_url
      )
  }

  // --- ACTIONS ---
  const saveProfile = async () => {
    if (!names.member1 || !names.member2) return alert("Please enter both full names.")
    if (localPhotos.includes(null)) return alert("Please upload photos for both members.")
    await supabase.from('groups').update({ member1_name: names.member1, member2_name: names.member2, team_photos: localPhotos }).eq('id', id)
    alert("Profile Saved!")
  }

  const saveRepo = async () => {
    const groupIdStr = groupData.user_id 
    const regex = new RegExp(`^https:\/\/github\.com\/[a-zA-Z0-9-]+\/${groupIdStr}_Hackathon_Jan$`)
    if (!regex.test(githubInput)) { setRepoError(`Invalid Format! Must be: https://github.com/USERNAME/${groupIdStr}_Hackathon_Jan`); return }
    setRepoError('')
    await supabase.from('groups').update({ repo_link: githubInput, last_updated: new Date() }).eq('id', id)
    alert("Repository Linked!")
  }

  const handleZipUpload = async (e) => {
    const file = e.target.files[0]; if (!file) return; setUploadingZip(true)
    const fileName = `${groupData.user_id}_submission_${Date.now()}.zip`
    const { error } = await supabase.storage.from('hackathon-zips').upload(fileName, file)
    if (error) { alert("Upload Failed"); setUploadingZip(false); return }
    const { data } = supabase.storage.from('hackathon-zips').getPublicUrl(fileName)
    await supabase.from('groups').update({ zip_url: data.publicUrl, last_updated: new Date() }).eq('id', id)
    setUploadingZip(false); alert("Zip Uploaded Successfully!")
  }

  const raiseHand = async () => {
    if (helpRequested) return
    await supabase.from('tickets').insert({ group_id: id, message: 'Help Requested' })
    const current = groupData.hand_raised_count || 0
    await supabase.from('groups').update({ hand_raised_count: current + 1 }).eq('id', id)
    setHelpRequested(true)
  }

  // --- SUBMISSION FLOW ---
  const handleStartSubmission = () => {
      if (!isReadyToSubmit()) return
      setSubmissionStage('terms')
  }

  const handleTermsSubmit = () => {
      if (!termsAccepted) return alert("You must accept the Terms & Conditions.")
      if (parseInt(captchaInput) !== captcha.a + captcha.b) {
          alert("Incorrect Captcha!"); generateCaptcha(); setCaptchaInput(''); return
      }
      setSubmissionStage('review')
  }

  const handleFinalSubmit = async () => {
      await supabase.from('groups').update({ status: 'submitted' }).eq('id', id)
      setSubmissionStage('done') // Shows Thank You
  }

  // Camera Utils
  const startCam = async (idx) => { setActiveCamIndex(idx); const s = await navigator.mediaDevices.getUserMedia({video:true}); setCameraStream(s); setTimeout(()=> {if(videoRef.current) videoRef.current.srcObject=s}, 100) }
  const takePic = async (idx) => {
    const v = videoRef.current; const c = document.createElement('canvas'); c.width=v.videoWidth; c.height=v.videoHeight; c.getContext('2d').drawImage(v,0,0)
    c.toBlob(async blob => {
        const fname = `${groupData.user_id}_p${idx}_${Date.now()}.jpg`
        await supabase.storage.from('hackathon-photos').upload(fname, blob)
        const { data } = supabase.storage.from('hackathon-photos').getPublicUrl(fname)
        const newPhotos = [...localPhotos]; newPhotos[idx] = data.publicUrl; setLocalPhotos(newPhotos)
        cameraStream.getTracks().forEach(t=>t.stop()); setActiveCamIndex(null)
    })
  }

  if (!groupData || !config) return <div className="bg-black h-screen text-green-500 flex items-center justify-center font-mono">LOADING SYSTEM...</div>

  const isFrozen = !config.submissions_open
  const isSetupComplete = groupData.member1_name && groupData.member2_name && !localPhotos.includes(null)
  const isCompleted = groupData.status === 'submitted'

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans relative overflow-hidden flex flex-col">
        
        {/* NAVBAR */}
        <nav className="border-b border-white/10 bg-black/50 backdrop-blur-md p-4 flex justify-between items-center z-50">
            <div className="flex items-center gap-4">
                <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">UNIT {groupData.user_id}</h1>
                {isFrozen && <span className="bg-red-500/20 text-red-400 border border-red-500/50 px-2 py-0.5 text-xs rounded animate-pulse">INTAKE FROZEN</span>}
            </div>
            <div className="flex gap-3">
                <button onClick={() => setShowLeaderboard(!showLeaderboard)} className="px-4 py-1 rounded border border-yellow-500/50 text-yellow-500 hover:bg-yellow-500/10 transition-all font-bold text-sm">{showLeaderboard ? 'CLOSE LEADERBOARD' : '🏆 LEADERBOARD'}</button>
                
                {/* COMPLETE BUTTON (Only active if ready) */}
                {!isCompleted && (
                    <button 
                        onClick={handleStartSubmission}
                        disabled={!isReadyToSubmit()}
                        className={`px-6 py-1 rounded font-bold text-sm transition-all shadow-lg ${
                            isReadyToSubmit() 
                            ? 'bg-gradient-to-r from-green-500 to-emerald-600 hover:scale-105 text-white shadow-green-500/20' 
                            : 'bg-gray-800 text-gray-500 cursor-not-allowed border border-gray-700'
                        }`}
                    >
                        {isReadyToSubmit() ? '✅ COMPLETE HACKATHON' : '⚠️ INCOMPLETE DATA'}
                    </button>
                )}

                <button onClick={raiseHand} disabled={helpRequested} className={`px-4 py-1 rounded border font-bold text-sm transition-all ${helpRequested ? 'bg-yellow-500 text-black' : 'border-white/20 hover:bg-white/10'}`}>{helpRequested ? '✋ WAITING...' : '✋ RAISE HAND'}</button>
            </div>
        </nav>

        {/* CONTENT AREA */}
        <div className="flex-1 flex overflow-hidden relative">
            <div className="flex-1 overflow-y-auto p-8 relative z-10">
                {/* --- 1. SETUP --- */}
                <div className={`mb-8 p-6 rounded-2xl border transition-all ${isSetupComplete ? 'bg-black/40 border-green-500/30' : 'bg-blue-900/10 border-blue-500/50'}`}>
                    <h2 className="text-lg font-bold mb-4 flex items-center gap-2">{isSetupComplete ? '✅' : '1.'} TEAM REGISTRATION</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-3">
                            <input disabled={isSetupComplete || isFrozen || isCompleted} value={names.member1} onChange={e => setNames({...names, member1: e.target.value})} placeholder="Participant 1 Full Name" className="w-full bg-black/50 border border-white/20 p-3 rounded text-white" />
                            <input disabled={isSetupComplete || isFrozen || isCompleted} value={names.member2} onChange={e => setNames({...names, member2: e.target.value})} placeholder="Participant 2 Full Name" className="w-full bg-black/50 border border-white/20 p-3 rounded text-white" />
                        </div>
                        <div className="flex gap-4">
                            {[0, 1].map(i => (
                                <div key={i} className="flex-1 aspect-square bg-black/50 rounded border border-white/20 relative overflow-hidden flex items-center justify-center group">
                                    {activeCamIndex === i ? (
                                        <><video ref={videoRef} autoPlay className="w-full h-full object-cover" /><button onClick={() => takePic(i)} className="absolute bottom-2 bg-white text-black text-xs px-3 py-1 rounded font-bold">SNAP</button></>
                                    ) : localPhotos[i] ? (
                                        <img src={localPhotos[i]} className="w-full h-full object-cover" />
                                    ) : (
                                        <button disabled={isFrozen || isCompleted} onClick={() => startCam(i)} className="text-xs text-gray-500 hover:text-white disabled:opacity-50">+ PHOTO</button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                    {!isSetupComplete && !isFrozen && !isCompleted && <button onClick={saveProfile} className="mt-4 w-full bg-blue-600 hover:bg-blue-500 py-2 rounded font-bold">SAVE PROFILE</button>}
                </div>

                {/* --- 2 & 3. SUBMISSION --- */}
                {isSetupComplete && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        <div className={`p-6 rounded-2xl border ${isFrozen || isCompleted ? 'bg-gray-900/50 border-gray-700 opacity-70' : 'bg-black/40 border-white/10'}`}>
                            <h2 className="font-bold mb-4 text-purple-400">2. GITHUB REPOSITORY</h2>
                            <input disabled={isFrozen || isCompleted} value={githubInput} onChange={e => setGithubInput(e.target.value)} placeholder={`https://github.com/User/${groupData.user_id}_Hackathon_Jan`} className="w-full bg-black/50 border border-white/20 p-3 rounded text-white mb-2 font-mono text-sm" />
                            {repoError && <p className="text-red-500 text-xs mb-2">{repoError}</p>}
                            <button disabled={isFrozen || isCompleted} onClick={saveRepo} className="bg-purple-600/80 hover:bg-purple-500 px-6 py-2 rounded font-bold text-sm disabled:opacity-50">LINK REPO</button>
                        </div>
                        <div className={`p-6 rounded-2xl border ${isCompleted ? 'bg-gray-900/50 border-gray-700 opacity-70' : 'bg-black/40 border-white/10'}`}>
                            <h2 className="font-bold mb-4 text-green-400">3. FINAL SUBMISSION (ZIP)</h2>
                            <div className="border-2 border-dashed border-white/20 rounded-xl p-6 text-center hover:border-green-500/50 transition-colors relative">
                                <input disabled={isCompleted} type="file" onChange={handleZipUpload} accept=".zip" className="absolute inset-0 opacity-0 cursor-pointer disabled:cursor-not-allowed" />
                                {uploadingZip ? <p className="animate-pulse text-green-400">UPLOADING...</p> : <p className="text-gray-500">DRAG & DROP OR CLICK TO UPLOAD ZIP</p>}
                            </div>
                            {groupData.zip_url && (<div className="mt-4 p-3 bg-green-900/20 border border-green-500/30 rounded flex justify-between items-center"><span className="text-green-400 text-xs">✅ ZIP UPLOADED</span><a href={groupData.zip_url} className="text-xs underline text-white">DOWNLOAD</a></div>)}
                        </div>
                    </div>
                )}

                {config.is_active && groupData.assigned_problem && (<div className="mt-8 p-6 bg-white/5 border border-white/10 rounded-2xl select-none"><h2 className="font-bold text-xl mb-4 text-cyan-400">MISSION BRIEFING</h2><div className="font-mono text-gray-300 whitespace-pre-wrap">{groupData.assigned_problem}</div></div>)}
            </div>

            {/* LEADERBOARD */}
            <AnimatePresence>
                {showLeaderboard && (<motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 20 }} className="absolute top-0 right-0 h-full w-full md:w-[400px] z-40 p-4"><Leaderboard /></motion.div>)}
            </AnimatePresence>
        </div>

        {/* --- MODAL 1: TERMS & CAPTCHA --- */}
        <AnimatePresence>
            {submissionStage === 'terms' && (
                <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
                    <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-[#0f0f0f] border border-white/10 rounded-2xl p-8 max-w-md w-full shadow-2xl relative">
                        <button onClick={() => setSubmissionStage('idle')} className="absolute top-4 right-4 text-gray-500">✕</button>
                        <h2 className="text-2xl font-bold text-white mb-6">FINAL VERIFICATION</h2>
                        
                        <div className="h-40 overflow-y-auto bg-black/50 p-4 rounded border border-white/5 text-xs text-gray-400 mb-6 font-mono leading-relaxed">
                            <p className="mb-2">1. By submitting, you confirm that all code provided is original and created during the hackathon period.</p>
                            <p className="mb-2">2. Plagiarism or use of pre-built commercial templates will result in immediate disqualification.</p>
                            <p className="mb-2">3. The decision of the judges is final and binding.</p>
                            <p>4. You grant the organizers permission to review and test your submitted code.</p>
                        </div>

                        <label className="flex items-center gap-3 mb-6 cursor-pointer">
                            <input type="checkbox" checked={termsAccepted} onChange={e => setTermsAccepted(e.target.checked)} className="w-5 h-5 accent-blue-500" />
                            <span className="text-sm text-gray-300">I accept the Terms & Conditions</span>
                        </label>

                        <div className="bg-white/5 p-4 rounded mb-6">
                            <label className="block text-xs text-gray-500 mb-2">SECURITY CHECK: {captcha.a} + {captcha.b} = ?</label>
                            <input 
                                value={captchaInput} 
                                onChange={e => setCaptchaInput(e.target.value)} 
                                type="number" 
                                className="w-full bg-black border border-white/20 rounded p-2 text-white" 
                                placeholder="Enter Sum"
                            />
                        </div>

                        <button onClick={handleTermsSubmit} className="w-full bg-blue-600 hover:bg-blue-500 py-3 rounded-lg font-bold transition-all">PROCEED TO REVIEW</button>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>

        {/* --- MODAL 2: REVIEW SNAPSHOT --- */}
        <AnimatePresence>
            {submissionStage === 'review' && (
                <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
                    <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-[#0f0f0f] border border-blue-500/30 rounded-2xl p-8 max-w-2xl w-full shadow-[0_0_50px_rgba(59,130,246,0.1)] relative">
                        <button onClick={() => setSubmissionStage('idle')} className="absolute top-4 right-4 text-gray-500">✕</button>
                        <h2 className="text-2xl font-bold text-white mb-2">SUBMISSION SNAPSHOT</h2>
                        <p className="text-gray-500 text-sm mb-6">Please verify all details before final commitment. This cannot be undone.</p>

                        <div className="grid grid-cols-2 gap-6 mb-6">
                            <div>
                                <p className="text-xs text-gray-500 mb-1">PARTICIPANTS</p>
                                <div className="bg-white/5 p-3 rounded border border-white/10">
                                    <p className="font-bold text-white">{names.member1}</p>
                                    <p className="font-bold text-white">{names.member2}</p>
                                </div>
                            </div>
                            <div>
                                <p className="text-xs text-gray-500 mb-1">VERIFICATION PHOTOS</p>
                                <div className="flex gap-2">
                                    {localPhotos.map((url, i) => <img key={i} src={url} className="w-16 h-16 rounded object-cover border border-white/20" />)}
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4 mb-8">
                            <div>
                                <p className="text-xs text-gray-500 mb-1">REPOSITORY</p>
                                <div className="bg-black/50 p-2 rounded border border-white/10 font-mono text-sm text-blue-400 break-all">{githubInput}</div>
                            </div>
                            <div>
                                <p className="text-xs text-gray-500 mb-1">ARCHIVE</p>
                                <div className="bg-black/50 p-2 rounded border border-white/10 font-mono text-sm text-green-400 break-all">{groupData.zip_url}</div>
                            </div>
                        </div>

                        <button onClick={handleFinalSubmit} className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 py-4 rounded-lg font-bold text-lg shadow-lg shadow-green-500/20">CONFIRM & COMPLETE HACKATHON</button>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>

        {/* --- MODAL 3: THANK YOU SCREEN (FINAL) --- */}
        {isCompleted && (
            <div className="fixed inset-0 z-[200] bg-black flex flex-col items-center justify-center p-8 text-center">
                <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.5 }}>
                    <div className="text-8xl mb-6">🎉</div>
                    <h1 className="text-5xl md:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600 mb-6">
                        THANK YOU!
                    </h1>
                    <p className="text-2xl text-white font-light max-w-2xl mx-auto leading-relaxed mb-8">
                        Your submission has been securely recorded. <br/>
                        Unit <span className="font-bold text-purple-400">{groupData.user_id}</span> has successfully completed the mission.
                    </p>
                    <div className="p-6 bg-white/5 border border-white/10 rounded-xl inline-block">
                        <p className="text-sm text-gray-400 mb-2">SUBMISSION HASH</p>
                        <p className="font-mono text-green-400 text-lg tracking-widest">{id.split('-')[0].toUpperCase()} - COMPLETED</p>
                    </div>
                    <div className="mt-12 text-gray-600 text-sm">You may now close this window or spectate the leaderboard.</div>
                </motion.div>
            </div>
        )}

        {groupData.is_banned && <div className="absolute inset-0 z-[100] bg-red-950/95 flex flex-col items-center justify-center"><h1 className="text-9xl font-black text-red-500">BANNED</h1></div>}
    </div>
  )
}