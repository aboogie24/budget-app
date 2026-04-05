import { useState } from "react";
import { Plus, ChevronDown, Home, Calendar, Bot, PieChart, Settings, Wallet, TrendingUp, TrendingDown, RefreshCw, Link2, Edit3 } from "lucide-react";

/* ─── Sparkline (matches home screen) ─── */
const Sparkline = ({ data, color, width = 50, height = 18 }) => {
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
        <linearGradient id={`spark-${color.replace('#','')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <polygon points={areaPoints} fill={`url(#spark-${color.replace('#','')})`} />
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

/* ─── Donut chart ─── */
const DonutChart = ({ segments, size = 90 }) => {
  const r = (size - 12) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const C = 2 * Math.PI * r;
  let offset = 0;
  return (
    <svg width={size} height={size}>
      {segments.map((s, i) => {
        const dash = C * s.pct;
        const gap = C - dash;
        const el = (
          <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={s.color} strokeWidth="10"
            strokeDasharray={`${dash} ${gap}`} strokeDashoffset={-offset}
            strokeLinecap="round" style={{ transform: "rotate(-90deg)", transformOrigin: "center" }} />
        );
        offset += dash;
        return el;
      })}
    </svg>
  );
};

/* ─── Mock data ─── */
const accounts = {
  assets: [
    { id: 1, name: "Joint Checking", institution: "Chase", balance: 8420.33, trend: [7200, 7800, 8100, 7900, 8200, 8420], owner: "Joint", type: "checking", connected: true, lastSync: "2 min ago", recentTx: [
      { desc: "Whole Foods", amount: -87.32, date: "Today" },
      { desc: "Direct Deposit", amount: 3200.00, date: "Mar 28" },
    ]},
    { id: 2, name: "Savings", institution: "Ally", balance: 15200.00, trend: [12000, 12800, 13500, 14100, 14800, 15200], owner: "Joint", type: "savings", connected: true, lastSync: "1 hr ago", recentTx: [
      { desc: "Auto Transfer", amount: 500.00, date: "Mar 30" },
    ]},
    { id: 3, name: "Personal Checking", institution: "BofA", balance: 2340.18, trend: [2900, 2600, 2100, 2500, 2200, 2340], owner: "You", type: "checking", connected: true, lastSync: "5 min ago", recentTx: [
      { desc: "Spotify", amount: -15.99, date: "Mar 29" },
      { desc: "Venmo Transfer", amount: 120.00, date: "Mar 27" },
    ]},
    { id: 4, name: "Investment", institution: "Fidelity", balance: 42800.00, trend: [38000, 39500, 41000, 40200, 41800, 42800], owner: "You", type: "investment", connected: true, lastSync: "1 day ago", recentTx: [
      { desc: "VTSAX Buy", amount: -500.00, date: "Mar 25" },
    ]},
    { id: 5, name: "Partner Savings", institution: "Marcus", balance: 6100.00, trend: [4800, 5100, 5400, 5600, 5800, 6100], owner: "Partner", type: "savings", connected: true, lastSync: "3 hr ago", recentTx: [] },
  ],
  debts: [
    { id: 6, name: "Credit Card", institution: "Amex", balance: 3200.00, trend: [4500, 4100, 3800, 3600, 3400, 3200], owner: "Joint", type: "credit", connected: true, lastSync: "10 min ago", recentTx: [
      { desc: "Payment", amount: -400.00, date: "Mar 28" },
    ]},
    { id: 7, name: "Student Loan", institution: "SoFi", balance: 18500.00, trend: [20000, 19700, 19400, 19100, 18800, 18500], owner: "You", type: "loan", connected: false, lastSync: null, recentTx: [] },
    { id: 8, name: "Car Loan", institution: "Capital One", balance: 8900.00, trend: [10200, 9900, 9600, 9400, 9100, 8900], owner: "Partner", type: "loan", connected: true, lastSync: "1 day ago", recentTx: [] },
  ],
};

const totalAssets = accounts.assets.reduce((s, a) => s + a.balance, 0);
const totalDebts = accounts.debts.reduce((s, a) => s + a.balance, 0);
const netWorth = totalAssets - totalDebts;

const allocationSegments = [
  { label: "Checking", pct: 0.14, color: "#3b82f6" },
  { label: "Savings", pct: 0.28, color: "#10b981" },
  { label: "Investments", pct: 0.56, color: "#a855f7" },
  { label: "Other", pct: 0.02, color: "#f59e0b" },
];

const fmt = (n) => {
  const abs = Math.abs(n);
  return (n < 0 ? "-" : "") + "$" + abs.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const OWNER_COLORS = { You: "#a855f7", Partner: "#ec4899", Joint: "#06b6d4" };

const OwnerDot = ({ owner }) => (
  <span style={{
    width: 8, height: 8, borderRadius: 4,
    background: OWNER_COLORS[owner] || "rgba(255,255,255,0.35)",
    display: "inline-block", marginRight: 6, flexShrink: 0,
  }} />
);

const SyncBadge = ({ connected, lastSync }) => {
  if (!connected) return (
    <span style={{ fontSize: 10, color: "#f59e0b", background: "rgba(245,158,11,0.12)", padding: "2px 8px", borderRadius: 8, display: "flex", alignItems: "center", gap: 4 }}>
      <Edit3 size={8} /> Manual
    </span>
  );
  return (
    <span style={{ fontSize: 10, color: "#10b981", background: "rgba(16,185,129,0.12)", padding: "2px 8px", borderRadius: 8, display: "flex", alignItems: "center", gap: 4 }}>
      <RefreshCw size={8} /> {lastSync}
    </span>
  );
};

const AccountRow = ({ account, isDebt }) => {
  const [expanded, setExpanded] = useState(false);
  const trendColor = isDebt
    ? (account.trend[account.trend.length - 1] < account.trend[0] ? "#10b981" : "#ef4444")
    : (account.trend[account.trend.length - 1] >= account.trend[0] ? "#10b981" : "#ef4444");

  return (
    <div style={{ marginBottom: 8 }}>
      <div onClick={() => setExpanded(!expanded)} style={{
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: expanded ? "14px 14px 0 0" : 14,
        padding: "12px 14px",
        display: "flex", alignItems: "center", cursor: "pointer", gap: 10,
        transition: "border-radius 0.2s",
      }}>
        {/* Institution icon */}
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: "rgba(255,255,255,0.06)", display: "flex",
          alignItems: "center", justifyContent: "center",
          fontSize: 14, fontWeight: 700, color: "rgba(255,255,255,0.5)",
          flexShrink: 0,
        }}>
          {account.institution.charAt(0)}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <OwnerDot owner={account.owner} />
            <span style={{ fontSize: 13, fontWeight: 600, color: "white", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {account.name}
            </span>
          </div>
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>{account.institution}</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: isDebt ? "#ef4444" : "white" }}>
            {isDebt ? "-" : ""}{fmt(account.balance)}
          </span>
          <Sparkline data={account.trend} color={trendColor} width={50} height={16} />
        </div>

        <ChevronDown size={14} style={{
          color: "rgba(255,255,255,0.35)", marginLeft: 2,
          transition: "transform 0.2s",
          transform: expanded ? "rotate(180deg)" : "rotate(0)",
        }} />
      </div>

      {expanded && (
        <div style={{
          background: "rgba(255,255,255,0.02)",
          border: "1px solid rgba(255,255,255,0.06)",
          borderTop: "none", borderRadius: "0 0 14px 14px", padding: "10px 14px",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>Owner: {account.owner}</span>
            <SyncBadge connected={account.connected} lastSync={account.lastSync} />
          </div>

          {account.recentTx.length > 0 && (
            <>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Recent Activity</div>
              {account.recentTx.map((tx, i) => (
                <div key={i} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "5px 0",
                  borderBottom: i < account.recentTx.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
                }}>
                  <div>
                    <div style={{ fontSize: 12, color: "white" }}>{tx.desc}</div>
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)" }}>{tx.date}</div>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 600, color: tx.amount < 0 ? "#ef4444" : "#10b981" }}>
                    {fmt(tx.amount)}
                  </span>
                </div>
              ))}
            </>
          )}

          {account.recentTx.length === 0 && (
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", textAlign: "center", padding: "8px 0" }}>No recent transactions</div>
          )}
        </div>
      )}
    </div>
  );
};

/* ─── Main Screen ─── */
export default function AccountsScreenRedesign() {
  const [assetsOpen, setAssetsOpen] = useState(true);
  const [debtsOpen, setDebtsOpen] = useState(true);
  const [activeTab, setActiveTab] = useState("finance");

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
        <div style={{ display: "flex", gap: 6 }}>
          <span style={{ fontSize: 12 }}>●●●●</span>
        </div>
      </div>

      {/* Header */}
      <div style={{ padding: "16px 20px 12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 26, fontWeight: 700 }}>Accounts</span>
        <div style={{
          width: 36, height: 36, borderRadius: 12,
          background: "linear-gradient(135deg, #7c3aed, #a855f7)",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 4px 12px rgba(124,58,237,0.3)",
          cursor: "pointer",
        }}>
          <Plus size={18} color="white" />
        </div>
      </div>

      <div style={{
        flex: 1, overflowY: "auto", height: "calc(100% - 170px)",
        padding: "0 20px 20px", scrollbarWidth: "none",
      }}>

        {/* ── Net Worth Hero ── */}
        <div style={{
          background: "linear-gradient(135deg, rgba(124,58,237,0.15) 0%, rgba(168,85,247,0.08) 100%)",
          border: "1px solid rgba(168,85,247,0.2)",
          borderRadius: 16, padding: 20, marginBottom: 16, textAlign: "center",
        }}>
          <p style={{ margin: 0, fontSize: 12, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 500 }}>Net Worth</p>
          <p style={{ margin: "4px 0 0", fontSize: 32, fontWeight: 800, letterSpacing: -1 }}>{fmt(netWorth)}</p>
          <div style={{ display: "flex", justifyContent: "center", gap: 24, marginTop: 12 }}>
            <div>
              <p style={{ margin: 0, fontSize: 10, color: "rgba(255,255,255,0.35)" }}>Assets</p>
              <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
                <TrendingUp size={12} color="#10b981" />
                <span style={{ fontSize: 15, fontWeight: 700, color: "#10b981" }}>{fmt(totalAssets)}</span>
              </div>
            </div>
            <div style={{ width: 1, background: "rgba(255,255,255,0.08)" }} />
            <div>
              <p style={{ margin: 0, fontSize: 10, color: "rgba(255,255,255,0.35)" }}>Debts</p>
              <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
                <TrendingDown size={12} color="#ef4444" />
                <span style={{ fontSize: 15, fontWeight: 700, color: "#ef4444" }}>-{fmt(totalDebts)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Asset Allocation Donut ── */}
        <div style={{
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.06)",
          borderRadius: 16, padding: 16, marginBottom: 16,
          display: "flex", alignItems: "center", gap: 16,
        }}>
          <DonutChart segments={allocationSegments} size={90} />
          <div style={{ flex: 1 }}>
            <p style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 600 }}>Asset Allocation</p>
            {allocationSegments.map((s, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: 4, background: s.color }} />
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", flex: 1 }}>{s.label}</span>
                <span style={{ fontSize: 11, fontWeight: 600 }}>{Math.round(s.pct * 100)}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Owner Legend ── */}
        <div style={{ display: "flex", gap: 14, marginBottom: 14, paddingLeft: 4 }}>
          {["You", "Partner", "Joint"].map(o => (
            <div key={o} style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <OwnerDot owner={o} />
              <span style={{ fontSize: 10, color: "rgba(255,255,255,0.4)" }}>{o}</span>
            </div>
          ))}
        </div>

        {/* ── Assets Section ── */}
        <div onClick={() => setAssetsOpen(!assetsOpen)} style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "8px 4px", cursor: "pointer", marginBottom: 8,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 700 }}>Assets</span>
            <span style={{ fontSize: 12, color: "#10b981", fontWeight: 600 }}>{fmt(totalAssets)}</span>
          </div>
          <ChevronDown size={14} style={{
            color: "rgba(255,255,255,0.35)",
            transition: "transform 0.2s",
            transform: assetsOpen ? "rotate(0)" : "rotate(-90deg)",
          }} />
        </div>

        {assetsOpen && accounts.assets.map(a => <AccountRow key={a.id} account={a} isDebt={false} />)}

        {/* ── Debts Section ── */}
        <div onClick={() => setDebtsOpen(!debtsOpen)} style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "8px 4px", cursor: "pointer", marginBottom: 8, marginTop: 8,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 700 }}>Debts</span>
            <span style={{ fontSize: 12, color: "#ef4444", fontWeight: 600 }}>-{fmt(totalDebts)}</span>
          </div>
          <ChevronDown size={14} style={{
            color: "rgba(255,255,255,0.35)",
            transition: "transform 0.2s",
            transform: debtsOpen ? "rotate(0)" : "rotate(-90deg)",
          }} />
        </div>

        {debtsOpen && accounts.debts.map(a => <AccountRow key={a.id} account={a} isDebt={true} />)}

        {/* ── Link Account CTA ── */}
        <div style={{
          marginTop: 16, padding: 14, borderRadius: 14,
          border: "1px dashed rgba(168,85,247,0.4)",
          background: "rgba(124,58,237,0.06)",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          cursor: "pointer",
        }}>
          <Link2 size={16} color="#a855f7" />
          <span style={{ fontSize: 13, fontWeight: 600, color: "#a855f7" }}>Link New Account</span>
        </div>

        {/* ── Manual Account CTA ── */}
        <div style={{
          marginTop: 8, marginBottom: 20, padding: 12, borderRadius: 14,
          border: "1px solid rgba(255,255,255,0.06)",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          cursor: "pointer",
        }}>
          <Edit3 size={14} color="rgba(255,255,255,0.4)" />
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>Add Manual Account</span>
        </div>

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
