import { useState, useMemo } from "react";
import {
  ChevronLeft, ChevronDown, ChevronRight, Plus, Flame, Shield, TrendingDown,
  CreditCard, Home, GraduationCap, Car, Heart, MoreHorizontal, Calculator,
  Zap, ArrowDownRight, ArrowUpRight, DollarSign, Target, Calendar,
  Bot, PieChart, Settings, Wallet, Clock, CheckCircle, AlertTriangle
} from "lucide-react";

// ── Colors ──
const C = {
  bg: "#0f0a1e",
  surface: "rgba(255,255,255,0.06)",
  surfaceHover: "rgba(255,255,255,0.08)",
  border: "rgba(255,255,255,0.08)",
  accent: "#a855f7",
  accentDark: "#7c3aed",
  pink: "#ec4899",
  income: "#34d399",
  attack: "#f87171",
  structured: "#60a5fa",
  warning: "#fbbf24",
  textPrimary: "#f8fafc",
  textMuted: "#94a3b8",
  textDim: "rgba(255,255,255,0.3)",
};

const fmt = (n) => "$" + Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtShort = (n) => {
  if (n >= 1000) return "$" + (n / 1000).toFixed(n >= 100000 ? 0 : 1).replace(/\.0$/, "") + "k";
  return "$" + n.toLocaleString();
};

// ── Debt type icons ──
const debtIcon = (type) => {
  const map = {
    "Credit Card": <CreditCard size={16} />,
    "Mortgage": <Home size={16} />,
    "Student": <GraduationCap size={16} />,
    "Auto": <Car size={16} />,
    "Personal": <Wallet size={16} />,
    "Medical": <Heart size={16} />,
  };
  return map[type] || <MoreHorizontal size={16} />;
};

// ── Mini progress ring ──
const MiniRing = ({ percent, size = 40, stroke = 3, color }) => {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (percent / 100) * circ;
  return (
    <svg width={size} height={size}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={stroke} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        transform={`rotate(-90 ${size/2} ${size/2})`} />
    </svg>
  );
};

// ── Payoff timeline bar ──
const PayoffTimeline = ({ debts }) => {
  const maxMonths = Math.max(...debts.map(d => d.estMonths));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {debts.map((d, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 10, color: C.textMuted, width: 70, textAlign: "right", flexShrink: 0 }}>{d.name}</span>
          <div style={{ flex: 1, height: 8, background: "rgba(255,255,255,0.06)", borderRadius: 4, overflow: "hidden" }}>
            <div style={{
              height: 8, borderRadius: 4,
              width: `${(d.estMonths / maxMonths) * 100}%`,
              background: d.category === "attack"
                ? `linear-gradient(90deg, ${C.attack}, ${C.attack}88)`
                : `linear-gradient(90deg, ${C.structured}, ${C.structured}88)`,
              transition: "width 0.5s ease"
            }} />
          </div>
          <span style={{ fontSize: 10, color: C.textMuted, width: 50, flexShrink: 0 }}>{d.estDate}</span>
        </div>
      ))}
    </div>
  );
};

// ── Mock data ──
const mockDebts = [
  {
    id: "1", name: "Amex Card", type: "Credit Card", balance: 2300, apr: 22.9,
    minPayment: 65, dueDay: 15, category: "attack", strategy: "avalanche",
    originalBalance: 10500, paidPercent: 78, estMonths: 3, estDate: "Jul '26",
    owner: "You", isShared: false
  },
  {
    id: "2", name: "Student Loan", type: "Student", balance: 18200, apr: 4.5,
    minPayment: 285, dueDay: 1, category: "attack", strategy: "avalanche",
    originalBalance: 31400, paidPercent: 42, estMonths: 36, estDate: "Mar '29",
    owner: "You", isShared: false
  },
  {
    id: "3", name: "Car Loan", type: "Auto", balance: 8400, apr: 5.9,
    minPayment: 320, dueDay: 20, category: "structured", strategy: "none",
    originalBalance: 22000, paidPercent: 62, estMonths: 24, estDate: "Apr '28",
    owner: "Partner", isShared: true
  },
  {
    id: "4", name: "Mortgage", type: "Mortgage", balance: 151100, apr: 5.2,
    minPayment: 1450, dueDay: 1, category: "structured", strategy: "none",
    originalBalance: 172000, paidPercent: 12, estMonths: 288, estDate: "Feb '51",
    owner: "Joint", isShared: true
  },
];

