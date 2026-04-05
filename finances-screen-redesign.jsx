import { useState } from "react";
import {
  TrendingUp, TrendingDown, ArrowRight, ChevronRight, ChevronDown,
  Home as HomeIcon, Calendar, Bot, PieChart, Settings,
  Building2, CreditCard, Landmark, Wallet, Car, GraduationCap,
  DollarSign, BarChart3, ArrowUpRight, ArrowDownRight,
  Eye, EyeOff, RefreshCw, Plus, CircleDot
} from "lucide-react";

// ── Donut chart for asset allocation ──
const DonutChart = ({ segments, size = 140, strokeWidth = 18 }) => {
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  let offset = 0;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {/* background ring */}
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth={strokeWidth} />
      {segments.map((seg, i) => {
        const dash = (seg.pct / 100) * circ;
        const gap = circ - dash;
        const rot = (offset / 100) * 360 - 90;
        offset += seg.pct;
        return (
          <circle key={i} cx={size/2} cy={size/2} r={r} fill="none"
            stroke={seg.color} strokeWidth={strokeWidth}
            strokeDasharray={`${dash} ${gap}`}
            strokeLinecap="round"
            transform={`rotate(${rot} ${size/2} ${size/2})`}
            style={{ transition: "all 0.6s ease" }}
          />
        );
      })}
    </svg>
  );
};

// ── Sparkline ──
const Sparkline = ({ data, color, width = 100, height = 36 }) => {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  }).join(" ");
  const areaPoints = `0,${height} ${points} ${width},${height}`;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <defs>
        <linearGradient id={`sg-${color.replace('#','')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <polygon points={areaPoints} fill={`url(#sg-${color.replace('#','')})`} />
      <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

// ── Monthly cash flow bar chart ──
const CashFlowChart = ({ data }) => {
  const maxVal = Math.max(...data.map(d => Math.max(d.income, d.expenses)));
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 100, padding: "0 2px" }}>
      {data.map((d, i) => (
        <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1, gap: 2 }}>
          <div style={{ display: "flex", gap: 2, alignItems: "flex-end", height: 72 }}>
            <div style={{
              width: 12, borderRadius: 3,
              height: Math.max(4, (d.income / maxVal) * 68),
              background: "linear-gradient(180deg, #10b981 0%, #059669 100%)",
            }} />
            <div style={{
              width: 12, borderRadius: 3,
              height: Math.max(4, (d.expenses / maxVal) * 68),
              background: "linear-gradient(180deg, #ef4444 0%, #dc2626 100%)",
              opacity: 0.8
            }} />
          </div>
          <span style={{ fontSize: 9, color: "rgba(255,255,255,0.35)" }}>{d.month}</span>
        </div>
      ))}
    </div>
  );
};

