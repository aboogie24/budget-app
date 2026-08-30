import React, { useState } from 'react';
import {
  ArrowLeft,
  Heart,
  TrendingUp,
  Calendar,
} from 'lucide-react';

export default function PartnerDashboard() {
  const [syncTime] = useState('5 min ago');
  const coupleScore = 78;
  const maxScore = 100;
  const scorePercentage = (coupleScore / maxScore) * 100;

  const spendingData = {
    you: {
      name: 'You',
      total: 1820,
      color: '#a855f7',
      categories: [
        { name: 'Groceries', amount: 420, percentage: 47 },
        { name: 'Dining', amount: 380, percentage: 42 },
        { name: 'Shopping', amount: 120, percentage: 13 },
      ],
    },
    partner: {
      name: 'Partner',
      total: 2380,
      color: '#ec4899',
      categories: [
        { name: 'Groceries', amount: 680, percentage: 36 },
        { name: 'Dining', amount: 950, percentage: 51 },
        { name: 'Shopping', amount: 380, percentage: 20 },
      ],
    },
  };

  const goals = [
    {
      name: 'Emergency Fund',
      current: 12000,
      target: 15000,
      color: '#10b981',
      dueText: '3 months to go',
    },
    {
      name: 'Vacation Fund',
      current: 800,
      target: 3000,
      color: '#a855f7',
      dueText: 'Aug 2026',
    },
    {
      name: 'New Car',
      current: 2200,
      target: 20000,
      color: '#f59e0b',
      dueText: '2028',
    },
  ];

  const activities = [
    {
      text: 'Partner added a transaction: Whole Foods -$67.30',
      time: '2h ago',
    },
    {
      text: 'Partner paid: Electric Bill -$145.00',
      time: 'yesterday',
    },
    {
      text: 'Partner updated savings goal',
      time: '2 days ago',
    },
    {
      text: 'Partner added a transaction: Gas Station -$52.00',
      time: '3 days ago',
    },
    {
      text: 'Partner funded Emergency Fund +$500',
      time: '5 days ago',
    },
  ];

  const getGoalPercentage = (current, target) => (current / target) * 100;

  return (
    <div
      style={{
        width: '393px',
        height: '852px',
        margin: '20px auto',
        borderRadius: '40px',
        border: '3px solid #2a2a2a',
        backgroundColor: '#0f0a1e',
        overflow: 'hidden',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.8)',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        color: '#ffffff',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Status Bar */}
      <div
        style={{
          height: '44px',
          backgroundColor: '#0f0a1e',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '14px',
          fontWeight: '600',
          borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
        }}
      >
        <span style={{ marginRight: 'auto', marginLeft: '16px' }}>4:03</span>
        <span style={{ marginRight: '16px' }}>●●●●●</span>
      </div>

      {/* Main Content Scroll Container */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          paddingBottom: '60px',
          scrollBehavior: 'smooth',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
          }}
        >
          <button
            style={{
              background: 'none',
              border: 'none',
              color: '#a855f7',
              cursor: 'pointer',
              padding: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ArrowLeft size={24} />
          </button>

          <h1
            style={{
              fontSize: '20px',
              fontWeight: '700',
              flex: 1,
              textAlign: 'center',
              margin: 0,
            }}
          >
            Our Finances
          </h1>

          {/* Couple Avatar Stack */}
          <div style={{ position: 'relative', width: '50px', height: '32px' }}>
            <div
              style={{
                position: 'absolute',
                left: '0',
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                backgroundColor: '#a855f7',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '14px',
                fontWeight: '700',
                border: '2px solid #0f0a1e',
                zIndex: 2,
              }}
            >
              T
            </div>
            <div
              style={{
                position: 'absolute',
                right: '0',
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                backgroundColor: '#ec4899',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '14px',
                fontWeight: '700',
                border: '2px solid #0f0a1e',
                zIndex: 1,
              }}
            >
              P
            </div>
          </div>
        </div>

        {/* Couple Score Card */}
        <div
          style={{
            margin: '20px 16px',
            padding: '24px',
            backgroundColor: '#1a1428',
            borderRadius: '16px',
            border: '1px solid rgba(168, 85, 247, 0.2)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          {/* Circular Gauge */}
          <div style={{ position: 'relative', width: '140px', height: '140px' }}>
            {/* Background circle */}
            <svg
              width="140"
              height="140"
              style={{ position: 'absolute', top: 0, left: 0 }}
              viewBox="0 0 140 140"
            >
              <circle
                cx="70"
                cy="70"
                r="60"
                fill="none"
                stroke="rgba(255, 255, 255, 0.1)"
                strokeWidth="8"
              />
              {/* Progress circle with gradient */}
              <defs>
                <linearGradient
                  id="scoreGradient"
                  x1="0%"
                  y1="0%"
                  x2="100%"
                  y2="100%"
                >
                  <stop offset="0%" stopColor="#a855f7" />
                  <stop offset="100%" stopColor="#10b981" />
                </linearGradient>
              </defs>
              <circle
                cx="70"
                cy="70"
                r="60"
                fill="none"
                stroke="url(#scoreGradient)"
                strokeWidth="8"
                strokeDasharray={`${(scorePercentage / 100) * 2 * Math.PI * 60} ${2 * Math.PI * 60}`}
                strokeLinecap="round"
                style={{
                  transform: 'rotate(-90deg)',
                  transformOrigin: '70px 70px',
                }}
              />
            </svg>

            {/* Center text */}
            <div
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: '32px', fontWeight: '700' }}>
                {coupleScore}
              </div>
              <div style={{ fontSize: '12px', color: '#a0aec0' }}>/ 100</div>
            </div>
          </div>

          <div style={{ textAlign: 'center', marginTop: '12px' }}>
            <div style={{ fontSize: '14px', fontWeight: '600' }}>
              CoupleFlow Score
            </div>
            <div
              style={{
                fontSize: '13px',
                color: '#10b981',
                marginTop: '4px',
                fontWeight: '500',
              }}
            >
              Good — you're aligned on 4 of 5 goals
            </div>
          </div>
        </div>

        {/* Spending Comparison */}
        <div style={{ margin: '20px 16px 0' }}>
          <h2
            style={{
              fontSize: '16px',
              fontWeight: '700',
              marginBottom: '16px',
              margin: '0 0 16px 0',
            }}
          >
            Spending Comparison
          </h2>

          <div style={{ display: 'flex', gap: '12px' }}>
            {/* You Column */}
            <div
              style={{
                flex: 1,
                padding: '16px',
                backgroundColor: '#1a1428',
                borderRadius: '12px',
                border: '1px solid rgba(168, 85, 247, 0.2)',
              }}
            >
              <div
                style={{
                  fontSize: '13px',
                  color: '#a0aec0',
                  marginBottom: '8px',
                  fontWeight: '500',
                }}
              >
                {spendingData.you.name}
              </div>
              <div
                style={{
                  fontSize: '20px',
                  fontWeight: '700',
                  marginBottom: '16px',
                  color: spendingData.you.color,
                }}
              >
                ${spendingData.you.total.toLocaleString()}
              </div>

              {spendingData.you.categories.map((cat, idx) => (
                <div key={idx} style={{ marginBottom: '12px' }}>
                  <div
                    style={{
                      fontSize: '12px',
                      marginBottom: '4px',
                      display: 'flex',
                      justifyContent: 'space-between',
                    }}
                  >
                    <span>{cat.name}</span>
                    <span style={{ color: '#a0aec0' }}>${cat.amount}</span>
                  </div>
                  <div
                    style={{
                      height: '6px',
                      backgroundColor: 'rgba(168, 85, 247, 0.2)',
                      borderRadius: '3px',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        height: '100%',
                        backgroundColor: '#a855f7',
                        width: `${cat.percentage}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Partner Column */}
            <div
              style={{
                flex: 1,
                padding: '16px',
                backgroundColor: '#1a1428',
                borderRadius: '12px',
                border: '1px solid rgba(236, 72, 153, 0.2)',
              }}
            >
              <div
                style={{
                  fontSize: '13px',
                  color: '#a0aec0',
                  marginBottom: '8px',
                  fontWeight: '500',
                }}
              >
                {spendingData.partner.name}
              </div>
              <div
                style={{
                  fontSize: '20px',
                  fontWeight: '700',
                  marginBottom: '16px',
                  color: spendingData.partner.color,
                }}
              >
                ${spendingData.partner.total.toLocaleString()}
              </div>

              {spendingData.partner.categories.map((cat, idx) => (
                <div key={idx} style={{ marginBottom: '12px' }}>
                  <div
                    style={{
                      fontSize: '12px',
                      marginBottom: '4px',
                      display: 'flex',
                      justifyContent: 'space-between',
                    }}
                  >
                    <span>{cat.name}</span>
                    <span style={{ color: '#a0aec0' }}>${cat.amount}</span>
                  </div>
                  <div
                    style={{
                      height: '6px',
                      backgroundColor: 'rgba(236, 72, 153, 0.2)',
                      borderRadius: '3px',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        height: '100%',
                        backgroundColor: '#ec4899',
                        width: `${cat.percentage}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Shared Goals */}
        <div style={{ margin: '24px 16px 0' }}>
          <h2
            style={{
              fontSize: '16px',
              fontWeight: '700',
              marginBottom: '16px',
              margin: '0 0 16px 0',
            }}
          >
            Shared Goals
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {goals.map((goal, idx) => {
              const percentage = getGoalPercentage(goal.current, goal.target);
              return (
                <div
                  key={idx}
                  style={{
                    padding: '16px',
                    backgroundColor: '#1a1428',
                    borderRadius: '12px',
                    border: `1px solid ${goal.color}20`,
                    display: 'flex',
                    gap: '12px',
                    alignItems: 'flex-start',
                  }}
                >
                  {/* Mini Circular Progress */}
                  <div
                    style={{
                      position: 'relative',
                      width: '56px',
                      height: '56px',
                      flexShrink: 0,
                    }}
                  >
                    <svg width="56" height="56" viewBox="0 0 56 56">
                      <circle
                        cx="28"
                        cy="28"
                        r="24"
                        fill="none"
                        stroke="rgba(255, 255, 255, 0.1)"
                        strokeWidth="4"
                      />
                      <circle
                        cx="28"
                        cy="28"
                        r="24"
                        fill="none"
                        stroke={goal.color}
                        strokeWidth="4"
                        strokeDasharray={`${(percentage / 100) * 2 * Math.PI * 24} ${2 * Math.PI * 24}`}
                        strokeLinecap="round"
                        style={{
                          transform: 'rotate(-90deg)',
                          transformOrigin: '28px 28px',
                        }}
                      />
                    </svg>
                    <div
                      style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        fontSize: '11px',
                        fontWeight: '700',
                      }}
                    >
                      {Math.round(percentage)}%
                    </div>
                  </div>

                  {/* Goal Details */}
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        fontSize: '14px',
                        fontWeight: '600',
                        marginBottom: '4px',
                      }}
                    >
                      {goal.name}
                    </div>
                    <div
                      style={{
                        fontSize: '12px',
                        color: '#a0aec0',
                        marginBottom: '8px',
                      }}
                    >
                      ${goal.current.toLocaleString()} / $
                      {goal.target.toLocaleString()}
                    </div>

                    {/* Progress bar */}
                    <div
                      style={{
                        height: '4px',
                        backgroundColor: 'rgba(255, 255, 255, 0.1)',
                        borderRadius: '2px',
                        overflow: 'hidden',
                        marginBottom: '6px',
                      }}
                    >
                      <div
                        style={{
                          height: '100%',
                          backgroundColor: goal.color,
                          width: `${percentage}%`,
                        }}
                      />
                    </div>

                    <div
                      style={{
                        fontSize: '11px',
                        color: '#a0aec0',
                      }}
                    >
                      {goal.dueText}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Activity Feed */}
        <div style={{ margin: '24px 16px 0' }}>
          <h2
            style={{
              fontSize: '16px',
              fontWeight: '700',
              marginBottom: '16px',
              margin: '0 0 16px 0',
            }}
          >
            Activity Feed
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {activities.map((activity, idx) => (
              <div
                key={idx}
                style={{
                  padding: '12px 16px',
                  backgroundColor: '#1a1428',
                  borderRadius: '12px',
                  border: '1px solid rgba(236, 72, 153, 0.15)',
                  display: 'flex',
                  gap: '12px',
                  alignItems: 'flex-start',
                }}
              >
                {/* Pink Avatar Dot */}
                <div
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    backgroundColor: '#ec4899',
                    flexShrink: 0,
                    marginTop: '2px',
                  }}
                />

                {/* Activity Text */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: '13px',
                      lineHeight: '1.4',
                      color: '#e0e7ff',
                      marginBottom: '4px',
                    }}
                  >
                    {activity.text}
                  </div>
                  <div
                    style={{
                      fontSize: '11px',
                      color: '#a0aec0',
                    }}
                  >
                    {activity.time}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Money Date CTA Button */}
        <div style={{ margin: '24px 16px' }}>
          <button
            style={{
              width: '100%',
              padding: '16px 20px',
              borderRadius: '12px',
              border: 'none',
              background: 'linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)',
              color: '#ffffff',
              fontSize: '16px',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'transform 0.2s, box-shadow 0.2s',
            }}
            onMouseEnter={(e) => {
              e.target.style.transform = 'translateY(-2px)';
              e.target.style.boxShadow = '0 8px 20px rgba(168, 85, 247, 0.4)';
            }}
            onMouseLeave={(e) => {
              e.target.style.transform = 'translateY(0)';
              e.target.style.boxShadow = 'none';
            }}
          >
            <Heart size={20} fill="#ffffff" />
            Start a Money Date
          </button>
        </div>
      </div>

      {/* Bottom Sync Status */}
      <div
        style={{
          padding: '12px 16px',
          borderTop: '1px solid rgba(255, 255, 255, 0.05)',
          backgroundColor: '#0f0a1e',
          fontSize: '12px',
          color: '#a0aec0',
          textAlign: 'center',
        }}
      >
        Last synced {syncTime}
      </div>
    </div>
  );
}
