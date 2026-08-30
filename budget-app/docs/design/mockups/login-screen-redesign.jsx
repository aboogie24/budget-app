import React, { useState } from 'react';
import { Mail, Lock, Eye, EyeOff, Heart } from 'lucide-react';

const CoupleFlowLogo = ({ width = 80 }) => (
  <svg width={width} height={width} viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Left circle - Purple */}
    <circle cx="28" cy="40" r="24" fill="#a855f7" opacity="0.9" />
    {/* Right circle - Pink */}
    <circle cx="52" cy="40" r="24" fill="#ec4899" opacity="0.9" />
    {/* Overlap blend area */}
    <circle cx="28" cy="40" r="24" fill="#a855f7" opacity="0.3" />
  </svg>
);

const GoogleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="currentColor" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="currentColor" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="currentColor" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="currentColor" />
  </svg>
);

const AppleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M17.05 13.5c-.91 2.18-.39 4.18 1.64 6.29.48.51.84 1.01.84 1.44 0 .77-.74 1.2-1.74 1.2-.99 0-1.76-.4-2.24-.89-.48-.5-1.02-1.06-1.98-1.06-.96 0-1.5.56-1.98 1.06-.48.49-1.25.89-2.24.89-1 0-1.74-.43-1.74-1.2 0-.43.36-.93.84-1.44 2.03-2.11 2.55-4.11 1.64-6.29-.67-1.5-.88-2.14-.88-3.5 0-2.84 2.36-5 5.25-5 .73 0 1.41.18 2.09.5.68-.32 1.36-.5 2.09-.5 2.89 0 5.25 2.16 5.25 5 0 1.36-.21 2 -.88 3.5z"/>
    <path d="M12 1.5c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2z"/>
  </svg>
);

