import { useState } from "react";
import { Home, Calendar, Bot, PieChart, Settings, Plus, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, TrendingUp, TrendingDown, Wallet, Receipt, AlertTriangle, Sparkles, Users, Eye } from "lucide-react";

/* ─── Progress Ring (matches home) ─── */
const ProgressRing = ({ percent, size = 56, stroke = 4, color = "#a855f7" }) => {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (Math.min(percent, 100) / 100) * circ;
  return (
    <svg width={size} height={size}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`} />
    </svg>
  );
};

/* ─── Horizontal bar ─── */
const ProgressBar = ({ percent, color = "#34d399", height = 4 }) => (
  <div style={{ height, background: "rgba(255,255,255,0.08)", borderRadius: height / 2, overflow: "hidden" }}>
    <div style={{
      height: "100%", width: `${Math.min(percent, 100)}%`,
      background: color, borderRadius: height / 2, transition: "width 0.3s",
    }} />
  </div>
);

/* ─── Mini spending bars ─── */
const SpendingBars = ({ categories }) => {
  const max = Math.max(...categories.map(c => c.spent), 1);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 50 }}>
      {categories.map((c, i) => {
        const h = (c.spent / max) * 40;
        const over = c.spent > c.budgeted;
        return (
          <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1 }}>
            <div style={{
              width: "100%", maxWidth: 24, height: Math.max(h, 3), borderRadius: 3,
              background: over
                ? "linear-gradient(180deg, #ef4444, #dc2626)"
                : `linear-gradient(180deg, ${c.color}cc, ${c.color}88)`,
            }} />
            <span style={{ fontSize: 7, color: "rgba(255,255,255,0.35)", marginTop: 3, textAlign: "center", lineHeight: 1.1 }}>{c.name.slice(0, 5)}</span>
          </div>
        );
      })}
    </div>
  );
};

/* ─── Owner dot ─── */
const OWNER_COLORS = { You: "#a855f7", Partner: "#ec4899", Joint: "#06b6d4" };
const OwnerDot = ({ owner }) => (
  <span style={{
    width: 8, height: 8, borderRadius: 4,
    background: OWNER_COLORS[owner] || "rgba(255,255,255,0.35)",
    display: "inline-block", flexShrink: 0,
  }} />
);

/* ─── Mock data ─── */
const summary = {
  month: "Apr 2026",
  totalIncome: 8400.00,
  totalBudgeted: 6200.00,
  totalSpent: 3847.50,
  totalRemaining: 2352.50,
};
const usedPct = Math.round((summary.totalSpent / summary.totalBudgeted) * 100);

const budgets = [
  {
    id: 1, name: "Groceries", type: "expense", budgeted: 800, spent: 623.40, owner: "Joint", isShared: true,
    categories: [
      { name: "Whole Foods", spent: 312.20, budgeted: 400, color: "#a855f7" },
      { name: "Costco", spent: 198.50, budgeted: 250, color: "#ec4899" },
      { name: "Target", spent: 112.70, budgeted: 150, color: "#3b82f6" },
    ],
  },
  {
    id: 2, name: "Dining Out", type: "expense", budgeted: 400, spent: 387.20, owner: "Joint", isShared: true,
    categories: [
      { name: "Restaurants", spent: 245.00, budgeted: 250, color: "#f59e0b" },
      { name: "Coffee", spent: 82.20, budgeted: 80, color: "#10b981" },
      { name: "Delivery", spent: 60.00, budgeted: 70, color: "#ef4444" },
    ],
  },
  {
    id: 3, name: "Entertainment", type: "expense", budgeted: 300, spent: 185.00, owner: "You", isShared: false,
    categories: [
      { name: "Streaming", spent: 65.00, budgeted: 80, color: "#8b5cf6" },
      { name: "Gaming", spent: 70.00, budgeted: 100, color: "#06b6d4" },
      { name: "Events", spent: 50.00, budgeted: 120, color: "#f472b6" },
    ],
  },
  {
    id: 4, name: "Transport", type: "expense", budgeted: 350, spent: 410.30, owner: "You", isShared: false,
    categories: [
      { name: "Gas", spent: 180.30, budgeted: 150, color: "#ef4444" },
      { name: "Parking", spent: 80.00, budgeted: 80, color: "#fbbf24" },
      { name: "Uber", spent: 150.00, budgeted: 120, color: "#a855f7" },
    ],
  },
  {
    id: 5, name: "Salary", type: "income", budgeted: 6500, spent: 6500, owner: "You", isShared: true,
    categories: [{ name: "Primary", spent: 6500, budgeted: 6500, color: "#34d399" }],
  },
  {
    id: 6, name: "Freelance", type: "income", budgeted: 1900, spent: 1200, owner: "Partner", isShared: true,
    categories: [{ name: "Design", spent: 1200, budgeted: 1900, color: "#ec4899" }],
  },
];

const billBudgets = [
  { id: 7, name: "Rent", budgeted: 1850, spent: 1850, isPaid: true, isShared: true, owner: "Joint" },
  { id: 8, name: "Electric", budgeted: 142, spent: 0, isPaid: false, isShared: true, owner: "Joint" },
  { id: 9, name: "Internet", budgeted: 79.99, spent: 79.99, isPaid: true, isShared: true, owner: "Joint" },
  { id: 10, name: "Student Loan", budgeted: 350, spent: 0, isPaid: false, isShared: false, owner: "You" },
];

const expenseBudgets = budgets.filter(b => b.type === "expense");
const incomeBudgets = budgets.filter(b => b.type === "income");

const fmt = (n) => "$" + Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtShort = (n) => {
  if (n >= 1000) return "$" + (n / 1000).toFixed(1) + "k";
  return "$" + n.toFixed(0);
};

/* ─── Budget Card ─── */
const BudgetCard = ({ budget }) => {
  const [expanded, setExpanded] = useState(false);
  const isIncome = budget.type === "income";
  const pct = Math.round((budget.spent / budget.budgeted) * 100);
  const overBudget = !isIncome && budget.spent > budget.budgeted;
  const nearLimit = !isIncome && pct >= 90 && !overBudget;
  const ringColor = isIncome ? "#34d399" : pct > 80 ? "#ef4444" : pct > 60 ? "#f59e0b" : "#34d399";

  return (
    <div style={{ marginBottom: 8 }}>
      <div onClick={() => setExpanded(!expanded)} style={{
        background: overBudget ? "rgba(239,68,68,0.04)" : "rgba(255,255,255,0.04)",
        border: `1px solid ${overBudget ? "rgba(239,68,68,0.2)" : "rgba(255,255,255,0.06)"}`,
        borderRadius: expanded ? "14px 14px 0 0" : 14,
        padding: "14px 14px", cursor: "pointer",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {/* Icon */}
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: isIncome ? "rgba(52,211,153,0.12)" : "rgba(248,113,113,0.12)",
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>
            {isIncome ? <TrendingUp size={16} color="#34d399" /> : <TrendingDown size={16} color="#f87171" />}
          </div>

          {/* Name + details */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <OwnerDot owner={budget.owner} />
              <span style={{ fontSize: 14, fontWeight: 700, color: "white" }}>{budget.name}</span>
              <span style={{
                fontSize: 10, fontWeight: 600, padding: "2px 6px", borderRadius: 6,
                background: isIncome ? "rgba(52,211,153,0.12)" : "rgba(248,113,113,0.12)",
                color: isIncome ? "#34d399" : "#f87171",
              }}>{isIncome ? "Income" : "Expense"}</span>
              {budget.isShared && (
                <span style={{
                  display: "inline-flex", alignItems: "center", gap: 3,
                  fontSize: 10, color: "#a855f7",
                  background: "rgba(168,85,247,0.12)", borderRadius: 6, padding: "2px 6px",
                }}>
                  <Users size={9} /> Shared
                </span>
              )}
              {overBudget && (
                <span style={{
                  display: "inline-flex", alignItems: "center", gap: 3,
                  fontSize: 10, fontWeight: 700, color: "#ef4444",
                  background: "rgba(239,68,68,0.12)", borderRadius: 6, padding: "2px 6px",
                }}>
                  <AlertTriangle size={9} /> Over
                </span>
              )}
            </div>
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 2, display: "block" }}>
              {fmt(budget.spent)} of {fmt(budget.budgeted)}
            </span>
          </div>

          {/* Progress ring */}
          <div style={{ position: "relative", flexShrink: 0 }}>
            <ProgressRing percent={pct} size={48} stroke={4} color={ringColor} />
            <div style={{
              position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
              fontSize: 11, fontWeight: 800, color: "white",
            }}>{pct}%</div>
          </div>

          {expanded ? <ChevronUp size={14} color="rgba(255,255,255,0.35)" /> : <ChevronDown size={14} color="rgba(255,255,255,0.35)" />}
        </div>

        {/* Progress bar */}
        <div style={{ marginTop: 10 }}>
          <ProgressBar percent={pct} color={isIncome ? "#34d399" : overBudget ? "#ef4444" : "#22c55e"} />
        </div>

        {/* Footer */}
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>{fmt(budget.spent)} {isIncome ? "earned" : "spent"}</span>
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>{fmt(Math.max(budget.budgeted - budget.spent, 0))} left</span>
        </div>
      </div>

      {/* Expanded: category breakdown */}
      {expanded && (
        <div style={{
          background: "rgba(255,255,255,0.02)",
          border: "1px solid rgba(255,255,255,0.06)",
          borderTop: "none", borderRadius: "0 0 14px 14px", padding: "12px 14px",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 10 }}>
            <span style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: 1 }}>Categories ({budget.categories.length})</span>
            <SpendingBars categories={budget.categories} />
          </div>

          {budget.categories.map((c, i) => {
            const cPct = Math.round((c.spent / c.budgeted) * 100);
            const over = c.spent > c.budgeted;
            return (
              <div key={i} style={{
                display: "flex", alignItems: "center", gap: 8, padding: "6px 0",
                borderBottom: i < budget.categories.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
              }}>
                <span style={{ width: 8, height: 8, borderRadius: 4, background: c.color, flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: "white", flex: 1 }}>{c.name}</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: over ? "#ef4444" : "rgba(255,255,255,0.7)" }}>{fmt(c.spent)}</span>
                <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>/ {fmt(c.budgeted)}</span>
              </div>
            );
          })}

          <div style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
            marginTop: 10, cursor: "pointer",
          }}>
            <Eye size={12} color="#a855f7" />
            <span style={{ fontSize: 11, fontWeight: 600, color: "#a855f7" }}>View all transactions</span>
          </div>
        </div>
      )}
    </div>
  );
};

/* ─── Bill Budget Card ─── */
const BillBudgetCard = ({ bill }) => {
  const isPaid = bill.isPaid;
  return (
    <div style={{
      background: "rgba(255,255,255,0.04)",
      border: "1px solid rgba(255,255,255,0.06)",
      borderRadius: 14, padding: "12px 14px", marginBottom: 8,
      display: "flex", alignItems: "center", gap: 12,
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: 8,
        background: "rgba(96,165,250,0.12)",
        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
      }}>
        <Receipt size={14} color="#60a5fa" />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <OwnerDot owner={bill.owner} />
          <span style={{ fontSize: 13, fontWeight: 600, color: "white" }}>{bill.name}</span>
          <span style={{
            fontSize: 10, fontWeight: 600, padding: "2px 6px", borderRadius: 6,
            background: isPaid ? "rgba(52,211,153,0.12)" : "rgba(251,191,36,0.12)",
            color: isPaid ? "#34d399" : "#fbbf24",
          }}>{isPaid ? "Paid" : "Unpaid"}</span>
        </div>
        <div style={{ marginTop: 4 }}>
          <ProgressBar percent={isPaid ? 100 : 0} color={isPaid ? "#34d399" : "#60a5fa"} height={3} />
        </div>
      </div>
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: "white" }}>{fmt(bill.budgeted)}</span>
        {bill.isShared && (
          <div style={{ display: "flex", alignItems: "center", gap: 3, justifyContent: "flex-end", marginTop: 2 }}>
            <Users size={9} color="#a855f7" />
            <span style={{ fontSize: 9, color: "#a855f7" }}>Shared</span>
          </div>
        )}
      </div>
    </div>
  );
};

/* ─── Main Screen ─── */
export default function BudgetScreenRedesign() {
  const [activeTab, setActiveTab] = useState("finance");
  const [budgetsExpanded, setBudgetsExpanded] = useState(true);
  const [billsExpanded, setBillsExpanded] = useState(true);

  const billsPaid = billBudgets.filter(b => b.isPaid).length;
  const billsTotal = billBudgets.reduce((s, b) => s + b.budgeted, 0);

  return (
    <div style={{
      width: 393, height: 852, borderRadius: 40,
      border: "3px solid #2a2a2a",
      background: "linear-gradient(180deg, #0f0a1e 0%, #1a1035 30%, #0f0a1e 100%)",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif",
      color: "white", position: "relative", overflow: "hidden",
      margin: "0 auto",
    }}>
      {/* Status bar */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "14px 28px 0", fontSize: 14, fontWeight: 600,
      }}>
        <span>9:41</span>
        <div style={{ display: "flex", gap: 6 }}><span style={{ fontSize: 12 }}>●●●●</span></div>
      </div>

      {/* Header */}
      <div style={{ padding: "16px 20px 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 22, fontWeight: 700 }}>Budgets</span>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Sparkles size={18} color="rgba(255,255,255,0.35)" style={{ cursor: "pointer" }} />
          <div style={{
            width: 36, height: 36, borderRadius: 12,
            background: "linear-gradient(135deg, #7c3aed, #a855f7)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 4px 12px rgba(124,58,237,0.3)", cursor: "pointer",
          }}>
            <Plus size={18} color="white" />
          </div>
        </div>
      </div>

      {/* Month switcher */}
      <div style={{
        display: "flex", justifyContent: "center", alignItems: "center", gap: 16,
        padding: "12px 20px",
      }}>
        <div style={{ cursor: "pointer", padding: 4 }}><ChevronLeft size={18} color="rgba(255,255,255,0.5)" /></div>
        <span style={{ fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.8)" }}>{summary.month}</span>
        <div style={{ cursor: "pointer", padding: 4 }}><ChevronRight size={18} color="rgba(255,255,255,0.5)" /></div>
      </div>

      <div style={{
        flex: 1, overflowY: "auto", height: "calc(100% - 210px)",
        padding: "0 20px 20px", scrollbarWidth: "none",
      }}>

        {/* ── Monthly Overview Hero ── */}
        <div style={{
          background: "linear-gradient(135deg, rgba(124,58,237,0.15) 0%, rgba(168,85,247,0.08) 100%)",
          border: "1px solid rgba(168,85,247,0.2)",
          borderRadius: 16, padding: 18, marginBottom: 16,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.7)", textTransform: "uppercase", letterSpacing: 0.5 }}>Monthly Overview</span>
            <span style={{
              fontSize: 11, fontWeight: 700, color: usedPct > 80 ? "#ef4444" : "#a855f7",
              background: usedPct > 80 ? "rgba(239,68,68,0.12)" : "rgba(168,85,247,0.15)",
              borderRadius: 8, padding: "3px 8px",
            }}>{usedPct}% used</span>
          </div>

          {/* Stat row */}
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
            <div>
              <p style={{ margin: 0, fontSize: 10, color: "rgba(255,255,255,0.35)" }}>Income</p>
              <p style={{ margin: "2px 0 0", fontSize: 18, fontWeight: 800 }}>{fmtShort(summary.totalIncome)}</p>
            </div>
            <div style={{ textAlign: "center" }}>
              <p style={{ margin: 0, fontSize: 10, color: "rgba(255,255,255,0.35)" }}>Budgeted</p>
              <p style={{ margin: "2px 0 0", fontSize: 18, fontWeight: 800, color: "#f59e0b" }}>{fmtShort(summary.totalBudgeted)}</p>
            </div>
            <div style={{ textAlign: "right" }}>
              <p style={{ margin: 0, fontSize: 10, color: "rgba(255,255,255,0.35)" }}>Remaining</p>
              <p style={{ margin: "2px 0 0", fontSize: 18, fontWeight: 800, color: "#10b981" }}>{fmtShort(summary.totalRemaining)}</p>
            </div>
          </div>

          {/* Main progress bar */}
          <ProgressBar percent={usedPct} color={usedPct > 80 ? "#ef4444" : "#a855f7"} height={6} />
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
            <span style={{ fontSize: 10, color: "rgba(255,255,255,0.4)" }}>{fmt(summary.totalSpent)} spent</span>
            <span style={{ fontSize: 10, color: "rgba(255,255,255,0.4)" }}>{fmt(summary.totalRemaining)} left</span>
          </div>
        </div>

        {/* ── AI Alert Card ── */}
        {expenseBudgets.some(b => b.spent > b.budgeted) && (
          <div style={{
            background: "linear-gradient(135deg, rgba(124,58,237,0.12), rgba(168,85,247,0.06))",
            border: "1px solid rgba(168,85,247,0.15)",
            borderRadius: 14, padding: "12px 14px", marginBottom: 16,
            display: "flex", alignItems: "center", gap: 10,
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: "linear-gradient(135deg, #7c3aed, #a855f7)",
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>
              <Sparkles size={14} color="white" />
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontSize: 12, color: "rgba(255,255,255,0.85)", lineHeight: 1.4 }}>
                <strong style={{ color: "#ef4444" }}>Transport</strong> is over budget by {fmt(410.30 - 350)}. Consider reducing Uber rides to stay on track.
              </p>
            </div>
          </div>
        )}

        {/* ── Owner Legend ── */}
        <div style={{ display: "flex", gap: 14, marginBottom: 12, paddingLeft: 4 }}>
          {["You", "Partner", "Joint"].map(o => (
            <div key={o} style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <OwnerDot owner={o} />
              <span style={{ fontSize: 10, color: "rgba(255,255,255,0.4)" }}>{o}</span>
            </div>
          ))}
        </div>

        {/* ── Budgets Section Header ── */}
        <div onClick={() => setBudgetsExpanded(!budgetsExpanded)} style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "10px 0", cursor: "pointer",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 28, height: 28, borderRadius: 8,
              background: "rgba(192,132,252,0.12)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Wallet size={14} color="#c084fc" />
            </div>
            <div>
              <span style={{ fontSize: 14, fontWeight: 700, color: "white" }}>Budgets ({budgets.length})</span>
              <div style={{ display: "flex", gap: 8, marginTop: 1 }}>
                <span style={{ fontSize: 10, color: "#34d399" }}>{incomeBudgets.length} income</span>
                <span style={{ fontSize: 10, color: "rgba(255,255,255,0.25)" }}>&middot;</span>
                <span style={{ fontSize: 10, color: "#f87171" }}>{expenseBudgets.length} expense</span>
              </div>
            </div>
          </div>
          {budgetsExpanded ? <ChevronUp size={16} color="rgba(255,255,255,0.35)" /> : <ChevronDown size={16} color="rgba(255,255,255,0.35)" />}
        </div>

        {budgetsExpanded && budgets.map(b => <BudgetCard key={b.id} budget={b} />)}

        {/* ── Bills Section Header ── */}
        <div onClick={() => setBillsExpanded(!billsExpanded)} style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "10px 0", marginTop: 4, cursor: "pointer",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 28, height: 28, borderRadius: 8,
              background: "rgba(96,165,250,0.12)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Receipt size={14} color="#60a5fa" />
            </div>
            <div>
              <span style={{ fontSize: 14, fontWeight: 700, color: "white" }}>Bills ({billBudgets.length})</span>
              <div style={{ display: "flex", gap: 8, marginTop: 1 }}>
                <span style={{ fontSize: 10, color: "#34d399" }}>{billsPaid} of {billBudgets.length} paid</span>
                <span style={{ fontSize: 10, color: "rgba(255,255,255,0.25)" }}>&middot;</span>
                <span style={{ fontSize: 10, color: "rgba(255,255,255,0.5)" }}>{fmt(billsTotal)}</span>
              </div>
            </div>
          </div>
          {billsExpanded ? <ChevronUp size={16} color="rgba(255,255,255,0.35)" /> : <ChevronDown size={16} color="rgba(255,255,255,0.35)" />}
        </div>

        {billsExpanded && billBudgets.map(b => <BillBudgetCard key={b.id} bill={b} />)}

        <div style={{ height: 20 }} />
      </div>

      {/* ── FAB ── */}
      <div style={{
        position: "absolute", bottom: 90, right: 20,
        width: 52, height: 52, borderRadius: 26,
        background: "linear-gradient(135deg, #7c3aed, #a855f7)",
        display: "flex", alignItems: "center", justifyContent: "center",
        boxShadow: "0 4px 20px rgba(124,58,237,0.4)", zIndex: 10,
        cursor: "pointer",
      }}>
        <Plus size={22} color="white" />
      </div>

      {/* ── Tab Bar ── */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0,
        background: "rgba(15,10,30,0.95)", backdropFilter: "blur(20px)",
        borderTop: "1px solid rgba(255,255,255,0.06)",
        display: "flex", justifyContent: "space-around", alignItems: "center",
        padding: "10px 0 28px", zIndex: 5,
      }}>
        {[
          { icon: <Home size={20} />, label: "Home", id: "home" },
          { icon: <Calendar size={20} />, label: "Calendar", id: "calendar" },
          { icon: <Bot size={20} />, label: "AI", id: "ai" },
          { icon: <PieChart size={20} />, label: "Finance", id: "finance" },
          { icon: <Settings size={20} />, label: "Settings", id: "settings" },
        ].map(tab => (
          <div key={tab.id} style={{
            display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
            color: tab.id === activeTab ? "#a855f7" : "rgba(255,255,255,0.35)",
            cursor: "pointer",
          }} onClick={() => setActiveTab(tab.id)}>
            {tab.icon}
            <span style={{ fontSize: 9, fontWeight: 500 }}>{tab.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
