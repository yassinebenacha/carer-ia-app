import React, { useState, useRef, useEffect } from 'react';
import { Send, X, MessageCircle, Minimize2, RotateCcw, Copy, Check } from 'lucide-react';

const ChatInterface = () => {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [copiedMessageId, setCopiedMessageId] = useState(null);
  const messagesEndRef = useRef(null);

  // Questions rapides adaptées à Carer-IA
  const basicQuestions = [
    "Qu'est-ce que Carer-IA ?",
    "Quels sont les outils disponibles ?",
    "Comment fonctionne le générateur de résumé ?",
    "Comment marchent les QCM ?"
  ];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, open]);

  // Créer une nouvelle session au démarrage
  useEffect(() => {
    if (open && !sessionId) {
      createNewSession();
    }
  }, [open]);

  const createNewSession = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/chat/new-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await response.json();
      setSessionId(data.session_id);
    } catch (error) {
      console.error('Error creating new session:', error);
    }
  };

  const copyToClipboard = async (text, messageId) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedMessageId(messageId);
      setTimeout(() => setCopiedMessageId(null), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  const clearConversation = async () => {
    if (sessionId) {
      try {
        await fetch(`http://localhost:8000/api/chat/history/${sessionId}`, {
          method: 'DELETE',
        });
      } catch (error) {
        console.error('Error clearing conversation:', error);
      }
    }
    setMessages([]);
    setSessionId(null);
    createNewSession();
  };

  const sendMessage = async (messageText = inputMessage) => {
    if (!messageText.trim()) return;

    const userMessage = {
      id: Date.now(),
      text: messageText,
      sender: 'user',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setLoading(true);

    try {
      const response = await fetch('http://localhost:8000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: messageText,
          session_id: sessionId
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      const botMessage = {
        id: Date.now() + 1,
        text: data.response,
        sender: 'bot',
        timestamp: new Date(data.timestamp),
      };

      setMessages(prev => [...prev, botMessage]);
      setSessionId(data.session_id);
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage = {
        id: Date.now() + 1,
        text: 'Désolé, je rencontre actuellement des difficultés techniques. Veuillez réessayer dans quelques instants.',
        sender: 'bot',
        timestamp: new Date(),
        error: true
      };
      setMessages(prev => [...prev, errorMessage]);
    }

    setLoading(false);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <>
      {/* Chat Bubble Icon */}
      {!open && (
        <div className="fixed bottom-6 right-6 z-50">
          <button
            onClick={() => setOpen(true)}
            className="group relative w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-110 flex items-center justify-center"
          >
            <MessageCircle className="w-8 h-8 text-white" />
            <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full animate-pulse"></div>
            <div className="absolute -bottom-12 right-0 bg-gray-800 text-white text-sm px-3 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap">
              CarerBot - Assistant Carer-IA
            </div>
          </button>
        </div>
      )}

      {/* Chat Window */}
      {open && (
        <div className={`fixed bottom-6 right-6 w-96 bg-white rounded-2xl shadow-2xl flex flex-col font-sans z-50 transition-all duration-300 ${
          minimized ? 'h-16' : 'h-[600px] max-h-[80vh]'
        }`}>
          {/* Header */}
          <div className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-t-2xl">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                <MessageCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold">CarerBot</h3>
                <p className="text-xs opacity-80">Assistant Carer-IA</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              {messages.length > 0 && (
                <button
                  onClick={clearConversation}
                  className="p-2 hover:bg-white/20 rounded-full transition-colors"
                  title="Effacer la conversation"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={() => setMinimized(!minimized)}
                className="p-2 hover:bg-white/20 rounded-full transition-colors"
                title={minimized ? "Agrandir" : "Réduire"}
              >
                <Minimize2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setOpen(false)}
                className="p-2 hover:bg-white/20 rounded-full transition-colors"
                title="Fermer le chat"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {!minimized && (
            <>
              {/* Quick Questions */}
              <div className="p-4 border-b border-gray-100">
                <p className="text-xs text-gray-500 mb-2">Questions rapides :</p>
                <div className="grid grid-cols-1 gap-2">
                  {basicQuestions.map((q, idx) => (
                    <button
                      key={idx}
                      onClick={() => sendMessage(q)}
                      disabled={loading}
                      className="p-2 text-xs bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200 rounded-lg transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed"
                      title={q}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 bg-gray-50 space-y-4">
                {messages.length === 0 && (
                  <div className="text-center py-8">
                    <MessageCircle className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">Bonjour ! Je suis CarerBot 🤖</p>
                    <p className="text-sm text-gray-400 mt-1">Posez-moi des questions sur Carer-IA</p>
                  </div>
                )}
                
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-[80%] ${message.sender === 'user' ? 'order-2' : ''}`}>
                      <div
                        className={`relative group px-4 py-3 rounded-2xl ${
                          message.sender === 'user'
                            ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white'
                            : message.error
                            ? 'bg-red-50 text-red-700 border border-red-200'
                            : 'bg-white text-gray-800 shadow-sm border border-gray-200'
                        } ${
                          message.sender === 'user' ? 'rounded-br-md' : 'rounded-bl-md'
                        }`}
                      >
                        <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{message.text}</p>
                        
                        {/* Copy button */}
                        <button
                          onClick={() => copyToClipboard(message.text, message.id)}
                          className={`absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded ${
                            message.sender === 'user' ? 'hover:bg-white/20' : 'hover:bg-gray-100'
                          }`}
                          title="Copier le message"
                        >
                          {copiedMessageId === message.id ? (
                            <Check className="w-3 h-3 text-green-500" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                      
                      {/* Timestamp */}
                      <p className={`text-xs mt-1 ${
                        message.sender === 'user' ? 'text-right text-gray-400' : 'text-gray-400'
                      }`}>
                        {message.timestamp.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    
                    {/* Avatar */}
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold ${
                      message.sender === 'user' 
                        ? 'bg-blue-500 text-white ml-3 order-1' 
                        : 'bg-green-500 text-white mr-3'
                    }`}>
                      {message.sender === 'user' ? '👤' : '🤖'}
                    </div>
                  </div>
                ))}
                
                {/* Loading indicator */}
                {loading && (
                  <div className="flex justify-start">
                    <div className="w-8 h-8 bg-green-500 text-white rounded-full flex items-center justify-center text-xs font-semibold mr-3">
                      🤖
                    </div>
                    <div className="bg-white rounded-2xl rounded-bl-md px-4 py-3 shadow-sm border border-gray-200">
                      <div className="flex space-x-1">
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                      </div>
                    </div>
                  </div>
                )}
                
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="p-4 border-t border-gray-100 bg-white rounded-b-2xl">
                <div className="flex space-x-3">
                  <div className="flex-1 relative">
                    <textarea
                      rows={1}
                      value={inputMessage}
                      onChange={(e) => setInputMessage(e.target.value)}
                      onKeyDown={handleKeyPress}
                      placeholder="Posez votre question sur Carer-IA..."
                      disabled={loading}
                      className="w-full resize-none rounded-xl border border-gray-300 px-4 py-3 pr-12 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed text-sm"
                      style={{ minHeight: '48px', maxHeight: '120px' }}
                      maxLength={1000}
                    />
                    <div className="absolute right-3 bottom-3 text-xs text-gray-400">
                      {inputMessage.length}/1000
                    </div>
                  </div>
                  <button
                    onClick={() => sendMessage()}
                    disabled={loading || !inputMessage.trim()}
                    className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 disabled:from-gray-300 disabled:to-gray-400 text-white rounded-xl font-medium transition-all duration-200 transform hover:scale-105 disabled:scale-100 disabled:cursor-not-allowed flex items-center space-x-2"
                  >
                    <Send className="w-4 h-4" />
                    <span className="hidden sm:inline">Envoyer</span>
                  </button>
                </div>
                <div className="mt-2 text-xs text-gray-400 text-center">
                  Propulsé par CarerBot - Assistant IA de Carer-IA
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
};

export default ChatInterface;