import React, { useState } from 'react';
import {
  Home,
  Calendar,
  Bot,
  Wallet,
  Settings,
  ChevronRight,
  Heart,
  Bell,
  LogOut,
  Edit2,
  AlertCircle,
} from 'lucide-react';

export default function SettingsScreen() {
  const [billRemindersOn, setBillRemindersOn] = useState(true);
  const [spendingAlertsOn, setSpendingAlertsOn] = useState(true);
  const [aiAdvisorOn, setAiAdvisorOn] = useState(true);

  const containerStyle = {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    background: '#0f0a1e',
    color: '#ffffff',
    width: '393px',
    height: '852px',
    borderRadius: '40px',
    border: '3px solid #2a2a2a',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.8)',
  };

  const statusBarStyle = {
    background: '#0f0a1e',
    padding: '8px 0',
    paddingTop: '12px',
    paddingBottom: '4px',
    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    fontSize: '14px',
    fontWeight: '600',
    color: '#ffffff',
  };

  const contentStyle = {
    flex: 1,
    overflowY: 'auto',
    paddingBottom: '70px',
  };

  const headerStyle = {
    padding: '20px 20px 16px 20px',
    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
  };

  const headerTitleStyle = {
    fontSize: '32px',
    fontWeight: '700',
    margin: 0,
  };

  const profileSectionStyle = {
    padding: '20px',
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
  };

  const avatarStyle = {
    width: '64px',
    height: '64px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '24px',
    fontWeight: '700',
    flexShrink: 0,
  };

  const profileInfoStyle = {
    flex: 1,
  };

  const profileNameStyle = {
    fontSize: '16px',
    fontWeight: '600',
    margin: '0 0 4px 0',
  };

  const profileEmailStyle = {
    fontSize: '14px',
    color: '#9ca3af',
    margin: 0,
  };

  const editButtonStyle = {
    padding: '8px 12px',
    border: '1px solid rgba(168, 85, 247, 0.4)',
    borderRadius: '6px',
    background: 'transparent',
    color: '#a855f7',
    fontSize: '13px',
    fontWeight: '500',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    transition: 'all 0.2s',
  };

  const cardStyle = {
    background: 'rgba(255, 255, 255, 0.04)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '12px',
    margin: '16px 20px',
    overflow: 'hidden',
  };

  const sectionHeaderStyle = {
    padding: '12px 16px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
    fontSize: '13px',
    fontWeight: '600',
    color: '#d1d5db',
  };

  const rowStyle = {
    padding: '12px 16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
    cursor: 'pointer',
    transition: 'background 0.2s',
  };

  const rowHoverStyle = {
    ...rowStyle,
    background: 'rgba(255, 255, 255, 0.02)',
  };

  const rowLabelStyle = {
    fontSize: '14px',
    fontWeight: '500',
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  };

  const rowSubtitleStyle = {
    fontSize: '12px',
    color: '#9ca3af',
  };

  const rowRightStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  };

  const badgeStyle = {
    background: '#ec4899',
    color: '#ffffff',
    padding: '2px 8px',
    borderRadius: '12px',
    fontSize: '11px',
    fontWeight: '600',
  };

  const labelStyle = {
    fontSize: '13px',
    color: '#9ca3af',
    fontWeight: '500',
  };

  const greenDotStyle = {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    background: '#10b981',
    display: 'inline-block',
    marginRight: '6px',
  };

  const toggleStyle = {
    width: '44px',
    height: '24px',
    borderRadius: '12px',
    border: 'none',
    cursor: 'pointer',
    transition: 'background 0.3s',
    position: 'relative',
  };

  const toggleCircleStyle = {
    position: 'absolute',
    width: '20px',
    height: '20px',
    borderRadius: '50%',
    background: '#ffffff',
    top: '2px',
    transition: 'left 0.3s',
  };

  const toggleOnStyle = {
    ...toggleStyle,
    background: '#a855f7',
  };

  const toggleOffStyle = {
    ...toggleStyle,
    background: 'rgba(255, 255, 255, 0.1)',
  };

  const toggleCircleOnStyle = {
    ...toggleCircleStyle,
    left: '22px',
  };

  const toggleCircleOffStyle = {
    ...toggleCircleStyle,
    left: '2px',
  };

  const bottomNavStyle = {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '70px',
    background: 'rgba(15, 10, 30, 0.95)',
    borderTop: '1px solid rgba(255, 255, 255, 0.08)',
    display: 'flex',
    justifyContent: 'space-around',
    alignItems: 'center',
    backdropFilter: 'blur(10px)',
  };

  const navItemStyle = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '4px',
    cursor: 'pointer',
    padding: '8px',
  };

  const navLabelStyle = {
    fontSize: '11px',
    fontWeight: '500',
  };

  const helpSectionStyle = {
    padding: '12px 16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
  };

  const signOutStyle = {
    padding: '12px 16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    color: '#ef4444',
  };

  const versionStyle = {
    padding: '20px',
    textAlign: 'center',
    fontSize: '12px',
    color: '#6b7280',
  };

  const [hoveredRow, setHoveredRow] = useState(null);

  return (
    <div style={containerStyle}>
      {/* Status Bar */}
      <div style={statusBarStyle}>4:03</div>

      {/* Header */}
      <div style={headerStyle}>
        <h1 style={headerTitleStyle}>Settings</h1>
      </div>

      {/* Main Content */}
      <div style={contentStyle}>
        {/* Profile Section */}
        <div style={profileSectionStyle}>
          <div style={avatarStyle}>TB</div>
          <div style={profileInfoStyle}>
            <p style={profileNameStyle}>Test user2</p>
            <p style={profileEmailStyle}>user@example.com</p>
          </div>
          <button style={editButtonStyle}>
            <Edit2 size={14} />
            Edit
          </button>
        </div>

        {/* Household Section */}
        <div style={cardStyle}>
          <div style={sectionHeaderStyle}>
            <Heart size={16} color="#a855f7" />
            Household
          </div>
          <div
            style={hoveredRow === 'partner' ? rowHoverStyle : rowStyle}
            onMouseEnter={() => setHoveredRow('partner')}
            onMouseLeave={() => setHoveredRow(null)}
          >
            <div style={rowLabelStyle}>
              <span>
                <span style={greenDotStyle}></span>
                Paired with Partner
              </span>
            </div>
            <ChevronRight size={18} color="#6b7280" />
          </div>
          <div
            style={hoveredRow === 'manage' ? rowHoverStyle : rowStyle}
            onMouseEnter={() => setHoveredRow('manage')}
            onMouseLeave={() => setHoveredRow(null)}
          >
            <span>Manage Household</span>
            <ChevronRight size={18} color="#6b7280" />
          </div>
          <div
            style={hoveredRow === 'sharing' ? rowHoverStyle : rowStyle}
            onMouseEnter={() => setHoveredRow('sharing')}
            onMouseLeave={() => setHoveredRow(null)}
          >
            <span>Sharing Preferences</span>
            <ChevronRight size={18} color="#6b7280" />
          </div>
          <div
            style={{
              ...rowStyle,
              borderBottom: 'none',
            }}
            onMouseEnter={() => setHoveredRow('invites')}
            onMouseLeave={() => setHoveredRow(null)}
          >
            <span>Pending Invites</span>
            <div style={rowRightStyle}>
              <div style={badgeStyle}>1</div>
              <ChevronRight size={18} color="#6b7280" />
            </div>
          </div>
        </div>

        {/* Financial Settings */}
        <div style={cardStyle}>
          <div style={sectionHeaderStyle}>
            <Wallet size={16} color="#a855f7" />
            Financial Settings
          </div>
          <div
            style={hoveredRow === 'accounts' ? rowHoverStyle : rowStyle}
            onMouseEnter={() => setHoveredRow('accounts')}
            onMouseLeave={() => setHoveredRow(null)}
          >
            <span>Linked Accounts</span>
            <div style={rowRightStyle}>
              <span style={labelStyle}>3 accounts</span>
              <ChevronRight size={18} color="#6b7280" />
            </div>
          </div>
          <div
            style={hoveredRow === 'budget' ? rowHoverStyle : rowStyle}
            onMouseEnter={() => setHoveredRow('budget')}
            onMouseLeave={() => setHoveredRow(null)}
          >
            <span>Budget Settings</span>
            <ChevronRight size={18} color="#6b7280" />
          </div>
          <div
            style={hoveredRow === 'categories' ? rowHoverStyle : rowStyle}
            onMouseEnter={() => setHoveredRow('categories')}
            onMouseLeave={() => setHoveredRow(null)}
          >
            <span>Categories</span>
            <ChevronRight size={18} color="#6b7280" />
          </div>
          <div style={rowStyle}>
            <span>Bill Reminders</span>
            <button
              style={billRemindersOn ? toggleOnStyle : toggleOffStyle}
              onClick={() => setBillRemindersOn(!billRemindersOn)}
            >
              <div
                style={billRemindersOn ? toggleCircleOnStyle : toggleCircleOffStyle}
              ></div>
            </button>
          </div>
          <div style={{ ...rowStyle, borderBottom: 'none' }}>
            <div style={rowLabelStyle}>
              <span>Spending Alerts</span>
              <span style={rowSubtitleStyle}>Notify when 80% of budget used</span>
            </div>
            <button
              style={spendingAlertsOn ? toggleOnStyle : toggleOffStyle}
              onClick={() => setSpendingAlertsOn(!spendingAlertsOn)}
            >
              <div
                style={spendingAlertsOn ? toggleCircleOnStyle : toggleCircleOffStyle}
              ></div>
            </button>
          </div>
        </div>

        {/* AI Settings */}
        <div style={cardStyle}>
          <div style={sectionHeaderStyle}>
            <Bot size={16} color="#a855f7" />
            AI Settings
          </div>
          <div style={rowStyle}>
            <span>AI Advisor</span>
            <button
              style={aiAdvisorOn ? toggleOnStyle : toggleOffStyle}
              onClick={() => setAiAdvisorOn(!aiAdvisorOn)}
            >
              <div
                style={aiAdvisorOn ? toggleCircleOnStyle : toggleCircleOffStyle}
              ></div>
            </button>
          </div>
          <div
            style={hoveredRow === 'method' ? rowHoverStyle : rowStyle}
            onMouseEnter={() => setHoveredRow('method')}
            onMouseLeave={() => setHoveredRow(null)}
          >
            <span>CoupleFlow Method</span>
            <div style={rowRightStyle}>
              <span style={labelStyle}>Level 2: Build Security</span>
              <ChevronRight size={18} color="#6b7280" />
            </div>
          </div>
          <div
            style={{
              ...rowStyle,
              borderBottom: 'none',
            }}
            onMouseEnter={() => setHoveredRow('plans')}
            onMouseLeave={() => setHoveredRow(null)}
          >
            <span>Financial Plans</span>
            <ChevronRight size={18} color="#6b7280" />
          </div>
        </div>

        {/* App Settings */}
        <div style={cardStyle}>
          <div style={sectionHeaderStyle}>Settings</div>
          <div
            style={hoveredRow === 'notif' ? rowHoverStyle : rowStyle}
            onMouseEnter={() => setHoveredRow('notif')}
            onMouseLeave={() => setHoveredRow(null)}
          >
            <span>Notifications</span>
            <ChevronRight size={18} color="#6b7280" />
          </div>
          <div
            style={hoveredRow === 'appear' ? rowHoverStyle : rowStyle}
            onMouseEnter={() => setHoveredRow('appear')}
            onMouseLeave={() => setHoveredRow(null)}
          >
            <span>Appearance</span>
            <div style={rowRightStyle}>
              <span style={labelStyle}>Dark</span>
              <ChevronRight size={18} color="#6b7280" />
            </div>
          </div>
          <div
            style={hoveredRow === 'currency' ? rowHoverStyle : rowStyle}
            onMouseEnter={() => setHoveredRow('currency')}
            onMouseLeave={() => setHoveredRow(null)}
          >
            <span>Currency</span>
            <div style={rowRightStyle}>
              <span style={labelStyle}>USD</span>
              <ChevronRight size={18} color="#6b7280" />
            </div>
          </div>
          <div
            style={{
              ...rowStyle,
              borderBottom: 'none',
            }}
            onMouseEnter={() => setHoveredRow('frequency')}
            onMouseLeave={() => setHoveredRow(null)}
          >
            <span>Budget Frequency</span>
            <div style={rowRightStyle}>
              <span style={labelStyle}>Monthly</span>
              <ChevronRight size={18} color="#6b7280" />
            </div>
          </div>
        </div>

        {/* Help & Support */}
        <div style={cardStyle}>
          <div
            style={hoveredRow === 'help' ? rowHoverStyle : helpSectionStyle}
            onMouseEnter={() => setHoveredRow('help')}
            onMouseLeave={() => setHoveredRow(null)}
          >
            <span>Help & Support</span>
            <ChevronRight size={18} color="#6b7280" />
          </div>
          <div
            style={hoveredRow === 'privacy' ? rowHoverStyle : helpSectionStyle}
            onMouseEnter={() => setHoveredRow('privacy')}
            onMouseLeave={() => setHoveredRow(null)}
          >
            <span>Privacy Policy</span>
            <ChevronRight size={18} color="#6b7280" />
          </div>
          <div style={signOutStyle}>
            <span>Sign Out</span>
            <LogOut size={18} />
          </div>
        </div>

        {/* Version */}
        <div style={versionStyle}>CoupleFlow v1.0.0</div>
      </div>

      {/* Bottom Navigation */}
      <div style={bottomNavStyle}>
        <div style={navItemStyle}>
          <Home size={24} color="#6b7280" />
          <div style={{ ...navLabelStyle, color: '#6b7280' }}>Home</div>
        </div>
        <div style={navItemStyle}>
          <Calendar size={24} color="#6b7280" />
          <div style={{ ...navLabelStyle, color: '#6b7280' }}>Calendar</div>
        </div>
        <div style={navItemStyle}>
          <Bot size={24} color="#6b7280" />
          <div style={{ ...navLabelStyle, color: '#6b7280' }}>AI</div>
        </div>
        <div style={navItemStyle}>
          <Wallet size={24} color="#6b7280" />
          <div style={{ ...navLabelStyle, color: '#6b7280' }}>Budget</div>
        </div>
        <div style={navItemStyle}>
          <Settings size={24} color="#a855f7" />
          <div style={{ ...navLabelStyle, color: '#a855f7' }}>Settings</div>
        </div>
      </div>
    </div>
  );
}
