import { useState, useMemo } from "react";
import {
  ChevronLeft, ChevronRight, Home, Calendar as CalIcon, Bot, PieChart, Settings,
  Maximize2, Minimize2, CreditCard, Wallet, TrendingUp, TrendingDown,
  ShoppingCart, Receipt, Zap, Clock, Sun, ArrowRight
} from "lucide-react";

// ── Helpers ──
const DAYS = ["S", "M", "T", "W", "T", "F", "S"];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const fmt = (n) => "$" + Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const toKey = (y, m, d) => `${y}-${String(m+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;

// ── Mock data (simulates what the API returns) ──
const TODAY_KEY = "2026-04-01";

const mockEvents = {
  "2026-04-01": [
    { id: "t1", name: "Credit Card Payment", amount: 20, type: "expense", source: "transaction", owner: "You" },
    { id: "t2", name: "Student Loan Payment", amount: 25, type: "expense", source: "bill", owner: "You", status: "paid", autoPay: true },
  ],
  "2026-04-02": [
    { id: "b1", name: "Rent", amount: 1200, type: "expense", source: "bill", owner: "Joint", status: "due", autoPay: true },
  ],
  "2026-04-05": [
    { id: "i1", name: "Paycheck", amount: 2500, type: "income", source: "budget", owner: "You" },
  ],
  "2026-04-08": [
    { id: "b2", name: "Internet Bill", amount: 85, type: "expense", source: "bill", owner: "Partner", status: "due", autoPay: true },
    { id: "t3", name: "Grocery Store", amount: 67.30, type: "expense", source: "transaction", owner: "Partner" },
  ],
  "2026-04-12": [
    { id: "i2", name: "Freelance Project", amount: 1800, type: "income", source: "budget", owner: "Partner" },
  ],
  "2026-04-15": [
    { id: "b3", name: "Phone Bill", amount: 45, type: "expense", source: "bill", owner: "You", status: "due" },
    { id: "b4", name: "Electric Bill", amount: 145, type: "expense", source: "bill", owner: "Joint", status: "due" },
  ],
  "2026-04-18": [
    { id: "t4", name: "Date Night Dinner", amount: 95, type: "expense", source: "transaction", owner: "You" },
  ],
  "2026-04-22": [
    { id: "i3", name: "Paycheck", amount: 2500, type: "income", source: "budget", owner: "You" },
    { id: "s1", name: "Monthly Savings Transfer", amount: 500, type: "expense", source: "budget", owner: "Joint", autoPay: true },
  ],
  "2026-04-25": [
    { id: "t5", name: "Gas Station", amount: 42, type: "expense", source: "transaction", owner: "Partner" },
  ],
  "2026-04-28": [
    { id: "b5", name: "Car Insurance", amount: 180, type: "expense", source: "bill", owner: "You", status: "due", autoPay: true },
  ],
};

// Color constants
const C = {
  income: "#34d399",
  expense: "#f87171",
  bill: "#60a5fa",
  accent: "#a855f7",
  accentDark: "#7c3aed",
  pink: "#ec4899",
  bg: "#0f0a1e",
  surface: "rgba(255,255,255,0.06)",
  border: "rgba(255,255,255,0.08)",
  textPrimary: "#f8fafc",
  textMuted: "#94a3b8",
  textDim: "rgba(255,255,255,0.3)",
};

const ownerColor = (o) => o === "Partner" ? C.pink : o === "Joint" ? C.income : C.accent;
const typeColor = (e) => e.source === "bill" ? C.bill : e.type === "income" ? C.income : C.expense;
const typeIcon = (e) => {
  if (e.source === "bill") return <Receipt size={14} />;
  if (e.type === "income") return <TrendingUp size={14} />;
  if (e.source === "budget") return <Wallet size={14} />;
  return <ShoppingCart size={14} />;
};

// ── Status chip ──
const StatusChip = ({ status, autoPay }) => {
  const colors = {
    paid: { bg: "rgba(52,211,153,0.12)", text: "#34d399", label: "Paid" },
    overdue: { bg: "rgba(248,113,113,0.12)", text: "#f87171", label: "Overdue" },
    due: { bg: "rgba(251,191,36,0.12)", text: "#fbbf24", label: "Due" },
  };
  const c = colors[status] || colors.due;
  return (
    <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
      <span style={{
        fontSize: 9, fontWeight: 700, color: c.text,
        background: c.bg, padding: "2px 6px", borderRadius: 4
      }}>{c.label}</span>
      {autoPay && (
        <span style={{
          fontSize: 8, fontWeight: 700, color: C.accent,
          background: "rgba(168,85,247,0.12)", padding: "2px 5px", borderRadius: 4,
          letterSpacing: 0.3
        }}>AUTO</span>
      )}
    </div>
  );
};

// ── Event Row ──
const EventRow = ({ event, dateBadge }) => {
  const tc = typeColor(event);
  const oc = ownerColor(event.owner);
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      background: "rgba(255,255,255,0.04)", borderRadius: 12,
      padding: "11px 12px", marginBottom: 6
    }}>
      <div style={{
        width: 34, height: 34, borderRadius: 10,
        background: `${tc}18`, display: "flex", alignItems: "center",
        justifyContent: "center", color: tc, flexShrink: 0
      }}>{typeIcon(event)}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{
            fontSize: 13, fontWeight: 600, color: C.textPrimary,
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis"
          }}>{event.name}</span>
          {event.status && <StatusChip status={event.status} autoPay={event.autoPay} />}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
          <div style={{ width: 5, height: 5, borderRadius: 3, background: oc }} />
          <span style={{ fontSize: 10, color: C.textMuted }}>
            {event.owner}
            {event.source === "bill" ? " · Bill" : event.source === "budget" ? " · Budget" : " · Transaction"}
            {dateBadge ? ` · ${dateBadge}` : ""}
          </span>
        </div>
      </div>
      <span style={{
        fontSize: 13, fontWeight: 700, flexShrink: 0,
        color: event.type === "income" ? C.income : C.expense
      }}>
        {event.type === "income" ? "+" : "-"}{fmt(event.amount)}
      </span>
    </div>
  );
};


export default function CalendarScreenRedesign() {
  const [activeTab, setActiveTab] = useState("calendar");
  const [expanded, setExpanded] = useState(false);
  const [selectedDate, setSelectedDate] = useState(TODAY_KEY);
  const [currentMonth, setCurrentMonth] = useState({ year: 2026, month: 3 }); // April = 3 (0-indexed)

  // ── Calendar math ──
  const daysInMonth = new Date(currentMonth.year, currentMonth.month + 1, 0).getDate();
  const firstDayOfWeek = new Date(currentMonth.year, currentMonth.month, 1).getDay();

  const calendarCells = useMemo(() => {
    const cells = [];
    for (let i = 0; i < firstDayOfWeek; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    return cells;
  }, [firstDayOfWeek, daysInMonth]);

  // Week view: get the week containing selected date
  const selectedDateObj = new Date(selectedDate + "T12:00:00");
  const weekStart = new Date(selectedDateObj);
  weekStart.setDate(selectedDateObj.getDate() - selectedDateObj.getDay());
  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d;
  });

  // Events for selected day
  const selEvents = mockEvents[selectedDate] || [];
  const selIncome = selEvents.filter(e => e.type === "income").reduce((s, e) => s + e.amount, 0);
  const selExpense = selEvents.filter(e => e.type === "expense").reduce((s, e) => s + e.amount, 0);

  // Monthly totals
  const monthTotals = useMemo(() => {
    let inc = 0, exp = 0;
    Object.entries(mockEvents).forEach(([, evs]) => {
      evs.forEach(e => { if (e.type === "income") inc += e.amount; else exp += e.amount; });
    });
    return { inc, exp, net: inc - exp };
  }, []);

  // Upcoming events (after today)
  const upcoming = useMemo(() => {
    const items = [];
    for (const date of Object.keys(mockEvents).sort()) {
      if (date <= TODAY_KEY) continue;
      for (const event of mockEvents[date]) items.push({ date, event });
      if (items.length >= 6) break;
    }
    return items.slice(0, 6);
  }, []);

  const shortDate = (s) => {
    const d = new Date(s + "T12:00:00");
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", weekday: "short" });
  };

  const dayLabel = (s) => {
    const d = new Date(s + "T12:00:00");
    return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  };

  const pick = (dateStr) => {
    setSelectedDate(dateStr);
  };

  const shiftMonth = (dir) => {
    let m = currentMonth.month + dir;
    let y = currentMonth.year;
    if (m < 0) { m = 11; y--; }
    if (m > 11) { m = 0; y++; }
    setCurrentMonth({ year: y, month: m });
  };

  const shiftWeek = (dir) => {
    const d = new Date(selectedDate + "T12:00:00");
    d.setDate(d.getDate() + dir * 7);
    const key = toKey(d.getFullYear(), d.getMonth(), d.getDate());
    setSelectedDate(key);
    if (d.getMonth() !== currentMonth.month || d.getFullYear() !== currentMonth.year) {
      setCurrentMonth({ year: d.getFullYear(), month: d.getMonth() });
    }
  };

  const getDotsForDay = (dateKey) => {
    const evs = mockEvents[dateKey] || [];
    const dots = [];
    const hasBill = evs.some(e => e.source === "bill");
    const hasIncome = evs.some(e => e.type === "income");
    const hasPartner = evs.some(e => e.owner === "Partner");
    if (hasBill) dots.push(C.bill);
    if (hasIncome) dots.push(C.income);
    if (hasPartner) dots.push(C.pink);
    if (!hasBill && !hasIncome && !hasPartner && evs.length > 0) dots.push(C.accent);
    return dots;
  };

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
        padding: "8px 0 20px",
        scrollbarWidth: "none"
      }}>

        {/* ── Header ── */}
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "0 20px", marginBottom: 12
        }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>Calendar</h1>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {selectedDate !== TODAY_KEY && (
              <div onClick={() => setSelectedDate(TODAY_KEY)} style={{
                background: "rgba(192,132,252,0.15)", padding: "5px 12px",
                borderRadius: 12, border: "1px solid rgba(192,132,252,0.25)", cursor: "pointer"
              }}>
                <span style={{ color: C.accent, fontSize: 12, fontWeight: 700 }}>Today</span>
              </div>
            )}
            <div onClick={() => setExpanded(!expanded)} style={{
              width: 34, height: 34, borderRadius: 10, background: C.surface,
              display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer"
            }}>
              {expanded ? <Minimize2 size={16} color={C.accent} /> : <Maximize2 size={16} color={C.accent} />}
            </div>
          </div>
        </div>

        {/* ── Calendar View ── */}
        {expanded ? (
          /* Full month calendar */
          <div style={{
            margin: "0 16px", background: C.surface, borderRadius: 16,
            padding: 16, border: `1px solid ${C.border}`
          }}>
            {/* Month nav */}
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16
            }}>
              <div onClick={() => shiftMonth(-1)} style={{ cursor: "pointer", padding: 4 }}>
                <ChevronLeft size={18} color={C.accent} />
              </div>
              <span style={{ fontSize: 17, fontWeight: 700 }}>
                {MONTHS[currentMonth.month]} {currentMonth.year}
              </span>
              <div onClick={() => shiftMonth(1)} style={{ cursor: "pointer", padding: 4 }}>
                <ChevronRight size={18} color={C.accent} />
              </div>
            </div>

            {/* Day headers */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", marginBottom: 8 }}>
              {DAYS.map((d, i) => (
                <div key={i} style={{ textAlign: "center", fontSize: 11, fontWeight: 600, color: C.textMuted }}>{d}</div>
              ))}
            </div>

            {/* Calendar grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
              {calendarCells.map((day, i) => {
                if (day === null) return <div key={i} />;
                const key = toKey(currentMonth.year, currentMonth.month, day);
                const isToday = key === TODAY_KEY;
                const isSelected = key === selectedDate;
                const dots = getDotsForDay(key);

                return (
                  <div key={i} onClick={() => pick(key)} style={{
                    display: "flex", flexDirection: "column", alignItems: "center",
                    padding: "6px 0", cursor: "pointer", borderRadius: 10,
                    background: isSelected ? "rgba(168,85,247,0.2)" : "transparent",
                    transition: "background 0.15s"
                  }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: 16,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      background: isSelected ? C.accent : "transparent",
                      border: isToday && !isSelected ? `1.5px solid ${C.accent}` : "none"
                    }}>
                      <span style={{
                        fontSize: 14, fontWeight: isSelected || isToday ? 700 : 500,
                        color: isSelected ? "#fff" : isToday ? C.accent : C.textPrimary
                      }}>{day}</span>
                    </div>
                    <div style={{ display: "flex", gap: 2, marginTop: 3, height: 5 }}>
                      {dots.slice(0, 3).map((c, j) => (
                        <div key={j} style={{ width: 4, height: 4, borderRadius: 2, background: c }} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Legend */}
            <div style={{
              display: "flex", justifyContent: "center", gap: 16, marginTop: 12, paddingTop: 10,
              borderTop: `1px solid ${C.border}`
            }}>
              {[
                { color: C.bill, label: "Bills" },
                { color: C.income, label: "Income" },
                { color: C.pink, label: "Partner" },
              ].map((l, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <div style={{ width: 6, height: 6, borderRadius: 3, background: l.color }} />
                  <span style={{ fontSize: 10, color: C.textMuted }}>{l.label}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* Compact week strip */
          <div style={{
            margin: "0 16px", background: C.surface, borderRadius: 16,
            padding: 12, border: `1px solid ${C.border}`
          }}>
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, padding: "0 4px"
            }}>
              <div onClick={() => shiftWeek(-1)} style={{ cursor: "pointer", padding: 4 }}>
                <ChevronLeft size={16} color={C.accent} />
              </div>
              <span onClick={() => setExpanded(true)} style={{
                fontSize: 15, fontWeight: 700, cursor: "pointer"
              }}>{MONTHS[currentMonth.month]} {currentMonth.year}</span>
              <div onClick={() => shiftWeek(1)} style={{ cursor: "pointer", padding: 4 }}>
                <ChevronRight size={16} color={C.accent} />
              </div>
            </div>
            <div style={{ display: "flex" }}>
              {weekDates.map((d, i) => {
                const key = toKey(d.getFullYear(), d.getMonth(), d.getDate());
                const isToday = key === TODAY_KEY;
                const isSel = key === selectedDate;
                const dots = getDotsForDay(key);
                return (
                  <div key={i} onClick={() => pick(key)} style={{
                    flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
                    gap: 4, cursor: "pointer"
                  }}>
                    <span style={{
                      fontSize: 11, fontWeight: 600,
                      color: isToday && !isSel ? C.accent : C.textMuted
                    }}>{DAYS[i]}</span>
                    <div style={{
                      width: 36, height: 36, borderRadius: 18,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      background: isSel ? C.accent : "transparent",
                      border: isToday && !isSel ? `1.5px solid ${C.accent}` : "none"
                    }}>
                      <span style={{
                        fontSize: 15, fontWeight: 700,
                        color: isSel ? "#fff" : isToday ? C.accent : C.textPrimary
                      }}>{d.getDate()}</span>
                    </div>
                    <div style={{ display: "flex", gap: 3, height: 5 }}>
                      {dots.slice(0, 3).map((c, j) => (
                        <div key={j} style={{ width: 5, height: 5, borderRadius: 2.5, background: c }} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Monthly Summary Bar ── */}
        <div style={{
          display: "flex", justifyContent: "space-around", alignItems: "center",
          margin: "12px 16px 0", background: C.surface, borderRadius: 14,
          padding: "12px 8px", border: `1px solid ${C.border}`
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 7, height: 7, borderRadius: 4, background: C.income }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: C.income }}>+{fmt(monthTotals.inc)}</span>
          </div>
          <div style={{ width: 1, height: 16, background: "rgba(255,255,255,0.1)" }} />
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 7, height: 7, borderRadius: 4, background: C.expense }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: C.expense }}>-{fmt(monthTotals.exp)}</span>
          </div>
          <div style={{ width: 1, height: 16, background: "rgba(255,255,255,0.1)" }} />
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 10, fontWeight: 600, color: C.textMuted }}>Net</span>
            <span style={{
              fontSize: 12, fontWeight: 700,
              color: monthTotals.net >= 0 ? C.income : C.expense
            }}>{monthTotals.net >= 0 ? "+" : ""}{fmt(monthTotals.net)}</span>
          </div>
        </div>

        {/* ── Day Detail Section ── */}
        <div style={{
          margin: "16px 16px 0", background: C.surface, borderRadius: 16,
          padding: 16, border: `1px solid ${C.border}`
        }}>
          <p style={{ margin: "0 0 2px", fontSize: 15, fontWeight: 800, color: C.textPrimary }}>
            {dayLabel(selectedDate)}
          </p>

          {selEvents.length === 0 ? (
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              gap: 8, padding: "20px 0"
            }}>
              <Sun size={18} color={C.textDim} />
              <span style={{ fontSize: 13, fontWeight: 600, color: C.textDim }}>Nothing scheduled</span>
            </div>
          ) : (
            <>
              {/* Day income/expense chips */}
              {(selIncome > 0 || selExpense > 0) && (
                <div style={{ display: "flex", gap: 8, margin: "10px 0 12px" }}>
                  {selIncome > 0 && (
                    <div style={{
                      display: "flex", alignItems: "center", gap: 4,
                      background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.15)",
                      borderRadius: 16, padding: "4px 10px"
                    }}>
                      <TrendingUp size={11} color={C.income} />
                      <span style={{ fontSize: 11, fontWeight: 700, color: C.income }}>+{fmt(selIncome)}</span>
                    </div>
                  )}
                  {selExpense > 0 && (
                    <div style={{
                      display: "flex", alignItems: "center", gap: 4,
                      background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.15)",
                      borderRadius: 16, padding: "4px 10px"
                    }}>
                      <TrendingDown size={11} color={C.expense} />
                      <span style={{ fontSize: 11, fontWeight: 700, color: C.expense }}>-{fmt(selExpense)}</span>
                    </div>
                  )}
                </div>
              )}
              {selEvents.map((ev, i) => <EventRow key={`${ev.id}-${i}`} event={ev} />)}
            </>
          )}
        </div>

        {/* ── Upcoming Section ── */}
        {upcoming.length > 0 && (
          <div style={{
            margin: "16px 16px 0", background: C.surface, borderRadius: 16,
            padding: 16, border: `1px solid ${C.border}`
          }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 8, marginBottom: 12
            }}>
              <Clock size={14} color={C.accent} />
              <span style={{ fontSize: 15, fontWeight: 800, color: C.textPrimary }}>Upcoming</span>
            </div>
            {upcoming.map(({ date, event }, i) => (
              <EventRow key={`up-${i}`} event={event} dateBadge={shortDate(date)} />
            ))}
          </div>
        )}

        {/* Bottom spacing */}
        <div style={{ height: 20 }} />
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
          { icon: <CalIcon size={20} />, label: "Calendar", id: "calendar" },
          { icon: <Bot size={20} />, label: "AI", id: "ai" },
          { icon: <PieChart size={20} />, label: "Finances", id: "finances" },
          { icon: <Settings size={20} />, label: "Settings", id: "settings" },
        ].map(tab => (
          <div key={tab.id} style={{
            display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
            color: tab.id === activeTab ? C.accent : "rgba(255,255,255,0.35)",
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