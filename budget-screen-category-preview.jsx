/**
 * BUDGET SCREEN REDESIGN — Category-Based Budgeting (Web Preview)
 * ════════════════════════════════════════════════════════════════
 *
 * This is a VISUAL PREVIEW of the redesigned budget screen.
 * The actual React Native implementation is in budget-screen-category-mock.jsx.
 *
 * KEY CHANGES from current budget.tsx:
 * ─────────────────────────────────────
 * 1. Categories ARE the budget — no separate "budget" entity
 * 2. Inline budget editing — tap amount to edit on the row
 * 3. Add/Delete categories directly from budget screen
 * 4. Parent/subcategory grouping with expandable sections
 * 5. Budgeted vs Unbudgeted split sections
 */

import { useState, useMemo } from "react";

// ─── Mock Data ───
const MOCK_CATEGORIES = [
  {
    id: '1', name: 'Housing', color: '#7c3aed', icon: '🏠', type: 'expense',
    budget_amount: 1800, spent: 1800, user_id: 'u1',
    subcategories: [
      { id: '1a', name: 'Rent', color: '#7c3aed', icon: '🏠', budget_amount: 1500, spent: 1500, user_id: 'u1', unverified_count: 0 },
      { id: '1b', name: 'Utilities', color: '#06b6d4', icon: '⚡', budget_amount: 300, spent: 280, user_id: 'u1', unverified_count: 1 },
    ],
  },
  {
    id: '2', name: 'Food & Dining', color: '#22c55e', icon: '🍽️', type: 'expense',
    budget_amount: 600, spent: 487, user_id: 'u1',
    subcategories: [
      { id: '2a', name: 'Groceries', color: '#22c55e', icon: '🛒', budget_amount: 400, spent: 342, user_id: 'u1', unverified_count: 2 },
      { id: '2b', name: 'Restaurants', color: '#f59e0b', icon: '🍔', budget_amount: 200, spent: 145, user_id: 'u1', unverified_count: 0 },
    ],
  },
  {
    id: '3', name: 'Transportation', color: '#3b82f6', icon: '🚗', type: 'expense',
    budget_amount: 350, spent: 410, user_id: 'u1',
    subcategories: [
      { id: '3a', name: 'Gas', color: '#3b82f6', icon: '⛽', budget_amount: 200, spent: 230, user_id: 'u1', unverified_count: 0 },
      { id: '3b', name: 'Car Insurance', color: '#8b5cf6', icon: '🛡️', budget_amount: 150, spent: 150, user_id: 'u1', unverified_count: 0 },
      { id: '3c', name: 'Parking', color: '#06b6d4', icon: '🅿️', budget_amount: null, spent: 30, user_id: 'u1', unverified_count: 0 },
    ],
  },
  {
    id: '4', name: 'Entertainment', color: '#ec4899', icon: '🎬', type: 'expense',
    budget_amount: 150, spent: 89, user_id: 'u1',
    subcategories: [
      { id: '4a', name: 'Streaming', color: '#ec4899', icon: '📺', budget_amount: 50, spent: 45, user_id: 'u1', unverified_count: 0 },
      { id: '4b', name: 'Going Out', color: '#f97316', icon: '🎉', budget_amount: 100, spent: 44, user_id: 'u1', unverified_count: 0 },
    ],
  },
  {
    id: '5', name: 'Health', color: '#14b8a6', icon: '💊', type: 'expense',
    budget_amount: null, spent: 65, user_id: 'u1',
    subcategories: [
      { id: '5a', name: 'Gym', color: '#14b8a6', icon: '🏋️', budget_amount: null, spent: 45, user_id: 'u1', unverified_count: 0 },
      { id: '5b', name: 'Pharmacy', color: '#ef4444', icon: '💊', budget_amount: null, spent: 20, user_id: 'u1', unverified_count: 0 },
    ],
  },
  {
    id: '6', name: 'Shopping', color: '#f59e0b', icon: '🛍️', type: 'expense',
    budget_amount: null, spent: 123, user_id: 'u1',
    subcategories: [],
  },
  {
    id: '7', name: 'Pets', color: '#8b5cf6', icon: '🐾', type: 'expense',
    budget_amount: null, spent: 0, user_id: null, // system category
    subcategories: [],
  },
  // Income categories
  {
    id: '10', name: 'Salary', color: '#22c55e', icon: '💰', type: 'income',
    budget_amount: 5500, spent: 5500, user_id: 'u1',
    subcategories: [],
  },
  {
    id: '11', name: 'Side Income', color: '#3b82f6', icon: '💼', type: 'income',
    budget_amount: 800, spent: 450, user_id: 'u1',
    subcategories: [
      { id: '11a', name: 'Freelance', color: '#3b82f6', icon: '💻', budget_amount: 500, spent: 350, user_id: 'u1', unverified_count: 0 },
      { id: '11b', name: 'Investments', color: '#22c55e', icon: '📈', budget_amount: 300, spent: 100, user_id: 'u1', unverified_count: 0 },
    ],
  },
];

