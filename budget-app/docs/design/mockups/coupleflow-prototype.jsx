import React, { useState, useEffect } from 'react';
import { 
  Plus, Menu, X, Home, Calendar, PiggyBank, CreditCard, 
  Users, Settings, Bell, Link2, Sparkles, ChevronRight,
  Moon, Sun, Heart, TrendingUp, ShoppingCart, Car, Utensils,
  Wifi, Check, Send, ArrowRight, Activity
} from 'lucide-react';

// Theme configurations
const themes = {
  light: {
    bg: 'bg-gradient-to-br from-purple-50 via-white to-lavender-50',
    glass: 'bg-white/60 backdrop-blur-xl border border-white/40',
    glassHover: 'hover:bg-white/80',
    text: 'text-gray-800',
    textMuted: 'text-gray-500',
    accent: 'from-purple-400 to-violet-600',
    accentSolid: 'bg-purple-500',
    cardBg: 'bg-white/70',
    input: 'bg-white/50 border-purple-200/50',
    shadow: 'shadow-lg shadow-purple-100/50',
  },
  dark: {
    bg: 'bg-gradient-to-br from-gray-900 via-purple-950 to-indigo-950',
    glass: 'bg-white/10 backdrop-blur-xl border border-white/10',
    glassHover: 'hover:bg-white/20',
    text: 'text-white',
    textMuted: 'text-gray-400',
    accent: 'from-purple-400 to-violet-500',
    accentSolid: 'bg-purple-500',
    cardBg: 'bg-white/5',
    input: 'bg-white/10 border-purple-500/30',
    shadow: 'shadow-lg shadow-purple-900/30',
  }
};

// Progress Ring Component
const ProgressRing = ({ progress, size = 120, strokeWidth = 8, label, amount, theme }) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (progress / 100) * circumference;
  
  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(147,51,234,0.1)'}
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="url(#gradient)"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-1000 ease-out"
        />
        <defs>
          <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#a855f7" />
            <stop offset="100%" stopColor="#7c3aed" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute flex flex-col items-center justify-center" style={{ width: size, height: size }}>
        <span className={`text-2xl font-bold ${themes[theme].text}`}>{progress}%</span>
      </div>
      <span className={`mt-2 text-sm font-medium ${themes[theme].text}`}>{label}</span>
      <span className={`text-xs ${themes[theme].textMuted}`}>{amount}</span>
    </div>
  );
};

// Floating Action Button
const FloatingActionButton = ({ onClick, theme }) => (
  <button
    onClick={onClick}
    className={`absolute bottom-24 left-1/2 transform -translate-x-1/2 w-14 h-14 rounded-full 
      bg-gradient-to-r ${themes[theme].accent} ${themes[theme].shadow}
      flex items-center justify-center text-white
      hover:scale-110 active:scale-95 transition-all duration-200
      ring-4 ring-purple-500/20`}
  >
    <Plus size={24} />
  </button>
);

// Quick Action Menu
const QuickActionMenu = ({ isOpen, onClose, theme }) => {
  const actions = [
    { icon: CreditCard, label: 'Expense', color: 'bg-red-400' },
    { icon: TrendingUp, label: 'Income', color: 'bg-green-400' },
    { icon: Calendar, label: 'Bill', color: 'bg-blue-400' },
    { icon: PiggyBank, label: 'Goal', color: 'bg-yellow-400' },
    { icon: Heart, label: 'Priority', color: 'bg-pink-400' },
    { icon: Activity, label: 'Note', color: 'bg-purple-400' },
  ];
  
  if (!isOpen) return null;
  
  return (
    <div className="absolute inset-0 z-50" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div className="absolute bottom-32 left-1/2 transform -translate-x-1/2 flex flex-wrap justify-center gap-3 w-64">
        {actions.map((action, i) => (
          <div
            key={action.label}
            className={`${themes[theme].glass} rounded-2xl p-4 flex flex-col items-center gap-2 
              cursor-pointer hover:scale-105 transition-all duration-200 animate-fade-in`}
            style={{ animationDelay: `${i * 50}ms` }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`${action.color} rounded-full p-2`}>
              <action.icon size={20} className="text-white" />
            </div>
            <span className={`text-xs font-medium ${themes[theme].text}`}>{action.label}</span>
          </div>
        ))}
      </div>
      <button
        onClick={onClose}
        className={`absolute bottom-24 left-1/2 transform -translate-x-1/2 w-14 h-14 rounded-full 
          bg-gradient-to-r from-gray-400 to-gray-600 ${themes[theme].shadow}
          flex items-center justify-center text-white rotate-45 transition-transform duration-300`}
      >
        <Plus size={24} />
      </button>
    </div>
  );
};

