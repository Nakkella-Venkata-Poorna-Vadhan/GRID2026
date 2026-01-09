'use client'
import { useEffect, useState, useRef, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { motion, AnimatePresence } from 'framer-motion'
import Leaderboard from '@/components/Leaderboard'
import Workspace from '@/components/Workspace'

// --- 1. MAIN CONTENT COMPONENT ---
function StudentContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const id = searchParams.get('id')
  
  // --- CORE DATA STATES ---
  const [groupData, setGroupData] = useState(null)
  const [config, setConfig] = useState(null)
  
  // --- SETUP STATES ---
  const [names, setNames] = useState({ member1: '', member2: '' })
  const [githubInput, setGithubInput] = useState('')
  const [repoError, setRepoError] = useState('')
  const [uploadingZip, setUploadingZip] = useState(false)
  
  // --- MEDIA STATES ---
  const [cameraStream, setCameraStream] = useState(null)
  const videoRef = useRef(null)
  const [activeCamIndex, setActiveCamIndex] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [localPhotos, setLocalPhotos] = useState([null, null]) 
  const fileInputRefs = useRef([])

  // --- MISSION CONTROL STATES ---
  const [helpRequested, setHelpRequested] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [announcements, setAnnouncements] = useState([])
  const [activePopup, setActivePopup] = useState(null)
  const [showHistory, setShowHistory] = useState(false)
  const [showLeaderboard, setShowLeaderboard] = useState(false)

  // --- PROFILE EDIT STATES ---
  const [showProfile, setShowProfile] = useState(false)
  const [isEditingProfile, setIsEditingProfile] = useState(false)
  const [editGithub, setEditGithub] = useState('')
  const [editPhotos, setEditPhotos] = useState([])

  // --- SUBMISSION WIZARD STATES ---
  const [submissionStage, setSubmissionStage] = useState('idle') // 'idle' | 'terms' | 'review' | 'done'
  const [captcha, setCaptcha] = useState({ a: 0, b: 0 })
  const [captchaInput, setCaptchaInput] = useState('')
  const [termsAccepted, setTermsAccepted] = useState(false)

  // --- INITIALIZATION ---
  useEffect(() => {
    if (!id) return
    const fetchData = async () => {
      const { data } = await supabase.from('groups').select('*').eq('id', id).single()
      setGroupData(data)
      setNames({ member1: data.member1_name || '', member2: data.member2_name || '' })
      if (data?.team_photos && data.team_photos.length > 0) {
          setLocalPhotos(data.team_photos)
          setEditPhotos(data.team_photos)
      }
      if (data.repo_link) setGithubInput(data.repo_link)
      const { data: ticket } = await supabase.from('tickets').select('*').eq('group_id', id).eq('status', 'open').maybeSingle()
      if (ticket) setHelpRequested(true)
    }
    const fetchConfig = async () => { const { data } = await supabase.from('global_config').select('*').single(); setConfig(data) }
    const fetchAnnouncements = async () => { const { data } = await supabase.from('announcements').select('*').order('created_at', { ascending: false }); setAnnouncements(data || []) }

    generateCaptcha(); fetchData(); fetchConfig(); fetchAnnouncements()

    const channel = supabase.channel('student-room')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'groups', filter: `id=eq.${id}` }, (payload) => { 
          setGroupData(payload.new)
          if (payload.new.team_photos && !isEditingProfile) {
              setLocalPhotos(payload.new.team_photos)
              setEditPhotos(payload.new.team_photos)
          }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'global_config' }, (payload) => setConfig(payload.new))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tickets', filter: `group_id=eq.${id}` }, (payload) => { if (payload.new.status === 'resolved') setHelpRequested(false) })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'announcements' }, (payload) => { setAnnouncements(prev => [payload.new, ...prev]); setActivePopup(payload.new) })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [id, isEditingProfile])

  // --- UTILS ---
  const generateCaptcha = () => setCaptcha({ a: Math.floor(Math.random() * 10), b: Math.floor(Math.random() * 10) })
  const isReadyToSubmit = () => groupData?.member1_name && groupData?.member2_name && groupData?.team_photos?.length === 2 && !groupData?.team_photos.includes(null) && groupData?.repo_link && groupData?.zip_url

  // --- CAMERA & UPLOAD LOGIC ---
  const startCamera = async (index) => { setActiveCamIndex(index); try { const stream = await navigator.mediaDevices.getUserMedia({ video: true }); setCameraStream(stream); setTimeout(() => { if (videoRef.current) videoRef.current.srcObject = stream }, 100) } catch (err) { alert("Camera access denied! Try uploading a file instead.") } }
  const stopCamera = () => { if (cameraStream) { cameraStream.getTracks().forEach(track => track.stop()); setCameraStream(null); setActiveCamIndex(null) } }

  const capturePhoto = async (index) => {
    if (!groupData) return; setUploading(true)
    const video = videoRef.current; const canvas = document.createElement('canvas'); canvas.width = video.videoWidth; canvas.height = video.videoHeight; canvas.getContext('2d').drawImage(video, 0, 0)
    canvas.toBlob(async (blob) => {
      const fileName = `${groupData.user_id}_member_${index}_${Date.now()}.jpg`
      await supabase.storage.from('hackathon-photos').upload(fileName, blob)
      const { data } = supabase.storage.from('hackathon-photos').getPublicUrl(fileName)
      const updatedPhotos = [...localPhotos]; updatedPhotos[index] = data.publicUrl; setLocalPhotos(updatedPhotos)
      await supabase.from('groups').update({ team_photos: updatedPhotos }).eq('id', id)
      stopCamera(); setUploading(false)
    }, 'image/jpeg')
  }

  const handlePhotoUpload = async (e, index) => {
      const file = e.target.files[0]; if (!file) return; setUploading(true)
      const fileName = `${groupData.user_id}_member_${index}_${Date.now()}.${file.name.split('.').pop()}`
      const { error } = await supabase.storage.from('hackathon-photos').upload(fileName, file)
      if (error) { alert("Upload Failed"); setUploading(false); return }
      const { data } = supabase.storage.from('hackathon-photos').getPublicUrl(fileName)
      const updatedPhotos = [...localPhotos]; updatedPhotos[index] = data.publicUrl; setLocalPhotos(updatedPhotos)
      await supabase.from('groups').update({ team_photos: updatedPhotos }).eq('id', id)
      setUploading(false)
  }

  const clearPhoto = async (index) => {
      if (!confirm("Remove this photo?")) return
      const updatedPhotos = [...localPhotos]; updatedPhotos[index] = null; setLocalPhotos(updatedPhotos)
      await supabase.from('groups').update({ team_photos: updatedPhotos }).eq('id', id)
  }

  const addMemberSlot = () => { setLocalPhotos([...localPhotos, null]) }

  // --- ACTIONS ---
  const saveProfile = async () => { if (!names.member1 || !names.member2) return alert("Enter both names."); if (localPhotos.includes(null)) return alert("Upload both photos."); await supabase.from('groups').update({ member1_name: names.member1, member2_name: names.member2, team_photos: localPhotos }).eq('id', id); alert("Profile Saved!") }
  const saveRepo = async () => { const regex = new RegExp(`^https:\/\/github\.com\/[a-zA-Z0-9-]+\/${groupData.user_id}_Hackathon_Jan$`); if (!regex.test(githubInput)) { setRepoError(`Invalid! Use: https://github.com/USERNAME/${groupData.user_id}_Hackathon_Jan`); return } setRepoError(''); await supabase.from('groups').update({ repo_link: githubInput, last_updated: new Date() }).eq('id', id); alert("Repo Linked!") }
  const handleZipUpload = async (e) => { const file = e.target.files[0]; if (!file) return; setUploadingZip(true); const fileName = `${groupData.user_id}_sub_${Date.now()}.zip`; const { error } = await supabase.storage.from('hackathon-zips').upload(fileName, file); if(error) { alert("Fail"); setUploadingZip(false); return } const { data } = supabase.storage.from('hackathon-zips').getPublicUrl(fileName); await supabase.from('groups').update({ zip_url: data.publicUrl, last_updated: new Date() }).eq('id', id); setUploadingZip(false); alert("Zip Uploaded!") }
  const raiseHand = async () => { if (helpRequested) return; await supabase.from('tickets').insert({ group_id: id, message: 'Help Requested' }); const c = groupData.hand_raised_count || 0; await supabase.from('groups').update({ hand_raised_count: c + 1 }).eq('id', id); setHelpRequested(true) }
  const handleLogout = () => { if (confirm("Logout?")) router.push('/') }
  
  // --- SUBMISSION FLOW ---
  const handleStartSubmission = () => { if (!isReadyToSubmit()) return; setSubmissionStage('terms') }
  const handleTermsSubmit = () => { if (!termsAccepted) return alert("Accept Terms"); if (parseInt(captchaInput) !== captcha.a + captcha.b) { alert("Wrong Captcha"); generateCaptcha(); return } setSubmissionStage('review') }
  const handleFinalSubmit = async () => { await supabase.from('groups').update({ status: 'submitted' }).eq('id', id); setSubmissionStage('done') }

  // --- EDIT PROFILE LOGIC ---
  const handleRequestEdit = async () => { if (!editGithub) return alert("Github required"); await supabase.from('groups').update({ edit_request: { github_username: editGithub, team_photos: editPhotos } }).eq('id', id); setIsEditingProfile(false); alert("Request Sent.") }
  const captureEditPhoto = async (index) => { /* Reuse capture logic for edits if needed */ } 

  if (!groupData || !config) return <div className="bg-black h-screen text-green-500 flex items-center justify-center font-mono">LOADING SYSTEM...</div>

  const isFrozen = !config.submissions_open
  const isSetupComplete = groupData.member1_name && groupData.member2_name && !localPhotos.includes(null)
  const isFinished = groupData.status === 'submitted'
  const isPending = groupData.status === 'pending_submission'
  const hasPendingEdit = groupData.edit_request !== null

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans relative overflow-hidden flex flex-col">
        {/* NAVBAR */}
        <nav className="border-b border-white/10 bg-black/50 backdrop-blur-md p-4 flex justify-between items-center z-50">
            <div className="flex items-center gap-4 cursor-pointer" onClick={() => { setShowProfile(true); setEditGithub(groupData?.github_username || ''); setEditPhotos(groupData?.team_photos || []) }}>
                <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></div>
                <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">UNIT {groupData?.user_id}</h1>
            </div>
            <div className="flex gap-3 relative">
                <button onClick={() => setShowHistory(!showHistory)} className="p-2 hover:bg-white/10 rounded-lg relative"><span className="text-xl">🔔</span>{announcements.length > 0 && <span className="absolute top-0 right-0 h-3 w-3 bg-red-500 rounded-full border-2 border-black"></span>}</button>
                <AnimatePresence>{showHistory && (<motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="absolute top-14 right-0 w-80 bg-black/95 border border-purple-500/30 rounded-xl backdrop-blur-xl shadow-2xl overflow-hidden max-h-96 overflow-y-auto z-[60]"><div className="bg-purple-900/20 p-3 border-b border-white/10 font-bold text-xs tracking-widest text-purple-400">INCOMING TRANSMISSIONS</div>{announcements.map(msg => (<div key={msg.id} className="p-4 border-b border-white/5 hover:bg-white/5"><p className="text-sm text-gray-200">{msg.message}</p><p className="text-[10px] text-gray-600 mt-2 font-mono">{new Date(msg.created_at).toLocaleTimeString()}</p></div>))}</motion.div>)}</AnimatePresence>
                <button onClick={() => setShowLeaderboard(!showLeaderboard)} className="px-4 py-1 rounded border border-yellow-500/50 text-yellow-500 hover:bg-yellow-500/10 font-bold text-sm hidden md:block">{showLeaderboard ? 'CLOSE LEADERBOARD' : '🏆 LEADERBOARD'}</button>
                
                {/* --- COMPLETE BUTTON --- */}
                {!isFinished && <button onClick={handleStartSubmission} disabled={!isReadyToSubmit()} className={`px-6 py-1 rounded font-bold text-sm transition-all shadow-lg ${isReadyToSubmit() ? 'bg-gradient-to-r from-green-500 to-emerald-600 hover:scale-105 text-white shadow-green-500/20' : 'bg-gray-800 text-gray-500 cursor-not-allowed border border-gray-700'}`}>{isReadyToSubmit() ? '✅ COMPLETE HACKATHON' : '⚠️ INCOMPLETE DATA'}</button>}
                
                <button onClick={raiseHand} disabled={helpRequested} className={`px-4 py-1 rounded border font-bold text-sm transition-all ${helpRequested ? 'bg-yellow-500 text-black' : 'border-white/20 hover:bg-white/10'}`}>{helpRequested ? '✋ WAITING...' : '✋ RAISE HAND'}</button>
                <button onClick={handleLogout} className="text-red-400 hover:text-red-300 font-bold text-sm px-2">EXIT</button>
            </div>
        </nav>

        <div className="flex-1 flex overflow-hidden relative">
            <div className="flex-1 overflow-y-auto p-8 relative z-10">
                {/* 1. SETUP */}
                <div className={`mb-8 p-6 rounded-2xl border transition-all ${isSetupComplete ? 'bg-black/40 border-green-500/30' : 'bg-blue-900/10 border-blue-500/50'}`}>
                    <h2 className="text-lg font-bold mb-4 flex items-center gap-2">{isSetupComplete ? '✅' : '1.'} TEAM REGISTRATION</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-3">
                            <input disabled={isSetupComplete || isFrozen || isFinished} value={names.member1} onChange={e => setNames({...names, member1: e.target.value})} placeholder="Participant 1 Full Name" className="w-full bg-black/50 border border-white/20 p-3 rounded text-white" />
                            <input disabled={isSetupComplete || isFrozen || isFinished} value={names.member2} onChange={e => setNames({...names, member2: e.target.value})} placeholder="Participant 2 Full Name" className="w-full bg-black/50 border border-white/20 p-3 rounded text-white" />
                        </div>
                        <div className="flex gap-4">
                            {[0, 1].map(i => (
                                <div key={i} className="flex-1 aspect-square bg-black/50 rounded border border-white/20 relative overflow-hidden flex items-center justify-center group">
                                    <input type="file" ref={el => fileInputRefs.current[i] = el} onChange={(e) => handlePhotoUpload(e, i)} hidden accept="image/png, image/jpeg" />
                                    {activeCamIndex === i ? (
                                        <><video ref={videoRef} autoPlay className="w-full h-full object-cover" /><div className="absolute bottom-2 flex gap-2"><button onClick={() => capturePhoto(i)} className="bg-white text-black text-xs px-3 py-1 rounded font-bold">SNAP</button><button onClick={stopCamera} className="bg-red-500 text-white px-2 rounded">X</button></div></>
                                    ) : localPhotos[i] ? (
                                        <div className="relative w-full h-full group">
                                            <img src={localPhotos[i]} className="w-full h-full object-cover" />
                                            {!isSetupComplete && !isFrozen && (
                                                <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button onClick={() => clearPhoto(i)} className="bg-red-500 text-white px-4 py-2 text-sm font-bold rounded hover:bg-red-600">RETAKE</button>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="flex flex-col gap-2">
                                            <button disabled={isFrozen || isFinished} onClick={() => startCamera(i)} className="text-xs border border-white/20 px-3 py-1 rounded hover:bg-white/10">📸 CAMERA</button>
                                            <button disabled={isFrozen || isFinished} onClick={() => fileInputRefs.current[i].click()} className="text-xs border border-white/20 px-3 py-1 rounded hover:bg-white/10">📂 UPLOAD</button>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                    {!isSetupComplete && !isFrozen && !isFinished && <button onClick={saveProfile} className="mt-4 w-full bg-blue-600 hover:bg-blue-500 py-2 rounded font-bold">SAVE PROFILE</button>}
                </div>

                {/* 2 & 3. SUBMISSION */}
                {isSetupComplete && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        <div className={`p-6 rounded-2xl border ${isFrozen || isFinished ? 'bg-gray-900/50 border-gray-700 opacity-70' : 'bg-black/40 border-white/10'}`}>
                            <h2 className="font-bold mb-4 text-purple-400">2. GITHUB REPOSITORY</h2><input disabled={isFrozen || isFinished} value={githubInput} onChange={e => setGithubInput(e.target.value)} placeholder={`https://github.com/User/${groupData.user_id}_Hackathon_Jan`} className="w-full bg-black/50 border border-white/20 p-3 rounded text-white mb-2 font-mono text-sm" />{repoError && <p className="text-red-500 text-xs mb-2">{repoError}</p>}<button disabled={isFrozen || isFinished} onClick={saveRepo} className="bg-purple-600/80 hover:bg-purple-500 px-6 py-2 rounded font-bold text-sm disabled:opacity-50">LINK REPO</button>
                        </div>
                        <div className={`p-6 rounded-2xl border ${isFinished ? 'bg-gray-900/50 border-gray-700 opacity-70' : 'bg-black/40 border-white/10'}`}>
                            <h2 className="font-bold mb-4 text-green-400">3. FINAL SUBMISSION (ZIP)</h2><div className="border-2 border-dashed border-white/20 rounded-xl p-6 text-center hover:border-green-500/50 transition-colors relative"><input disabled={isFinished} type="file" onChange={handleZipUpload} accept=".zip" className="absolute inset-0 opacity-0 cursor-pointer disabled:cursor-not-allowed" />{uploadingZip ? <p className="animate-pulse text-green-400">UPLOADING...</p> : <p className="text-gray-500">DRAG & DROP OR CLICK TO UPLOAD ZIP</p>}</div>{groupData.zip_url && (<div className="mt-4 p-3 bg-green-900/20 border border-green-500/30 rounded flex justify-between items-center"><span className="text-green-400 text-xs">✅ ZIP UPLOADED</span><a href={groupData.zip_url} className="text-xs underline text-white">DOWNLOAD</a></div>)}
                        </div>
                    </div>
                )}
                {config.is_active && groupData.assigned_problem && (<div className="mt-8 p-6 bg-white/5 border border-white/10 rounded-2xl select-none"><h2 className="font-bold text-xl mb-4 text-cyan-400">MISSION BRIEFING</h2><div className="font-mono text-gray-300 whitespace-pre-wrap">{groupData.assigned_problem}</div></div>)}
            </div>
            
            <AnimatePresence>{showLeaderboard && (<motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 20 }} className="absolute top-0 right-0 h-full w-full md:w-[400px] z-40 p-4"><Leaderboard /></motion.div>)}</AnimatePresence>
            {groupData?.is_banned && (<div className="absolute inset-0 z-[100] bg-red-950/95 flex flex-col items-center justify-center"><h1 className="text-9xl font-black text-red-500">BANNED</h1><p className="text-xl text-white mt-4">CONTACT ADMINISTRATOR</p></div>)}
        </div>

        {/* --- MODALS --- */}
        <AnimatePresence>
            {/* TERMS & CAPTCHA */}
            {submissionStage === 'terms' && (
                <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
                    <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-[#0f0f0f] border border-white/10 rounded-2xl p-8 max-w-md w-full shadow-2xl relative">
                        <button onClick={() => setSubmissionStage('idle')} className="absolute top-4 right-4 text-gray-500">✕</button>
                        <h2 className="text-2xl font-bold text-white mb-6">FINAL VERIFICATION</h2>
                        
                        <div className="h-40 overflow-y-auto bg-black/50 p-4 rounded border border-white/5 text-xs text-gray-400 mb-6 font-mono leading-relaxed">
                            <p className="mb-2">1. By submitting, you confirm that all code provided is original.</p>
                            <p className="mb-2">2. Plagiarism will result in immediate disqualification.</p>
                            <p className="mb-2">3. The decision of the judges is final.</p>
                            <p>4. You grant permission to review your code.</p>
                        </div>

                        <label className="flex items-center gap-3 mb-6 cursor-pointer">
                            <input type="checkbox" checked={termsAccepted} onChange={e => setTermsAccepted(e.target.checked)} className="w-5 h-5 accent-blue-500" />
                            <span className="text-sm text-gray-300">I accept the Terms & Conditions</span>
                        </label>

                        <div className="bg-white/5 p-4 rounded mb-6">
                            <label className="block text-xs text-gray-500 mb-2">SECURITY CHECK: {captcha.a} + {captcha.b} = ?</label>
                            <input value={captchaInput} onChange={e => setCaptchaInput(e.target.value)} type="number" className="w-full bg-black border border-white/20 rounded p-2 text-white" placeholder="Enter Sum" />
                        </div>

                        <button onClick={handleTermsSubmit} className="w-full bg-blue-600 hover:bg-blue-500 py-3 rounded-lg font-bold transition-all">PROCEED TO REVIEW</button>
                    </motion.div>
                </div>
            )}

            {/* REVIEW SNAPSHOT */}
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
                                <p className="text-xs text-gray-500 mb-1">PHOTOS</p>
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

            {/* PROFILE MODAL */}
            {showProfile && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
                    <div className="w-full max-w-3xl bg-[#0a0a0a] border border-white/10 rounded-2xl p-6 md:p-8 shadow-2xl relative overflow-hidden">
                        <button onClick={() => setShowProfile(false)} className="absolute top-4 right-4 text-gray-500 hover:text-white font-bold">X</button>
                        <h2 className="text-2xl font-bold text-white mb-8 tracking-widest border-b border-white/10 pb-4">IDENTIFICATION CARD</h2>
                        <div className="flex flex-col md:flex-row gap-8">
                            <div className="flex-1 grid grid-cols-2 gap-2">{(isEditingProfile ? editPhotos : localPhotos).map((url, i) => (<div key={i} className="aspect-video bg-black/50 rounded border border-white/20 relative overflow-hidden group">{isEditingProfile && activeCamIndex === i ? (<><video ref={videoRef} autoPlay className="w-full h-full object-cover" /><div className="absolute bottom-1 left-1 right-1 flex gap-1"><button onClick={() => captureEditPhoto(i)} className="flex-1 bg-white text-black text-[10px] py-1 font-bold rounded">SNAP</button><button onClick={stopCamera} className="bg-red-500 text-white px-2 text-[10px] rounded">X</button></div></>) : (<><img src={url} className="w-full h-full object-cover" />{isEditingProfile && (<div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><button onClick={() => startCamera(i)} className="bg-white text-black px-3 py-1 text-xs font-bold rounded hover:bg-gray-200">RETAKE</button></div>)}</>)}</div>))}</div>
                            <div className="flex-1 space-y-6"><div><label className="text-xs text-gray-500 tracking-widest block mb-1">UNIT ID</label><div className="text-xl font-mono text-cyan-400">{groupData?.user_id}</div></div><div><label className="text-xs text-gray-500 tracking-widest block mb-1">GITHUB UPLINK</label>{isEditingProfile ? (<input value={editGithub} onChange={(e) => setEditGithub(e.target.value)} className="w-full bg-white/5 border border-white/20 p-2 rounded text-white focus:border-cyan-500 outline-none" placeholder="Enter valid GitHub ID" />) : (<div className="text-lg text-white font-mono break-all">{groupData?.github_username || groupData?.repo_link}</div>)}</div><div className="pt-4 border-t border-white/10">{hasPendingEdit ? (<div className="bg-pink-500/10 text-pink-400 p-3 rounded text-sm text-center border border-pink-500/30 animate-pulse font-bold tracking-wider">⚠ UPDATE PENDING APPROVAL</div>) : (isEditingProfile ? (<div className="flex gap-2"><button onClick={cancelEdit} className="flex-1 py-2 rounded border border-white/20 text-gray-400 hover:bg-white/5">CANCEL</button><button onClick={handleRequestEdit} className="flex-1 py-2 rounded bg-cyan-600 hover:bg-cyan-500 text-white font-bold">VERIFY & SUBMIT</button></div>) : (<button onClick={() => setIsEditingProfile(true)} className="w-full py-2 rounded border border-white/20 hover:bg-white/5 text-cyan-400 font-bold tracking-widest transition-colors">REQUEST DATA CHANGE</button>))}</div></div>
                        </div>
                    </div>
                </motion.div>
            )}

            {/* THANK YOU + LEADERBOARD OPTION */}
            {isFinished && submissionStage === 'done' && (
                <div className="fixed inset-0 z-[200] bg-black/95 flex flex-col items-center justify-center p-8 text-center backdrop-blur-xl">
                    <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex flex-col items-center">
                        <div className="text-8xl mb-6">🎉</div>
                        <h1 className="text-5xl md:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600 mb-6">THANK YOU!</h1>
                        <p className="text-2xl text-white font-light max-w-2xl mx-auto leading-relaxed mb-8">Submission received. Unit <span className="font-bold text-purple-400">{groupData?.user_id}</span> completed.</p>
                        <button onClick={() => { setSubmissionStage('viewing'); setShowLeaderboard(true) }} className="bg-yellow-500 hover:bg-yellow-400 text-black font-bold py-3 px-8 rounded-full text-lg shadow-[0_0_30px_rgba(234,179,8,0.4)] transition-transform hover:scale-105">VIEW LIVE LEADERBOARD</button>
                    </motion.div>
                </div>
            )}

            {/* ANNOUNCEMENT POPUP */}
            {activePopup && (<motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"><div className="w-full max-w-lg bg-black/90 border border-purple-500 rounded-2xl p-8 shadow-[0_0_50px_rgba(168,85,247,0.3)] relative overflow-hidden"><h2 className="text-purple-400 font-bold text-xl mb-4 tracking-widest flex items-center gap-2"><span className="animate-pulse">📡</span> INCOMING TRANSMISSION</h2><p className="text-2xl font-light text-white mb-8 leading-relaxed">{activePopup.message}</p><button onClick={() => setActivePopup(null)} className="w-full bg-purple-600 hover:bg-purple-500 py-3 rounded-lg font-bold transition-all">ACKNOWLEDGE</button></div></motion.div>)}
        </AnimatePresence>
    </div>
  )
}

// --- WRAPPER FOR SUSPENSE ---
export default function StudentDashboard() {
  return (
    <Suspense fallback={<div className="bg-black h-screen text-green-500 flex items-center justify-center font-mono">INITIALIZING MISSION CONTROL...</div>}>
      <StudentContent />
    </Suspense>
  )
}