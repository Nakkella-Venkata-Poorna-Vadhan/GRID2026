'use client'
import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

export default function AIAssistant({ groupData }) {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState([
    { role: 'assistant', text: 'System Online. Ready to assist Unit. Type your query below.' }
  ])
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const messagesEndRef = useRef(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    if (isOpen) {
      setTimeout(scrollToBottom, 100)
    }
  }, [messages, isOpen])

  const handleSend = async (textToSend) => {
    const query = textToSend || input
    if (!query.trim()) return

    if (!textToSend) setInput('')
    
    // Add user message
    setMessages((prev) => [...prev, { role: 'user', text: query }])
    setIsTyping(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: query, groupData })
      })
      const data = await res.json()
      
      setMessages((prev) => [...prev, { role: 'assistant', text: data.reply || 'No response from AI.' }])
    } catch (err) {
      console.error(err)
      setMessages((prev) => [...prev, { role: 'assistant', text: 'Error: Connection link disrupted.' }])
    } finally {
      setIsTyping(false)
    }
  }

  const suggestions = [
    "What are the rules?",
    "GitHub repo format?",
    "How to complete submission?",
    "System status?"
  ]

  return (
    <div className="fixed bottom-6 right-6 z-[100] font-mono">
      {/* Floating Action Button */}
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="h-14 w-14 rounded-full bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shadow-[0_0_20px_rgba(6,182,212,0.4)] border border-cyan-400/30 text-white cursor-pointer relative"
      >
        <span className="text-2xl">{isOpen ? '✕' : '🤖'}</span>
        {!isOpen && (
          <span className="absolute -top-1 -right-1 flex h-4 w-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-4 w-4 bg-cyan-500"></span>
          </span>
        )}
      </motion.button>

      {/* Chat Drawer */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 100, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 100, scale: 0.9 }}
            transition={{ type: 'spring', damping: 20 }}
            className="absolute bottom-20 right-0 w-[360px] sm:w-[400px] h-[500px] bg-black/90 backdrop-blur-xl border border-cyan-500/30 rounded-2xl shadow-[0_0_50px_rgba(6,182,212,0.2)] flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="p-4 bg-gradient-to-r from-cyan-950/50 to-blue-950/50 border-b border-cyan-500/20 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse"></span>
                <span className="text-cyan-400 font-bold tracking-wider text-sm">HACK_OS // NEURAL_NET</span>
              </div>
              <button 
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-white text-xs border border-white/10 px-2 py-0.5 rounded"
              >
                MINIMIZE
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-black/20">
              {messages.map((msg, index) => (
                <div
                  key={index}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] p-3 rounded-lg text-xs leading-relaxed border ${
                      msg.role === 'user'
                        ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-200 rounded-tr-none'
                        : 'bg-white/5 border-white/10 text-gray-300 rounded-tl-none'
                    }`}
                  >
                    <div className="text-[9px] text-gray-500 uppercase tracking-widest mb-1">
                      {msg.role === 'user' ? 'UNIT' : 'HACK_OS AI'}
                    </div>
                    <p className="whitespace-pre-wrap">{msg.text}</p>
                  </div>
                </div>
              ))}
              
              {isTyping && (
                <div className="flex justify-start">
                  <div className="bg-white/5 border border-white/10 p-3 rounded-lg rounded-tl-none max-w-[85%] text-xs text-cyan-400 animate-pulse">
                    QUERYING CORE DATABASE...
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Suggestions */}
            {messages.length === 1 && (
              <div className="p-3 border-t border-white/5 bg-black/40">
                <p className="text-[10px] text-gray-500 mb-2 uppercase tracking-wider">Suggested Queries:</p>
                <div className="flex flex-wrap gap-1.5">
                  {suggestions.map((s, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSend(s)}
                      className="text-[10px] bg-white/5 border border-white/10 hover:border-cyan-500/50 hover:bg-cyan-950/20 px-2 py-1 rounded text-gray-400 hover:text-cyan-300 transition-all cursor-pointer"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Input */}
            <div className="p-3 border-t border-cyan-500/20 bg-black/40 flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="INPUT SYSTEM INQUIRY..."
                className="flex-1 bg-black/50 border border-white/15 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500/50"
              />
              <button
                onClick={() => handleSend()}
                className="bg-cyan-900/30 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500 hover:text-black px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer"
              >
                SEND
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
