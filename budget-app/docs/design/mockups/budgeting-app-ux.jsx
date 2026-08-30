import React, { useState } from 'react';

// Couples/Household Budgeting App - UX Prototype
// Design Direction: Warm, trustworthy fintech with partnership emphasis

const App = () => {
  const [currentScreen, setCurrentScreen] = useState('welcome');
  const [registrationStep, setRegistrationStep] = useState(1);
  const [activeTab, setActiveTab] = useState('dashboard');
  
  // Color palette
  const colors = {
    primary: '#1a5f4a',      // Deep forest green - trust, growth
    primaryLight: '#e8f5f0', // Light green tint
    secondary: '#f4a261',    // Warm coral - partnership, warmth
    background: '#faf9f7',   // Warm off-white
    surface: '#ffffff',
    text: '#1a1a1a',
    textMuted: '#6b7280',
    success: '#22c55e',
    warning: '#f59e0b',
    danger: '#ef4444',
    border: '#e5e5e5',
  };

  const styles = {
    // Base container
    container: {
      fontFamily: "'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif",
      maxWidth: '390px',
      minHeight: '844px',
      margin: '0 auto',
      background: colors.background,
      position: 'relative',
      overflow: 'hidden',
      borderRadius: '40px',
      boxShadow: '0 25px 100px rgba(0,0,0,0.15)',
    },
    
    // Status bar
    statusBar: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '12px 24px',
      fontSize: '14px',
      fontWeight: '600',
    },

    // Screen wrapper
    screen: {
      padding: '0 24px 100px',
      minHeight: '700px',
    },

    // Typography
    h1: {
      fontSize: '28px',
      fontWeight: '700',
      color: colors.text,
      margin: '0 0 8px 0',
      letterSpacing: '-0.5px',
    },
    h2: {
      fontSize: '22px',
      fontWeight: '600',
      color: colors.text,
      margin: '0 0 16px 0',
    },
    h3: {
      fontSize: '16px',
      fontWeight: '600',
      color: colors.text,
      margin: '0 0 8px 0',
    },
    subtitle: {
      fontSize: '15px',
      color: colors.textMuted,
      margin: '0 0 24px 0',
      lineHeight: '1.5',
    },
    label: {
      fontSize: '13px',
      fontWeight: '500',
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: '0.5px',
      marginBottom: '6px',
      display: 'block',
    },

    // Buttons
    buttonPrimary: {
      width: '100%',
      padding: '16px 24px',
      background: colors.primary,
      color: 'white',
      border: 'none',
      borderRadius: '14px',
      fontSize: '16px',
      fontWeight: '600',
      cursor: 'pointer',
      transition: 'all 0.2s ease',
      marginBottom: '12px',
    },
    buttonSecondary: {
      width: '100%',
      padding: '16px 24px',
      background: 'transparent',
      color: colors.primary,
      border: `2px solid ${colors.primary}`,
      borderRadius: '14px',
      fontSize: '16px',
      fontWeight: '600',
      cursor: 'pointer',
      transition: 'all 0.2s ease',
    },
    buttonText: {
      background: 'none',
      border: 'none',
      color: colors.primary,
      fontSize: '15px',
      fontWeight: '600',
      cursor: 'pointer',
      padding: '8px 0',
    },

    // Inputs
    input: {
      width: '100%',
      padding: '16px',
      border: `1.5px solid ${colors.border}`,
      borderRadius: '12px',
      fontSize: '16px',
      background: colors.surface,
      marginBottom: '16px',
      boxSizing: 'border-box',
      outline: 'none',
      transition: 'border-color 0.2s ease',
    },

    // Cards
    card: {
      background: colors.surface,
      borderRadius: '16px',
      padding: '20px',
      marginBottom: '16px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
    },

    // Nav
    bottomNav: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      background: colors.surface,
      borderTop: `1px solid ${colors.border}`,
      display: 'flex',
      justifyContent: 'space-around',
      padding: '12px 8px 28px',
    },
    navItem: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '4px',
      background: 'none',
      border: 'none',
      cursor: 'pointer',
      padding: '8px',
      minWidth: '56px',
    },
    navIcon: {
      width: '24px',
      height: '24px',
    },
    navLabel: {
      fontSize: '10px',
      fontWeight: '500',
    },
  };

  // ============ WELCOME SCREEN ============
  const WelcomeScreen = () => (
    <div style={{ ...styles.screen, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', paddingTop: '60px' }}>
      <div style={{ textAlign: 'center', marginTop: '40px' }}>
        {/* Logo/Illustration */}
        <div style={{
          width: '120px',
          height: '120px',
          margin: '0 auto 32px',
          background: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.secondary} 100%)`,
          borderRadius: '30px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 12px 40px rgba(26, 95, 74, 0.3)',
        }}>
          <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/>
            <path d="M8 12a4 4 0 108 0 4 4 0 00-8 0z"/>
            <circle cx="8" cy="10" r="2"/>
            <circle cx="16" cy="10" r="2"/>
          </svg>
        </div>
        
        <h1 style={{ ...styles.h1, fontSize: '32px', marginBottom: '12px' }}>Centsible</h1>
        <p style={{ ...styles.subtitle, fontSize: '17px', maxWidth: '280px', margin: '0 auto' }}>
          Budget together, grow together. Financial harmony for couples.
        </p>
      </div>

      <div style={{ marginBottom: '40px' }}>
        {/* Features preview */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '24px', marginBottom: '48px' }}>
          {[
            { icon: '👥', label: 'Shared Goals' },
            { icon: '📊', label: 'Joint Budgets' },
            { icon: '💬', label: 'Stay Aligned' },
          ].map((item, i) => (
            <div key={i} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '28px', marginBottom: '8px' }}>{item.icon}</div>
              <div style={{ fontSize: '12px', color: colors.textMuted, fontWeight: '500' }}>{item.label}</div>
            </div>
          ))}
        </div>

        <button 
          style={styles.buttonPrimary}
          onClick={() => setCurrentScreen('login')}
        >
          Sign In
        </button>
        <button 
          style={styles.buttonSecondary}
          onClick={() => {
            setRegistrationStep(1);
            setCurrentScreen('register');
          }}
        >
          Create Account
        </button>
      </div>
    </div>
  );

  // ============ LOGIN SCREEN ============
  const LoginScreen = () => (
    <div style={styles.screen}>
      <button 
        style={{ ...styles.buttonText, marginTop: '20px', marginBottom: '20px' }}
        onClick={() => setCurrentScreen('welcome')}
      >
        ← Back
      </button>
      
      <h1 style={styles.h1}>Welcome back</h1>
      <p style={styles.subtitle}>Sign in to continue managing your finances together.</p>

      <div style={{ marginTop: '32px' }}>
        <label style={styles.label}>Email</label>
        <input 
          type="email" 
          placeholder="you@example.com" 
          style={styles.input}
        />
        
        <label style={styles.label}>Password</label>
        <input 
          type="password" 
          placeholder="Enter your password" 
          style={styles.input}
        />
        
        <div style={{ textAlign: 'right', marginBottom: '24px' }}>
          <button style={{ ...styles.buttonText, fontSize: '14px' }}>
            Forgot password?
          </button>
        </div>

        <button 
          style={styles.buttonPrimary}
          onClick={() => setCurrentScreen('app')}
        >
          Sign In
        </button>

        <div style={{ textAlign: 'center', margin: '24px 0' }}>
          <span style={{ color: colors.textMuted, fontSize: '14px' }}>or continue with</span>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button style={{
            flex: 1,
            padding: '14px',
            background: colors.surface,
            border: `1.5px solid ${colors.border}`,
            borderRadius: '12px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            fontSize: '14px',
            fontWeight: '500',
          }}>
            <span>🍎</span> Apple
          </button>
          <button style={{
            flex: 1,
            padding: '14px',
            background: colors.surface,
            border: `1.5px solid ${colors.border}`,
            borderRadius: '12px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            fontSize: '14px',
            fontWeight: '500',
          }}>
            <span>G</span> Google
          </button>
        </div>

        <p style={{ textAlign: 'center', marginTop: '32px', fontSize: '14px', color: colors.textMuted }}>
          Don't have an account?{' '}
          <button 
            style={{ ...styles.buttonText, display: 'inline', fontSize: '14px' }}
            onClick={() => setCurrentScreen('register')}
          >
            Sign up
          </button>
        </p>
      </div>
    </div>
  );

  // ============ REGISTRATION FLOW ============
  const RegistrationScreen = () => {
    const steps = [
      { title: 'Create Account', subtitle: 'Let\'s get you started' },
      { title: 'About You', subtitle: 'Help us personalize your experience' },
      { title: 'Set Up Household', subtitle: 'Create or join a household' },
      { title: 'Invite Partner', subtitle: 'Budget better together' },
    ];

    const renderStep = () => {
      switch(registrationStep) {
        case 1:
          return (
            <>
              <label style={styles.label}>Full Name</label>
              <input type="text" placeholder="Your name" style={styles.input} />
              
              <label style={styles.label}>Email</label>
              <input type="email" placeholder="you@example.com" style={styles.input} />
              
              <label style={styles.label}>Password</label>
              <input type="password" placeholder="Create a strong password" style={styles.input} />
              
              <label style={styles.label}>Confirm Password</label>
              <input type="password" placeholder="Confirm your password" style={styles.input} />
            </>
          );
        case 2:
          return (
            <>
              <label style={styles.label}>What's your primary financial goal?</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
                {['Pay off debt', 'Build savings', 'Budget better', 'Save for a goal', 'All of the above'].map((goal, i) => (
                  <button key={i} style={{
                    padding: '16px',
                    background: i === 4 ? colors.primaryLight : colors.surface,
                    border: `1.5px solid ${i === 4 ? colors.primary : colors.border}`,
                    borderRadius: '12px',
                    textAlign: 'left',
                    cursor: 'pointer',
                    fontSize: '15px',
                    fontWeight: i === 4 ? '600' : '400',
                    color: colors.text,
                  }}>
                    {goal}
                  </button>
                ))}
              </div>
            </>
          );
        case 3:
          return (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <button style={{
                  ...styles.card,
                  border: `2px solid ${colors.primary}`,
                  cursor: 'pointer',
                  textAlign: 'left',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{
                      width: '48px',
                      height: '48px',
                      background: colors.primaryLight,
                      borderRadius: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '24px',
                    }}>🏠</div>
                    <div>
                      <h3 style={{ ...styles.h3, marginBottom: '4px' }}>Create New Household</h3>
                      <p style={{ fontSize: '13px', color: colors.textMuted, margin: 0 }}>
                        Start fresh and invite your partner
                      </p>
                    </div>
                  </div>
                </button>

                <button style={{
                  ...styles.card,
                  cursor: 'pointer',
                  textAlign: 'left',
                  border: `1.5px solid ${colors.border}`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{
                      width: '48px',
                      height: '48px',
                      background: '#f3f4f6',
                      borderRadius: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '24px',
                    }}>🔗</div>
                    <div>
                      <h3 style={{ ...styles.h3, marginBottom: '4px' }}>Join Existing Household</h3>
                      <p style={{ fontSize: '13px', color: colors.textMuted, margin: 0 }}>
                        I have an invite code from my partner
                      </p>
                    </div>
                  </div>
                </button>
              </div>

              <div style={{ marginTop: '24px' }}>
                <label style={styles.label}>Household Name</label>
                <input type="text" placeholder="e.g., The Smiths" style={styles.input} />
              </div>
            </>
          );
        case 4:
          return (
            <>
              <div style={{
                background: colors.primaryLight,
                borderRadius: '16px',
                padding: '24px',
                textAlign: 'center',
                marginBottom: '24px',
              }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>💑</div>
                <p style={{ fontSize: '15px', color: colors.text, margin: 0, lineHeight: '1.5' }}>
                  Budgeting is better together! Invite your partner to join your household.
                </p>
              </div>

              <label style={styles.label}>Partner's Email</label>
              <input type="email" placeholder="partner@example.com" style={styles.input} />

              <div style={{ textAlign: 'center', margin: '16px 0' }}>
                <span style={{ color: colors.textMuted, fontSize: '14px' }}>or share invite link</span>
              </div>

              <button style={{
                ...styles.buttonSecondary,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}>
                <span>📋</span> Copy Invite Link
              </button>

              <button 
                style={{ ...styles.buttonText, width: '100%', marginTop: '16px', textAlign: 'center' }}
                onClick={() => setCurrentScreen('app')}
              >
                Skip for now
              </button>
            </>
          );
        default:
          return null;
      }
    };

    return (
      <div style={styles.screen}>
        <button 
          style={{ ...styles.buttonText, marginTop: '20px', marginBottom: '20px' }}
          onClick={() => {
            if (registrationStep > 1) {
              setRegistrationStep(registrationStep - 1);
            } else {
              setCurrentScreen('welcome');
            }
          }}
        >
          ← Back
        </button>

        {/* Progress indicator */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '32px' }}>
          {[1, 2, 3, 4].map((step) => (
            <div 
              key={step}
              style={{
                flex: 1,
                height: '4px',
                borderRadius: '2px',
                background: step <= registrationStep ? colors.primary : colors.border,
                transition: 'background 0.3s ease',
              }}
            />
          ))}
        </div>

        <h1 style={styles.h1}>{steps[registrationStep - 1].title}</h1>
        <p style={styles.subtitle}>{steps[registrationStep - 1].subtitle}</p>

        <div style={{ marginTop: '24px' }}>
          {renderStep()}
        </div>

        <div style={{ marginTop: '32px' }}>
          <button 
            style={styles.buttonPrimary}
            onClick={() => {
              if (registrationStep < 4) {
                setRegistrationStep(registrationStep + 1);
              } else {
                setCurrentScreen('app');
              }
            }}
          >
            {registrationStep === 4 ? 'Send Invite & Continue' : 'Continue'}
          </button>
        </div>
      </div>
    );
  };

  // ============ MAIN APP ============
  const MainApp = () => {
    // Partner avatars component
    const PartnerAvatars = ({ size = 32 }) => (
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <div style={{
          width: size,
          height: size,
          borderRadius: '50%',
          background: colors.primary,
          border: '2px solid white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontSize: size * 0.4,
          fontWeight: '600',
        }}>A</div>
        <div style={{
          width: size,
          height: size,
          borderRadius: '50%',
          background: colors.secondary,
          border: '2px solid white',
          marginLeft: -size * 0.3,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontSize: size * 0.4,
          fontWeight: '600',
        }}>S</div>
      </div>
    );

    // Dashboard Screen
    const DashboardScreen = () => (
      <div style={{ ...styles.screen, paddingTop: '20px' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div>
            <p style={{ fontSize: '14px', color: colors.textMuted, margin: '0 0 4px 0' }}>Good evening,</p>
            <h1 style={{ ...styles.h1, marginBottom: 0 }}>Alfred & Sarah</h1>
          </div>
          <PartnerAvatars size={44} />
        </div>

        {/* Month selector */}
        <div style={{ 
          display: 'flex', 
          background: colors.surface, 
          borderRadius: '12px', 
          padding: '4px',
          marginBottom: '24px',
        }}>
          <button style={{
            flex: 1,
            padding: '12px',
            background: colors.primary,
            color: 'white',
            border: 'none',
            borderRadius: '10px',
            fontSize: '14px',
            fontWeight: '600',
            cursor: 'pointer',
          }}>December 2025</button>
          <button style={{
            flex: 1,
            padding: '12px',
            background: 'transparent',
            color: colors.textMuted,
            border: 'none',
            borderRadius: '10px',
            fontSize: '14px',
            fontWeight: '500',
            cursor: 'pointer',
          }}>Year Overview</button>
        </div>

        {/* Financial Summary Card */}
        <div style={{
          ...styles.card,
          background: `linear-gradient(135deg, ${colors.primary} 0%, #2d7a5f 100%)`,
          color: 'white',
          marginBottom: '20px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
            <div>
              <p style={{ fontSize: '13px', opacity: 0.8, margin: '0 0 4px 0' }}>Available to spend</p>
              <h2 style={{ fontSize: '36px', fontWeight: '700', margin: 0 }}>$2,847</h2>
            </div>
            <div style={{ 
              background: 'rgba(255,255,255,0.2)', 
              borderRadius: '8px', 
              padding: '6px 12px',
              fontSize: '13px',
              fontWeight: '500',
            }}>
              22 days left
            </div>
          </div>
          
          <div style={{ display: 'flex', gap: '16px' }}>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: '12px', opacity: 0.8, margin: '0 0 4px 0' }}>Income</p>
              <p style={{ fontSize: '18px', fontWeight: '600', margin: 0 }}>$8,500</p>
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: '12px', opacity: 0.8, margin: '0 0 4px 0' }}>Spent</p>
              <p style={{ fontSize: '18px', fontWeight: '600', margin: 0 }}>$4,153</p>
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: '12px', opacity: 0.8, margin: '0 0 4px 0' }}>Budgeted</p>
              <p style={{ fontSize: '18px', fontWeight: '600', margin: 0 }}>$1,500</p>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
          <div style={styles.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <p style={{ fontSize: '13px', color: colors.textMuted, margin: '0 0 4px 0' }}>Debt</p>
                <p style={{ fontSize: '22px', fontWeight: '700', margin: 0, color: colors.text }}>$12,450</p>
              </div>
              <div style={{ fontSize: '20px' }}>📉</div>
            </div>
            <p style={{ fontSize: '12px', color: colors.success, margin: '8px 0 0 0', fontWeight: '500' }}>
              ↓ $350 this month
            </p>
          </div>
          
          <div style={styles.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <p style={{ fontSize: '13px', color: colors.textMuted, margin: '0 0 4px 0' }}>Savings</p>
                <p style={{ fontSize: '22px', fontWeight: '700', margin: 0, color: colors.text }}>$5,200</p>
              </div>
              <div style={{ fontSize: '20px' }}>🎯</div>
            </div>
            <p style={{ fontSize: '12px', color: colors.primary, margin: '8px 0 0 0', fontWeight: '500' }}>
              52% of $10,000 goal
            </p>
          </div>
        </div>

        {/* Shared Priorities */}
        <div style={styles.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={styles.h3}>Shared Priorities</h3>
            <button style={{ ...styles.buttonText, fontSize: '13px' }}>View all →</button>
          </div>
          
          {[
            { title: 'Emergency Fund', progress: 52, target: '$10,000', by: 'Sarah' },
            { title: 'Pay off Credit Card', progress: 78, target: '$2,500', by: 'Alfred' },
            { title: 'Vacation Fund', progress: 35, target: '$3,000', by: 'Both' },
          ].map((priority, i) => (
            <div key={i} style={{ marginBottom: i < 2 ? '16px' : 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontSize: '14px', fontWeight: '500' }}>{priority.title}</span>
                <span style={{ fontSize: '13px', color: colors.textMuted }}>{priority.target}</span>
              </div>
              <div style={{ 
                height: '8px', 
                background: colors.border, 
                borderRadius: '4px',
                overflow: 'hidden',
              }}>
                <div style={{
                  width: `${priority.progress}%`,
                  height: '100%',
                  background: priority.progress > 70 ? colors.success : colors.primary,
                  borderRadius: '4px',
                  transition: 'width 0.5s ease',
                }} />
              </div>
              <p style={{ fontSize: '11px', color: colors.textMuted, margin: '4px 0 0 0' }}>
                Added by {priority.by}
              </p>
            </div>
          ))}
        </div>

        {/* Recent Activity */}
        <div style={styles.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={styles.h3}>Recent Activity</h3>
            <button style={{ ...styles.buttonText, fontSize: '13px' }}>See all →</button>
          </div>
          
          {[
            { icon: '🛒', name: 'Whole Foods', amount: -127.43, by: 'S', category: 'Groceries' },
            { icon: '⛽', name: 'Shell Gas', amount: -52.00, by: 'A', category: 'Transportation' },
            { icon: '💰', name: 'Paycheck', amount: 4250.00, by: 'A', category: 'Income' },
          ].map((tx, i) => (
            <div key={i} style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '12px',
              padding: '12px 0',
              borderBottom: i < 2 ? `1px solid ${colors.border}` : 'none',
            }}>
              <div style={{
                width: '40px',
                height: '40px',
                background: colors.background,
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '18px',
              }}>{tx.icon}</div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: '14px', fontWeight: '500', margin: 0 }}>{tx.name}</p>
                <p style={{ fontSize: '12px', color: colors.textMuted, margin: '2px 0 0 0' }}>{tx.category}</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ 
                  fontSize: '14px', 
                  fontWeight: '600', 
                  margin: 0,
                  color: tx.amount > 0 ? colors.success : colors.text,
                }}>
                  {tx.amount > 0 ? '+' : ''}{tx.amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                </p>
                <div style={{
                  width: '20px',
                  height: '20px',
                  borderRadius: '50%',
                  background: tx.by === 'A' ? colors.primary : colors.secondary,
                  color: 'white',
                  fontSize: '10px',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginLeft: 'auto',
                  marginTop: '4px',
                }}>{tx.by}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );

    // Budget Screen
    const BudgetScreen = () => (
      <div style={{ ...styles.screen, paddingTop: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h1 style={styles.h1}>Budget</h1>
          <button style={{
            padding: '10px 16px',
            background: colors.primary,
            color: 'white',
            border: 'none',
            borderRadius: '10px',
            fontSize: '14px',
            fontWeight: '600',
            cursor: 'pointer',
          }}>+ Add Budget</button>
        </div>

        {/* Tabs */}
        <div style={{ 
          display: 'flex', 
          borderBottom: `1px solid ${colors.border}`,
          marginBottom: '24px',
        }}>
          {['Budgets', 'Transactions'].map((tab, i) => (
            <button key={tab} style={{
              flex: 1,
              padding: '12px',
              background: 'none',
              border: 'none',
              borderBottom: i === 0 ? `2px solid ${colors.primary}` : '2px solid transparent',
              color: i === 0 ? colors.primary : colors.textMuted,
              fontSize: '15px',
              fontWeight: '600',
              cursor: 'pointer',
            }}>{tab}</button>
          ))}
        </div>

        {/* Budget Summary */}
        <div style={{
          ...styles.card,
          background: colors.primaryLight,
          border: `1px solid ${colors.primary}20`,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div>
              <p style={{ fontSize: '13px', color: colors.textMuted, margin: '0 0 4px 0' }}>Total Budgeted</p>
              <p style={{ fontSize: '24px', fontWeight: '700', margin: 0, color: colors.text }}>$6,500</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: '13px', color: colors.textMuted, margin: '0 0 4px 0' }}>Spent</p>
              <p style={{ fontSize: '24px', fontWeight: '700', margin: 0, color: colors.warning }}>$4,153</p>
            </div>
          </div>
          <div style={{ 
            height: '8px', 
            background: 'white', 
            borderRadius: '4px',
            overflow: 'hidden',
          }}>
            <div style={{
              width: '64%',
              height: '100%',
              background: colors.primary,
              borderRadius: '4px',
            }} />
          </div>
          <p style={{ fontSize: '12px', color: colors.textMuted, margin: '8px 0 0 0' }}>
            64% spent • $2,347 remaining
          </p>
        </div>

        {/* Budget Categories */}
        <h3 style={{ ...styles.h3, marginTop: '24px', marginBottom: '16px' }}>Expense Budgets</h3>
        
        {[
          { icon: '🏠', name: 'Housing', budgeted: 2200, spent: 2200, color: '#6366f1' },
          { icon: '🛒', name: 'Groceries', budgeted: 800, spent: 623, color: '#22c55e' },
          { icon: '🚗', name: 'Transportation', budgeted: 500, spent: 312, color: '#f59e0b' },
          { icon: '🎬', name: 'Entertainment', budgeted: 300, spent: 418, color: '#ef4444' },
          { icon: '🍽️', name: 'Dining Out', budgeted: 400, spent: 285, color: '#ec4899' },
        ].map((budget, i) => (
          <div key={i} style={{ ...styles.card, marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
              <div style={{
                width: '40px',
                height: '40px',
                background: `${budget.color}15`,
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '18px',
              }}>{budget.icon}</div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: '15px', fontWeight: '600', margin: 0 }}>{budget.name}</p>
                <p style={{ fontSize: '13px', color: colors.textMuted, margin: '2px 0 0 0' }}>
                  ${budget.spent.toLocaleString()} of ${budget.budgeted.toLocaleString()}
                </p>
              </div>
              <div style={{ 
                textAlign: 'right',
                color: budget.spent > budget.budgeted ? colors.danger : colors.success,
                fontWeight: '600',
                fontSize: '14px',
              }}>
                {budget.spent > budget.budgeted ? 
                  `+$${(budget.spent - budget.budgeted).toLocaleString()}` : 
                  `$${(budget.budgeted - budget.spent).toLocaleString()} left`
                }
              </div>
            </div>
            <div style={{ 
              height: '6px', 
              background: colors.border, 
              borderRadius: '3px',
              overflow: 'hidden',
            }}>
              <div style={{
                width: `${Math.min(100, (budget.spent / budget.budgeted) * 100)}%`,
                height: '100%',
                background: budget.spent > budget.budgeted ? colors.danger : budget.color,
                borderRadius: '3px',
              }} />
            </div>
          </div>
        ))}
      </div>
    );

    // Debts Screen
    const DebtsScreen = () => (
      <div style={{ ...styles.screen, paddingTop: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h1 style={styles.h1}>Debt Payoff</h1>
          <button style={{
            padding: '10px 16px',
            background: colors.primary,
            color: 'white',
            border: 'none',
            borderRadius: '10px',
            fontSize: '14px',
            fontWeight: '600',
            cursor: 'pointer',
          }}>+ Add Debt</button>
        </div>

        {/* Debt Overview */}
        <div style={{
          ...styles.card,
          background: `linear-gradient(135deg, #1e293b 0%, #334155 100%)`,
          color: 'white',
        }}>
          <p style={{ fontSize: '13px', opacity: 0.8, margin: '0 0 4px 0' }}>Total Debt</p>
          <h2 style={{ fontSize: '32px', fontWeight: '700', margin: '0 0 16px 0' }}>$12,450</h2>
          
          <div style={{ display: 'flex', gap: '16px' }}>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: '12px', opacity: 0.7, margin: '0 0 4px 0' }}>Monthly min</p>
              <p style={{ fontSize: '16px', fontWeight: '600', margin: 0 }}>$485</p>
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: '12px', opacity: 0.7, margin: '0 0 4px 0' }}>Debt-free by</p>
              <p style={{ fontSize: '16px', fontWeight: '600', margin: 0 }}>Mar 2027</p>
            </div>
          </div>
        </div>

        {/* Strategy selector */}
        <div style={{ margin: '20px 0' }}>
          <label style={styles.label}>Payoff Strategy</label>
          <div style={{ 
            display: 'flex', 
            background: colors.surface, 
            borderRadius: '10px', 
            padding: '4px',
            border: `1px solid ${colors.border}`,
          }}>
            <button style={{
              flex: 1,
              padding: '10px',
              background: colors.primary,
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: '600',
            }}>Avalanche</button>
            <button style={{
              flex: 1,
              padding: '10px',
              background: 'transparent',
              color: colors.textMuted,
              border: 'none',
              fontSize: '13px',
              fontWeight: '500',
            }}>Snowball</button>
          </div>
        </div>

        {/* Debt list */}
        {[
          { name: 'Chase Sapphire', type: 'Credit Card', balance: 4200, rate: 24.99, minPayment: 120, owner: 'A' },
          { name: 'Student Loan', type: 'Loan', balance: 8250, rate: 5.5, minPayment: 365, owner: 'S' },
        ].map((debt, i) => (
          <div key={i} style={{ ...styles.card, marginBottom: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h3 style={{ ...styles.h3, marginBottom: 0 }}>{debt.name}</h3>
                  <div style={{
                    width: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    background: debt.owner === 'A' ? colors.primary : colors.secondary,
                    color: 'white',
                    fontSize: '10px',
                    fontWeight: '600',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>{debt.owner}</div>
                </div>
                <p style={{ fontSize: '13px', color: colors.textMuted, margin: '4px 0 0 0' }}>{debt.type}</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ fontSize: '20px', fontWeight: '700', margin: 0 }}>${debt.balance.toLocaleString()}</p>
                <p style={{ fontSize: '12px', color: colors.danger, margin: '2px 0 0 0' }}>{debt.rate}% APR</p>
              </div>
            </div>
            
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between',
              padding: '12px',
              background: colors.background,
              borderRadius: '10px',
            }}>
              <div>
                <p style={{ fontSize: '11px', color: colors.textMuted, margin: '0 0 2px 0' }}>Min Payment</p>
                <p style={{ fontSize: '14px', fontWeight: '600', margin: 0 }}>${debt.minPayment}/mo</p>
              </div>
              <button style={{
                padding: '8px 16px',
                background: colors.primary,
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer',
              }}>Make Payment</button>
            </div>
          </div>
        ))}
      </div>
    );

    // Savings Screen  
    const SavingsScreen = () => (
      <div style={{ ...styles.screen, paddingTop: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h1 style={styles.h1}>Savings Goals</h1>
          <button style={{
            padding: '10px 16px',
            background: colors.primary,
            color: 'white',
            border: 'none',
            borderRadius: '10px',
            fontSize: '14px',
            fontWeight: '600',
            cursor: 'pointer',
          }}>+ New Goal</button>
        </div>

        {/* Total Savings */}
        <div style={{
          ...styles.card,
          background: `linear-gradient(135deg, ${colors.success} 0%, #16a34a 100%)`,
          color: 'white',
        }}>
          <p style={{ fontSize: '13px', opacity: 0.9, margin: '0 0 4px 0' }}>Total Saved</p>
          <h2 style={{ fontSize: '32px', fontWeight: '700', margin: '0 0 8px 0' }}>$5,200</h2>
          <p style={{ fontSize: '14px', opacity: 0.9, margin: 0 }}>across 3 goals</p>
        </div>

        {/* Goals */}
        {[
          { name: 'Emergency Fund', target: 10000, current: 5200, icon: '🛡️', shared: true, deadline: 'Jun 2026' },
          { name: 'Hawaii Vacation', target: 5000, current: 1750, icon: '🏝️', shared: true, deadline: 'Aug 2026' },
          { name: 'New Laptop', target: 2000, current: 800, icon: '💻', shared: false, owner: 'A', deadline: 'Mar 2026' },
        ].map((goal, i) => (
          <div key={i} style={{ ...styles.card, marginTop: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{
                  width: '48px',
                  height: '48px',
                  background: colors.primaryLight,
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '24px',
                }}>{goal.icon}</div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h3 style={{ ...styles.h3, marginBottom: 0 }}>{goal.name}</h3>
                    {goal.shared ? (
                      <span style={{ fontSize: '10px', background: colors.primaryLight, color: colors.primary, padding: '2px 6px', borderRadius: '4px', fontWeight: '600' }}>SHARED</span>
                    ) : (
                      <div style={{
                        width: '18px',
                        height: '18px',
                        borderRadius: '50%',
                        background: colors.primary,
                        color: 'white',
                        fontSize: '9px',
                        fontWeight: '600',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}>{goal.owner}</div>
                    )}
                  </div>
                  <p style={{ fontSize: '12px', color: colors.textMuted, margin: '4px 0 0 0' }}>Target: {goal.deadline}</p>
                </div>
              </div>
            </div>

            <div style={{ marginBottom: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontSize: '20px', fontWeight: '700' }}>${goal.current.toLocaleString()}</span>
                <span style={{ fontSize: '14px', color: colors.textMuted }}>${goal.target.toLocaleString()}</span>
              </div>
              <div style={{ 
                height: '10px', 
                background: colors.border, 
                borderRadius: '5px',
                overflow: 'hidden',
              }}>
                <div style={{
                  width: `${(goal.current / goal.target) * 100}%`,
                  height: '100%',
                  background: `linear-gradient(90deg, ${colors.primary} 0%, ${colors.success} 100%)`,
                  borderRadius: '5px',
                }} />
              </div>
            </div>

            <button style={{
              width: '100%',
              padding: '12px',
              background: colors.primaryLight,
              color: colors.primary,
              border: 'none',
              borderRadius: '10px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
            }}>+ Add Funds</button>
          </div>
        ))}
      </div>
    );

    // Settings Screen
    const SettingsScreen = () => (
      <div style={{ ...styles.screen, paddingTop: '20px' }}>
        <h1 style={{ ...styles.h1, marginBottom: '24px' }}>Settings</h1>

        {/* Household Card */}
        <div style={{ ...styles.card, background: colors.primaryLight, border: `1px solid ${colors.primary}30` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
            <PartnerAvatars size={48} />
            <div>
              <h3 style={{ ...styles.h3, marginBottom: '2px' }}>The Household</h3>
              <p style={{ fontSize: '13px', color: colors.textMuted, margin: 0 }}>2 members</p>
            </div>
          </div>
          
          <div style={{ 
            padding: '12px', 
            background: 'white', 
            borderRadius: '10px',
            marginBottom: '12px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  background: colors.primary,
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: '600',
                }}>A</div>
                <div>
                  <p style={{ fontSize: '14px', fontWeight: '500', margin: 0 }}>Alfred</p>
                  <p style={{ fontSize: '12px', color: colors.textMuted, margin: 0 }}>Owner</p>
                </div>
              </div>
              <span style={{ fontSize: '12px', color: colors.success, fontWeight: '500' }}>You</span>
            </div>
          </div>
          
          <div style={{ 
            padding: '12px', 
            background: 'white', 
            borderRadius: '10px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  background: colors.secondary,
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: '600',
                }}>S</div>
                <div>
                  <p style={{ fontSize: '14px', fontWeight: '500', margin: 0 }}>Sarah</p>
                  <p style={{ fontSize: '12px', color: colors.textMuted, margin: 0 }}>Member</p>
                </div>
              </div>
            </div>
          </div>

          <button style={{
            width: '100%',
            marginTop: '16px',
            padding: '12px',
            background: 'white',
            color: colors.primary,
            border: `1px solid ${colors.primary}`,
            borderRadius: '10px',
            fontSize: '14px',
            fontWeight: '600',
            cursor: 'pointer',
          }}>Invite Another Member</button>
        </div>

        {/* Settings List */}
        <div style={{ marginTop: '24px' }}>
          {[
            { icon: '🔗', label: 'Link Bank Account', desc: 'Connect your accounts' },
            { icon: '🏷️', label: 'Manage Categories', desc: 'Customize spending categories' },
            { icon: '🔔', label: 'Notifications', desc: 'Alerts and reminders' },
            { icon: '🔒', label: 'Security', desc: 'Password and authentication' },
            { icon: '💳', label: 'Subscription', desc: 'Free plan' },
          ].map((item, i) => (
            <button key={i} style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              padding: '16px',
              background: colors.surface,
              border: 'none',
              borderRadius: '12px',
              marginBottom: '8px',
              cursor: 'pointer',
              textAlign: 'left',
            }}>
              <div style={{
                width: '40px',
                height: '40px',
                background: colors.background,
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '18px',
              }}>{item.icon}</div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: '15px', fontWeight: '500', margin: 0, color: colors.text }}>{item.label}</p>
                <p style={{ fontSize: '13px', color: colors.textMuted, margin: '2px 0 0 0' }}>{item.desc}</p>
              </div>
              <span style={{ color: colors.textMuted }}>→</span>
            </button>
          ))}
        </div>

        <button style={{
          width: '100%',
          marginTop: '24px',
          padding: '16px',
          background: '#fef2f2',
          color: colors.danger,
          border: 'none',
          borderRadius: '12px',
          fontSize: '15px',
          fontWeight: '600',
          cursor: 'pointer',
        }}>Log Out</button>
      </div>
    );

    // Navigation
    const navItems = [
      { id: 'dashboard', label: 'Home', icon: '🏠' },
      { id: 'budget', label: 'Budget', icon: '📊' },
      { id: 'debts', label: 'Debts', icon: '💳' },
      { id: 'savings', label: 'Savings', icon: '🎯' },
      { id: 'settings', label: 'Settings', icon: '⚙️' },
    ];

    const renderScreen = () => {
      switch(activeTab) {
        case 'dashboard': return <DashboardScreen />;
        case 'budget': return <BudgetScreen />;
        case 'debts': return <DebtsScreen />;
        case 'savings': return <SavingsScreen />;
        case 'settings': return <SettingsScreen />;
        default: return <DashboardScreen />;
      }
    };

    return (
      <>
        {renderScreen()}
        
        {/* Bottom Navigation */}
        <div style={styles.bottomNav}>
          {navItems.map((item) => (
            <button 
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              style={{
                ...styles.navItem,
              }}
            >
              <span style={{ 
                fontSize: '22px',
                filter: activeTab === item.id ? 'none' : 'grayscale(100%)',
                opacity: activeTab === item.id ? 1 : 0.5,
              }}>{item.icon}</span>
              <span style={{ 
                ...styles.navLabel,
                color: activeTab === item.id ? colors.primary : colors.textMuted,
                fontWeight: activeTab === item.id ? '600' : '500',
              }}>{item.label}</span>
            </button>
          ))}
        </div>
      </>
    );
  };

  // ============ RENDER ============
  return (
    <div style={{ 
      minHeight: '100vh', 
      background: '#1a1a1a',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 20px',
    }}>
      <div style={styles.container}>
        {/* Status Bar */}
        <div style={styles.statusBar}>
          <span>9:41</span>
          <div style={{ display: 'flex', gap: '4px' }}>
            <span>📶</span>
            <span>🔋</span>
          </div>
        </div>

        {/* Screen Content */}
        {currentScreen === 'welcome' && <WelcomeScreen />}
        {currentScreen === 'login' && <LoginScreen />}
        {currentScreen === 'register' && <RegistrationScreen />}
        {currentScreen === 'app' && <MainApp />}

        {/* Home Indicator */}
        <div style={{
          position: 'absolute',
          bottom: '8px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '134px',
          height: '5px',
          background: currentScreen === 'app' ? '#e5e5e5' : '#333',
          borderRadius: '3px',
        }} />
      </div>

      {/* Screen selector */}
      <div style={{
        position: 'fixed',
        bottom: '20px',
        left: '20px',
        background: 'white',
        borderRadius: '12px',
        padding: '12px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
      }}>
        <p style={{ fontSize: '12px', fontWeight: '600', margin: '0 0 8px 0', color: '#666' }}>SCREENS</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {[
            { id: 'welcome', label: 'Welcome' },
            { id: 'login', label: 'Login' },
            { id: 'register', label: 'Registration' },
            { id: 'app', label: 'Main App' },
          ].map((screen) => (
            <button 
              key={screen.id}
              onClick={() => setCurrentScreen(screen.id)}
              style={{
                padding: '8px 12px',
                background: currentScreen === screen.id ? '#1a5f4a' : '#f3f4f6',
                color: currentScreen === screen.id ? 'white' : '#333',
                border: 'none',
                borderRadius: '6px',
                fontSize: '13px',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >{screen.label}</button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default App;