// ─── Progress Bar ───
const ProgressBar = ({ percent, color = '#34d399', height = 4 }) => (
  <div style={{ height, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: height / 2, overflow: 'hidden' }}>
    <div style={{ height: '100%', width: `${Math.min(Math.max(percent, 0), 100)}%`, backgroundColor: color, borderRadius: height / 2, transition: 'width 0.3s ease' }} />
  </div>
);

// ─── Format helpers ───
const fmt = (n) => '$' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtShort = (n) => {
  if (Math.abs(n) >= 1000) return '$' + (n / 1000).toFixed(1) + 'k';
  return '$' + n.toFixed(0);
};

// ═══════════════════════════════════════════
// CATEGORY BUDGET ROW
// ═══════════════════════════════════════════
const CategoryBudgetRow = ({ category, onSetBudget, onDelete, isSubcategory = false }) => {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState('');

  const hasBudget = category.budget_amount != null && category.budget_amount > 0;
  const spent = category.spent || 0;
  const budgeted = category.budget_amount || 0;
  const pct = budgeted > 0 ? Math.round((spent / budgeted) * 100) : 0;
  const overBudget = spent > budgeted && hasBudget;
  const isSystem = !category.user_id;

  const progressColor = overBudget ? '#ef4444' : pct > 80 ? '#f59e0b' : '#22c55e';

  return (
    <div style={{
      display: 'flex', alignItems: 'center', padding: isSubcategory ? '10px 14px 10px 52px' : '12px 14px',
      gap: 10, borderBottom: '1px solid rgba(255,255,255,0.04)',
      ...(overBudget ? { background: 'rgba(239,68,68,0.04)' } : {}),
    }}>
      {/* Icon */}
      <div style={{
        width: isSubcategory ? 28 : 36, height: isSubcategory ? 28 : 36,
        borderRadius: isSubcategory ? 8 : 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: `${category.color || '#7c3aed'}22`, fontSize: isSubcategory ? 14 : 18, flexShrink: 0,
      }}>
        {category.icon}
      </div>

      {/* Name + Progress */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: isSubcategory ? 13 : 14, fontWeight: isSubcategory ? 500 : 600, color: isSubcategory ? '#cbd5e1' : '#f8fafc' }}>
            {category.name}
          </span>
          {overBudget && (
            <span style={{ fontSize: 9, fontWeight: 700, color: '#ef4444', background: 'rgba(239,68,68,0.12)', padding: '2px 5px', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 2 }}>
              ⚠ Over
            </span>
          )}
          {(category.unverified_count || 0) > 0 && (
            <span style={{ fontSize: 9, color: '#fbbf24', background: 'rgba(251,191,36,0.12)', padding: '2px 5px', borderRadius: 6 }}>
              {category.unverified_count} unverified
            </span>
          )}
        </div>
        {hasBudget ? (
          <div style={{ marginTop: 4 }}>
            <ProgressBar percent={pct} color={progressColor} height={3} />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3 }}>
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>{fmt(spent)} spent</span>
              <span style={{ fontSize: 10, color: overBudget ? '#ef4444' : 'rgba(255,255,255,0.4)' }}>
                {overBudget ? `${fmt(spent - budgeted)} over` : `${fmt(budgeted - spent)} left`}
              </span>
            </div>
          </div>
        ) : (
          <span style={{ fontSize: 11, color: '#475569', marginTop: 2, display: 'block' }}>
            {spent > 0 ? `${fmt(spent)} spent · No budget set` : 'Tap amount to set budget'}
          </span>
        )}
      </div>

      {/* Budget Amount */}
      {editing ? (
        <div style={{
          display: 'flex', alignItems: 'center', background: 'rgba(168,85,247,0.12)',
          borderRadius: 8, padding: '2px 8px', border: '1px solid rgba(168,85,247,0.4)', gap: 4,
        }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#c084fc' }}>$</span>
          <input
            type="number"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            autoFocus
            onBlur={() => {
              const val = parseFloat(editValue);
              if (!isNaN(val) && val >= 0) onSetBudget(category.id, val);
              setEditing(false);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const val = parseFloat(editValue);
                if (!isNaN(val) && val >= 0) onSetBudget(category.id, val);
                setEditing(false);
              }
            }}
            style={{
              background: 'transparent', border: 'none', outline: 'none',
              color: '#f8fafc', fontSize: 14, fontWeight: 700, width: 60, padding: '4px 0',
            }}
            placeholder="0"
          />
        </div>
      ) : (
        <button
          onClick={() => { setEditValue(hasBudget ? String(budgeted) : ''); setEditing(true); }}
          style={{
            background: 'rgba(255,255,255,0.06)', borderRadius: 8, padding: '6px 10px',
            border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer', minWidth: 64, textAlign: 'center',
            color: hasBudget ? '#f8fafc' : '#a855f7', fontSize: hasBudget ? 13 : 12,
            fontWeight: hasBudget ? 700 : 600,
          }}
        >
          {hasBudget ? fmt(budgeted) : '+ Set'}
        </button>
      )}

      {/* Delete */}
      {!isSystem && (
        <button
          onClick={() => onDelete(category)}
          style={{
            width: 28, height: 28, borderRadius: 8, background: 'rgba(255,255,255,0.04)',
            border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#f87171', fontSize: 14, flexShrink: 0,
          }}
        >
          🗑
        </button>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════
// CATEGORY GROUP (expandable parent)
// ═══════════════════════════════════════════
const CategoryGroup = ({ category, onSetBudget, onDelete, onAddSub }) => {
  const [expanded, setExpanded] = useState(false);
  const hasSubs = (category.subcategories || []).length > 0;

  const totalBudgeted = (category.subcategories || []).reduce((s, c) => s + (c.budget_amount || 0), 0) + (category.budget_amount || 0);
  const totalSpent = (category.subcategories || []).reduce((s, c) => s + (c.spent || 0), 0) + (category.spent || 0);
  const pct = totalBudgeted > 0 ? Math.round((totalSpent / totalBudgeted) * 100) : 0;

  return (
    <div style={{
      background: 'rgba(255,255,255,0.04)', borderRadius: 14,
      border: '1px solid rgba(255,255,255,0.06)', marginBottom: 8, overflow: 'hidden',
    }}>
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          display: 'flex', alignItems: 'center', padding: 14, gap: 10, width: '100%',
          background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left',
        }}
      >
        <div style={{
          width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: `${category.color || '#7c3aed'}22`, fontSize: 18, flexShrink: 0,
        }}>
          {category.icon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#f8fafc' }}>{category.name}</span>
            {hasSubs && (
              <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>
                {category.subcategories.length} sub{category.subcategories.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          {totalBudgeted > 0 && (
            <div style={{ marginTop: 4 }}>
              <ProgressBar percent={pct} color={pct > 100 ? '#ef4444' : pct > 80 ? '#f59e0b' : '#22c55e'} height={3} />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3 }}>
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>{fmt(totalSpent)} spent</span>
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>{fmt(totalBudgeted)} budgeted</span>
              </div>
            </div>
          )}
        </div>
        <span style={{ fontSize: 14, fontWeight: 700, color: totalBudgeted > 0 ? '#f8fafc' : '#475569', marginRight: 4 }}>
          {totalBudgeted > 0 ? fmt(totalBudgeted) : '—'}
        </span>
        <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12 }}>{expanded ? '▲' : '▼'}</span>
      </button>

      {/* Expanded body */}
      {expanded && (
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 4, paddingBottom: 4 }}>
          {!hasSubs && (
            <CategoryBudgetRow category={category} onSetBudget={onSetBudget} onDelete={onDelete} />
          )}
          {(category.subcategories || []).map((sub) => (
            <CategoryBudgetRow key={sub.id} category={sub} onSetBudget={onSetBudget} onDelete={onDelete} isSubcategory />
          ))}
          <button
            onClick={() => onAddSub(category.id)}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              padding: 10, margin: '6px 14px', borderRadius: 10,
              border: '1px dashed rgba(168,85,247,0.25)', background: 'rgba(168,85,247,0.06)',
              cursor: 'pointer', color: '#a855f7', fontSize: 12, fontWeight: 700, width: 'calc(100% - 28px)',
            }}
          >
            + Add Subcategory
          </button>
        </div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════
