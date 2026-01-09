'use client'
import { useState } from 'react'
import Editor from '@monaco-editor/react'
import { Octokit } from 'octokit'

export default function Workspace({ groupData }) {
  const [code, setCode] = useState('// Write your solution here...')
  const [isCommitting, setIsCommitting] = useState(false)
  const [lastCommit, setLastCommit] = useState(null)

  // This function pushes code to GitHub
  const handleCommit = async () => {
    if (!groupData.github_username) return alert("No GitHub user linked!")
    
    setIsCommitting(true)
    
    // NOTE: In a real production app, this Token should be backend-only.
    // For this Hackathon MVP, we will ask the student for a PAT or use a shared one.
    // Ideally, we would use a Next.js API route to hide this.
    const token = prompt("Please enter your GitHub Personal Access Token to commit:")
    if(!token) { setIsCommitting(false); return; }

    const octokit = new Octokit({ auth: token })

    try {
      // 1. Get the Repo (We assume it exists or we create it - simple version: create file in gist or repo)
      // For this MVP, let's just create a Gist to test connection, 
      // OR push to a specific repo if you have one set up.
      
      // Let's do a Gist for simplicity first (Zero setup required)
      const { data } = await octokit.request('POST /gists', {
        description: `Hackathon Submission for ${groupData.user_id}`,
        public: false,
        files: {
          'solution.js': {
            content: code
          }
        }
      })

      setLastCommit(new Date().toLocaleTimeString())
      alert(`Saved! Gist ID: ${data.id}`)
    } catch (err) {
      console.error(err)
      alert("Commit Failed! Check console.")
    }
    
    setIsCommitting(false)
  }

  return (
    <div className="flex h-full font-mono text-sm">
      
      {/* LEFT: PROBLEM STATEMENT */}
      <div className="w-1/2 border-r border-gray-800 flex flex-col bg-gray-900">
        <div className="p-4 border-b border-gray-800 bg-gray-800 text-purple-400 font-bold flex justify-between">
            <span>MISSION BRIEFING</span>
            <span className="text-gray-500 text-xs">READ-ONLY</span>
        </div>
        <div className="p-8 overflow-y-auto text-gray-300 select-none">
            {/* You can load this from Supabase global_config later */}
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
        </div>
      </div>

      {/* RIGHT: CODE EDITOR */}
      <div className="w-1/2 flex flex-col bg-[#1e1e1e]">
        <div className="p-2 bg-[#2d2d2d] flex justify-between items-center border-b border-black">
            <div className="text-gray-400 px-4">main.js</div>
            <div className="flex items-center gap-4">
                {lastCommit && <span className="text-xs text-green-500">Last Saved: {lastCommit}</span>}
                <button 
                    onClick={handleCommit}
                    disabled={isCommitting}
                    className={`px-6 py-1 rounded text-xs font-bold transition-all ${
                        isCommitting ? 'bg-yellow-600 text-black' : 'bg-green-700 text-white hover:bg-green-600'
                    }`}
                >
                    {isCommitting ? 'PUSHING...' : 'COMMIT CODE'}
                </button>
            </div>
        </div>
        
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
                fontFamily: 'Fira Code'
            }}
        />
      </div>
    </div>
  )
}