// Drawer Navigation
const DrawerNav = ({ isOpen, onClose, theme, onNavigate }) => {
  const menuItems = [
    { icon: Home, label: 'Dashboard', view: 'dashboard' },
    { icon: PiggyBank, label: 'Budgets', view: 'budgets' },
    { icon: Calendar, label: 'Calendar', view: 'calendar' },
    { icon: CreditCard, label: 'Debts', view: 'debts' },
    { icon: TrendingUp, label: 'Savings', view: 'savings' },
    { icon: Users, label: 'Shared Activity', view: 'activity' },
    { icon: Settings, label: 'Household Settings', view: 'settings' },
    { icon: Bell, label: 'Notifications', view: 'notifications' },
    { icon: Link2, label: 'Linked Accounts', view: 'accounts' },
    { icon: Sparkles, label: 'AI Insights', view: 'insights' },
  ];
  
  return (
    <>
      <div 
        className={`absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-300 z-40
          ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />
      <div 
        className={`absolute top-0 right-0 h-full w-72 ${themes[theme].glass} z-50
          transform transition-transform duration-300 ease-out
          ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="p-6">
          <div className="flex items-center justify-between mb-8">
            <h2 className={`text-xl font-bold ${themes[theme].text}`}>Menu</h2>
            <button onClick={onClose} className={themes[theme].textMuted}>
              <X size={24} />
            </button>
          </div>
          <nav className="space-y-2">
            {menuItems.map((item) => (
              <button
                key={item.label}
                onClick={() => { onNavigate(item.view); onClose(); }}
                className={`w-full flex items-center gap-3 p-3 rounded-xl ${themes[theme].glassHover} 
                  transition-colors duration-200`}
              >
                <item.icon size={20} className="text-purple-400" />
                <span className={themes[theme].text}>{item.label}</span>
              </button>
            ))}
          </nav>
        </div>
      </div>
    </>
  );
};

// Welcome Screen
const WelcomeScreen = ({ onNext, theme }) => (
  <div className="h-full flex flex-col items-center justify-center p-8 text-center">
    <div className="mb-8">
      {/* Logo */}
      <div className="relative w-24 h-24 mx-auto mb-6">
        <div className="absolute inset-0 bg-gradient-to-r from-purple-400 to-violet-600 rounded-3xl rotate-12 opacity-60" />
        <div className="absolute inset-0 bg-gradient-to-r from-purple-400 to-violet-600 rounded-3xl -rotate-6 opacity-80" />
        <div className={`absolute inset-0 ${themes[theme].glass} rounded-3xl flex items-center justify-center`}>
          <svg viewBox="0 0 48 48" className="w-12 h-12">
            <path
              d="M12 24C12 18 18 14 24 14C30 14 36 18 36 24C36 30 30 34 24 34C18 34 12 30 12 24Z"
              fill="none"
              stroke="url(#logoGrad)"
              strokeWidth="3"
              strokeLinecap="round"
            />
            <path
              d="M8 24C8 16 14 8 24 8C34 8 40 16 40 24C40 32 34 40 24 40C14 40 8 32 8 24Z"
              fill="none"
              stroke="url(#logoGrad)"
              strokeWidth="2"
              strokeLinecap="round"
              opacity="0.5"
            />
            <defs>
              <linearGradient id="logoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#c084fc" />
                <stop offset="100%" stopColor="#7c3aed" />
              </linearGradient>
            </defs>
          </svg>
        </div>
      </div>
      <h1 className={`text-3xl font-bold mb-2 bg-gradient-to-r ${themes[theme].accent} bg-clip-text text-transparent`}>
        CoupleFlow
      </h1>
      <p className={`${themes[theme].textMuted} text-sm`}>
        A shared money experience that feels calm, supportive, and built for real relationships.
      </p>
    </div>
    
    <button
      onClick={onNext}
      className={`w-full max-w-xs py-4 rounded-2xl bg-gradient-to-r ${themes[theme].accent} 
        text-white font-semibold ${themes[theme].shadow} hover:scale-[1.02] active:scale-[0.98]
        transition-transform duration-200 flex items-center justify-center gap-2`}
    >
      Get Started <ArrowRight size={20} />
    </button>
  </div>
);

// Theme Selection Screen
const ThemeSelectionScreen = ({ onSelect, currentTheme }) => (
  <div className="h-full flex flex-col items-center justify-center p-8">
    <h2 className={`text-2xl font-bold mb-2 ${themes[currentTheme].text}`}>Choose Your Vibe</h2>
    <p className={`${themes[currentTheme].textMuted} text-sm mb-8 text-center`}>
      Select a theme that suits your style. You can always change this later.
    </p>
    
    <div className="flex gap-4 w-full max-w-xs">
      <button
        onClick={() => onSelect('light')}
        className={`flex-1 p-6 rounded-2xl border-2 transition-all duration-200
          ${currentTheme === 'light' ? 'border-purple-500 scale-105' : 'border-transparent'}
          bg-gradient-to-br from-purple-50 to-white shadow-lg`}
      >
        <Sun size={32} className="text-purple-500 mx-auto mb-2" />
        <span className="text-gray-800 font-medium text-sm">Light</span>
      </button>
      
      <button
        onClick={() => onSelect('dark')}
        className={`flex-1 p-6 rounded-2xl border-2 transition-all duration-200
          ${currentTheme === 'dark' ? 'border-purple-400 scale-105' : 'border-transparent'}
          bg-gradient-to-br from-gray-900 to-purple-950 shadow-lg`}
      >
        <Moon size={32} className="text-purple-400 mx-auto mb-2" />
        <span className="text-white font-medium text-sm">Dark</span>
      </button>
    </div>
  </div>
);

// Partner Setup Screen
const PartnerSetupScreen = ({ onNext, theme }) => {
  const [mode, setMode] = useState(null);
  
  return (
    <div className="h-full flex flex-col items-center justify-center p-8">
      <h2 className={`text-2xl font-bold mb-2 ${themes[theme].text}`}>How will you use CoupleFlow?</h2>
      <p className={`${themes[theme].textMuted} text-sm mb-8 text-center`}>
        You can invite your partner anytime later.
      </p>
      
      <div className="space-y-3 w-full max-w-xs mb-8">
        <button
          onClick={() => setMode('partner')}
          className={`w-full p-4 rounded-2xl ${themes[theme].glass} ${themes[theme].glassHover}
            flex items-center gap-4 transition-all duration-200
            ${mode === 'partner' ? 'ring-2 ring-purple-500' : ''}`}
        >
          <div className="w-12 h-12 rounded-full bg-gradient-to-r from-pink-400 to-purple-500 flex items-center justify-center">
            <Users size={24} className="text-white" />
          </div>
          <div className="text-left">
            <span className={`font-semibold ${themes[theme].text}`}>With Partner</span>
            <p className={`text-xs ${themes[theme].textMuted}`}>Share budgets & track together</p>
          </div>
        </button>
        
        <button
          onClick={() => setMode('solo')}
          className={`w-full p-4 rounded-2xl ${themes[theme].glass} ${themes[theme].glassHover}
            flex items-center gap-4 transition-all duration-200
            ${mode === 'solo' ? 'ring-2 ring-purple-500' : ''}`}
        >
          <div className="w-12 h-12 rounded-full bg-gradient-to-r from-purple-400 to-violet-500 flex items-center justify-center">
            <Heart size={24} className="text-white" />
          </div>
          <div className="text-left">
            <span className={`font-semibold ${themes[theme].text}`}>Solo for Now</span>
            <p className={`text-xs ${themes[theme].textMuted}`}>Personal finance tracking</p>
          </div>
        </button>
      </div>
      
      {mode && (
        <button
          onClick={onNext}
          className={`w-full max-w-xs py-4 rounded-2xl bg-gradient-to-r ${themes[theme].accent} 
            text-white font-semibold ${themes[theme].shadow} hover:scale-[1.02] active:scale-[0.98]
            transition-transform duration-200`}
        >
          Continue
        </button>
      )}
    </div>
  );
};

// Household Setup Screen
const HouseholdSetupScreen = ({ onNext, theme }) => {
  const [householdName, setHouseholdName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  
  return (
    <div className="h-full flex flex-col p-8">
      <h2 className={`text-2xl font-bold mb-2 ${themes[theme].text}`}>Set Up Your Household</h2>
      <p className={`${themes[theme].textMuted} text-sm mb-8`}>
        Give your shared space a name and invite your partner.
      </p>
      
      <div className="space-y-6 flex-1">
        <div>
          <label className={`text-sm font-medium ${themes[theme].text} block mb-2`}>
            Household Name
          </label>
          <input
            type="text"
            value={householdName}
            onChange={(e) => setHouseholdName(e.target.value)}
            placeholder="e.g., The Johnsons, Casa del Amor"
            className={`w-full p-4 rounded-xl ${themes[theme].input} ${themes[theme].text}
              focus:ring-2 focus:ring-purple-500 outline-none transition-all duration-200`}
          />
        </div>
        
        <div>
          <label className={`text-sm font-medium ${themes[theme].text} block mb-2`}>
            Invite Partner (optional)
          </label>
          <div className="flex gap-2">
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="partner@email.com"
              className={`flex-1 p-4 rounded-xl ${themes[theme].input} ${themes[theme].text}
                focus:ring-2 focus:ring-purple-500 outline-none transition-all duration-200`}
            />
            <button className={`p-4 rounded-xl bg-gradient-to-r ${themes[theme].accent} text-white`}>
              <Send size={20} />
            </button>
          </div>
        </div>
      </div>
      
      <button
        onClick={onNext}
        className={`w-full py-4 rounded-2xl bg-gradient-to-r ${themes[theme].accent} 
          text-white font-semibold ${themes[theme].shadow} hover:scale-[1.02] active:scale-[0.98]
          transition-transform duration-200`}
      >
        {householdName ? 'Continue' : 'Skip for Now'}
      </button>
    </div>
  );
};

// Budget Setup Screen
const BudgetSetupScreen = ({ onNext, theme }) => {
  const suggestedBudgets = [
    { icon: ShoppingCart, label: 'Groceries', amount: 600, enabled: true },
    { icon: Utensils, label: 'Dining Out', amount: 300, enabled: true },
    { icon: Car, label: 'Transportation', amount: 400, enabled: true },
    { icon: Wifi, label: 'Utilities', amount: 200, enabled: true },
    { icon: Heart, label: 'Entertainment', amount: 150, enabled: false },
  ];
  
  const [budgets, setBudgets] = useState(suggestedBudgets);
  
  const toggleBudget = (index) => {
    const newBudgets = [...budgets];
    newBudgets[index].enabled = !newBudgets[index].enabled;
    setBudgets(newBudgets);
  };
  
  return (
    <div className="h-full flex flex-col p-8">
      <div className="flex items-center gap-2 mb-2">
        <Sparkles size={20} className="text-purple-400" />
        <h2 className={`text-2xl font-bold ${themes[theme].text}`}>Suggested Budgets</h2>
      </div>
      <p className={`${themes[theme].textMuted} text-sm mb-6`}>
        We've created these based on typical spending. Adjust as needed!
      </p>
      
      <div className="space-y-3 flex-1 overflow-auto">
        {budgets.map((budget, index) => (
          <div
            key={budget.label}
            className={`p-4 rounded-xl ${themes[theme].glass} flex items-center gap-4`}
          >
            <div className={`w-10 h-10 rounded-full bg-gradient-to-r ${themes[theme].accent} 
              flex items-center justify-center opacity-${budget.enabled ? '100' : '40'}`}>
              <budget.icon size={20} className="text-white" />
            </div>
            <div className="flex-1">
              <span className={`font-medium ${themes[theme].text} ${!budget.enabled && 'opacity-50'}`}>
                {budget.label}
              </span>
              <p className={`text-sm ${themes[theme].textMuted}`}>${budget.amount}/mo</p>
            </div>
            <button
              onClick={() => toggleBudget(index)}
              className={`w-12 h-7 rounded-full transition-colors duration-200
                ${budget.enabled ? 'bg-purple-500' : themes[theme].input}`}
            >
              <div className={`w-5 h-5 rounded-full bg-white shadow transform transition-transform duration-200
                ${budget.enabled ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>
        ))}
      </div>
      
      <button
        onClick={onNext}
        className={`w-full py-4 rounded-2xl bg-gradient-to-r ${themes[theme].accent} 
          text-white font-semibold ${themes[theme].shadow} hover:scale-[1.02] active:scale-[0.98]
          transition-transform duration-200 mt-4`}
      >
        Finish Setup
      </button>
    </div>
  );
};

// Dashboard Screen
const DashboardScreen = ({ theme, userName = 'Ava', partnerName = 'Marcus' }) => {
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Morning';
    if (hour < 17) return 'Afternoon';
    return 'Evening';
  };
  
  const recentActivity = [
    { type: 'expense', label: 'Whole Foods', amount: -127.43, category: 'Groceries', shared: true },
    { type: 'expense', label: 'Netflix', amount: -15.99, category: 'Entertainment', shared: true },
    { type: 'income', label: 'Paycheck', amount: 3200, category: 'Income', shared: false },
  ];
  
  return (
    <div className="h-full flex flex-col p-6 overflow-auto pb-32">
      {/* Header */}
      <div className="mb-6">
        <p className={`text-sm ${themes[theme].textMuted}`}>{getGreeting()},</p>
        <h1 className={`text-2xl font-bold ${themes[theme].text}`}>{userName} 💜</h1>
      </div>
      
      {/* AI Insight Card */}
      <div className={`${themes[theme].glass} rounded-2xl p-4 mb-6 ${themes[theme].shadow}`}>
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-r from-purple-400 to-violet-500 flex items-center justify-center flex-shrink-0">
            <Sparkles size={16} className="text-white" />
          </div>
          <div>
            <p className={`text-sm ${themes[theme].text}`}>
              You and {partnerName} stayed under groceries this week — <span className="text-purple-400 font-medium">nicely done!</span> 🎉
            </p>
          </div>
        </div>
      </div>
      
      {/* Progress Rings */}
      <div className={`${themes[theme].glass} rounded-2xl p-6 mb-6 ${themes[theme].shadow}`}>
        <h3 className={`text-sm font-medium ${themes[theme].textMuted} mb-4`}>This Month's Progress</h3>
        <div className="flex justify-around relative">
          <ProgressRing progress={68} label="Budget" amount="$1,847 left" theme={theme} />
          <ProgressRing progress={45} label="Savings" amount="$450 / $1,000" theme={theme} />
          <ProgressRing progress={82} label="Bills" amount="4 of 5 paid" theme={theme} />
        </div>
      </div>
      
      {/* Shared Toggle Info */}
      <div className={`${themes[theme].glass} rounded-xl p-3 mb-4 flex items-center gap-3`}>
        <Users size={16} className="text-purple-400" />
        <span className={`text-xs ${themes[theme].textMuted}`}>Viewing shared household activity</span>
      </div>
      
      {/* Recent Activity */}
      <div>
        <h3 className={`text-sm font-medium ${themes[theme].textMuted} mb-3`}>Recent Activity</h3>
        <div className="space-y-2">
          {recentActivity.map((item, index) => (
            <div key={index} className={`${themes[theme].glass} rounded-xl p-4 flex items-center gap-4`}>
              <div className={`w-10 h-10 rounded-full flex items-center justify-center
                ${item.type === 'income' ? 'bg-green-500/20' : 'bg-purple-500/20'}`}>
                {item.type === 'income' ? (
                  <TrendingUp size={20} className="text-green-400" />
                ) : (
                  <ShoppingCart size={20} className="text-purple-400" />
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className={`font-medium ${themes[theme].text}`}>{item.label}</span>
                  {item.shared && <Users size={12} className="text-purple-400" />}
                </div>
                <span className={`text-xs ${themes[theme].textMuted}`}>{item.category}</span>
              </div>
              <span className={`font-semibold ${item.type === 'income' ? 'text-green-400' : themes[theme].text}`}>
                {item.type === 'income' ? '+' : ''}{item.amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// Shared Settings Screen
const SharedSettingsScreen = ({ theme, onClose }) => {
  const [settings, setSettings] = useState({
    budgetStyle: 'combined',
    notifications: true,
    sharingDefault: true,
    accountsVisible: 'all'
  });
  
  return (
    <div className="h-full flex flex-col p-6 overflow-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className={`text-xl font-bold ${themes[theme].text}`}>Household Settings</h2>
        <button onClick={onClose} className={themes[theme].textMuted}>
          <X size={24} />
        </button>
      </div>
      
      <p className={`${themes[theme].textMuted} text-sm mb-6`}>
        Customize how you and your partner manage finances together.
      </p>
      
      <div className="space-y-4">
        {/* Budgeting Style */}
        <div className={`${themes[theme].glass} rounded-xl p-4`}>
          <div className="flex items-center gap-3 mb-3">
            <PiggyBank size={20} className="text-purple-400" />
            <span className={`font-medium ${themes[theme].text}`}>Budgeting Style</span>
          </div>
          <div className="space-y-2 ml-8">
            {['combined', 'separate', 'hybrid'].map((style) => (
              <button
                key={style}
                onClick={() => setSettings({...settings, budgetStyle: style})}
                className={`w-full p-3 rounded-lg text-left flex items-center gap-3 transition-colors
                  ${settings.budgetStyle === style ? 'bg-purple-500/20' : themes[theme].glassHover}`}
              >
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center
                  ${settings.budgetStyle === style ? 'border-purple-500 bg-purple-500' : 'border-gray-400'}`}>
                  {settings.budgetStyle === style && <Check size={10} className="text-white" />}
                </div>
                <span className={`capitalize ${themes[theme].text}`}>{style}</span>
              </button>
            ))}
          </div>
        </div>
        
        {/* Notifications */}
        <div className={`${themes[theme].glass} rounded-xl p-4 flex items-center justify-between`}>
          <div className="flex items-center gap-3">
            <Bell size={20} className="text-purple-400" />
            <span className={`font-medium ${themes[theme].text}`}>Partner Notifications</span>
          </div>
          <button
            onClick={() => setSettings({...settings, notifications: !settings.notifications})}
            className={`w-12 h-7 rounded-full transition-colors duration-200
              ${settings.notifications ? 'bg-purple-500' : themes[theme].input}`}
          >
            <div className={`w-5 h-5 rounded-full bg-white shadow transform transition-transform duration-200
              ${settings.notifications ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        </div>
        
        {/* Sharing Defaults */}
        <div className={`${themes[theme].glass} rounded-xl p-4 flex items-center justify-between`}>
          <div className="flex items-center gap-3">
            <Users size={20} className="text-purple-400" />
            <div>
              <span className={`font-medium ${themes[theme].text} block`}>Share by Default</span>
              <span className={`text-xs ${themes[theme].textMuted}`}>New items visible to partner</span>
            </div>
          </div>
          <button
            onClick={() => setSettings({...settings, sharingDefault: !settings.sharingDefault})}
            className={`w-12 h-7 rounded-full transition-colors duration-200
              ${settings.sharingDefault ? 'bg-purple-500' : themes[theme].input}`}
          >
            <div className={`w-5 h-5 rounded-full bg-white shadow transform transition-transform duration-200
              ${settings.sharingDefault ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        </div>
        
        {/* Visible Accounts */}
        <div className={`${themes[theme].glass} rounded-xl p-4`}>
          <div className="flex items-center gap-3 mb-3">
            <CreditCard size={20} className="text-purple-400" />
            <span className={`font-medium ${themes[theme].text}`}>Visible Accounts</span>
          </div>
          <select 
            value={settings.accountsVisible}
            onChange={(e) => setSettings({...settings, accountsVisible: e.target.value})}
            className={`w-full p-3 rounded-lg ${themes[theme].input} ${themes[theme].text} ml-8 -ml-0`}
          >
            <option value="all">All Linked Accounts</option>
            <option value="shared">Shared Accounts Only</option>
            <option value="custom">Custom Selection</option>
          </select>
        </div>
      </div>
      
      <div className={`mt-6 p-4 rounded-xl bg-purple-500/10 border border-purple-500/20`}>
        <p className={`text-sm ${themes[theme].text}`}>
          <span className="font-medium">Everything is opt-in.</span> Your partner will see only what you choose to share.
        </p>
      </div>
    </div>
  );
};

// Main App Component
export default function CoupleFlowPrototype() {
  const [theme, setTheme] = useState('light');
  const [currentScreen, setCurrentScreen] = useState('welcome');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [quickActionOpen, setQuickActionOpen] = useState(false);
  
  const screens = {
    welcome: <WelcomeScreen onNext={() => setCurrentScreen('theme')} theme={theme} />,
    theme: <ThemeSelectionScreen onSelect={(t) => { setTheme(t); setCurrentScreen('partner'); }} currentTheme={theme} />,
    partner: <PartnerSetupScreen onNext={() => setCurrentScreen('household')} theme={theme} />,
    household: <HouseholdSetupScreen onNext={() => setCurrentScreen('budget')} theme={theme} />,
    budget: <BudgetSetupScreen onNext={() => setCurrentScreen('dashboard')} theme={theme} />,
    dashboard: <DashboardScreen theme={theme} />,
    settings: <SharedSettingsScreen theme={theme} onClose={() => setCurrentScreen('dashboard')} />,
  };
  
  const showNav = ['dashboard', 'settings', 'budgets', 'calendar', 'debts', 'savings', 'activity', 'notifications', 'accounts', 'insights'].includes(currentScreen);
  
  return (
    <div className={`w-full max-w-md mx-auto h-screen ${themes[theme].bg} relative overflow-hidden`}>
      {/* Status Bar Simulation */}
      <div className={`h-11 flex items-center justify-between px-6 ${themes[theme].text}`}>
        <span className="text-sm font-medium">9:41</span>
        <div className="flex items-center gap-1">
          <Wifi size={16} />
          <div className="w-6 h-3 border rounded-sm border-current">
            <div className="w-4 h-full bg-current rounded-sm" />
          </div>
        </div>
      </div>
      
      {/* Navigation Header (only on main screens) */}
      {showNav && (
        <div className={`px-6 py-3 flex items-center justify-between`}>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-purple-400 to-violet-500 flex items-center justify-center">
              <Heart size={16} className="text-white" />
            </div>
            <span className={`font-semibold ${themes[theme].text}`}>CoupleFlow</span>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} className={themes[theme].textMuted}>
              {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
            </button>
            <button onClick={() => setDrawerOpen(true)} className={themes[theme].textMuted}>
              <Menu size={24} />
            </button>
          </div>
        </div>
      )}
      
      {/* Main Content */}
      <div className="h-full">
        {screens[currentScreen] || <DashboardScreen theme={theme} />}
      </div>
      
      {/* Floating Action Button */}
      {showNav && !quickActionOpen && (
        <FloatingActionButton onClick={() => setQuickActionOpen(true)} theme={theme} />
      )}
      
      {/* Quick Action Menu */}
      <QuickActionMenu 
        isOpen={quickActionOpen} 
        onClose={() => setQuickActionOpen(false)} 
        theme={theme}
      />
      
      {/* Drawer Navigation */}
      <DrawerNav 
        isOpen={drawerOpen} 
        onClose={() => setDrawerOpen(false)} 
        theme={theme}
        onNavigate={setCurrentScreen}
      />
      
      {/* Bottom Safe Area */}
      {showNav && (
        <div className={`absolute bottom-0 left-0 right-0 h-8 ${themes[theme].glass}`} />
      )}
      
      {/* Screen Navigation (for demo purposes) */}
      <div className="absolute bottom-10 left-0 right-0 flex justify-center gap-2 px-4">
        {['welcome', 'theme', 'partner', 'household', 'budget', 'dashboard'].map((screen, i) => (
          <button
            key={screen}
            onClick={() => setCurrentScreen(screen)}
            className={`w-2 h-2 rounded-full transition-all duration-200
              ${currentScreen === screen 
                ? 'bg-purple-500 w-6' 
                : theme === 'dark' ? 'bg-white/30' : 'bg-gray-300'}`}
          />
        ))}
      </div>

      <style jsx>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fade-in 0.3s ease-out forwards;
          opacity: 0;
        }
      `}</style>
    </div>
  );
}