const ownerColor = (o) => o === "Partner" ? C.pink : o === "Joint" ? C.income : C.accent;

// ── Debt Card ──
const DebtCard = ({ debt, expanded, onToggle }) => {
  const catColor = debt.category === "attack" ? C.attack : C.structured;
  const icon = debtIcon(debt.type);

  return (
    <div style={{
      background: C.surface, borderRadius: 16, overflow: "hidden",
      border: `1px solid ${C.border}`, marginBottom: 8
    }}>
      {/* Main row */}
      <div onClick={onToggle} style={{
        display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", cursor: "pointer"
      }}>
        {/* Icon + ring */}
        <div style={{ position: "relative", flexShrink: 0 }}>
          <MiniRing percent={debt.paidPercent} size={42} stroke={3} color={catColor} />
          <div style={{
            position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
            color: catColor, display: "flex", alignItems: "center", justifyContent: "center"
          }}>{icon}</div>
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: C.textPrimary }}>{debt.name}</span>
            <span style={{
              fontSize: 8, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase",
              color: catColor, background: `${catColor}18`, padding: "2px 6px", borderRadius: 4
            }}>{debt.category}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 3 }}>
            <div style={{ width: 5, height: 5, borderRadius: 3, background: ownerColor(debt.owner) }} />
            <span style={{ fontSize: 10, color: C.textMuted }}>
              {debt.owner} · {debt.apr}% APR · Due {debt.dueDay}th
            </span>
          </div>
        </div>

        {/* Balance + chevron */}
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: C.textPrimary }}>{fmt(debt.balance)}</span>
          <div style={{ fontSize: 10, color: C.textMuted, marginTop: 1 }}>
            {debt.paidPercent}% paid
          </div>
        </div>
        <ChevronDown size={14} color={C.textDim} style={{
          transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
          transition: "transform 0.2s", flexShrink: 0
        }} />
      </div>

      {/* Progress bar */}
      <div style={{ padding: "0 16px 12px" }}>
        <div style={{ height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 2 }}>
          <div style={{
            height: 4, width: `${debt.paidPercent}%`, borderRadius: 2,
            background: `linear-gradient(90deg, ${catColor}, ${catColor}88)`,
          }} />
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div style={{
          padding: "0 16px 16px",
          borderTop: `1px solid ${C.border}`,
          paddingTop: 14
        }}>
          {/* Stats grid */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 14 }}>
            {[
              { label: "Min Payment", value: fmt(debt.minPayment), icon: <DollarSign size={11} /> },
              { label: "Payoff Date", value: debt.estDate, icon: <Calendar size={11} /> },
              { label: "Strategy", value: debt.strategy === "avalanche" ? "Avalanche" : debt.strategy === "snowball" ? "Snowball" : "Standard", icon: <Target size={11} /> },
            ].map((s, i) => (
              <div key={i} style={{
                background: "rgba(0,0,0,0.2)", borderRadius: 10, padding: "10px 8px", textAlign: "center"
              }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4, marginBottom: 4 }}>
                  <span style={{ color: C.textDim }}>{s.icon}</span>
                  <span style={{ fontSize: 9, color: C.textMuted, fontWeight: 500 }}>{s.label}</span>
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: C.textPrimary }}>{s.value}</span>
              </div>
            ))}
          </div>

          {/* Action buttons */}
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{
              flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              padding: "10px 0", borderRadius: 10,
              background: `linear-gradient(135deg, ${C.accent}, ${C.accentDark})`,
              cursor: "pointer"
            }}>
              <DollarSign size={14} color="white" />
              <span style={{ fontSize: 12, fontWeight: 700, color: "white" }}>Make Payment</span>
            </div>
            <div style={{
              flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              padding: "10px 0", borderRadius: 10,
              border: `1px solid ${C.border}`, background: "rgba(255,255,255,0.03)",
              cursor: "pointer"
            }}>
              <span style={{ fontSize: 12, fontWeight: 500, color: C.textMuted }}>Edit Details</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


