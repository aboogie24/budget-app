import React, { useState } from 'react';
import {
  X,
  Calendar,
  ChevronDown,
  ShoppingCart,
  Utensils,
  Car,
  ShoppingBag,
  Zap,
  Film,
  Heart,
  MoreHorizontal,
  Camera,
  DollarSign,
} from 'lucide-react';

export default function AddTransactionScreen() {
  const [transactionType, setTransactionType] = useState('expense');
  const [amount, setAmount] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('groceries');
  const [selectedPayer, setSelectedPayer] = useState('you');
  const [notes, setNotes] = useState('');

  const categories = [
    { id: 'groceries', label: 'Groceries', icon: ShoppingCart },
    { id: 'dining', label: 'Dining', icon: Utensils },
    { id: 'transport', label: 'Transport', icon: Car },
    { id: 'shopping', label: 'Shopping', icon: ShoppingBag },
    { id: 'bills', label: 'Bills', icon: Zap },
    { id: 'entertainment', label: 'Entertainment', icon: Film },
    { id: 'health', label: 'Health', icon: Heart },
    { id: 'other', label: 'Other', icon: MoreHorizontal },
  ];

  const containerStyle = {
    width: '393px',
    height: '852px',
    borderRadius: '40px',
    border: '3px solid #2a2a2a',
    backgroundColor: '#0f0a1e',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    color: '#ffffff',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.8)',
  };

  const statusBarStyle = {
    height: '44px',
    backgroundColor: '#0f0a1e',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: '16px',
    paddingRight: '16px',
    fontSize: '14px',
    fontWeight: '600',
    borderBottom: '1px solid #1a1427',
  };

  const contentStyle = {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflowY: 'auto',
    paddingLeft: '20px',
    paddingRight: '20px',
  };

  const headerStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: '16px',
    paddingBottom: '20px',
  };

  const headerTitleStyle = {
    fontSize: '24px',
    fontWeight: '700',
  };

  const closeButtonStyle = {
    background: 'none',
    border: 'none',
    color: '#ffffff',
    cursor: 'pointer',
    padding: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };

  const typeToggleStyle = {
    display: 'flex',
    gap: '12px',
    marginBottom: '28px',
    backgroundColor: '#1a1427',
    padding: '6px',
    borderRadius: '20px',
    width: 'fit-content',
  };

  const typeButtonStyle = (isActive, tint) => ({
    padding: '10px 20px',
    border: 'none',
    borderRadius: '16px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    backgroundColor: isActive
      ? tint === 'expense'
        ? 'rgba(220, 38, 38, 0.2)'
        : 'rgba(34, 197, 94, 0.2)'
      : 'transparent',
    color: isActive
      ? tint === 'expense'
        ? '#ef4444'
        : '#22c55e'
      : '#888888',
    transition: 'all 0.2s ease',
  });

  const amountContainerStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '32px',
    gap: '8px',
  };

  const amountInputStyle = {
    fontSize: '56px',
    fontWeight: '700',
    backgroundColor: 'transparent',
    border: 'none',
    color: '#ffffff',
    textAlign: 'center',
    outline: 'none',
    width: '200px',
  };

  const dollarSignStyle = {
    fontSize: '48px',
    fontWeight: '700',
    color: '#a855f7',
  };

  const sectionLabelStyle = {
    fontSize: '12px',
    fontWeight: '600',
    color: '#888888',
    textTransform: 'uppercase',
    marginBottom: '12px',
    marginTop: '20px',
  };

  const categoryGridStyle = {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '12px',
    marginBottom: '28px',
  };

  const categoryButtonStyle = (isSelected) => ({
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
    padding: '12px',
    backgroundColor: '#1a1427',
    border: isSelected ? '2px solid #a855f7' : '2px solid transparent',
    borderRadius: '16px',
    cursor: 'pointer',
    color: '#ffffff',
    fontSize: '12px',
    fontWeight: '500',
    transition: 'all 0.2s ease',
  });

  const categoryIconStyle = {
    width: '28px',
    height: '28px',
    color: '#a855f7',
  };

  const rowStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 16px',
    backgroundColor: '#1a1427',
    borderRadius: '12px',
    marginBottom: '12px',
    cursor: 'pointer',
    color: '#ffffff',
    fontSize: '14px',
    fontWeight: '500',
  };

  const rowIconStyle = {
    width: '20px',
    height: '20px',
    color: '#a855f7',
    flexShrink: 0,
  };

  const payerToggleStyle = {
    display: 'flex',
    gap: '8px',
    marginBottom: '28px',
  };

  const payerButtonStyle = (isActive, variant) => {
    let bgColor = '#1a1427';
    let textColor = '#888888';

    if (isActive) {
      if (variant === 'you') {
        bgColor = '#a855f7';
        textColor = '#ffffff';
      } else if (variant === 'partner') {
        bgColor = '#ec4899';
        textColor = '#ffffff';
      } else if (variant === 'split') {
        bgColor = 'linear-gradient(135deg, #a855f7, #ec4899)';
        textColor = '#ffffff';
      }
    }

    return {
      flex: 1,
      padding: '12px 16px',
      border: 'none',
      borderRadius: '12px',
      fontSize: '13px',
      fontWeight: '600',
      cursor: 'pointer',
      background: bgColor,
      color: textColor,
      transition: 'all 0.2s ease',
    };
  };

  const notesInputStyle = {
    padding: '12px 16px',
    backgroundColor: '#1a1427',
    border: 'none',
    borderRadius: '12px',
    color: '#ffffff',
    fontSize: '14px',
    fontWeight: '500',
    outline: 'none',
    marginBottom: '12px',
  };

  const actionRowStyle = {
    display: 'flex',
    gap: '12px',
    marginBottom: '24px',
  };

  const cameraButtonStyle = {
    width: '44px',
    height: '44px',
    padding: '10px',
    backgroundColor: '#1a1427',
    border: 'none',
    borderRadius: '12px',
    color: '#a855f7',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  };

  const addButtonStyle = {
    width: '100%',
    padding: '16px',
    border: 'none',
    borderRadius: '16px',
    background: 'linear-gradient(135deg, #a855f7, #7c3aed)',
    color: '#ffffff',
    fontSize: '16px',
    fontWeight: '700',
    cursor: 'pointer',
    marginTop: 'auto',
    marginBottom: '16px',
    transition: 'all 0.2s ease',
  };

  return (
    <div style={containerStyle}>
      {/* Status Bar */}
      <div style={statusBarStyle}>
        <span></span>
        <span>4:03</span>
        <span></span>
      </div>

      {/* Content */}
      <div style={contentStyle}>
        {/* Header */}
        <div style={headerStyle}>
          <h1 style={headerTitleStyle}>Add Transaction</h1>
          <button style={closeButtonStyle}>
            <X size={24} />
          </button>
        </div>

        {/* Transaction Type Toggle */}
        <div style={typeToggleStyle}>
          <button
            style={typeButtonStyle(transactionType === 'expense', 'expense')}
            onClick={() => setTransactionType('expense')}
          >
            Expense
          </button>
          <button
            style={typeButtonStyle(transactionType === 'income', 'income')}
            onClick={() => setTransactionType('income')}
          >
            Income
          </button>
        </div>

        {/* Amount Input */}
        <div style={amountContainerStyle}>
          <span style={dollarSignStyle}>$</span>
          <input
            style={amountInputStyle}
            type="number"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>

        {/* Category Selector */}
        <div style={{ ...sectionLabelStyle, marginTop: '12px' }}>Category</div>
        <div style={categoryGridStyle}>
          {categories.map((category) => {
            const IconComponent = category.icon;
            return (
              <button
                key={category.id}
                style={categoryButtonStyle(selectedCategory === category.id)}
                onClick={() => setSelectedCategory(category.id)}
              >
                <IconComponent style={categoryIconStyle} />
                <span>{category.label}</span>
              </button>
            );
          })}
        </div>

        {/* Date Picker */}
        <div style={{ ...sectionLabelStyle, marginTop: '12px' }}>Date</div>
        <div style={rowStyle}>
          <Calendar style={rowIconStyle} />
          <span>Today, Apr 1</span>
        </div>

        {/* Account Selector */}
        <div style={{ ...sectionLabelStyle, marginTop: '12px' }}>Account</div>
        <div style={rowStyle}>
          <div
            style={{
              width: '20px',
              height: '20px',
              backgroundColor: '#a855f7',
              borderRadius: '4px',
              flexShrink: 0,
            }}
          ></div>
          <span style={{ flex: 1 }}>Chase Checking ••4521</span>
          <ChevronDown style={rowIconStyle} />
        </div>

        {/* Who Paid Toggle */}
        <div style={{ ...sectionLabelStyle, marginTop: '12px' }}>Who Paid?</div>
        <div style={payerToggleStyle}>
          <button
            style={payerButtonStyle(selectedPayer === 'you', 'you')}
            onClick={() => setSelectedPayer('you')}
          >
            You
          </button>
          <button
            style={payerButtonStyle(selectedPayer === 'partner', 'partner')}
            onClick={() => setSelectedPayer('partner')}
          >
            Partner
          </button>
          <button
            style={payerButtonStyle(selectedPayer === 'split', 'split')}
            onClick={() => setSelectedPayer('split')}
          >
            Split
          </button>
        </div>

        {/* Notes */}
        <div style={{ ...sectionLabelStyle, marginTop: '12px' }}>Notes</div>
        <input
          style={notesInputStyle}
          type="text"
          placeholder="Add a note..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />

        {/* Action Row */}
        <div style={actionRowStyle}>
          <button style={cameraButtonStyle}>
            <Camera size={20} />
          </button>
        </div>

        {/* Add Transaction Button */}
        <button style={addButtonStyle}>Add Transaction</button>
      </div>
    </div>
  );
}
