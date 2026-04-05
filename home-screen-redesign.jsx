import { useState } from "react";
import { TrendingUp, TrendingDown, ArrowRight, MessageCircle, Home, Calendar, Bot, PieChart, Settings, Plus, Heart, Target, Shield, Flame, Star } from "lucide-react";

// Mini sparkline component
const Sparkline = ({ data, color, width = 120, height = 40 }) => {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  }).join(" ");

  // Create area fill
  const areaPoints = `0,${height} ${points} ${width},${height}`;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <defs>
        <linearGradient id={`grad-${color}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <polygon points={areaPoints} fill={`url(#grad-${color})`} />
      <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

// Mini bar chart for weekly spending
const WeeklyBars = ({ data, budget }) => {
  const max = Math.max(...data, budget);
  const days = ["M", "T", "W", "T", "F", "S", "S"];
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 80, padding: "0 4px" }}>
      {data.map((val, i) => {
        const h = (val / max) * 60;
        const over = val > budget / 7;
        return (
          <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1 }}>
            <div style={{
              width: "100%",
              maxWidth: 28,
              height: h,
              borderRadius: 4,
              background: over
                ? "linear-gradient(180deg, #ef4444 0%, #dc2626 100%)"
                : i === new Date().getDay() - 1
                  ? "linear-gradient(180deg, #a855f7 0%, #7c3aed 100%)"
                  : "linear-gradient(180deg, rgba(168,85,247,0.5) 0%, rgba(124,58,237,0.5) 100%)",
              transition: "height 0.3s ease"
            }} />
            <span style={{
              fontSize: 9,
              color: i === new Date().getDay() - 1 ? "#a855f7" : "rgba(255,255,255,0.4)",
              marginTop: 4,
              fontWeight: i === new Date().getDay() - 1 ? 700 : 400
            }}>{days[i]}</span>
          </div>
        );
      })}
    </div>
  );
};

// Circular progress - simplified
const MiniRing = ({ percent, size = 44, stroke = 3, color = "#a855f7" }) => {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (percent / 100) * circ;
  return (
    <svg width={size} height={size}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        transform={`rotate(-90 ${size/2} ${size/2})`} />
    </svg>
  );
};

