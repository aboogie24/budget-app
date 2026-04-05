import { useState } from "react";
import { Home, Calendar, Bot, PieChart, Settings, Plus, ChevronDown, ChevronRight, Zap, Link2, Check, Clock, AlertTriangle, ScanLine, ArrowLeft, Trash2, CreditCard } from "lucide-react";

/* ─── Owner dot (matches home) ─── */
const OWNER_COLORS = { You: "#a855f7", Partner: "#ec4899", Joint: "#06b6d4" };
const OwnerDot = ({ owner }) => (
  <span style={{
    width: 8, height: 8, borderRadius: 4,
    background: OWNER_COLORS[owner] || "rgba(255,255,255,0.35)",
    display: "inline-block", flexShrink: 0,
  }} />
);

/* ─── Progress ring ─── */
const ProgressRing = ({ percent, size = 52, stroke = 4, color = "#a855f7" }) => {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (percent / 100) * circ;
  return (
    <svg width={size} height={size}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`} />
    </svg>
  );
};

/* ─── Mock data ─── */
const bills = [
  { id: 1, name: "Rent", amount: 1850.00, dueDay: 1, frequency: "monthly", payee: "Landlord", status: "paid", isAutopay: true, isShared: true, owner: "Joint", category: "Housing", debtLinked: false },
  { id: 2, name: "Car Payment", amount: 425.00, dueDay: 5, frequency: "monthly", payee: "Capital One Auto", status: "paid", isAutopay: true, isShared: false, owner: "Partner", category: "Auto", debtLinked: true },
  { id: 3, name: "Electric", amount: 142.00, dueDay: 10, frequency: "monthly", payee: "Duke Energy", status: "unpaid", isAutopay: false, isShared: true, owner: "Joint", category: "Utilities", debtLinked: false },
  { id: 4, name: "Netflix", amount: 22.99, dueDay: 12, frequency: "monthly", payee: "Netflix Inc.", status: "unpaid", isAutopay: true, isShared: true, owner: "You", category: "Entertainment", debtLinked: false },
  { id: 5, name: "Student Loan", amount: 350.00, dueDay: 15, frequency: "monthly", payee: "SoFi", status: "unpaid", isAutopay: false, isShared: false, owner: "You", category: "Debt", debtLinked: true },
  { id: 6, name: "Internet", amount: 79.99, dueDay: 18, frequency: "monthly", payee: "Xfinity", status: "unpaid", isAutopay: true, isShared: true, owner: "Joint", category: "Utilities", debtLinked: false },
  { id: 7, name: "Gym", amount: 49.99, dueDay: 20, frequency: "monthly", payee: "Planet Fitness", status: "overdue", isAutopay: false, isShared: false, owner: "You", category: "Health", debtLinked: false },
  { id: 8, name: "Credit Card", amount: 200.00, dueDay: 25, frequency: "monthly", payee: "Amex", status: "unpaid", isAutopay: false, isShared: true, owner: "Joint", category: "Debt", debtLinked: true },
];

const STATUS_CONFIG = {
  paid: { color: "#34d399", bg: "rgba(52,211,153,0.12)", icon: Check, label: "Paid" },
  unpaid: { color: "#fbbf24", bg: "rgba(251,191,36,0.12)", icon: Clock, label: "Upcoming" },
  overdue: { color: "#f87171", bg: "rgba(248,113,113,0.12)", icon: AlertTriangle, label: "Overdue" },
};

const paidCount = bills.filter(b => b.status === "paid").length;
const totalDue = bills.reduce((s, b) => s + b.amount, 0);
const paidAmount = bills.filter(b => b.status === "paid").reduce((s, b) => s + b.amount, 0);
const unpaidAmount = totalDue - paidAmount;
const overdueCount = bills.filter(b => b.status === "overdue").length;
const paidPct = Math.round((paidCount / bills.length) * 100);

const fmt = (n) => "$" + Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const ordinal = (d) => {
  if (d >= 11 && d <= 13) return d + "th";
  const s = ["th", "st", "nd", "rd"];
  return d + (s[d % 10] || s[0]);
};

/* ─── Bill Card ─── */
const BillCard = ({ bill }) => {
  const status = STATUS_CONFIG[bill.status];
  const StatusIcon = status.icon;

  return (
    <div style={{
      background: "rgba(255,255,255,0.04)",
      border: "1px solid rgba(255,255,255,0.06)",
      borderRadius: 16, padding: "14px 16px", marginBottom: 8,
    }}>
      {/* Top row: name + amount */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <OwnerDot owner={bill.owner} />
            <span style={{ fontSize: 14, fontWeight: 700, color: "white" }}>{bill.name}</span>
            {bill.isAutopay && (
              <span style={{
                display: "inline-flex", alignItems: "center", gap: 3,
                background: "rgba(96,165,250,0.12)", borderRadius: 6,
                padding: "2px 6px", fontSize: 10, color: "#60a5fa", fontWeight: 600,
              }}>
                <Zap size={9} /> Auto
              </span>
            )}
            {bill.debtLinked && (
              <span style={{
                display: "inline-flex", alignItems: "center", gap: 3,
                background: "rgba(236,72,153,0.12)", borderRadius: 6,
                padding: "2px 6px", fontSize: 10, color: "#f472b6", fontWeight: 600,
              }}>
                <Link2 size={9} /> Debt
              </span>
            )}
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>Due {ordinal(bill.dueDay)}</span>
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>{bill.payee}</span>
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>{bill.category}</span>
          </div>
        </div>
        <span style={{ fontSize: 16, fontWeight: 800, color: "#c084fc", marginLeft: 8, flexShrink: 0 }}>{fmt(bill.amount)}</span>
      </div>

      {/* Footer: status + actions */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10 }}>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 4,
          background: status.bg, borderRadius: 10,
          padding: "4px 10px",
        }}>
          <StatusIcon size={12} color={status.color} />
          <span style={{ fontSize: 12, fontWeight: 700, color: status.color }}>{status.label}</span>
        </div>

        <div style={{ display: "flex", gap: 6 }}>
          {bill.status !== "paid" && (
            <div style={{
              display: "flex", alignItems: "center", gap: 4,
              background: "rgba(52,211,153,0.12)", borderRadius: 10,
              padding: "5px 10px", cursor: "pointer",
            }}>
              <Check size={12} color="#34d399" />
              <span style={{ fontSize: 12, fontWeight: 700, color: "#34d399" }}>Mark Paid</span>
            </div>
          )}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "rgba(248,113,113,0.08)", borderRadius: 10,
            padding: "5px 8px", cursor: "pointer",
          }}>
            <Trash2 size={12} color="#f87171" />
          </div>
        </div>
      </div>
    </div>
  );
};

/* ─── Timeline dot row ─── */
const BillTimeline = ({ bills }) => {
  const today = 8; // mock: April 8
  const sorted = [...bills].sort((a, b) => a.dueDay - b.dueDay);
  return (
    <div style={{
      background: "rgba(255,255,255,0.04)",
      border: "1px solid rgba(255,255,255,0.06)",
      borderRadius: 16, padding: "14px 16px", marginBottom: 16,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.7)", textTransform: "uppercase", letterSpacing: 0.5 }}>April Timeline</span>
        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>Today: {ordinal(today)}</span>
      </div>

      {/* Timeline bar */}
      <div style={{ position: "relative", height: 32, marginBottom: 6 }}>
        {/* Track */}
        <div style={{ position: "absolute", top: 12, left: 0, right: 0, height: 3, background: "rgba(255,255,255,0.06)", borderRadius: 2 }} />
        {/* Progress through month */}
        <div style={{ position: "absolute", top: 12, left: 0, width: `${(today / 30) * 100}%`, height: 3, background: "linear-gradient(90deg, #7c3aed, #a855f7)", borderRadius: 2 }} />

        {/* Bill dots */}
        {sorted.map((b, i) => {
          const left = ((b.dueDay - 1) / 30) * 100;
          const statusColor = STATUS_CONFIG[b.status].color;
          return (
            <div key={b.id} style={{
              position: "absolute", left: `${left}%`, top: 6,
              transform: "translateX(-50%)",
              display: "flex", flexDirection: "column", alignItems: "center",
            }}>
              <div style={{
                width: 14, height: 14, borderRadius: 7,
                background: statusColor,
                border: "2px solid #0f0a1e",
                boxShadow: `0 0 6px ${statusColor}44`,
              }} />
            </div>
          );
        })}

        {/* Today marker */}
        <div style={{
          position: "absolute", left: `${(today / 30) * 100}%`, top: 2,
          transform: "translateX(-50%)",
          width: 2, height: 22, background: "#a855f7", borderRadius: 1,
        }} />
      </div>

      {/* Legend */}
      <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
        {[
          { color: "#34d399", label: "Paid" },
          { color: "#fbbf24", label: "Upcoming" },
          { color: "#f87171", label: "Overdue" },
        ].map(l => (
          <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ width: 6, height: 6, borderRadius: 3, background: l.color }} />
            <span style={{ fontSize: 9, color: "rgba(255,255,255,0.4)" }}>{l.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ─── Main Screen ─── */
export default function BillsScreenRedesign() {
  const [activeTab, setActiveTab] = useState("finance");
  const [filter, setFilter] = useState("all");

  const filtered = filter === "all" ? bills : bills.filter(b => b.status === filter);

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
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.12)",
            background: "rgba(255,255,255,0.05)",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer",
          }}>
            <ArrowLeft size={18} color="#e5e7eb" />
          </div>
          <span style={{ fontSize: 22, fontWeight: 700 }}>Bills</span>
        </div>
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

        {/* ── Summary Hero ── */}
        <div style={{
          background: "linear-gradient(135deg, rgba(124,58,237,0.15) 0%, rgba(168,85,247,0.08) 100%)",
          border: "1px solid rgba(168,85,247,0.2)",
          borderRadius: 16, padding: 20, marginBottom: 16,
          display: "flex", alignItems: "center", gap: 16,
        }}>
          {/* Progress ring */}
          <div style={{ position: "relative", flexShrink: 0 }}>
            <ProgressRing percent={paidPct} size={64} stroke={5} color="#34d399" />
            <div style={{
              position: "absolute", top: "50%", left: "50%",
              transform: "translate(-50%, -50%)",
              textAlign: "center",
            }}>
              <div style={{ fontSize: 16, fontWeight: 800 }}>{paidCount}</div>
              <div style={{ fontSize: 8, color: "rgba(255,255,255,0.5)" }}>of {bills.length}</div>
            </div>
          </div>

          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <div>
                <p style={{ margin: 0, fontSize: 11, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 500 }}>Total Due</p>
                <p style={{ margin: "2px 0 0", fontSize: 24, fontWeight: 800 }}>{fmt(totalDue)}<span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", fontWeight: 400 }}>/mo</span></p>
              </div>
            </div>
            <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
              <div>
                <p style={{ margin: 0, fontSize: 10, color: "rgba(255,255,255,0.35)" }}>Paid</p>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#34d399" }}>{fmt(paidAmount)}</p>
              </div>
              <div>
                <p style={{ margin: 0, fontSize: 10, color: "rgba(255,255,255,0.35)" }}>Remaining</p>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#fbbf24" }}>{fmt(unpaidAmount)}</p>
              </div>
              {overdueCount > 0 && (
                <div>
                  <p style={{ margin: 0, fontSize: 10, color: "rgba(255,255,255,0.35)" }}>Overdue</p>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#f87171" }}>{overdueCount}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Timeline ── */}
        <BillTimeline bills={bills} />

        {/* ── Auto-detect Button ── */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          background: "rgba(96,165,250,0.08)",
          border: "1px solid rgba(96,165,250,0.15)",
          borderRadius: 12, padding: "10px 0", marginBottom: 16,
          cursor: "pointer",
        }}>
          <ScanLine size={16} color="#60a5fa" />
          <span style={{ fontSize: 13, fontWeight: 700, color: "#60a5fa" }}>Auto-detect from bank</span>
        </div>

        {/* ── Filter Tabs ── */}
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          {[
            { key: "all", label: "All", count: bills.length },
            { key: "unpaid", label: "Upcoming", count: bills.filter(b => b.status === "unpaid").length },
            { key: "paid", label: "Paid", count: paidCount },
            { key: "overdue", label: "Overdue", count: overdueCount },
          ].map(f => (
            <div key={f.key} onClick={() => setFilter(f.key)} style={{
              padding: "6px 12px", borderRadius: 10,
              background: filter === f.key ? "rgba(168,85,247,0.2)" : "rgba(255,255,255,0.04)",
              border: `1px solid ${filter === f.key ? "rgba(168,85,247,0.4)" : "rgba(255,255,255,0.06)"}`,
              cursor: "pointer", display: "flex", alignItems: "center", gap: 5,
            }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: filter === f.key ? "#a855f7" : "rgba(255,255,255,0.5)" }}>{f.label}</span>
              <span style={{
                fontSize: 10, fontWeight: 700, color: filter === f.key ? "#a855f7" : "rgba(255,255,255,0.3)",
                background: filter === f.key ? "rgba(168,85,247,0.15)" : "rgba(255,255,255,0.06)",
                borderRadius: 6, padding: "1px 5px",
              }}>{f.count}</span>
            </div>
          ))}
        </div>

        {/* ── Owner Legend ── */}
        <div style={{ display: "flex", gap: 14, marginBottom: 10, paddingLeft: 4 }}>
          {["You", "Partner", "Joint"].map(o => (
            <div key={o} style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <OwnerDot owner={o} />
              <span style={{ fontSize: 10, color: "rgba(255,255,255,0.4)" }}>{o}</span>
            </div>
          ))}
        </div>

        {/* ── Bill Cards ── */}
        {filtered.map(b => <BillCard key={b.id} bill={b} />)}

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
