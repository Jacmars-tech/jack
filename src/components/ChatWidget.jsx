import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Bot, MessageCircle, Send, Sparkles, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { getProducts, getUserOrders } from '../lib/db';
import { requestAssistantReply } from '../lib/assistantApi';
import {
    buildAssistantReply,
    getInitialAssistantMessages,
    persistableMessages
} from '../lib/chatbot';
import './ChatWidget.css';

const STORAGE_PREFIX = 'jack-ai-assistant';

const ChatWidget = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile, isAdmin } = useAuth();
  const { cart, cartCount } = useCart();
  const [isOpen, setIsOpen] = useState(false);
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [dataReady, setDataReady] = useState(false);
  const [lastResponseId, setLastResponseId] = useState('');
  const messagesEndRef = useRef(null);

  const storageKey = useMemo(
    () => `${STORAGE_PREFIX}:${user?.uid || 'guest'}`,
    [user?.uid]
  );

  const baseContext = useMemo(
    () => ({
      user,
      profile,
      isAdmin,
      cartCount
    }),
    [user, profile, isAdmin, cartCount]
  );

  useEffect(() => {
    const savedMessages = localStorage.getItem(storageKey);
    if (savedMessages) {
      try {
        const parsed = JSON.parse(savedMessages);
        setMessages(
          Array.isArray(parsed?.messages)
            ? parsed.messages
            : (Array.isArray(parsed) ? parsed : getInitialAssistantMessages(baseContext))
        );
        setLastResponseId(parsed.lastResponseId || '');
        return;
      } catch (error) {
        console.error('Failed to parse saved assistant messages', error);
      }
    }

    setMessages(getInitialAssistantMessages(baseContext));
    setLastResponseId('');
  }, [storageKey, baseContext]);

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify({
      lastResponseId,
      messages: persistableMessages(messages)
    }));
  }, [messages, storageKey, lastResponseId]);

  useEffect(() => {
    let mounted = true;

    const loadContext = async () => {
      try {
        const [productData, orderData] = await Promise.all([
          getProducts(),
          user ? getUserOrders(user.uid) : Promise.resolve([])
        ]);

        if (!mounted) return;
        setProducts(productData);
        setOrders(orderData);
      } catch (error) {
        console.error('Failed to load assistant context', error);
        if (!mounted) return;
        setProducts([]);
        setOrders([]);
      } finally {
        if (mounted) {
          setDataReady(true);
        }
      }
    };

    loadContext();
    return () => {
      mounted = false;
    };
  }, [user]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping, isOpen]);

  useEffect(() => {
    setIsOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const openHandler = () => setIsOpen(true);
    window.addEventListener('open-chat', openHandler);
    return () => window.removeEventListener('open-chat', openHandler);
  }, []);

  const sendPrompt = async (prompt) => {
    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt) return;

    const userMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: trimmedPrompt,
      timestamp: Date.now()
    };

    setMessages((prev) => [...prev, userMessage]);
    setNewMessage('');
    setIsTyping(true);

    window.setTimeout(async () => {
      try {
        const aiResult = await requestAssistantReply({
          message: trimmedPrompt,
          previousResponseId: lastResponseId,
          products,
          orders,
          cart,
          user,
          profile,
          currentPath: location.pathname
        });

        setMessages((prev) => [
          ...prev,
          {
            id: `assistant-${Date.now()}`,
            role: 'assistant',
            content: aiResult.reply,
            suggestions: [],
            timestamp: Date.now()
          }
        ]);
        setLastResponseId(aiResult.responseId || '');
      } catch (error) {
        console.error('AI assistant unavailable, falling back to local assistant', error);

        const fallbackReply = buildAssistantReply({
          prompt: trimmedPrompt,
          products,
          orders,
          cart,
          user,
          profile,
          isAdmin
        });

        fallbackReply.content = `The live jack AI service is not available right now, so I am answering in offline store-assistant mode.\n\n${fallbackReply.content}`;

        setMessages((prev) => [...prev, fallbackReply]);
      } finally {
        setIsTyping(false);
      }
    }, 450);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    await sendPrompt(newMessage);
  };

  const handleSuggestionClick = async (suggestion) => {
    if (suggestion.type === 'link') {
      navigate(suggestion.href);
      setIsOpen(false);
      return;
    }

    await sendPrompt(suggestion.value);
  };

  const handleResetConversation = () => {
    const nextMessages = getInitialAssistantMessages(baseContext);
    setMessages(nextMessages);
    setLastResponseId('');
    setIsTyping(false);
  };

  return (
    <div className="chat-widget-container">
      {isOpen ? (
        <section className="chat-window" aria-label="AI shopping assistant">
          <header className="chat-header">
            <div className="chat-header-copy">
              <span className="chat-badge">
                <Sparkles size={14} /> AI Assistant
              </span>
              <h4>Zack AI</h4>
              <p>OpenAI-powered shopping help for products, cart, M-Pesa checkout, and orders.</p>
            </div>
            <div className="chat-header-actions">
              <button type="button" className="chat-secondary-btn" onClick={handleResetConversation}>
                Reset
              </button>
              <button type="button" className="close-btn" onClick={() => setIsOpen(false)} aria-label="Close assistant">
                <X size={20} />
              </button>
            </div>
          </header>

          <div className="chat-context-strip">
            <span>{dataReady ? `${products.length} products loaded` : 'Loading products...'}</span>
            {user ? <span>{orders.length} orders in your account</span> : <span>Guest shopping mode</span>}
            <span>{cartCount} items in cart</span>
          </div>

          <div className="chat-messages">
            {messages.map((message) => (
              <article key={message.id} className={`message ${message.role === 'user' ? 'outgoing' : 'incoming'}`}>
                <div className="message-avatar">
                  {message.role === 'user' ? <span>U</span> : <Bot size={16} />}
                </div>
                <div className="message-content">
                  <div className="bubble">
                    {message.content.split('\n').map((line, index) => (
                      <p key={`${message.id}-${index}`}>{line}</p>
                    ))}
                  </div>

                  {message.role === 'assistant' && message.suggestions?.length > 0 && (
                    <div className="message-suggestions">
                      {message.suggestions.map((suggestion) => (
                        <button
                          key={`${message.id}-${suggestion.label}`}
                          type="button"
                          className="suggestion-chip"
                          onClick={() => handleSuggestionClick(suggestion)}
                        >
                          {suggestion.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </article>
            ))}

            {isTyping && (
              <div className="message incoming">
                <div className="message-avatar">
                  <Bot size={16} />
                </div>
                <div className="message-content">
                  <div className="bubble typing-bubble">
                    <span />
                    <span />
                    <span />
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          <form className="chat-input" onSubmit={handleSubmit}>
            <input
              type="text"
              placeholder="Ask about products, budget, M-Pesa, delivery, or orders..."
              value={newMessage}
              onChange={(event) => setNewMessage(event.target.value)}
            />
            <button type="submit" disabled={!newMessage.trim()}>
              <Send size={18} />
            </button>
          </form>
        </section>
      ) : (
        <button className="chat-fab" onClick={() => setIsOpen(true)} aria-label="Open AI shopping assistant">
          <div className="chat-fab-icon">
            <MessageCircle size={22} />
          </div>
          <div className="chat-fab-copy">
            <strong>Ask AI</strong>
            <span>Products, orders, checkout</span>
          </div>
        </button>
      )}
    </div>
  );
};

export default ChatWidget;