export default function HomeScreenRedesign() {
  const [activeTab, setActiveTab] = useState("home");

  // Sample data
  const weeklySpending = [45, 120, 30, 85, 200, 60, 0];
  const netWorthTrend = [385000, 388000, 390000, 389500, 392000, 395000, 399100];
  const weeklyBudget = 4375; // 17500/4

  return (
    <div style={{
      width: 393,
      height: 852,
      background: "linear-gradient(180deg, #0f0a1e 0%, #1a1035 30%, #0f0a1e 100%)",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif",
      color: "white",
      position: "relative",
      overflow: "hidden",
      borderRadius: 40,
      border: "3px solid #2a2a2a",
      margin: "0 auto"
    }}>
      {/* Status bar */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "14px 28px 0", fontSize: 14, fontWeight: 600
      }}>
        <span>4:03</span>
        <div style={{ display: "flex", gap: 6 }}>
          <span style={{ fontSize: 12 }}>●●●●</span>
        </div>
      </div>

      {/* Scrollable content */}
      <div style={{
        overflowY: "auto", height: "calc(100% - 110px)",
        padding: "16px 20px 20px",
        scrollbarWidth: "none"
      }}>

        {/* Header - Greeting + Partner avatars */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
          <div>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", margin: 0 }}>Good afternoon,</p>
            <h1 style={{ fontSize: 26, fontWeight: 700, margin: "2px 0 0" }}>
              Test user2 <span style={{ fontSize: 20 }}>❤️</span>
            </h1>
          </div>
          {/* Couple avatars - stacked */}
          <div style={{ display: "flex", alignItems: "center" }}>
            <div style={{
              width: 36, height: 36, borderRadius: 18,
              background: "linear-gradient(135deg, #7c3aed, #a855f7)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 14, fontWeight: 600, border: "2px solid #0f0a1e", zIndex: 2
            }}>T</div>
            <div style={{
              width: 36, height: 36, borderRadius: 18,
              background: "linear-gradient(135deg, #ec4899, #f472b6)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 14, fontWeight: 600, border: "2px solid #0f0a1e", marginLeft: -12, zIndex: 1
            }}>P</div>
          </div>
        </div>

        {/* AI Insight Card - CoupleFlow Method tie-in */}
        <div style={{
          background: "linear-gradient(135deg, rgba(124,58,237,0.15) 0%, rgba(168,85,247,0.08) 100%)",
          border: "1px solid rgba(168,85,247,0.2)",
          borderRadius: 16, padding: "14px 16px", marginBottom: 16,
          display: "flex", alignItems: "center", gap: 12
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: "linear-gradient(135deg, #7c3aed, #a855f7)",
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0
          }}>
            <Bot size={18} color="white" />
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.4, color: "rgba(255,255,255,0.9)" }}>
              You're on track this month! At this rate, you'll hit your emergency fund goal by <strong style={{ color: "#a855f7" }}>June</strong>.
            </p>
          </div>
          <ArrowRight size={16} color="rgba(255,255,255,0.3)" />
        </div>

        {/* CoupleFlow Level Progress */}
        <div style={{
          background: "rgba(255,255,255,0.04)",
          borderRadius: 16, padding: "14px 16px", marginBottom: 16,
          border: "1px solid rgba(255,255,255,0.06)"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Shield size={14} color="#10b981" />
              <span style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.7)", textTransform: "uppercase", letterSpacing: 0.5 }}>Level 2 · Build Security</span>
            </div>
            <span style={{ fontSize: 11, color: "#10b981" }}>68%</span>
          </div>
          <div style={{ height: 4, background: "rgba(255,255,255,0.08)", borderRadius: 2 }}>
            <div style={{ height: 4, width: "68%", background: "linear-gradient(90deg, #10b981, #34d399)", borderRadius: 2 }} />
          </div>
          <div style={{ display: "flex", gap: 16, marginTop: 10 }}>
            {[
              { icon: <Home size={11} />, label: "Foundation", done: true },
              { icon: <Flame size={11} />, label: "Debt Free", done: true },
              { icon: <Shield size={11} />, label: "Security", active: true },
              { icon: <TrendingUp size={11} />, label: "Grow", done: false },
              { icon: <Star size={11} />, label: "Dream", done: false },
            ].map((s, i) => (
              <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, flex: 1 }}>
                <div style={{
                  width: 22, height: 22, borderRadius: 11,
                  background: s.done ? "#10b981" : s.active ? "rgba(16,185,129,0.3)" : "rgba(255,255,255,0.08)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: s.done || s.active ? "white" : "rgba(255,255,255,0.3)",
                  border: s.active ? "1.5px solid #10b981" : "none"
                }}>{s.icon}</div>
                <span style={{ fontSize: 8, color: s.done || s.active ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.25)" }}>{s.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* This Week's Spending - THE KEY GRAPH */}
        <div style={{
          background: "rgba(255,255,255,0.04)",
          borderRadius: 16, padding: "16px", marginBottom: 16,
          border: "1px solid rgba(255,255,255,0.06)"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div>
              <p style={{ margin: 0, fontSize: 12, color: "rgba(255,255,255,0.5)", fontWeight: 500 }}>This Week</p>
              <p style={{ margin: "2px 0 0", fontSize: 22, fontWeight: 700 }}>$540<span style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", fontWeight: 400 }}> / $4,375</span></p>
            </div>
            <div style={{
              display: "flex", alignItems: "center", gap: 4,
              background: "rgba(16,185,129,0.15)", borderRadius: 8, padding: "4px 8px"
            }}>
              <TrendingDown size={12} color="#10b981" />
              <span style={{ fontSize: 11, color: "#10b981", fontWeight: 600 }}>12% less</span>
            </div>
          </div>
          <WeeklyBars data={weeklySpending} budget={weeklyBudget} />
          <div style={{
            borderTop: "1px solid rgba(255,255,255,0.06)", marginTop: 10, paddingTop: 10,
            display: "flex", justifyContent: "space-between"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: 4, background: "#a855f7" }} />
              <span style={{ fontSize: 10, color: "rgba(255,255,255,0.4)" }}>You: $320</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: 4, background: "#ec4899" }} />
              <span style={{ fontSize: 10, color: "rgba(255,255,255,0.4)" }}>Partner: $220</span>
            </div>
          </div>
        </div>

        {/* Budget + Bills + Savings row - condensed */}
        <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
          {[
            { label: "Budget", value: "$17.5k", sub: "remaining", pct: 100, color: "#a855f7" },
            { label: "Savings", value: "$0", sub: "of $5k goal", pct: 0, color: "#f59e0b" },
            { label: "Bills", value: "2/2", sub: "paid", pct: 100, color: "#10b981" },
          ].map((item, i) => (
            <div key={i} style={{
              flex: 1, background: "rgba(255,255,255,0.04)", borderRadius: 14,
              padding: "14px 12px", border: "1px solid rgba(255,255,255,0.06)",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 6
            }}>
              <div style={{ position: "relative" }}>
                <MiniRing percent={item.pct} color={item.color} />
                <div style={{
                  position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
                  fontSize: 12, fontWeight: 700
                }}>{item.pct}%</div>
              </div>
              <div style={{ textAlign: "center" }}>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>{item.value}</p>
                <p style={{ margin: 0, fontSize: 9, color: "rgba(255,255,255,0.4)" }}>{item.sub}</p>
              </div>
              <p style={{ margin: 0, fontSize: 10, color: "rgba(255,255,255,0.5)", fontWeight: 600 }}>{item.label}</p>
            </div>
          ))}
        </div>

        {/* Net Worth with sparkline */}
        <div style={{
          background: "rgba(255,255,255,0.04)",
          borderRadius: 16, padding: "16px", marginBottom: 16,
          border: "1px solid rgba(255,255,255,0.06)",
          display: "flex", justifyContent: "space-between", alignItems: "center"
        }}>
          <div>
            <p style={{ margin: 0, fontSize: 12, color: "rgba(255,255,255,0.5)", fontWeight: 500 }}>Net Worth</p>
            <p style={{ margin: "4px 0 0", fontSize: 24, fontWeight: 700 }}>$399,100</p>
            <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 4 }}>
              <TrendingUp size={12} color="#10b981" />
              <span style={{ fontSize: 11, color: "#10b981", fontWeight: 500 }}>+$14,100 this month</span>
            </div>
          </div>
          <Sparkline data={netWorthTrend} color="#10b981" width={100} height={44} />
        </div>

        {/* Recent Activity - Couple-aware */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Recent Activity</p>
            <span style={{ fontSize: 12, color: "#a855f7", fontWeight: 500 }}>See all</span>
          </div>

          {[
            { who: "You", avatar: "T", color: "#7c3aed", desc: "Credit Card payment", amount: "-$20.00", time: "2h ago" },
            { who: "You", avatar: "T", color: "#7c3aed", desc: "Student Loan Payment", amount: "-$25.00", time: "3h ago" },
            { who: "Partner", avatar: "P", color: "#ec4899", desc: "Grocery Store", amount: "-$67.30", time: "5h ago" },
          ].map((tx, i) => (
            <div key={i} style={{
              display: "flex", alignItems: "center", gap: 12, padding: "10px 0",
              borderBottom: i < 2 ? "1px solid rgba(255,255,255,0.04)" : "none"
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: `linear-gradient(135deg, ${tx.color}, ${tx.color}88)`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 13, fontWeight: 600
              }}>{tx.avatar}</div>
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 500 }}>{tx.desc}</p>
                <p style={{ margin: 0, fontSize: 10, color: "rgba(255,255,255,0.35)" }}>{tx.who} · {tx.time}</p>
              </div>
              <span style={{ fontSize: 14, fontWeight: 600, color: tx.amount.startsWith("+") ? "#10b981" : "#ef4444" }}>{tx.amount}</span>
            </div>
          ))}
        </div>
      </div>

      {/* FAB */}
      <div style={{
        position: "absolute", bottom: 90, right: 20,
        width: 52, height: 52, borderRadius: 26,
        background: "linear-gradient(135deg, #7c3aed, #a855f7)",
        display: "flex", alignItems: "center", justifyContent: "center",
        boxShadow: "0 4px 20px rgba(124,58,237,0.4)", zIndex: 10
      }}>
        <Plus size={22} color="white" />
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
          { icon: <Home size={20} />, label: "Home", id: "home" },
          { icon: <Calendar size={20} />, label: "Calendar", id: "calendar" },
          { icon: <Bot size={20} />, label: "AI", id: "ai" },
          { icon: <PieChart size={20} />, label: "Budget", id: "budget" },
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