export default function LoginScreenRedesign() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const phoneFrameStyles = {
    container: {
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
      backgroundColor: '#0a0a0a',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      padding: '20px',
    },
    phoneFrame: {
      width: '393px',
      height: '852px',
      borderRadius: '40px',
      border: '3px solid #2a2a2a',
      background: 'linear-gradient(180deg, #0f0a1e 0%, #1a1035 50%, #0f0a1e 100%)',
      overflow: 'hidden',
      boxShadow: '0 20px 60px rgba(0, 0, 0, 0.8)',
      display: 'flex',
      flexDirection: 'column',
      position: 'relative',
    },
    statusBar: {
      height: '44px',
      background: 'rgba(0, 0, 0, 0.3)',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingLeft: '16px',
      paddingRight: '16px',
      fontSize: '14px',
      fontWeight: '600',
      color: '#ffffff',
      borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
    },
    content: {
      flex: 1,
      overflow: 'auto',
      display: 'flex',
      flexDirection: 'column',
      padding: '32px 24px',
      position: 'relative',
    },
    decorativeCircle1: {
      position: 'absolute',
      width: '200px',
      height: '200px',
      background: 'radial-gradient(circle, #a855f7 0%, transparent 70%)',
      borderRadius: '50%',
      opacity: '0.08',
      top: '-50px',
      right: '-50px',
      filter: 'blur(40px)',
      pointerEvents: 'none',
    },
    decorativeCircle2: {
      position: 'absolute',
      width: '120px',
      height: '120px',
      background: 'radial-gradient(circle, #ec4899 0%, transparent 70%)',
      borderRadius: '50%',
      opacity: '0.06',
      bottom: '100px',
      left: '-30px',
      filter: 'blur(30px)',
      pointerEvents: 'none',
    },
    logoContainer: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      marginBottom: '48px',
      position: 'relative',
      zIndex: 1,
    },
    logoSvg: {
      marginBottom: '16px',
    },
    branding: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '8px',
      marginBottom: '12px',
    },
    coupleText: {
      fontSize: '32px',
      fontWeight: '700',
      color: '#a855f7',
    },
    flowText: {
      fontSize: '32px',
      fontWeight: '700',
      color: '#ec4899',
    },
    tagline: {
      fontSize: '12px',
      fontWeight: '600',
      color: '#a855f7',
      letterSpacing: '0.5px',
    },
    welcomeSection: {
      marginBottom: '32px',
      position: 'relative',
      zIndex: 1,
    },
    welcomeTitle: {
      fontSize: '26px',
      fontWeight: '700',
      color: '#ffffff',
      marginBottom: '8px',
      letterSpacing: '-0.5px',
    },
    welcomeSubtitle: {
      fontSize: '14px',
      color: '#9ca3af',
      fontWeight: '500',
    },
    form: {
      display: 'flex',
      flexDirection: 'column',
      gap: '16px',
      marginBottom: '24px',
      position: 'relative',
      zIndex: 1,
    },
    inputWrapper: {
      position: 'relative',
      display: 'flex',
      alignItems: 'center',
    },
    inputIcon: {
      position: 'absolute',
      left: '14px',
      color: '#94a3b8',
      pointerEvents: 'none',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2,
    },
    input: {
      width: '100%',
      paddingLeft: '44px',
      paddingRight: '14px',
      paddingTop: '14px',
      paddingBottom: '14px',
      backgroundColor: 'rgba(255, 255, 255, 0.06)',
      border: '1px solid rgba(255, 255, 255, 0.08)',
      borderRadius: '12px',
      color: '#ffffff',
      fontSize: '15px',
      fontFamily: 'inherit',
      transition: 'all 0.2s ease',
      outline: 'none',
    },
    inputFocus: {
      backgroundColor: 'rgba(255, 255, 255, 0.08)',
      borderColor: 'rgba(168, 85, 247, 0.3)',
      boxShadow: '0 0 0 3px rgba(168, 85, 247, 0.1)',
    },
    passwordToggle: {
      position: 'absolute',
      right: '14px',
      background: 'none',
      border: 'none',
      color: '#94a3b8',
      cursor: 'pointer',
      padding: '4px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 3,
      transition: 'color 0.2s ease',
    },
    forgotPassword: {
      textAlign: 'right',
      marginBottom: '8px',
    },
    forgotLink: {
      fontSize: '12px',
      color: '#a855f7',
      textDecoration: 'none',
      fontWeight: '600',
      cursor: 'pointer',
      transition: 'color 0.2s ease',
    },
    loginButton: {
      width: '100%',
      padding: '16px',
      background: 'linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)',
      border: 'none',
      borderRadius: '14px',
      color: '#ffffff',
      fontSize: '16px',
      fontWeight: '800',
      cursor: 'pointer',
      transition: 'all 0.3s ease',
      boxShadow: '0 8px 24px rgba(168, 85, 247, 0.3)',
      position: 'relative',
      zIndex: 1,
    },
    loginButtonHover: {
      transform: 'translateY(-2px)',
      boxShadow: '0 12px 32px rgba(168, 85, 247, 0.4)',
    },
    divider: {
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      margin: '24px 0',
      position: 'relative',
      zIndex: 1,
    },
    dividerLine: {
      flex: 1,
      height: '1px',
      backgroundColor: 'rgba(100, 116, 139, 0.3)',
    },
    dividerText: {
      fontSize: '12px',
      color: '#64748b',
      fontWeight: '500',
      whiteSpace: 'nowrap',
    },
    oauthContainer: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: '12px',
      marginBottom: '24px',
      position: 'relative',
      zIndex: 1,
    },
    oauthButton: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '8px',
      padding: '14px',
      backgroundColor: 'rgba(255, 255, 255, 0.04)',
      border: '1px solid rgba(255, 255, 255, 0.08)',
      borderRadius: '12px',
      color: '#ffffff',
      fontSize: '14px',
      fontWeight: '600',
      cursor: 'pointer',
      transition: 'all 0.2s ease',
      fontFamily: 'inherit',
    },
    oauthButtonHover: {
      backgroundColor: 'rgba(255, 255, 255, 0.08)',
      borderColor: 'rgba(168, 85, 247, 0.3)',
    },
    registerSection: {
      textAlign: 'center',
      fontSize: '14px',
      color: '#9ca3af',
      position: 'relative',
      zIndex: 1,
      marginTop: 'auto',
      paddingBottom: '24px',
    },
    signupLink: {
      color: '#c084fc',
      fontWeight: '700',
      textDecoration: 'none',
      cursor: 'pointer',
      transition: 'color 0.2s ease',
    },
  };

  const [emailFocus, setEmailFocus] = useState(false);
  const [passwordFocus, setPasswordFocus] = useState(false);
  const [loginHover, setLoginHover] = useState(false);
  const [googleHover, setGoogleHover] = useState(false);
  const [appleHover, setAppleHover] = useState(false);

  return (
    <div style={phoneFrameStyles.container}>
      <div style={phoneFrameStyles.phoneFrame}>
        {/* Decorative circles */}
        <div style={phoneFrameStyles.decorativeCircle1} />
        <div style={phoneFrameStyles.decorativeCircle2} />

        {/* Status Bar */}
        <div style={phoneFrameStyles.statusBar}>
          <span />
          <span>4:03</span>
          <span />
        </div>

        {/* Content */}
        <div style={phoneFrameStyles.content}>
          {/* Logo Section */}
          <div style={phoneFrameStyles.logoContainer}>
            <div style={phoneFrameStyles.logoSvg}>
              <CoupleFlowLogo width={80} />
            </div>

            <div style={phoneFrameStyles.branding}>
              <span style={phoneFrameStyles.coupleText}>Couple</span>
              <Heart width={28} height={28} fill="#ec4899" color="#ec4899" />
              <span style={phoneFrameStyles.flowText}>Flow</span>
            </div>

            <div style={phoneFrameStyles.tagline}>
              For couples & shared goals
            </div>
          </div>

          {/* Welcome Section */}
          <div style={phoneFrameStyles.welcomeSection}>
            <h1 style={phoneFrameStyles.welcomeTitle}>Welcome back</h1>
            <p style={phoneFrameStyles.welcomeSubtitle}>
              Log in to your financial journey.
            </p>
          </div>

          {/* Form */}
          <form style={phoneFrameStyles.form}>
            {/* Email Input */}
            <div style={phoneFrameStyles.inputWrapper}>
              <div style={phoneFrameStyles.inputIcon}>
                <Mail width={20} height={20} />
              </div>
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onFocus={() => setEmailFocus(true)}
                onBlur={() => setEmailFocus(false)}
                style={{
                  ...phoneFrameStyles.input,
                  ...(emailFocus ? phoneFrameStyles.inputFocus : {}),
                }}
              />
            </div>

            {/* Password Input */}
            <div style={phoneFrameStyles.inputWrapper}>
              <div style={phoneFrameStyles.inputIcon}>
                <Lock width={20} height={20} />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onFocus={() => setPasswordFocus(true)}
                onBlur={() => setPasswordFocus(false)}
                style={{
                  ...phoneFrameStyles.input,
                  paddingRight: '44px',
                  ...(passwordFocus ? phoneFrameStyles.inputFocus : {}),
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  ...phoneFrameStyles.passwordToggle,
                  color: showPassword ? '#a855f7' : '#94a3b8',
                }}
              >
                {showPassword ? (
                  <EyeOff width={20} height={20} />
                ) : (
                  <Eye width={20} height={20} />
                )}
              </button>
            </div>

            {/* Forgot Password Link */}
            <div style={phoneFrameStyles.forgotPassword}>
              <a
                href="#"
                onClick={(e) => e.preventDefault()}
                style={{
                  ...phoneFrameStyles.forgotLink,
                  opacity: 0.8,
                  ':hover': { opacity: 1 },
                }}
                onMouseEnter={(e) => (e.target.style.opacity = '1')}
                onMouseLeave={(e) => (e.target.style.opacity = '0.8')}
              >
                Forgot password?
              </a>
            </div>

            {/* Log In Button */}
            <button
              type="submit"
              onClick={(e) => e.preventDefault()}
              style={{
                ...phoneFrameStyles.loginButton,
                ...(loginHover ? phoneFrameStyles.loginButtonHover : {}),
              }}
              onMouseEnter={() => setLoginHover(true)}
              onMouseLeave={() => setLoginHover(false)}
            >
              Log In
            </button>
          </form>

          {/* Divider */}
          <div style={phoneFrameStyles.divider}>
            <div style={phoneFrameStyles.dividerLine} />
            <span style={phoneFrameStyles.dividerText}>Or continue with</span>
            <div style={phoneFrameStyles.dividerLine} />
          </div>

          {/* OAuth Buttons */}
          <div style={phoneFrameStyles.oauthContainer}>
            <button
              type="button"
              onClick={(e) => e.preventDefault()}
              style={{
                ...phoneFrameStyles.oauthButton,
                ...(googleHover ? phoneFrameStyles.oauthButtonHover : {}),
              }}
              onMouseEnter={() => setGoogleHover(true)}
              onMouseLeave={() => setGoogleHover(false)}
            >
              <GoogleIcon />
              <span>Google</span>
            </button>
            <button
              type="button"
              onClick={(e) => e.preventDefault()}
              style={{
                ...phoneFrameStyles.oauthButton,
                ...(appleHover ? phoneFrameStyles.oauthButtonHover : {}),
              }}
              onMouseEnter={() => setAppleHover(true)}
              onMouseLeave={() => setAppleHover(false)}
            >
              <AppleIcon />
              <span>Apple</span>
            </button>
          </div>

          {/* Sign Up Link */}
          <div style={phoneFrameStyles.registerSection}>
            Don't have an account?{' '}
            <a
              href="#"
              onClick={(e) => e.preventDefault()}
              style={phoneFrameStyles.signupLink}
              onMouseEnter={(e) => (e.target.style.color = '#d8b4fe')}
              onMouseLeave={(e) => (e.target.style.color = '#c084fc')}
            >
              Sign up
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
