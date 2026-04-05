import React, { useState } from 'react';
import {
  Heart,
  ChevronLeft,
  Mail,
  Smartphone,
  Lock,
  Home,
  Flame,
  Shield,
  TrendingUp,
  Star,
  ArrowRight,
} from 'lucide-react';

const OnboardingScreen = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [email, setEmail] = useState('');
  const [selectedBank, setSelectedBank] = useState(null);

  const banks = [
    { id: 'chase', name: 'Chase', logo: '🏦' },
    { id: 'boa', name: 'Bank of America', logo: '🏢' },
    { id: 'wells', name: 'Wells Fargo', logo: '🏛️' },
    { id: 'other', name: 'Other Bank', logo: '💳' },
  ];

  const pathSteps = [
    {
      id: 1,
      title: 'Foundation',
      description: 'Set up budgets & emergency fund',
      icon: Home,
      color: '#a855f7',
    },
    {
      id: 2,
      title: 'Attack Debt',
      description: 'Eliminate high-interest debt',
      icon: Flame,
      color: '#ec4899',
    },
    {
      id: 3,
      title: 'Build Security',
      description: '3-6 month safety net',
      icon: Shield,
      color: '#10b981',
    },
    {
      id: 4,
      title: 'Grow Wealth',
      description: 'Invest & build assets',
      icon: TrendingUp,
      color: '#a855f7',
    },
    {
      id: 5,
      title: 'Dream Big',
      description: 'Plan your dream goals',
      icon: Star,
      color: '#ec4899',
    },
  ];

  const handleNext = () => {
    if (currentStep < 3) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'space-between',
              height: '100%',
              paddingBottom: '40px',
            }}
          >
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ textAlign: 'center' }}>
                <div
                  style={{
                    fontSize: '48px',
                    marginBottom: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '12px',
                  }}
                >
                  <span style={{ color: '#a855f7', fontWeight: '700' }}>Couple</span>
                  <Heart size={40} fill="#ec4899" color="#ec4899" />
                  <span style={{ color: '#ec4899', fontWeight: '700' }}>Flow</span>
                </div>
              </div>
            </div>

            <div style={{ textAlign: 'center', marginBottom: '48px' }}>
              <div
                style={{
                  width: '200px',
                  height: '120px',
                  margin: '0 auto 32px',
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    width: '100px',
                    height: '100px',
                    borderRadius: '50%',
                    backgroundColor: '#a855f7',
                    opacity: 0.3,
                    left: '0',
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    width: '100px',
                    height: '100px',
                    borderRadius: '50%',
                    backgroundColor: '#ec4899',
                    opacity: 0.3,
                    right: '0',
                  }}
                />
              </div>

              <h1
                style={{
                  fontSize: '28px',
                  fontWeight: '700',
                  color: '#ffffff',
                  margin: '0 0 12px 0',
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI"',
                }}
              >
                Build your financial future, together
              </h1>
              <p
                style={{
                  fontSize: '14px',
                  color: '#b0b0b0',
                  margin: '0',
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI"',
                }}
              >
                Take control of your finances as a couple
              </p>
            </div>

            <button
              onClick={handleNext}
              style={{
                width: '100%',
                padding: '14px 24px',
                borderRadius: '12px',
                border: 'none',
                background: 'linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)',
                color: '#ffffff',
                fontSize: '16px',
                fontWeight: '600',
                cursor: 'pointer',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI"',
              }}
            >
              Get Started
            </button>
          </div>
        );

      case 1:
        return (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'space-between',
              height: '100%',
              paddingBottom: '40px',
            }}
          >
            <div>
              <h2
                style={{
                  fontSize: '24px',
                  fontWeight: '700',
                  color: '#ffffff',
                  margin: '0 0 32px 0',
                  textAlign: 'center',
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI"',
                }}
              >
                Invite Your Partner
              </h2>

              <div
                style={{
                  width: '200px',
                  height: '120px',
                  margin: '0 auto 32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '24px',
                }}
              >
                <Smartphone size={48} color="#a855f7" />
                <ArrowRight size={32} color="#7c3aed" style={{ opacity: 0.6 }} />
                <Smartphone size={48} color="#ec4899" />
              </div>
            </div>

            <div style={{ width: '100%', marginBottom: '32px' }}>
              <label
                style={{
                  display: 'block',
                  fontSize: '12px',
                  color: '#9ca3af',
                  marginBottom: '8px',
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI"',
                }}
              >
                Partner's Email or Phone
              </label>
              <input
                type="text"
                placeholder="partner@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  borderRadius: '8px',
                  border: '1px solid #3a3a4a',
                  backgroundColor: '#1a1a2e',
                  color: '#ffffff',
                  fontSize: '14px',
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI"',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ width: '100%' }}>
              <button
                onClick={handleNext}
                style={{
                  width: '100%',
                  padding: '14px 24px',
                  borderRadius: '12px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)',
                  color: '#ffffff',
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  marginBottom: '12px',
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI"',
                }}
              >
                Send Invite
              </button>
              <button
                onClick={handleNext}
                style={{
                  width: '100%',
                  padding: '14px 24px',
                  borderRadius: '12px',
                  border: 'none',
                  background: 'transparent',
                  color: '#a855f7',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI"',
                }}
              >
                Skip for now
              </button>
            </div>
          </div>
        );

      case 2:
        return (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'space-between',
              height: '100%',
              paddingBottom: '40px',
            }}
          >
            <div style={{ width: '100%' }}>
              <h2
                style={{
                  fontSize: '24px',
                  fontWeight: '700',
                  color: '#ffffff',
                  margin: '0 0 8px 0',
                  textAlign: 'center',
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI"',
                }}
              >
                Link Your Accounts
              </h2>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px',
                  marginBottom: '32px',
                }}
              >
                <span
                  style={{
                    fontSize: '12px',
                    color: '#9ca3af',
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI"',
                  }}
                >
                  Powered by Plaid
                </span>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '16px',
                  marginBottom: '32px',
                }}
              >
                {banks.map((bank) => (
                  <button
                    key={bank.id}
                    onClick={() => setSelectedBank(bank.id)}
                    style={{
                      padding: '20px 16px',
                      borderRadius: '12px',
                      border: selectedBank === bank.id ? '2px solid #a855f7' : '1px solid #3a3a4a',
                      backgroundColor: selectedBank === bank.id ? '#1a1a2e' : '#1a1a2e',
                      color: '#ffffff',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '12px',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <span style={{ fontSize: '28px' }}>{bank.logo}</span>
                    <span
                      style={{
                        fontSize: '12px',
                        fontWeight: '500',
                        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI"',
                      }}
                    >
                      {bank.name}
                    </span>
                  </button>
                ))}
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  marginBottom: '32px',
                  padding: '12px 16px',
                  backgroundColor: '#1a1a2e',
                  borderRadius: '8px',
                }}
              >
                <Lock size={14} color="#10b981" />
                <span
                  style={{
                    fontSize: '12px',
                    color: '#10b981',
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI"',
                  }}
                >
                  We use bank-level encryption
                </span>
              </div>
            </div>

            <div style={{ width: '100%' }}>
              <button
                onClick={handleNext}
                style={{
                  width: '100%',
                  padding: '14px 24px',
                  borderRadius: '12px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)',
                  color: '#ffffff',
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  marginBottom: '12px',
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI"',
                }}
              >
                Connect
              </button>
              <button
                onClick={handleNext}
                style={{
                  width: '100%',
                  padding: '14px 24px',
                  borderRadius: '12px',
                  border: 'none',
                  background: 'transparent',
                  color: '#a855f7',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI"',
                }}
              >
                Skip
              </button>
            </div>
          </div>
        );

      case 3:
        return (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'space-between',
              height: '100%',
              paddingBottom: '40px',
            }}
          >
            <div style={{ width: '100%' }}>
              <h2
                style={{
                  fontSize: '24px',
                  fontWeight: '700',
                  color: '#ffffff',
                  margin: '0 0 8px 0',
                  textAlign: 'center',
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI"',
                }}
              >
                Start Your CoupleFlow Journey
              </h2>
              <p
                style={{
                  fontSize: '12px',
                  color: '#9ca3af',
                  margin: '0 0 32px 0',
                  textAlign: 'center',
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI"',
                }}
              >
                Our AI will assess where you are
              </p>

              <div style={{ width: '100%', marginBottom: '24px' }}>
                {pathSteps.map((step, index) => {
                  const IconComponent = step.icon;
                  return (
                    <div key={step.id} style={{ display: 'flex', gap: '16px', marginBottom: '20px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <div
                          style={{
                            width: '40px',
                            height: '40px',
                            borderRadius: '50%',
                            backgroundColor: step.color,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            opacity: 0.2,
                          }}
                        >
                          <IconComponent size={20} color={step.color} />
                        </div>
                        {index < pathSteps.length - 1 && (
                          <div
                            style={{
                              width: '2px',
                              height: '24px',
                              backgroundColor: '#3a3a4a',
                              margin: '8px 0',
                            }}
                          />
                        )}
                      </div>
                      <div style={{ flex: 1, paddingTop: '4px' }}>
                        <h3
                          style={{
                            fontSize: '14px',
                            fontWeight: '600',
                            color: '#ffffff',
                            margin: '0 0 4px 0',
                            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI"',
                          }}
                        >
                          {step.title}
                        </h3>
                        <p
                          style={{
                            fontSize: '12px',
                            color: '#9ca3af',
                            margin: '0',
                            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI"',
                          }}
                        >
                          {step.description}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <button
              onClick={handleNext}
              style={{
                width: '100%',
                padding: '14px 24px',
                borderRadius: '12px',
                border: 'none',
                background: 'linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)',
                color: '#ffffff',
                fontSize: '16px',
                fontWeight: '600',
                cursor: 'pointer',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI"',
              }}
            >
              Let's Go!
            </button>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div
      style={{
        width: '100%',
        height: '100vh',
        backgroundColor: '#0f0a1e',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI"',
      }}
    >
      <div
        style={{
          width: '393px',
          height: '852px',
          borderRadius: '40px',
          border: '3px solid #2a2a2a',
          backgroundColor: '#0f0a1e',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.8)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 16px',
            backgroundColor: '#0f0a1e',
            borderBottom: '1px solid #2a2a2a',
            height: '44px',
          }}
        >
          <span
            style={{
              fontSize: '14px',
              fontWeight: '600',
              color: '#ffffff',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI"',
            }}
          >
            4:03
          </span>
          <span
            style={{
              fontSize: '10px',
              color: '#9ca3af',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI"',
            }}
          >
            ■ ■ ■
          </span>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            padding: '20px 0 16px 0',
          }}
        >
          {[0, 1, 2, 3].map((dot) => (
            <div
              key={dot}
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: dot === currentStep ? '#a855f7' : '#3a3a4a',
                transition: 'background-color 0.3s ease',
              }}
            />
          ))}
        </div>

        <div
          style={{
            flex: 1,
            padding: '24px 24px 0 24px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {renderStep()}
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 24px 24px 24px',
            borderTop: '1px solid #2a2a2a',
          }}
        >
          <button
            onClick={handleBack}
            disabled={currentStep === 0}
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              border: 'none',
              backgroundColor: currentStep === 0 ? '#1a1a2e' : '#2a2a3a',
              color: currentStep === 0 ? '#5a5a6a' : '#a855f7',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: currentStep === 0 ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            <ChevronLeft size={20} />
          </button>

          <div
            style={{
              fontSize: '12px',
              color: '#9ca3af',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI"',
            }}
          >
            Step {currentStep + 1} of 4
          </div>

          <button
            onClick={handleNext}
            disabled={currentStep === 3}
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              border: 'none',
              backgroundColor: currentStep === 3 ? '#1a1a2e' : '#a855f7',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: currentStep === 3 ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            <ChevronLeft size={20} style={{ transform: 'scaleX(-1)' }} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default OnboardingScreen;