export default function DebtsScreenRedesign() {
  const [expandedId, setExpandedId] = useState("1");
  const [activeFilter, setActiveFilter] = useState("all"); // all | attack | structured

  const totalDebt = mockDebts.reduce((s, d) => s + d.balance, 0);
  const totalMin = mockDebts.reduce((s, d) => s + d.minPayment, 0);
  const attackDebts = mockDebts.filter(d => d.category === "attack");
  const structuredDebts = mockDebts.filter(d => d.category === "structured");
  const attackTotal = attackDebts.reduce((s, d) => s + d.balance, 0);
  const structuredTotal = structuredDebts.reduce((s, d) => s + d.balance, 0);

  const filtered = activeFilter === "all" ? mockDebts
    : mockDebts.filter(d => d.category === activeFilter);

  // Weighted average APR
  const weightedApr = totalDebt > 0
    ? mockDebts.reduce((s, d) => s + d.apr * d.balance, 0) / totalDebt
    : 0;

  return (
    <div style={{
      width: 393, height: 852,
      background: "linear-gradient(180deg, #0f0a1e 0%, #1a1035 30%, #0f0a1e 100%)",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif",
      color: "white", position: "relative", overflow: "hidden",
      borderRadius: 40, border: "3px solid #2a2a2a", margin: "0 auto"
    }}>
      {/* Status bar */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "14px 28px 0", fontSize: 14, fontWeight: 600
      }}>
        <span>4:03</span>
        <span style={{ fontSize: 12 }}>●●●●</span>
      </div>

      {/* Scrollable content */}
      <div style={{
        overflowY: "auto", height: "calc(100% - 110px)",
        padding: "8px 0 20px", scrollbarWidth: "none"
      }}>

        {/* ── Header ── */}
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "0 20px", marginBottom: 16
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ cursor: "pointer", padding: 2 }}>
              <ChevronLeft size={20} color={C.textMuted} />
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>Debts</h1>
          </div>
          <div style={{
            width: 34, height: 34, borderRadius: 10, background: C.surface,
            display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
            border: `1px solid ${C.border}`
          }}>
            <Plus size={18} color={C.accent} />
          </div>
        </div>

        {/* ── Hero Summary Card ── */}
        <div style={{
          margin: "0 16px", borderRadius: 20, padding: 20, marginBottom: 16,
          background: "linear-gradient(135deg, rgba(248,113,113,0.08) 0%, rgba(168,85,247,0.06) 100%)",
          border: "1px solid rgba(248,113,113,0.12)"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <p style={{ margin: 0, fontSize: 12, color: C.textMuted, fontWeight: 500 }}>Total Debt</p>
              <p style={{ margin: "4px 0 0", fontSize: 30, fontWeight: 800, letterSpacing: -1 }}>{fmt(totalDebt)}</p>
            </div>
            <div style={{
              display: "flex", alignItems: "center", gap: 4,
              background: "rgba(52,211,153,0.12)", borderRadius: 8, padding: "4px 8px"
            }}>
              <ArrowDownRight size={12} color={C.income} />
              <span style={{ fontSize: 11, color: C.income, fontWeight: 600 }}>-$1,420</span>
            </div>
          </div>

          {/* Stats row */}
          <div style={{
            display: "flex", gap: 8, marginTop: 16,
            background: "rgba(0,0,0,0.2)", borderRadius: 12, padding: "12px 10px"
          }}>
            <div style={{ flex: 1, textAlign: "center" }}>
              <p style={{ margin: 0, fontSize: 9, color: C.textMuted }}>Min. Payment</p>
              <p style={{ margin: "2px 0 0", fontSize: 14, fontWeight: 700, color: C.textPrimary }}>{fmt(totalMin)}</p>
            </div>
            <div style={{ width: 1, background: "rgba(255,255,255,0.06)" }} />
            <div style={{ flex: 1, textAlign: "center" }}>
              <p style={{ margin: 0, fontSize: 9, color: C.textMuted }}>Avg. APR</p>
              <p style={{ margin: "2px 0 0", fontSize: 14, fontWeight: 700, color: C.warning }}>{weightedApr.toFixed(1)}%</p>
            </div>
            <div style={{ width: 1, background: "rgba(255,255,255,0.06)" }} />
            <div style={{ flex: 1, textAlign: "center" }}>
              <p style={{ margin: 0, fontSize: 9, color: C.textMuted }}>Accounts</p>
              <p style={{ margin: "2px 0 0", fontSize: 14, fontWeight: 700, color: C.textPrimary }}>{mockDebts.length}</p>
            </div>
          </div>

          {/* Attack vs Structured breakdown */}
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <div style={{
              flex: 1, display: "flex", alignItems: "center", gap: 8,
              background: "rgba(248,113,113,0.08)", borderRadius: 10, padding: "10px 12px",
              border: "1px solid rgba(248,113,113,0.1)"
            }}>
              <Flame size={14} color={C.attack} />
              <div>
                <p style={{ margin: 0, fontSize: 9, color: C.attack, fontWeight: 600 }}>ATTACK</p>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>{fmtShort(attackTotal)}</p>
              </div>
            </div>
            <div style={{
              flex: 1, display: "flex", alignItems: "center", gap: 8,
              background: "rgba(96,165,250,0.08)", borderRadius: 10, padding: "10px 12px",
              border: "1px solid rgba(96,165,250,0.1)"
            }}>
              <Shield size={14} color={C.structured} />
              <div>
                <p style={{ margin: 0, fontSize: 9, color: C.structured, fontWeight: 600 }}>STRUCTURED</p>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>{fmtShort(structuredTotal)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* ── AI Insight ── */}
        <div style={{
          margin: "0 16px", marginBottom: 16, padding: "12px 14px", borderRadius: 14,
          background: "linear-gradient(135deg, rgba(124,58,237,0.1), rgba(168,85,247,0.05))",
          border: "1px solid rgba(168,85,247,0.15)",
          display: "flex", alignItems: "center", gap: 10
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: `linear-gradient(135deg, ${C.accentDark}, ${C.accent})`,
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0
          }}>
            <Bot size={16} color="white" />
          </div>
          <p style={{ margin: 0, fontSize: 12, color: "rgba(255,255,255,0.8)", lineHeight: 1.4, flex: 1 }}>
            Pay <strong style={{ color: C.accent }}>$200 extra</strong> on Amex Card to save $840 in interest and be debt-free by <strong style={{ color: C.accent }}>May '26</strong>.
          </p>
          <ChevronRight size={14} color={C.textDim} />
        </div>

        {/* ── Payoff Timeline ── */}
        <div style={{
          margin: "0 16px", background: C.surface, borderRadius: 16,
          padding: 16, border: `1px solid ${C.border}`, marginBottom: 16
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Clock size={14} color={C.accent} />
              <span style={{ fontSize: 13, fontWeight: 700 }}>Payoff Timeline</span>
            </div>
            <div onClick={() => {}} style={{
              display: "flex", alignItems: "center", gap: 4,
              background: "rgba(168,85,247,0.1)", borderRadius: 8, padding: "5px 10px",
              cursor: "pointer", border: "1px solid rgba(168,85,247,0.15)"
            }}>
              <Calculator size={11} color={C.accent} />
              <span style={{ fontSize: 10, fontWeight: 600, color: C.accent }}>Calculator</span>
            </div>
          </div>
          <PayoffTimeline debts={mockDebts.filter(d => d.category !== "structured" || d.type !== "Mortgage").map(d => ({
            name: d.name, estMonths: d.estMonths, estDate: d.estDate, category: d.category
          }))} />
          <p style={{ margin: "10px 0 0", fontSize: 10, color: C.textDim, textAlign: "center" }}>
            Mortgage excluded · Based on minimum payments
          </p>
        </div>

        {/* ── Filter Tabs ── */}
        <div style={{
          display: "flex", gap: 6, margin: "0 16px", marginBottom: 12
        }}>
          {[
            { id: "all", label: "All", count: mockDebts.length },
            { id: "attack", label: "Attack", count: attackDebts.length, color: C.attack },
            { id: "structured", label: "Structured", count: structuredDebts.length, color: C.structured },
          ].map(f => (
            <div key={f.id} onClick={() => setActiveFilter(f.id)} style={{
              display: "flex", alignItems: "center", gap: 5,
              padding: "7px 12px", borderRadius: 10, cursor: "pointer",
              background: activeFilter === f.id ? (f.color ? `${f.color}18` : "rgba(168,85,247,0.12)") : "rgba(255,255,255,0.04)",
              border: `1px solid ${activeFilter === f.id ? (f.color || C.accent) + "30" : C.border}`,
              transition: "all 0.15s"
            }}>
              {f.id === "attack" && <Flame size={11} color={activeFilter === f.id ? C.attack : C.textMuted} />}
              {f.id === "structured" && <Shield size={11} color={activeFilter === f.id ? C.structured : C.textMuted} />}
              <span style={{
                fontSize: 12, fontWeight: 600,
                color: activeFilter === f.id ? (f.color || C.accent) : C.textMuted
              }}>{f.label}</span>
              <span style={{
                fontSize: 10, fontWeight: 700,
                color: activeFilter === f.id ? (f.color || C.accent) : C.textDim,
                background: "rgba(255,255,255,0.06)", borderRadius: 6, padding: "1px 5px"
              }}>{f.count}</span>
            </div>
          ))}
        </div>

        {/* ── Debt Cards ── */}
        <div style={{ padding: "0 16px" }}>
          {filtered.map(debt => (
            <DebtCard
              key={debt.id}
              debt={debt}
              expanded={expandedId === debt.id}
              onToggle={() => setExpandedId(expandedId === debt.id ? null : debt.id)}
            />
          ))}
        </div>

        {/* ── Add Debt CTA ── */}
        <div style={{
          margin: "8px 16px 20px", padding: 14, borderRadius: 14,
          border: "1px dashed rgba(168,85,247,0.3)", background: "rgba(168,85,247,0.04)",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8, cursor: "pointer"
        }}>
          <Plus size={16} color={C.accent} />
          <span style={{ fontSize: 13, color: C.accent, fontWeight: 500 }}>Add New Debt</span>
        </div>
      </div>

      {/* ── Bottom Nav ── */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0,
        background: "rgba(15,10,30,0.95)", backdropFilter: "blur(20px)",
        borderTop: `1px solid ${C.border}`,
        display: "flex", justifyContent: "space-around", alignItems: "center",
        padding: "10px 0 28px", zIndex: 5
      }}>
        {[
          { icon: <Home size={20} />, label: "Home", id: "home" },
          { icon: <Calendar size={20} />, label: "Calendar", id: "calendar" },
          { icon: <Bot size={20} />, label: "AI", id: "ai" },
          { icon: <PieChart size={20} />, label: "Finances", id: "finances" },
          { icon: <Settings size={20} />, label: "Settings", id: "settings" },
        ].map(tab => (
          <div key={tab.id} style={{
            display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
            color: "rgba(255,255,255,0.35)", cursor: "pointer"
          }}>
            {tab.icon}
            <span style={{ fontSize: 9, fontWeight: 500 }}>{tab.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}