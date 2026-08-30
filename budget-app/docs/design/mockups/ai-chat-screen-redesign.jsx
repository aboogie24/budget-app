import React, { useState } from 'react';
import {
  Sparkles,
  Bot,
  Home,
  Calendar,
  MessageCircle,
  PieChart,
  Settings,
  Send,
  Mic,
  TrendingUp,
} from 'lucide-react';

const AIChatScreen = () => {
  const [messages, setMessages] = useState([
    {
      type: 'ai',
      text: 'Based on your March spending, here are a few thoughts. I noticed your dining out expenses jumped 23% compared to February. That\'s worth exploring—not to stress you out, but to help you understand where your money\'s going. How are you feeling about your current spending habits?',
      timestamp: '9:32 AM',
    },
    {
      type: 'user',
      text: 'How should we tackle our credit card debt?',
      timestamp: '9:34 AM',
    },
    {
      type: 'ai',
      text: 'Great question! This falls into Level 2: Build Security of the CoupleFlow Method. Let me show you the Avalanche Method—it\'s mathematically optimal and will save you the most interest.',
      hasCard: true,
      cardType: 'debtPayoff',
      timestamp: '9:35 AM',
    },
    {
      type: 'user',
      text: 'Can we afford a vacation this summer?',
      timestamp: '9:37 AM',
    },
    {
      type: 'ai',
      text: 'Absolutely! Let\'s run the numbers. Based on your current budget, if you commit to saving $400 per month starting this April, you\'ll have enough for a nice getaway by mid-July.',
      hasCard: true,
      cardType: 'vacation',
      timestamp: '9:38 AM',
    },
  ]);

  const [inputValue, setInputValue] = useState('');

  const handleSendMessage = () => {
    if (inputValue.trim()) {
      setMessages([
        ...messages,
        {
          type: 'user',
          text: inputValue,
          timestamp: new Date().toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          }),
        },
      ]);
      setInputValue('');
    }
  };

  const DebtPayoffCard = () => (
    <div
      style={{
        background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.15) 0%, rgba(124, 58, 237, 0.1) 100%)',
        border: '1px solid rgba(168, 85, 247, 0.3)',
        borderRadius: 12,
        padding: 16,
        marginTop: 12,
        marginBottom: 8,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <TrendingUp size={18} color="#10b981" strokeWidth={2.5} />
        <span style={{ fontWeight: 600, fontSize: 14, color: '#fff' }}>
          Debt Payoff Plan (Avalanche Method)
        </span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <span style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.6)' }}>Monthly Payment</span>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#a855f7', marginTop: 4 }}>
            $450
          </div>
        </div>
        <div>
          <span style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.6)' }}>Payoff Date</span>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#10b981', marginTop: 4 }}>
            Aug 2027
          </div>
        </div>
      </div>
      <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(168, 85, 247, 0.2)' }}>
        <span style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.7)' }}>
          Interest saved: <strong style={{ color: '#10b981' }}>$1,240</strong> vs. minimum payments
        </span>
      </div>
    </div>
  );

  const VacationSavingsCard = () => (
    <div
      style={{
        background: 'linear-gradient(135deg, rgba(236, 72, 153, 0.15) 0%, rgba(168, 85, 247, 0.1) 100%)',
        border: '1px solid rgba(236, 72, 153, 0.3)',
        borderRadius: 12,
        padding: 16,
        marginTop: 12,
        marginBottom: 8,
      }}
    >
      <div style={{ marginBottom: 12 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255, 255, 255, 0.8)' }}>
          VACATION FUND PROJECTION
        </span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 13, color: 'rgba(255, 255, 255, 0.6)', marginBottom: 4 }}>
            April
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#ec4899' }}>$400</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 13, color: 'rgba(255, 255, 255, 0.6)', marginBottom: 4 }}>
            May
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#ec4899' }}>$800</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 13, color: 'rgba(255, 255, 255, 0.6)', marginBottom: 4 }}>
            June
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#10b981' }}>$1,200</div>
        </div>
      </div>
      <div
        style={{
          width: '100%',
          height: 6,
          background: 'rgba(255, 255, 255, 0.1)',
          borderRadius: 3,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: '75%',
            height: '100%',
            background: 'linear-gradient(90deg, #ec4899 0%, #a855f7 100%)',
          }}
        />
      </div>
      <div style={{ marginTop: 8, fontSize: 12, color: 'rgba(255, 255, 255, 0.6)' }}>
        On track for your July trip! ✈️
      </div>
    </div>
  );

  return (
    <div
      style={{
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        width: 393,
        height: 852,
        background: '#0f0a1e',
        borderRadius: 40,
        border: '3px solid #2a2a2a',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.8)',
      }}
    >
      {/* Status Bar */}
      <div
        style={{
          background: '#0f0a1e',
          padding: '8px 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: 12,
          fontWeight: 600,
          color: '#fff',
          borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
        }}
      >
        <span></span>
        <span>4:03</span>
        <span></span>
      </div>

      {/* Header */}
      <div
        style={{
          padding: '16px 20px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          background: '#0f0a1e',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Bot size={20} color="#fff" strokeWidth={2} />
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>AI Advisor</div>
            <div style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.5)', marginTop: 2 }}>
              Always here to help
            </div>
          </div>
          <div style={{ marginLeft: 'auto' }}>
            <Sparkles size={20} color="#a855f7" strokeWidth={2} />
          </div>
        </div>
      </div>

      {/* Messages Container */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        {messages.map((msg, idx) => (
          <div
            key={idx}
            style={{
              display: 'flex',
              justifyContent: msg.type === 'user' ? 'flex-end' : 'flex-start',
              gap: 8,
              animation: 'fadeIn 0.3s ease-in',
            }}
          >
            {msg.type === 'ai' && (
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  marginTop: 4,
                }}
              >
                <Bot size={16} color="#fff" strokeWidth={2.5} />
              </div>
            )}
            <div
              style={{
                maxWidth: msg.type === 'user' ? 280 : 300,
              }}
            >
              <div
                style={{
                  background:
                    msg.type === 'ai'
                      ? 'rgba(168, 85, 247, 0.12)'
                      : 'linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)',
                  border:
                    msg.type === 'ai'
                      ? '1px solid rgba(168, 85, 247, 0.2)'
                      : 'none',
                  borderRadius: msg.type === 'ai' ? 16 : 18,
                  padding: '12px 16px',
                  color: '#fff',
                  fontSize: 14,
                  lineHeight: 1.5,
                  wordWrap: 'break-word',
                }}
              >
                {msg.text}
                {msg.hasCard && msg.cardType === 'debtPayoff' && <DebtPayoffCard />}
                {msg.hasCard && msg.cardType === 'vacation' && <VacationSavingsCard />}
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: 'rgba(255, 255, 255, 0.4)',
                  marginTop: 6,
                  textAlign: msg.type === 'user' ? 'right' : 'left',
                }}
              >
                {msg.timestamp}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Suggestions */}
      <div
        style={{
          padding: '12px 16px',
          borderTop: '1px solid rgba(255, 255, 255, 0.1)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          background: '#0f0a1e',
        }}
      >
        <div
          style={{
            display: 'flex',
            gap: 8,
            overflowX: 'auto',
            scrollBehavior: 'smooth',
            paddingBottom: 4,
          }}
        >
          {[
            'Review spending',
            'Debt strategy',
            'Savings plan',
            'Ask partner',
          ].map((chip, idx) => (
            <button
              key={idx}
              style={{
                padding: '8px 14px',
                borderRadius: 20,
                border: '1px solid rgba(168, 85, 247, 0.4)',
                background: 'rgba(168, 85, 247, 0.1)',
                color: 'rgba(255, 255, 255, 0.8)',
                fontSize: 12,
                fontWeight: 500,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.target.style.background = 'rgba(168, 85, 247, 0.25)';
                e.target.style.borderColor = 'rgba(168, 85, 247, 0.6)';
              }}
              onMouseLeave={(e) => {
                e.target.style.background = 'rgba(168, 85, 247, 0.1)';
                e.target.style.borderColor = 'rgba(168, 85, 247, 0.4)';
              }}
            >
              {chip}
            </button>
          ))}
        </div>
      </div>

      {/* Input Section */}
      <div
        style={{
          padding: '12px 16px 20px 16px',
          background: '#0f0a1e',
          borderTop: '1px solid rgba(255, 255, 255, 0.1)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            gap: 10,
            background: 'rgba(255, 255, 255, 0.08)',
            borderRadius: 24,
            padding: '10px 14px',
            border: '1px solid rgba(168, 85, 247, 0.2)',
          }}
        >
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handleSendMessage();
              }
            }}
            placeholder="Ask about your finances..."
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              color: '#fff',
              fontSize: 14,
              outline: 'none',
              fontFamily: 'inherit',
            }}
          />
          <button
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Mic size={18} color="rgba(255, 255, 255, 0.4)" strokeWidth={2} />
          </button>
          <button
            onClick={handleSendMessage}
            disabled={!inputValue.trim()}
            style={{
              background:
                inputValue.trim()
                  ? 'linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)'
                  : 'rgba(168, 85, 247, 0.3)',
              border: 'none',
              borderRadius: '50%',
              width: 32,
              height: 32,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: inputValue.trim() ? 'pointer' : 'not-allowed',
              transition: 'all 0.2s ease',
              flexShrink: 0,
            }}
            onMouseEnter={(e) => {
              if (inputValue.trim()) {
                e.target.style.transform = 'scale(1.05)';
                e.target.style.boxShadow = '0 4px 12px rgba(168, 85, 247, 0.4)';
              }
            }}
            onMouseLeave={(e) => {
              e.target.style.transform = 'scale(1)';
              e.target.style.boxShadow = 'none';
            }}
          >
            <Send size={16} color="#fff" strokeWidth={2.5} />
          </button>
        </div>
      </div>

      {/* Bottom Navigation */}
      <div
        style={{
          borderTop: '1px solid rgba(255, 255, 255, 0.1)',
          background: 'rgba(15, 10, 30, 0.8)',
          backdropFilter: 'blur(10px)',
          display: 'flex',
          justifyContent: 'space-around',
          alignItems: 'center',
          padding: '8px 0 12px 0',
          paddingBottom: '16px',
        }}
      >
        {[
          { icon: Home, label: 'Home', active: false },
          { icon: Calendar, label: 'Calendar', active: false },
          { icon: MessageCircle, label: 'AI', active: true },
          { icon: PieChart, label: 'Finances', active: false },
          { icon: Settings, label: 'Settings', active: false },
        ].map((tab, idx) => (
          <button
            key={idx}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4,
              padding: '8px 12px',
              transition: 'all 0.2s ease',
            }}
          >
            <tab.icon
              size={24}
              color={tab.active ? '#a855f7' : 'rgba(255, 255, 255, 0.4)'}
              strokeWidth={1.5}
              fill={tab.active ? '#a855f7' : 'none'}
            />
            <span
              style={{
                fontSize: 10,
                fontWeight: 500,
                color: tab.active ? '#a855f7' : 'rgba(255, 255, 255, 0.4)',
              }}
            >
              {tab.label}
            </span>
          </button>
        ))}
      </div>

      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
};

export default AIChatScreen;
