import React, { useState } from 'react';
import { User, Mail, Lock, Eye, EyeOff, ArrowRight, Heart } from 'lucide-react';

export default function RegisterScreenRedesign() {
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const passwordsMatch = formData.password && formData.confirmPassword && formData.password === formData.confirmPassword;
  const passwordStrength = formData.password.length > 0 ? 'good' : null;

  const containerStyle = {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
    background: '#0f0a1e',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    padding: '20px',
  };

  const phoneFrameStyle = {
    width: '393px',
    height: '852px',
    borderRadius: '40px',
    border: '3px solid #2a2a2a',
    background: 'linear-gradient(135deg, #0f0a1e 0%, #1a1225 100%)',
    overflow: 'hidden',
    position: 'relative',
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.8)',
  };

  const screenContentStyle = {
    height: '100%',
    overflow: 'auto',
    padding: '0',
    position: 'relative',
  };

  const statusBarStyle = {
    height: '44px',
    background: 'rgba(0, 0, 0, 0.3)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingLeft: '20px',
    paddingRight: '20px',
    fontSize: '14px',
    fontWeight: '600',
    color: '#fff',
  };

  const contentWrapperStyle = {
    padding: '0 24px',
    paddingBottom: '40px',
  };

  const decorativeCircleStyle = {
    position: 'absolute',
    top: '-100px',
    right: '-150px',
    width: '400px',
    height: '400px',
    background: 'radial-gradient(circle, rgba(168, 85, 247, 0.3) 0%, transparent 70%)',
    borderRadius: '50%',
    filter: 'blur(60px)',
    opacity: 0.15,
    pointerEvents: 'none',
  };

  const logoStyle = {
    marginTop: '60px',
    marginBottom: '32px',
    textAlign: 'center',
  };

  const logoTextStyle = {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '4px',
    fontSize: '18px',
    fontWeight: '700',
    letterSpacing: '-0.5px',
  };

  const titleSectionStyle = {
    marginBottom: '40px',
    textAlign: 'center',
  };

  const titleStyle = {
    fontSize: '28px',
    fontWeight: '800',
    color: '#fff',
    marginBottom: '8px',
    letterSpacing: '-0.5px',
  };

  const subtitleStyle = {
    fontSize: '14px',
    color: '#9ca3af',
    fontWeight: '400',
  };

  const avatarPlaceholderStyle = {
    width: '72px',
    height: '72px',
    borderRadius: '50%',
    background: 'rgba(168, 85, 247, 0.1)',
    border: '2px solid rgba(168, 85, 247, 0.25)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    margin: '0 auto 40px',
    boxShadow: '0 0 24px rgba(168, 85, 247, 0.15)',
  };

  const formFieldStyle = {
    marginBottom: '20px',
  };

  const inputContainerStyle = {
    display: 'flex',
    alignItems: 'center',
    background: 'rgba(255, 255, 255, 0.06)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '12px',
    paddingLeft: '14px',
    paddingRight: '14px',
    height: '50px',
    gap: '10px',
    transition: 'all 0.2s ease',
  };

  const inputContainerFocusStyle = {
    ...inputContainerStyle,
    borderColor: '#a855f7',
    background: 'rgba(168, 85, 247, 0.08)',
  };

  const iconStyle = {
    color: '#94a3b8',
    flexShrink: 0,
  };

  const inputStyle = {
    flex: 1,
    background: 'none',
    border: 'none',
    color: '#fff',
    fontSize: '16px',
    outline: 'none',
    fontFamily: 'inherit',
  };

  const inputPlaceholderStyle = {
    '::placeholder': {
      color: '#6b7280',
    },
  };

  const eyeButtonStyle = {
    background: 'none',
    border: 'none',
    color: '#94a3b8',
    cursor: 'pointer',
    padding: '4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  };

  const passwordStrengthStyle = {
    marginTop: '12px',
    marginBottom: '24px',
  };

  const strengthBarsStyle = {
    display: 'flex',
    gap: '6px',
    marginBottom: '8px',
  };

  const strengthBarStyle = (isFilled) => ({
    flex: 1,
    height: '4px',
    borderRadius: '2px',
    background: isFilled ? '#60a5fa' : 'rgba(255, 255, 255, 0.1)',
    transition: 'background 0.3s ease',
  });

  const strengthLabelStyle = {
    fontSize: '12px',
    color: '#60a5fa',
    fontWeight: '500',
  };

  const matchIndicatorStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '12px',
    color: passwordsMatch ? '#10b981' : '#6b7280',
    marginTop: '12px',
  };

  const matchCheckmarkStyle = {
    width: '16px',
    height: '16px',
    borderRadius: '50%',
    background: passwordsMatch ? '#10b981' : 'rgba(255, 255, 255, 0.1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '10px',
    color: '#fff',
  };

  const buttonStyle = {
    width: '100%',
    padding: '16px',
    background: 'linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)',
    border: 'none',
    borderRadius: '14px',
    color: '#fff',
    fontSize: '16px',
    fontWeight: '800',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    marginBottom: '24px',
    marginTop: '32px',
    transition: 'all 0.3s ease',
  };

  const dividerStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    margin: '32px 0',
  };

  const dividerLineStyle = {
    flex: 1,
    height: '1px',
    background: 'rgba(100, 116, 139, 0.3)',
  };

  const dividerTextStyle = {
    fontSize: '12px',
    color: '#64748b',
    fontWeight: '400',
    whiteSpace: 'nowrap',
  };

  const oauthButtonsStyle = {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '12px',
    marginBottom: '24px',
  };

  const oauthButtonStyle = {
    padding: '14px',
    background: 'rgba(255, 255, 255, 0.06)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '12px',
    color: '#fff',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    transition: 'all 0.2s ease',
  };

  const loginLinkStyle = {
    textAlign: 'center',
    fontSize: '14px',
    color: '#9ca3af',
  };

  const loginLinkBoldStyle = {
    color: '#c084fc',
    fontWeight: '700',
    cursor: 'pointer',
  };

  return (
    <div style={containerStyle}>
      <div style={phoneFrameStyle}>
        <div style={decorativeCircleStyle} />

        <div style={statusBarStyle}>
          <span style={{ opacity: 0 }}>.</span>
          <span>4:03</span>
          <span style={{ opacity: 0 }}>.</span>
        </div>

        <div style={screenContentStyle}>
          <div style={contentWrapperStyle}>
            {/* Logo */}
            <div style={logoStyle}>
              <div style={logoTextStyle}>
                <span style={{ color: '#a855f7' }}>Couple</span>
                <Heart size={16} fill="#ec4899" color="#ec4899" />
                <span style={{ color: '#ec4899' }}>Flow</span>
              </div>
            </div>

            {/* Title Section */}
            <div style={titleSectionStyle}>
              <div style={titleStyle}>Create Account</div>
              <div style={subtitleStyle}>Start your financial journey together.</div>
            </div>

            {/* Avatar Placeholder */}
            <div style={avatarPlaceholderStyle}>
              <User size={32} color="#a855f7" strokeWidth={1.5} />
            </div>

            {/* Full Name Field */}
            <div style={formFieldStyle}>
              <div style={inputContainerStyle}>
                <User size={20} style={iconStyle} />
                <input
                  type="text"
                  name="fullName"
                  placeholder="Full Name"
                  value={formData.fullName}
                  onChange={handleInputChange}
                  style={inputStyle}
                />
              </div>
            </div>

            {/* Email Field (with focus state) */}
            <div style={formFieldStyle}>
              <div style={inputContainerFocusStyle}>
                <Mail size={20} style={iconStyle} />
                <input
                  type="email"
                  name="email"
                  placeholder="Email address"
                  value={formData.email}
                  onChange={handleInputChange}
                  style={inputStyle}
                />
              </div>
            </div>

            {/* Password Field */}
            <div style={formFieldStyle}>
              <div style={inputContainerStyle}>
                <Lock size={20} style={iconStyle} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  placeholder="Password"
                  value={formData.password}
                  onChange={handleInputChange}
                  style={inputStyle}
                />
                <button
                  style={eyeButtonStyle}
                  onClick={() => setShowPassword(!showPassword)}
                  type="button"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>

              {/* Password Strength Meter */}
              {formData.password && (
                <div style={passwordStrengthStyle}>
                  <div style={strengthBarsStyle}>
                    <div style={strengthBarStyle(true)} />
                    <div style={strengthBarStyle(true)} />
                    <div style={strengthBarStyle(true)} />
                    <div style={strengthBarStyle(false)} />
                  </div>
                  <div style={strengthLabelStyle}>Good password</div>
                </div>
              )}
            </div>

            {/* Confirm Password Field */}
            <div style={formFieldStyle}>
              <div style={inputContainerStyle}>
                <Lock size={20} style={iconStyle} />
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  name="confirmPassword"
                  placeholder="Confirm Password"
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                  style={inputStyle}
                />
                <button
                  style={eyeButtonStyle}
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  type="button"
                >
                  {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>

              {/* Password Match Indicator */}
              {formData.confirmPassword && (
                <div style={matchIndicatorStyle}>
                  <div style={matchCheckmarkStyle}>
                    {passwordsMatch && '✓'}
                  </div>
                  <span>
                    {passwordsMatch ? 'Passwords match' : 'Passwords do not match'}
                  </span>
                </div>
              )}
            </div>

            {/* Continue Button */}
            <button style={buttonStyle}>
              Continue
              <ArrowRight size={18} />
            </button>

            {/* Divider */}
            <div style={dividerStyle}>
              <div style={dividerLineStyle} />
              <div style={dividerTextStyle}>Or sign up with</div>
              <div style={dividerLineStyle} />
            </div>

            {/* OAuth Buttons */}
            <div style={oauthButtonsStyle}>
              <button style={oauthButtonStyle}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 6v6m3-3H9" />
                </svg>
                Google
              </button>
              <button style={oauthButtonStyle}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17 12a5 5 0 10-10 0" />
                </svg>
                Apple
              </button>
            </div>

            {/* Login Link */}
            <div style={loginLinkStyle}>
              Already have an account?{' '}
              <span style={loginLinkBoldStyle}>Log in</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