export default function FinancesScreen() {
  const [activeTab, setActiveTab] = useState("finances");
  const [balanceVisible, setBalanceVisible] = useState(true);
  const [expandedSection, setExpandedSection] = useState("assets");

  // ── Data ──
  const netWorthHistory = [372000, 378000, 382000, 385000, 390000, 399100];
  const cashFlowData = [
    { month: "Nov", income: 8200, expenses: 6100 },
    { month: "Dec", income: 8500, expenses: 7800 },
    { month: "Jan", income: 8200, expenses: 5900 },
    { month: "Feb", income: 8200, expenses: 6400 },
    { month: "Mar", income: 8700, expenses: 5200 },
    { month: "Apr", income: 8200, expenses: 3100 },
  ];

  const allocationSegments = [
    { label: "Property", pct: 62, color: "#7c3aed", amount: "$248,000" },
    { label: "Investments", pct: 22, color: "#10b981", amount: "$87,800" },
    { label: "Cash", pct: 11, color: "#3b82f6", amount: "$43,900" },
    { label: "Other", pct: 5, color: "#f59e0b", amount: "$19,400" },
  ];

  const accounts = {
    assets: [
      { name: "Primary Home", subtitle: "Zillow estimate", icon: <Building2 size={16} />, balance: 399100, color: "#7c3aed", trend: [380, 385, 390, 392, 396, 399] },
      { name: "Joint Checking", subtitle: "Chase ••4521", icon: <Landmark size={16} />, balance: 12450, color: "#3b82f6", trend: [10, 11, 9, 12, 11, 12.4] },
      { name: "Savings", subtitle: "Marcus ••8832", icon: <Wallet size={16} />, balance: 31450, color: "#3b82f6", trend: [25, 26, 27, 28, 30, 31.4] },
      { name: "Brokerage", subtitle: "Fidelity ••2291", icon: <BarChart3 size={16} />, balance: 54200, color: "#10b981", trend: [45, 48, 50, 49, 52, 54.2] },
      { name: "401(k) - You", subtitle: "Fidelity ••7810", icon: <BarChart3 size={16} />, balance: 33600, color: "#10b981", trend: [28, 29, 30, 31, 32, 33.6] },
    ],
    debts: [
      { name: "Mortgage", subtitle: "Chase ••4521 · 5.2%", icon: <Building2 size={16} />, balance: -151100, color: "#ef4444", trend: [155, 154, 153, 152.5, 151.8, 151.1] },
      { name: "Student Loan", subtitle: "Navient ••3302 · 4.5%", icon: <GraduationCap size={16} />, balance: -18200, color: "#ef4444", trend: [21, 20, 19.5, 19, 18.6, 18.2] },
      { name: "Credit Card", subtitle: "Amex ••9012 · 22.9%", icon: <CreditCard size={16} />, balance: -2300, color: "#ef4444", trend: [3.5, 3, 2.8, 2.9, 2.5, 2.3] },
    ]
  };

  const totalAssets = accounts.assets.reduce((s, a) => s + a.balance, 0);
  const totalDebts = accounts.debts.reduce((s, a) => s + a.balance, 0);
  const netWorth = totalAssets + totalDebts;

  const fmt = (n) => {
    const abs = Math.abs(n);
    if (abs >= 1000) return (n < 0 ? "-" : "") + "$" + (abs / 1000).toFixed(abs >= 100000 ? 0 : 1).replace(/\.0$/, '') + "k";
    return (n < 0 ? "-" : "") + "$" + abs.toLocaleString();
  };
  const fmtFull = (n) => (n < 0 ? "-" : "") + "$" + Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const SectionHeader = ({ title, total, expanded, onToggle, count }) => (
    <div onClick={onToggle} style={{
      display: "flex", justifyContent: "space-between", alignItems: "center",
      padding: "12px 0", cursor: "pointer"
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {expanded ? <ChevronDown size={16} color="rgba(255,255,255,0.4)" /> : <ChevronRight size={16} color="rgba(255,255,255,0.4)" />}
        <span style={{ fontSize: 14, fontWeight: 600 }}>{title}</span>
        <span style={{
          fontSize: 10, background: "rgba(255,255,255,0.08)", borderRadius: 10,
          padding: "2px 7px", color: "rgba(255,255,255,0.4)"
        }}>{count}</span>
      </div>
      <span style={{
        fontSize: 14, fontWeight: 600,
        color: total < 0 ? "#ef4444" : "#10b981"
      }}>{balanceVisible ? fmtFull(total) : "••••••"}</span>
    </div>
  );

  const AccountRow = ({ account }) => (
    <div style={{
      display: "flex", alignItems: "center", gap: 12,
      padding: "12px 14px", marginBottom: 6,
      background: "rgba(255,255,255,0.03)", borderRadius: 12,
      border: "1px solid rgba(255,255,255,0.04)"
    }}>
      <div style={{
        width: 38, height: 38, borderRadius: 10,
        background: `${account.color}18`,
        display: "flex", alignItems: "center", justifyContent: "center",
        color: account.color, flexShrink: 0
      }}>
        {account.icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{account.name}</p>
        <p style={{ margin: 0, fontSize: 10, color: "rgba(255,255,255,0.35)" }}>{account.subtitle}</p>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Sparkline data={account.trend} color={account.balance < 0 ? "#ef4444" : "#10b981"} width={50} height={24} />
        <div style={{ textAlign: "right", minWidth: 70 }}>
          <p style={{
            margin: 0, fontSize: 13, fontWeight: 600,
            color: account.balance < 0 ? "#ef4444" : "white"
          }}>{balanceVisible ? fmtFull(account.balance) : "••••••"}</p>
        </div>
      </div>
    </div>
  );

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
        <div style={{ display: "flex", gap: 6 }}><span style={{ fontSize: 12 }}>●●●●</span></div>
      </div>

      {/* Scrollable content */}
      <div style={{
        overflowY: "auto", height: "calc(100% - 110px)",
        padding: "12px 20px 20px",
        scrollbarWidth: "none"
      }}>

        {/* Page header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Finances</h1>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <div onClick={() => setBalanceVisible(!balanceVisible)} style={{ cursor: "pointer", padding: 4 }}>
              {balanceVisible ? <Eye size={18} color="rgba(255,255,255,0.5)" /> : <EyeOff size={18} color="rgba(255,255,255,0.5)" />}
            </div>
            <div style={{ padding: 4, cursor: "pointer" }}>
              <RefreshCw size={16} color="rgba(255,255,255,0.5)" />
            </div>
          </div>
        </div>

        {/* ── Net Worth Hero Card ── */}
        <div style={{
          background: "linear-gradient(135deg, rgba(124,58,237,0.12) 0%, rgba(16,185,129,0.06) 100%)",
          border: "1px solid rgba(168,85,247,0.15)",
          borderRadius: 20, padding: "20px", marginBottom: 16
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <p style={{ margin: 0, fontSize: 12, color: "rgba(255,255,255,0.5)", fontWeight: 500, letterSpacing: 0.3 }}>Combined Net Worth</p>
              <p style={{ margin: "6px 0 0", fontSize: 32, fontWeight: 800, letterSpacing: -1 }}>
                {balanceVisible ? "$399,100" : "••••••••"}
              </p>
              <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 6 }}>
                <div style={{
                  display: "flex", alignItems: "center", gap: 3,
                  background: "rgba(16,185,129,0.15)", borderRadius: 6, padding: "3px 7px"
                }}>
                  <ArrowUpRight size={11} color="#10b981" />
                  <span style={{ fontSize: 11, color: "#10b981", fontWeight: 600 }}>+3.7%</span>
                </div>
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>+$14,100 this month</span>
              </div>
            </div>
            <Sparkline data={netWorthHistory} color="#10b981" width={90} height={48} />
          </div>

          {/* Assets / Debts summary bar */}
          <div style={{
            display: "flex", gap: 10, marginTop: 16,
            background: "rgba(0,0,0,0.2)", borderRadius: 12, padding: "12px 14px"
          }}>
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontSize: 10, color: "rgba(255,255,255,0.4)", fontWeight: 500 }}>Total Assets</p>
              <p style={{ margin: "2px 0 0", fontSize: 16, fontWeight: 700, color: "#10b981" }}>
                {balanceVisible ? fmtFull(totalAssets) : "••••••"}
              </p>
            </div>
            <div style={{ width: 1, background: "rgba(255,255,255,0.08)" }} />
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontSize: 10, color: "rgba(255,255,255,0.4)", fontWeight: 500 }}>Total Debts</p>
              <p style={{ margin: "2px 0 0", fontSize: 16, fontWeight: 700, color: "#ef4444" }}>
                {balanceVisible ? fmtFull(totalDebts) : "••••••"}
              </p>
            </div>
          </div>
        </div>

        {/* ── Asset Allocation Donut ── */}
        <div style={{
          background: "rgba(255,255,255,0.04)", borderRadius: 16, padding: "16px",
          marginBottom: 16, border: "1px solid rgba(255,255,255,0.06)"
        }}>
          <p style={{ margin: "0 0 14px", fontSize: 13, fontWeight: 600 }}>Asset Allocation</p>
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <div style={{ position: "relative", flexShrink: 0 }}>
              <DonutChart segments={allocationSegments} size={120} strokeWidth={16} />
              <div style={{
                position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
                textAlign: "center"
              }}>
                <p style={{ margin: 0, fontSize: 8, color: "rgba(255,255,255,0.4)" }}>TOTAL</p>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>{balanceVisible ? fmt(totalAssets) : "•••"}</p>
              </div>
            </div>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
              {allocationSegments.map((seg, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 4, background: seg.color }} />
                    <span style={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}>{seg.label}</span>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <span style={{ fontSize: 12, fontWeight: 600 }}>{seg.pct}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Cash Flow Chart ── */}
        <div style={{
          background: "rgba(255,255,255,0.04)", borderRadius: 16, padding: "16px",
          marginBottom: 16, border: "1px solid rgba(255,255,255,0.06)"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>Cash Flow</p>
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>6 months</span>
          </div>

          <CashFlowChart data={cashFlowData} />

          <div style={{
            display: "flex", justifyContent: "center", gap: 20,
            marginTop: 12, paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.05)"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: "#10b981" }} />
              <span style={{ fontSize: 10, color: "rgba(255,255,255,0.45)" }}>Income</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: "#ef4444", opacity: 0.8 }} />
              <span style={{ fontSize: 10, color: "rgba(255,255,255,0.45)" }}>Expenses</span>
            </div>
          </div>

          {/* Current month summary */}
          <div style={{
            display: "flex", gap: 10, marginTop: 12,
            background: "rgba(0,0,0,0.15)", borderRadius: 10, padding: "10px 12px"
          }}>
            <div style={{ flex: 1, textAlign: "center" }}>
              <p style={{ margin: 0, fontSize: 9, color: "rgba(255,255,255,0.35)" }}>Apr Income</p>
              <p style={{ margin: "2px 0 0", fontSize: 14, fontWeight: 700, color: "#10b981" }}>$8,200</p>
            </div>
            <div style={{ width: 1, background: "rgba(255,255,255,0.06)" }} />
            <div style={{ flex: 1, textAlign: "center" }}>
              <p style={{ margin: 0, fontSize: 9, color: "rgba(255,255,255,0.35)" }}>Apr Spent</p>
              <p style={{ margin: "2px 0 0", fontSize: 14, fontWeight: 700, color: "#ef4444" }}>$3,100</p>
            </div>
            <div style={{ width: 1, background: "rgba(255,255,255,0.06)" }} />
            <div style={{ flex: 1, textAlign: "center" }}>
              <p style={{ margin: 0, fontSize: 9, color: "rgba(255,255,255,0.35)" }}>Saved</p>
              <p style={{ margin: "2px 0 0", fontSize: 14, fontWeight: 700, color: "#a855f7" }}>$5,100</p>
            </div>
          </div>
        </div>

        {/* ── Accounts List ── */}
        <div style={{
          background: "rgba(255,255,255,0.04)", borderRadius: 16, padding: "4px 16px 12px",
          marginBottom: 16, border: "1px solid rgba(255,255,255,0.06)"
        }}>
          {/* Assets section */}
          <SectionHeader
            title="Assets" total={totalAssets}
            expanded={expandedSection === "assets"} count={accounts.assets.length}
            onToggle={() => setExpandedSection(expandedSection === "assets" ? null : "assets")}
          />
          {expandedSection === "assets" && accounts.assets.map((acc, i) => (
            <AccountRow key={i} account={acc} />
          ))}

          <div style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "4px 0" }} />

          {/* Debts section */}
          <SectionHeader
            title="Debts" total={totalDebts}
            expanded={expandedSection === "debts"} count={accounts.debts.length}
            onToggle={() => setExpandedSection(expandedSection === "debts" ? null : "debts")}
          />
          {expandedSection === "debts" && accounts.debts.map((acc, i) => (
            <AccountRow key={i} account={acc} />
          ))}
        </div>

        {/* ── Debt Payoff Progress ── */}
        <div style={{
          background: "rgba(255,255,255,0.04)", borderRadius: 16, padding: "16px",
          marginBottom: 16, border: "1px solid rgba(255,255,255,0.06)"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>Debt Payoff Progress</p>
            <span style={{ fontSize: 11, color: "#a855f7", fontWeight: 500 }}>View plan</span>
          </div>

          {[
            { name: "Credit Card", paid: 78, total: 10500, remaining: 2300, color: "#ef4444", eta: "Jul 2026" },
            { name: "Student Loan", paid: 42, total: 31400, remaining: 18200, color: "#f59e0b", eta: "Mar 2029" },
            { name: "Mortgage", paid: 12, total: 172000, remaining: 151100, color: "#3b82f6", eta: "Feb 2051" },
          ].map((debt, i) => (
            <div key={i} style={{ marginBottom: i < 2 ? 14 : 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 500 }}>{debt.name}</span>
                <span style={{ fontSize: 10, color: "rgba(255,255,255,0.4)" }}>
                  {balanceVisible ? fmtFull(debt.remaining) : "••••••"} left · {debt.eta}
                </span>
              </div>
              <div style={{ height: 6, background: "rgba(255,255,255,0.06)", borderRadius: 3, overflow: "hidden" }}>
                <div style={{
                  height: 6, width: `${debt.paid}%`, borderRadius: 3,
                  background: `linear-gradient(90deg, ${debt.color}, ${debt.color}aa)`,
                  transition: "width 0.5s ease"
                }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                <span style={{ fontSize: 9, color: "rgba(255,255,255,0.3)" }}>{debt.paid}% paid off</span>
              </div>
            </div>
          ))}
        </div>

        {/* ── Link Account CTA ── */}
        <div onClick={() => {}} style={{
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          padding: "14px", borderRadius: 14,
          border: "1px dashed rgba(168,85,247,0.3)",
          background: "rgba(168,85,247,0.04)",
          cursor: "pointer", marginBottom: 20
        }}>
          <Plus size={16} color="#a855f7" />
          <span style={{ fontSize: 13, color: "#a855f7", fontWeight: 500 }}>Link New Account</span>
        </div>

        {/* Plaid last sync */}
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <p style={{ margin: 0, fontSize: 10, color: "rgba(255,255,255,0.2)" }}>
            Last synced 2 hours ago via Plaid
          </p>
        </div>

      </div>

      {/* Bottom Nav */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0,
        background: "rgba(15,10,30,0.95)", backdropFilter: "blur(20px)",
        borderTop: "1px solid rgba(255,255,255,0.06)",
        display: "flex", justifyContent: "space-around", alignItems: "center",
        padding: "10px 0 28px", zIndex: 5
      }}>
        {[
          { icon: <HomeIcon size={20} />, label: "Home", id: "home" },
          { icon: <Calendar size={20} />, label: "Calendar", id: "calendar" },
          { icon: <Bot size={20} />, label: "AI", id: "ai" },
          { icon: <PieChart size={20} />, label: "Finances", id: "finances" },
          { icon: <Settings size={20} />, label: "Settings", id: "settings" },
        ].map(tab => (
          <div key={tab.id} style={{
            display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
            color: tab.id === activeTab ? "#a855f7" : "rgba(255,255,255,0.35)",
            cursor: "pointer"
          }} onClick={() => setActiveTab(tab.id)}>
            {tab.icon}
            <span style={{ fontSize: 9, fontWeight: 500 }}>{tab.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}