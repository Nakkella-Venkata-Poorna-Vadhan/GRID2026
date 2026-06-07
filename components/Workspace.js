'use client'
import { useState, useEffect } from 'react'
import Editor from '@monaco-editor/react'
import { Octokit } from 'octokit'

export default function Workspace({ groupData, assignedProblem }) {
  const [code, setCode] = useState('// Write your solution here...')
  const [isCommitting, setIsCommitting] = useState(false)
  const [lastCommit, setLastCommit] = useState(null)
  const [activeTab, setActiveTab] = useState('briefing') // 'briefing' | 'editor'
  const [hasToken, setHasToken] = useState(false)

  useEffect(() => {
    // Check if token exists in localStorage
    if (typeof window !== 'undefined') {
      setHasToken(!!localStorage.getItem('github_pat'))
    }
  }, [])

  const getRepoDetails = (url) => {
    if (!url) return null
    try {
      // Clean up git url format if needed
      const cleanUrl = url.replace(/\.git$/, '')
      const parts = cleanUrl.split('/')
      if (parts.length >= 2) {
        return {
          owner: parts[parts.length - 2],
          repo: parts[parts.length - 1]
        }
      }
    } catch (e) {
      console.error("Failed to parse repo url:", e)
    }
    return null
  }

  // This function pushes code to GitHub
  const handleCommit = async () => {
    if (!groupData) return alert("No group data loaded!")
    
    setIsCommitting(true)
    
    let token = typeof window !== 'undefined' ? localStorage.getItem('github_pat') : null
    if (!token) {
      token = prompt("Please enter your GitHub Personal Access Token (PAT) to commit:")
      if (!token) { 
        setIsCommitting(false) 
        return 
      }
      if (typeof window !== 'undefined') {
        localStorage.setItem('github_pat', token)
        setHasToken(true)
      }
    }

    const octokit = new Octokit({ auth: token })

    try {
      // Check if they have a repository linked
      if (groupData.repo_link) {
        const repoDetails = getRepoDetails(groupData.repo_link)
        if (repoDetails) {
          const { owner, repo } = repoDetails
          const path = 'solution.js'
          let sha = undefined

          // 1. Try to fetch existing file to get the SHA (if it exists)
          try {
            const { data } = await octokit.request('GET /repos/{owner}/{repo}/contents/{path}', {
              owner,
              repo,
              path
            })
            sha = data.sha
          } catch (err) {
            // File doesn't exist yet, which is fine (first commit)
          }

          // 2. Put file contents (base64 encoded)
          await octokit.request('PUT /repos/{owner}/{repo}/contents/{path}', {
            owner,
            repo,
            path,
            message: `Submission update from HACK_OS for Unit ${groupData.user_id}`,
            content: btoa(unescape(encodeURIComponent(code))),
            sha
          })

          setLastCommit(new Date().toLocaleTimeString())
          alert(`Successfully committed to GitHub repository: ${owner}/${repo}/${path}`)
        } else {
          alert("Invalid repository link format! Falling back to Gist.")
          await createFallbackGist(octokit)
        }
      } else {
        // Fallback to Gist if no repository is linked yet
        alert("No GitHub repository linked to your profile. Saving as a Gist instead...")
        await createFallbackGist(octokit)
      }
    } catch (err) {
      console.error(err)
      alert("GitHub Operation Failed! Verify your Personal Access Token (PAT) permissions (repo/gist scopes).")
      // Clear token on failure in case it was invalid
      if (confirm("Clear saved GitHub token?")) {
        handleClearToken()
      }
    } finally {
      setIsCommitting(false)
    }
  }

  const createFallbackGist = async (octokit) => {
    const { data } = await octokit.request('POST /gists', {
      description: `Hackathon Submission for Unit ${groupData.user_id}`,
      public: false,
      files: {
        'solution.js': {
          content: code
        }
      }
    })
    setLastCommit(new Date().toLocaleTimeString())
    alert(`Saved to fallback Gist! Gist ID: ${data.id}`)
  }

  const handleClearToken = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('github_pat')
      setHasToken(false)
      alert("GitHub Token cleared.")
    }
  }

  return (
    <div className="flex flex-col md:flex-row h-full font-mono text-sm overflow-hidden bg-black">
      
      {/* MOBILE TAB SWITCHER */}
      <div className="md:hidden flex bg-[#1a1a1a] border-b border-gray-800 text-[10px] font-bold select-none z-10 shrink-0">
        <button 
          onClick={() => setActiveTab('briefing')} 
          className={`flex-1 py-3 text-center border-b-2 transition-all ${
            activeTab === 'briefing' ? 'border-purple-500 text-purple-400 bg-purple-950/10' : 'border-transparent text-gray-500'
          }`}
        >
          MISSION BRIEFING
        </button>
        <button 
          onClick={() => setActiveTab('editor')} 
          className={`flex-1 py-3 text-center border-b-2 transition-all ${
            activeTab === 'editor' ? 'border-cyan-500 text-cyan-400 bg-cyan-950/10' : 'border-transparent text-gray-500'
          }`}
        >
          CODE EDITOR
        </button>
      </div>

      {/* LEFT: PROBLEM STATEMENT */}
      <div className={`w-full md:w-1/2 border-r border-gray-800 flex flex-col bg-gray-900 h-full overflow-hidden ${
        activeTab === 'briefing' ? 'flex' : 'hidden md:flex'
      }`}>
        <div className="p-4 border-b border-gray-800 bg-gray-800 text-purple-400 font-bold flex justify-between shrink-0">
          <span>MISSION BRIEFING</span>
          <span className="text-gray-500 text-xs">READ-ONLY</span>
        </div>
        <div className="p-6 md:p-8 overflow-y-auto text-gray-300 select-none flex-1 custom-scrollbar">
          {assignedProblem ? (
            <div className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
              {assignedProblem}
            </div>
          ) : (
            <>
              <h1 className="text-3xl font-bold text-white mb-6">Problem: The Quantum Sort</h1>
              <p className="mb-4">
                Your task is to implement a sorting algorithm that organizes quantum states based on their 
                probability amplitude.
              </p>
              <h3 className="text-xl text-white mt-6 mb-2">Input Format</h3>
              <code className="bg-black p-2 rounded block mb-4">
                [0.5, 0.1, 0.9, 0.3]
              </code>
              <h3 className="text-xl text-white mt-6 mb-2">Constraints</h3>
              <ul className="list-disc pl-5">
                <li>Time Limit: 1.0s</li>
                <li>Memory Limit: 256MB</li>
              </ul>
            </>
          )}
        </div>
      </div>

      {/* RIGHT: CODE EDITOR */}
      <div className={`w-full md:w-1/2 flex flex-col bg-[#1e1e1e] h-full overflow-hidden ${
        activeTab === 'editor' ? 'flex' : 'hidden md:flex'
      }`}>
        <div className="p-2 bg-[#2d2d2d] flex justify-between items-center border-b border-black shrink-0">
          <div className="text-gray-400 px-4 text-xs">solution.js</div>
          <div className="flex items-center gap-2">
            {lastCommit && <span className="text-[10px] text-green-500 hidden sm:inline">Last: {lastCommit}</span>}
            {hasToken && (
              <button 
                onClick={handleClearToken}
                className="px-2 py-1 border border-red-500/20 hover:bg-red-950/20 text-red-400 hover:text-red-300 text-[10px] font-bold rounded transition-all cursor-pointer"
              >
                DISCONNECT PAT
              </button>
            )}
            <button 
              onClick={handleCommit}
              disabled={isCommitting}
              className={`px-4 py-1 rounded text-xs font-bold transition-all cursor-pointer ${
                isCommitting ? 'bg-yellow-600 text-black animate-pulse' : 'bg-green-700 hover:bg-green-600 text-white'
              }`}
            >
              {isCommitting ? 'PUSHING...' : 'COMMIT CODE'}
            </button>
          </div>
        </div>
        
        <div className="flex-1 min-h-0">
          <Editor 
            height="100%"
            defaultLanguage="javascript"
            defaultValue="// Write your code here..."
            theme="vs-dark"
            value={code}
            onChange={(value) => setCode(value)}
            options={{
              minimap: { enabled: false },
              fontSize: 14,
              fontFamily: 'Fira Code',
              automaticLayout: true
            }}
          />
        </div>
      </div>
    </div>
  )
}