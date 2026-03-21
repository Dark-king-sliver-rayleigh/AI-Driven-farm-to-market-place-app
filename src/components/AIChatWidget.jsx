import { useState, useRef, useEffect } from 'react';

/**
 * AIChatWidget — Floating AI Chatbot for AgroDirect
 * 
 * This widget provides a chat interface to the AI-powered chatbot
 * which uses Google Gemini LLM for natural language understanding
 * and generation, with live market data context injection.
 */

const STYLES = {
  fabButton: {
    position: 'fixed',
    bottom: '24px',
    right: '24px',
    width: '60px',
    height: '60px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #2d7a3a, #4caf50)',
    color: '#fff',
    border: 'none',
    cursor: 'pointer',
    boxShadow: '0 4px 16px rgba(45,122,58,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '28px',
    zIndex: 9999,
    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
  },
  chatPanel: {
    position: 'fixed',
    bottom: '96px',
    right: '24px',
    width: '380px',
    maxHeight: '520px',
    borderRadius: '16px',
    background: '#fff',
    boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
    display: 'flex',
    flexDirection: 'column',
    zIndex: 9998,
    overflow: 'hidden',
    border: '1px solid #e0e0e0',
  },
  header: {
    background: 'linear-gradient(135deg, #2d7a3a, #4caf50)',
    color: '#fff',
    padding: '14px 18px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: '15px',
    fontWeight: '600',
  },
  messages: {
    flex: 1,
    overflowY: 'auto',
    padding: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    maxHeight: '360px',
    minHeight: '200px',
    background: '#f9fafb',
  },
  userMsg: {
    alignSelf: 'flex-end',
    background: 'linear-gradient(135deg, #2d7a3a, #4caf50)',
    color: '#fff',
    padding: '10px 14px',
    borderRadius: '16px 16px 4px 16px',
    maxWidth: '80%',
    fontSize: '14px',
    lineHeight: '1.4',
    wordBreak: 'break-word',
  },
  botMsg: {
    alignSelf: 'flex-start',
    background: '#e8f5e9',
    color: '#1b5e20',
    padding: '10px 14px',
    borderRadius: '16px 16px 16px 4px',
    maxWidth: '85%',
    fontSize: '14px',
    lineHeight: '1.5',
    wordBreak: 'break-word',
    whiteSpace: 'pre-wrap',
  },
  inputArea: {
    display: 'flex',
    padding: '10px',
    borderTop: '1px solid #e0e0e0',
    background: '#fff',
  },
  input: {
    flex: 1,
    border: '1px solid #ccc',
    borderRadius: '24px',
    padding: '10px 16px',
    fontSize: '14px',
    outline: 'none',
    transition: 'border-color 0.2s',
  },
  sendBtn: {
    marginLeft: '8px',
    background: '#2d7a3a',
    color: '#fff',
    border: 'none',
    borderRadius: '50%',
    width: '40px',
    height: '40px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '18px',
    transition: 'background 0.2s',
  },
  typing: {
    alignSelf: 'flex-start',
    color: '#888',
    fontSize: '13px',
    fontStyle: 'italic',
    padding: '4px 12px',
  },
  badge: {
    position: 'absolute',
    top: '-4px',
    right: '-4px',
    background: '#ff5252',
    color: '#fff',
    borderRadius: '50%',
    width: '18px',
    height: '18px',
    fontSize: '11px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 'bold',
  },
  methodLabel: {
    fontSize: '10px',
    color: '#999',
    textAlign: 'right',
    marginTop: '2px',
    fontStyle: 'italic',
  },
};

export default function AIChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'bot', text: '🙏 Namaste! I\'m AgroDirect AI. Ask me about market prices, crop suggestions, demand forecasts, or anything farming-related!' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [unread, setUnread] = useState(0);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;
    
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text }]);
    setLoading(true);
    
    try {
      const token = sessionStorage.getItem('authToken');
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
      
      const res = await fetch(`${apiUrl}/chatbot/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ message: text, sessionId })
      });
      
      const data = await res.json();
      
      if (data.success) {
        setMessages(prev => [...prev, { 
          role: 'bot', 
          text: data.reply,
          methodology: data.methodology 
        }]);
        if (data.sessionId) setSessionId(data.sessionId);
      } else {
        setMessages(prev => [...prev, { 
          role: 'bot', 
          text: data.reply || '❌ Sorry, I encountered an error. Please try again.' 
        }]);
      }
    } catch (err) {
      setMessages(prev => [...prev, { 
        role: 'bot', 
        text: '❌ Unable to reach the server. Please check your connection.' 
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const toggleChat = () => {
    setOpen(prev => !prev);
    if (!open) setUnread(0);
  };

  return (
    <>
      {/* Floating Action Button */}
      <button 
        onClick={toggleChat} 
        style={{
          ...STYLES.fabButton,
          transform: open ? 'rotate(45deg)' : 'rotate(0deg)'
        }}
        title="AI Assistant"
      >
        {open ? '✕' : '🤖'}
        {!open && unread > 0 && <span style={STYLES.badge}>{unread}</span>}
      </button>

      {/* Chat Panel */}
      {open && (
        <div style={STYLES.chatPanel}>
          <div style={STYLES.header}>
            <span>🤖 AgroDirect AI Assistant</span>
            <span style={{ fontSize: '12px', opacity: 0.8 }}>Powered by Gemini</span>
          </div>
          
          <div style={STYLES.messages}>
            {messages.map((msg, i) => (
              <div key={i}>
                <div style={msg.role === 'user' ? STYLES.userMsg : STYLES.botMsg}>
                  {msg.text}
                </div>
                {msg.methodology && (
                  <div style={STYLES.methodLabel}>
                    {msg.methodology === 'gemini_llm_with_context' ? '🧠 AI Generated' : '📋 Quick Response'}
                  </div>
                )}
              </div>
            ))}
            {loading && <div style={STYLES.typing}>AgroDirect AI is thinking...</div>}
            <div ref={messagesEndRef} />
          </div>
          
          <div style={STYLES.inputArea}>
            <input
              style={STYLES.input}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about prices, crops, forecasts..."
              disabled={loading}
            />
            <button 
              onClick={sendMessage} 
              style={{ ...STYLES.sendBtn, opacity: loading ? 0.5 : 1 }}
              disabled={loading}
            >
              ➤
            </button>
          </div>
        </div>
      )}
    </>
  );
}