// ADD CATEGORY MODAL
// ═══════════════════════════════════════════
const AddCategoryModal = ({ visible, onClose, onSave, type }) => {
  const [name, setName] = useState('');
  const [budget, setBudget] = useState('');
  const [color, setColor] = useState('#7c3aed');
  const COLORS = ['#7c3aed','#22c55e','#ef4444','#3b82f6','#06b6d4','#f59e0b','#ec4899','#14b8a6','#f97316','#8b5cf6'];
  const ICONS = ['🏠','🍽️','🚗','🎬','🛒','💪','💰','🛡️','📄','👤','🎁','🎓','💊','✈️','🎮','🎵','👕','📱','📶','💧','⚡','🐾','📚','💼'];

  const [icon, setIcon] = useState('🏠');

  if (!visible) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex',
      alignItems: 'flex-end', justifyContent: 'center', zIndex: 100,
    }} onClick={onClose}>
      <div style={{
        background: '#0f0a1e', borderRadius: '24px 24px 0 0', width: '100%', maxWidth: 420,
        maxHeight: '85vh', overflowY: 'auto', border: '1px solid rgba(255,255,255,0.08)', borderBottom: 'none',
      }} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 20px 12px' }}>
          <span style={{ fontSize: 20, fontWeight: 800, color: '#f8fafc' }}>Add Category</span>
          <button onClick={onClose} style={{
            width: 36, height: 36, borderRadius: 12, background: 'rgba(255,255,255,0.08)',
            border: 'none', cursor: 'pointer', color: '#e5e7eb', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>✕</button>
        </div>

        <div style={{ padding: '0 20px 16px' }}>
          {/* Name */}
          <label style={{ color: '#94a3b8', fontWeight: 700, fontSize: 13, display: 'block', marginBottom: 6, marginTop: 12 }}>Name</label>
          <input
            value={name} onChange={(e) => setName(e.target.value)} placeholder="Category name" autoFocus
            style={{
              width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 12, padding: '12px 14px', color: '#f8fafc', fontSize: 15, outline: 'none', boxSizing: 'border-box',
            }}
          />

          {/* Budget */}
          <label style={{ color: '#94a3b8', fontWeight: 700, fontSize: 13, display: 'block', marginBottom: 6, marginTop: 12 }}>
            Monthly Budget <span style={{ color: '#64748b', fontWeight: 400 }}>(optional)</span>
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 18, fontWeight: 800, color: '#c084fc' }}>$</span>
            <input
              value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="0.00" type="number"
              style={{
                flex: 1, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 12, padding: '12px 14px', color: '#f8fafc', fontSize: 15, outline: 'none',
              }}
            />
          </div>

          {/* Color */}
          <label style={{ color: '#94a3b8', fontWeight: 700, fontSize: 13, display: 'block', marginBottom: 6, marginTop: 12 }}>Color</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {COLORS.map((c) => (
              <button key={c} onClick={() => setColor(c)} style={{
                width: 32, height: 32, borderRadius: 10, background: c, border: color === c ? '2px solid #fff' : '2px solid transparent',
                cursor: 'pointer',
              }} />
            ))}
          </div>

          {/* Icon */}
          <label style={{ color: '#94a3b8', fontWeight: 700, fontSize: 13, display: 'block', marginBottom: 6, marginTop: 12 }}>Icon</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {ICONS.map((i) => (
              <button key={i} onClick={() => setIcon(i)} style={{
                width: 42, height: 42, borderRadius: 12, fontSize: 20,
                background: icon === i ? `${color}22` : 'rgba(255,255,255,0.06)',
                border: icon === i ? `1.5px solid ${color}` : '1.5px solid rgba(255,255,255,0.08)',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>{i}</button>
            ))}
          </div>

          {/* Preview */}
          <label style={{ color: '#94a3b8', fontWeight: 700, fontSize: 13, display: 'block', marginBottom: 6, marginTop: 12 }}>Preview</label>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(255,255,255,0.05)',
            borderRadius: 14, padding: 14, border: '1px solid rgba(255,255,255,0.08)',
          }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: `${color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
              {icon}
            </div>
            <div>
              <div style={{ color: '#f8fafc', fontSize: 16, fontWeight: 700 }}>{name || 'Category Name'}</div>
              <div style={{ color: budget ? '#22c55e' : '#475569', fontSize: 12, fontWeight: 600, marginTop: 2 }}>
                {budget ? `$${parseFloat(budget || '0').toFixed(2)} / month` : 'No budget set'}
              </div>
            </div>
          </div>
        </div>

        {/* Save */}
        <div style={{ padding: '8px 20px 36px' }}>
          <button
            onClick={() => { if (name.trim()) { onSave({ name, budget, color, icon }); setName(''); setBudget(''); } }}
            style={{
              width: '100%', background: '#7c3aed', borderRadius: 14, padding: '14px 0',
              border: 'none', cursor: 'pointer', color: '#fff', fontSize: 16, fontWeight: 800,
              opacity: name.trim() ? 1 : 0.5,
            }}
          >
            Create Category
          </button>
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════
// MAIN BUDGET SCREEN
// ═══════════════════════════════════════════
export default function BudgetScreenPreview() {
  const [categories, setCategories] = useState(MOCK_CATEGORIES);
  const [type, setType] = useState('expense');
  const [month, setMonth] = useState('Apr 2026');
  const [monthIdx, setMonthIdx] = useState(3);
  const [showAddModal, setShowAddModal] = useState(false);
  const [budgetedExpanded, setBudgetedExpanded] = useState(true);
  const [unbudgetedExpanded, setUnbudgetedExpanded] = useState(false);

  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const changeMonth = (delta) => {
    const newIdx = Math.max(0, Math.min(11, monthIdx + delta));
    setMonthIdx(newIdx);
    setMonth(`${months[newIdx]} 2026`);
  };

  const filtered = useMemo(() => categories.filter((c) => c.type === type), [categories, type]);

  const budgeted = useMemo(() => filtered.filter((c) => {
    const self = c.budget_amount != null && c.budget_amount > 0;
    const subs = (c.subcategories || []).some((s) => s.budget_amount > 0);
    return self || subs;
  }), [filtered]);

  const unbudgeted = useMemo(() => filtered.filter((c) => {
    const self = c.budget_amount != null && c.budget_amount > 0;
    const subs = (c.subcategories || []).some((s) => s.budget_amount > 0);
    return !self && !subs;
  }), [filtered]);

  const totalBudgeted = useMemo(() => {
    let t = 0;
    for (const c of filtered) {
      t += c.budget_amount || 0;
      for (const s of c.subcategories || []) t += s.budget_amount || 0;
    }
    return t;
  }, [filtered]);

  const totalSpent = useMemo(() => {
    let t = 0;
    for (const c of filtered) {
      t += c.spent || 0;
      for (const s of c.subcategories || []) t += s.spent || 0;
    }
    return t;
  }, [filtered]);

  const totalRemaining = Math.max(totalBudgeted - totalSpent, 0);
  const usedPct = totalBudgeted > 0 ? Math.round((totalSpent / totalBudgeted) * 100) : 0;

  const handleSetBudget = (id, amount) => {
    setCategories((prev) =>
      prev.map((cat) => {
        if (cat.id === id) return { ...cat, budget_amount: amount };
        return {
          ...cat,
          subcategories: (cat.subcategories || []).map((s) =>
            s.id === id ? { ...s, budget_amount: amount } : s
          ),
        };
      })
    );
  };

  const handleDelete = (cat) => {
    if (!cat.user_id) return;
    setCategories((prev) => prev.filter((c) => c.id !== cat.id).map((c) => ({
      ...c,
      subcategories: (c.subcategories || []).filter((s) => s.id !== cat.id),
    })));
  };

  const handleAddCategory = (data) => {
    setCategories((prev) => [
      ...prev,
      {
        id: `new-${Date.now()}`,
        name: data.name,
        color: data.color,
        icon: data.icon,
        type,
        budget_amount: data.budget ? parseFloat(data.budget) : null,
        spent: 0,
        user_id: 'u1',
        subcategories: [],
      },
    ]);
    setShowAddModal(false);
  };

  return (
    <div style={{
      minHeight: '100vh', background: 'linear-gradient(180deg, #0f0a1e 0%, #1a1035 50%, #0f0a1e 100%)',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      maxWidth: 420, margin: '0 auto', position: 'relative', overflow: 'hidden',
    }}>
      {/* Phone frame hint */}
      <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '0 0 20px 20px', padding: '8px 0', textAlign: 'center' }}>
        <div style={{ width: 40, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.15)', margin: '0 auto' }} />
      </div>

      {/* ── Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px 0' }}>
        <span style={{ fontSize: 22, fontWeight: 700, color: 'white' }}>Budget</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.35)', fontSize: 16 }}>⚙️</button>
          <button
            onClick={() => setShowAddModal(true)}
            style={{
              width: 36, height: 36, borderRadius: 12, border: 'none', cursor: 'pointer',
              background: 'linear-gradient(135deg, #7c3aed, #a855f7)', color: 'white', fontSize: 18,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(124,58,237,0.3)',
            }}
          >
            +
          </button>
        </div>
      </div>

      {/* ── Month Switcher ── */}
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 16, padding: '10px 20px' }}>
        <button onClick={() => changeMonth(-1)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.5)', fontSize: 16 }}>◀</button>
        <span style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.8)' }}>{month}</span>
        <button onClick={() => changeMonth(1)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.5)', fontSize: 16 }}>▶</button>
      </div>

      {/* ── Type Toggle ── */}
      <div style={{ display: 'flex', gap: 10, padding: '0 20px', marginBottom: 12 }}>
        {['expense', 'income'].map((t) => (
          <button
            key={t}
            onClick={() => setType(t)}
            style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
              padding: '10px 0', borderRadius: 12, cursor: 'pointer',
              border: `1px solid ${type === t ? 'rgba(192,132,252,0.3)' : 'rgba(255,255,255,0.08)'}`,
              background: type === t ? 'rgba(192,132,252,0.12)' : 'rgba(255,255,255,0.04)',
              color: type === t ? '#c084fc' : '#64748b', fontSize: 13, fontWeight: type === t ? 800 : 700,
            }}
          >
            {t === 'expense' ? '📉' : '📈'} {t === 'expense' ? 'Expenses' : 'Income'}
          </button>
        ))}
      </div>

      {/* ── Scrollable Content ── */}
      <div style={{ padding: '0 20px', paddingBottom: 100, overflowY: 'auto', maxHeight: 'calc(100vh - 200px)' }}>

        {/* ── Hero Card ── */}
        <div style={{
          background: 'rgba(124,58,237,0.08)', borderRadius: 16, padding: 18, marginBottom: 16,
          border: '1px solid rgba(168,85,247,0.2)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.7)', letterSpacing: 0.5 }}>
              {type === 'expense' ? 'EXPENSE BUDGET' : 'INCOME BUDGET'}
            </span>
            <span style={{
              fontSize: 11, fontWeight: 700, borderRadius: 8, padding: '3px 8px',
              color: usedPct > 80 ? '#ef4444' : '#a855f7',
              background: usedPct > 80 ? 'rgba(239,68,68,0.12)' : 'rgba(168,85,247,0.15)',
            }}>
              {usedPct}% {type === 'expense' ? 'used' : 'earned'}
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginBottom: 2 }}>Budgeted</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: 'white' }}>{fmtShort(totalBudgeted)}</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginBottom: 2 }}>{type === 'expense' ? 'Spent' : 'Earned'}</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: type === 'expense' ? '#f59e0b' : '#34d399' }}>{fmtShort(totalSpent)}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginBottom: 2 }}>Remaining</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#10b981' }}>{fmtShort(totalRemaining)}</div>
            </div>
          </div>

          <ProgressBar percent={usedPct} color={usedPct > 80 ? '#ef4444' : '#a855f7'} height={6} />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>{budgeted.length} categories budgeted</span>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>{fmt(totalRemaining)} left</span>
          </div>
        </div>

        {/* ═══ BUDGETED SECTION ═══ */}
        <button
          onClick={() => setBudgetedExpanded(!budgetedExpanded)}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%',
            padding: '10px 0', marginBottom: 8, background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(34,197,94,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>💰</div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'white' }}>Budgeted ({budgeted.length})</div>
              <div style={{ fontSize: 10, color: '#22c55e' }}>{fmt(totalBudgeted)} total</div>
            </div>
          </div>
          <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12 }}>{budgetedExpanded ? '▲' : '▼'}</span>
        </button>

        {budgetedExpanded && budgeted.map((cat) => (
          <CategoryGroup
            key={cat.id}
            category={cat}
            onSetBudget={handleSetBudget}
            onDelete={handleDelete}
            onAddSub={(parentId) => alert(`Add subcategory under ${parentId}`)}
          />
        ))}

        {/* ═══ UNBUDGETED SECTION ═══ */}
        {unbudgeted.length > 0 && (
          <>
            <button
              onClick={() => setUnbudgetedExpanded(!unbudgetedExpanded)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%',
                padding: '10px 0', marginTop: 4, marginBottom: 8, background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(100,116,139,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>❓</div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'white' }}>Unbudgeted ({unbudgeted.length})</div>
                  <div style={{ fontSize: 10, color: '#64748b' }}>Tap to set a budget</div>
                </div>
              </div>
              <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12 }}>{unbudgetedExpanded ? '▲' : '▼'}</span>
            </button>

            {unbudgetedExpanded && unbudgeted.map((cat) => (
              <CategoryGroup
                key={cat.id}
                category={cat}
                onSetBudget={handleSetBudget}
                onDelete={handleDelete}
                onAddSub={(parentId) => alert(`Add subcategory under ${parentId}`)}
              />
            ))}
          </>
        )}
      </div>

      {/* ── FAB ── */}
      <button
        onClick={() => setShowAddModal(true)}
        style={{
          position: 'fixed', bottom: 30, right: 'calc(50% - 190px)',
          width: 52, height: 52, borderRadius: 26, border: 'none', cursor: 'pointer',
          background: 'linear-gradient(135deg, #7c3aed, #a855f7)', color: 'white', fontSize: 22,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 20px rgba(124,58,237,0.4)', zIndex: 10,
        }}
      >
        +
      </button>

      {/* ── Add Category Modal ── */}
      <AddCategoryModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSave={handleAddCategory}
        type={type}
      />
    </div>
  );
}
