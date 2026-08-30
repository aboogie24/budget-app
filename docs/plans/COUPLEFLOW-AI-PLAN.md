# CoupleFlow AI — Couples Financial Assistant
## Product & Architecture Plan

---

## 1. Vision

CoupleFlow AI is a **goal-driven financial assistant for couples**. It doesn't just track money — it predicts a path to financial success. Whether a couple wants to eliminate debt, build an emergency fund, or save for a dream vacation, the AI creates a personalized, month-by-month roadmap and guides them together through every milestone.

**Core Principle:** The AI is a financial co-pilot, not an autopilot. It builds the plan, the couple owns it.

---

## 2. System Architecture

### 2.1 High-Level Architecture

```mermaid
graph TB
    subgraph Client["📱 React Native App (Expo)"]
        Dashboard["Dashboard View<br/>Daily finances, balances,<br/>spending insights"]
        AIChat["AI Chat Interface<br/>Financial advisor,<br/>goal planning"]
        Goals["Goal Tracker<br/>Progress, milestones,<br/>celebrations"]
        Partner["Partner View<br/>Shared dashboard,<br/>joint decisions"]
    end

    subgraph Backend["⚙️ Go API Server"]
        Router["Gorilla Mux Router"]
        Auth["Auth Middleware<br/>JWT + Sessions"]
        API["REST API Handlers"]
        AIService["AI Service Layer"]
        PathEngine["Path Planning Engine"]
        Scheduler["Background Jobs<br/>Recurring txns,<br/>alert checks,<br/>plan updates"]
    end

    subgraph AI["🧠 AI Layer"]
        Claude["Claude API<br/>(Anthropic)"]
        PromptMgr["Prompt Manager<br/>System prompts,<br/>context builder"]
        ConvoStore["Conversation<br/>History Store"]
        ToolDefs["Tool Definitions<br/>Financial calculators,<br/>data lookups"]
    end

    subgraph Data["🗄️ PostgreSQL"]
        Users["Users &<br/>Households"]
        Financial["Transactions,<br/>Budgets, Bills"]
        GoalData["Goals, Debts,<br/>Savings"]
        Plans["Financial Plans<br/>& Milestones"]
        ChatHistory["Chat History<br/>& Context"]
    end

    subgraph External["🌐 External Services"]
        Plaid["Plaid API<br/>Bank sync"]
        Push["Expo Push<br/>Notifications"]
    end

    Client <--> Router
    Router --> Auth --> API
    API --> AIService
    AIService <--> Claude
    AIService --> PromptMgr
    AIService --> ConvoStore
    AIService --> ToolDefs
    API --> PathEngine
    PathEngine --> GoalData
    API --> Financial
    API --> Plans
    ConvoStore --> ChatHistory
    Scheduler --> PathEngine
    Backend <--> Plaid
    Backend --> Push
```

### 2.2 AI Service Architecture (Detail)

```mermaid
graph LR
    subgraph Request["User Message"]
        Msg["'How fast can we<br/>pay off our credit cards?'"]
    end

    subgraph ContextBuilder["Context Builder"]
        Profile["User Profile<br/>Income, expenses,<br/>risk tolerance"]
        FinSnap["Financial Snapshot<br/>Balances, debts,<br/>monthly cash flow"]
        GoalCtx["Active Goals<br/>Current plans,<br/>progress"]
        PartnerCtx["Partner Context<br/>Shared vs individual,<br/>permissions"]
    end

    subgraph ClaudeCall["Claude API Call"]
        SysPrompt["System Prompt<br/>Financial advisor<br/>persona + rules"]
        Tools["Tool Use<br/>calculate_payoff<br/>project_savings<br/>simulate_budget"]
        Response["Structured Response<br/>Analysis + Plan +<br/>Action Items"]
    end

    subgraph Output["Response to User"]
        Chat["Conversational<br/>explanation"]
        Visual["Charts &<br/>projections"]
        Actions["Actionable<br/>next steps"]
    end

    Msg --> ContextBuilder
    ContextBuilder --> ClaudeCall
    ClaudeCall --> Output
```

---

## 3. AI Assistant Design

### 3.1 Hybrid UX Model

The app uses a **dashboard + AI chat** hybrid. The dashboard handles daily financial viewing; the AI chat handles planning, advice, and goal creation.

```mermaid
graph TB
    subgraph DailyUX["📊 Dashboard (Daily Use)"]
        Balance["Account Balances"]
        Recent["Recent Transactions"]
        BudgetBar["Budget Progress Bars"]
        Alerts["AI-Powered Nudges<br/>'You're 80% through<br/>dining budget — 12 days left'"]
        GoalRing["Goal Progress Rings"]
    end

    subgraph AIUX["💬 AI Chat (Planning & Advice)"]
        Welcome["'What financial goal<br/>should we tackle first?'"]
        GoalSetup["Guided Goal Creation<br/>AI asks questions,<br/>builds the plan"]
        WhatIf["What-If Scenarios<br/>'What if we cut dining<br/>by $200/month?'"]
        Review["Monthly Plan Review<br/>'Here's how February went.<br/>Let's adjust March.'"]
        Advice["On-Demand Advice<br/>'Should we refinance?'<br/>'Is this purchase worth it?'"]
    end

    subgraph Bridge["🔗 Connection Points"]
        DashToChat["Dashboard nudge →<br/>Opens chat with context"]
        ChatToDash["Chat creates goal →<br/>Appears on dashboard"]
        Notif["Push notification →<br/>Deep links to chat"]
    end

    DailyUX --> Bridge
    Bridge --> AIUX
    AIUX --> Bridge
    Bridge --> DailyUX
```

### 3.2 AI Persona & Capabilities

The AI assistant has a defined persona and bounded capabilities:

**Persona:** Warm, knowledgeable financial advisor who understands couples dynamics. Never judgmental about spending. Celebrates wins. Speaks plainly — no jargon.

**Can Do:**
- Analyze spending patterns and predict future cash flow
- Create debt payoff plans (avalanche, snowball, hybrid)
- Project savings timelines for goals
- Simulate "what-if" budget scenarios
- Generate month-by-month financial roadmaps
- Provide couple-aware advice (fair splitting, shared goals)
- Send proactive check-ins and nudges

**Cannot Do:**
- Execute transactions or move money
- Provide tax advice or legal guidance
- Access accounts the user hasn't linked
- Make decisions without couple consensus

---

## 4. Goal Path Planning Engine

This is the core differentiator — the AI doesn't just track goals, it **plans the path** to reach them.

### 4.1 Path Planning Flow

```mermaid
flowchart TD
    Start([Couple Opens Goal Planner]) --> Gather

    subgraph Gather["📋 Step 1: Gather Context"]
        Income["Combined Monthly Income"]
        Expenses["Fixed & Variable Expenses"]
        Debts["All Debts<br/>(balances, rates, minimums)"]
        Savings["Current Savings &<br/>Emergency Fund"]
        Linked["Plaid-Linked Accounts<br/>(auto-populated)"]
    end

    Gather --> Goals

    subgraph Goals["🎯 Step 2: Define Goals"]
        G1["Goal 1: Emergency Fund<br/>$10,000 target"]
        G2["Goal 2: Pay Off Credit Cards<br/>$8,500 total"]
        G3["Goal 3: Vacation Fund<br/>$3,000 by December"]
    end

    Goals --> Prioritize

    subgraph Prioritize["⚖️ Step 3: AI Prioritizes"]
        Risk["Risk Assessment<br/>No emergency fund = high risk"]
        Math["Financial Math<br/>High-APR debt costs $X/month"]
        Pref["Couple Preferences<br/>What matters most to you?"]
        Rec["AI Recommendation<br/>Suggested priority order<br/>with reasoning"]
    end

    Prioritize --> Plan

    subgraph Plan["🗺️ Step 4: Generate Path"]
        M1["Month 1-3:<br/>Build $1,000 starter<br/>emergency fund"]
        M2["Month 4-8:<br/>Avalanche attack on<br/>credit card debt"]
        M3["Month 9-11:<br/>Grow emergency fund<br/>to $10,000"]
        M4["Month 12:<br/>Vacation fund sprint<br/>+ celebration!"]
    end

    Plan --> Review

    subgraph Review["👫 Step 5: Couple Review"]
        Show["Present plan to<br/>both partners"]
        Adjust["Allow adjustments<br/>'Can we start vacation<br/>saving sooner?'"]
        Commit["Both partners<br/>commit to plan"]
    end

    Review --> Execute

    subgraph Execute["🚀 Step 6: Execute & Track"]
        Monthly["Monthly check-ins<br/>AI reviews progress"]
        Adapt["Adaptive replanning<br/>Income changed?<br/>Unexpected expense?"]
        Celebrate["Milestone celebrations<br/>🎉 Debt #1 paid off!"]
    end

    Execute -->|"Life happens"| Gather
```

### 4.2 Financial Framework: The CoupleFlow Method

The AI follows a structured framework for financial success — a guided sequence the couple progresses through:

```mermaid
graph TD
    subgraph Framework["💎 The CoupleFlow Financial Framework"]

        L1["🛡️ LEVEL 1: FOUNDATION<br/>━━━━━━━━━━━━━━━━━━━<br/>✓ Track all income & expenses<br/>✓ Create a joint budget<br/>✓ Build $1,000 starter emergency fund<br/>✓ Pay all minimums on time"]

        L2["⚔️ LEVEL 2: ATTACK DEBT<br/>━━━━━━━━━━━━━━━━━━━<br/>✓ List all debts with rates<br/>✓ Choose strategy: avalanche or snowball<br/>✓ Allocate extra payments<br/>✓ Celebrate each payoff"]

        L3["🏰 LEVEL 3: BUILD SECURITY<br/>━━━━━━━━━━━━━━━━━━━<br/>✓ Grow emergency fund to 3-6 months<br/>✓ Review insurance coverage<br/>✓ Start retirement contributions<br/>✓ Automate savings"]

        L4["🚀 LEVEL 4: GROW WEALTH<br/>━━━━━━━━━━━━━━━━━━━<br/>✓ Max retirement accounts<br/>✓ Open investment accounts<br/>✓ Plan big purchases<br/>✓ Build passive income"]

        L5["🌟 LEVEL 5: DREAM BIG<br/>━━━━━━━━━━━━━━━━━━━<br/>✓ Fund dream goals (travel, home, etc.)<br/>✓ Give generously<br/>✓ Achieve financial independence<br/>✓ Mentor others"]
    end

    L1 --> L2 --> L3 --> L4 --> L5

    style L1 fill:#dc2626,color:#fff,stroke:#991b1b
    style L2 fill:#ea580c,color:#fff,stroke:#c2410c
    style L3 fill:#ca8a04,color:#fff,stroke:#a16207
    style L4 fill:#16a34a,color:#fff,stroke:#15803d
    style L5 fill:#7c3aed,color:#fff,stroke:#6d28d9
```

### 4.3 Path Prediction Algorithm

The AI uses a combination of Claude's reasoning and deterministic calculations:

```mermaid
flowchart LR
    subgraph Inputs["Inputs"]
        I1["Monthly take-home pay"]
        I2["Fixed expenses"]
        I3["Variable spending<br/>(3-month average)"]
        I4["Debt details<br/>(balance, APR, min)"]
        I5["Current savings"]
        I6["Goal targets & dates"]
    end

    subgraph Calculation["Calculation Engine (Go)"]
        CF["Cash Flow Analysis<br/>Income - Fixed - Variable<br/>= Available monthly"]
        Debt["Debt Payoff Simulator<br/>Avalanche/Snowball/Hybrid<br/>Month-by-month projection"]
        Save["Savings Projector<br/>Compound interest,<br/>contribution schedule"]
        Risk["Risk Scorer<br/>Months of runway,<br/>debt-to-income ratio"]
    end

    subgraph Claude["Claude AI Layer"]
        Optimize["Optimize Allocation<br/>How much to each goal<br/>per month?"]
        Scenario["Scenario Generation<br/>Best case / Expected /<br/>Conservative"]
        Explain["Natural Language<br/>Explanation<br/>Why this path works"]
        Couple["Couple-Aware Advice<br/>Fair contribution splits,<br/>shared vs. personal goals"]
    end

    subgraph Output["Plan Output"]
        Timeline["Month-by-Month<br/>Timeline"]
        Milestones["Key Milestones<br/>& Celebrations"]
        Actions["Monthly Action Items<br/>for Each Partner"]
        Projections["Visual Projections<br/>Charts & Graphs"]
    end

    Inputs --> Calculation --> Claude --> Output
```

---

## 5. Couple Collaboration Model

### 5.1 Partner Decision Flow

Financial plans require both partners to agree. The AI facilitates this:

```mermaid
sequenceDiagram
    actor P1 as Partner 1 (Alfred)
    participant AI as CoupleFlow AI
    actor P2 as Partner 2

    P1->>AI: "Let's plan to pay off our debt"
    AI->>AI: Analyze household finances
    AI->>P1: Here's a proposed plan:<br/>5-month debt payoff, $800/mo extra
    AI->>P2: 🔔 Alfred started a debt payoff plan.<br/>Review and share your thoughts?

    P2->>AI: "Can we do $600 instead?<br/>I want to keep some for fun money"
    AI->>AI: Recalculate with $600/mo
    AI->>P1: Partner suggested $600/mo.<br/>This extends payoff to 7 months.<br/>Here's the comparison.
    AI->>P2: Same comparison shown

    P1->>AI: "Let's meet in the middle at $700"
    AI->>AI: Recalculate with $700/mo
    AI->>P1: $700/mo = 6 month payoff.<br/>Ready to commit?
    AI->>P2: $700/mo = 6 month payoff.<br/>Ready to commit?

    P2->>AI: "Yes, let's do it!"
    P1->>AI: "Agreed!"
    AI->>AI: Lock plan, create milestones
    AI->>P1: ✅ Plan committed! First milestone:<br/>$2,100 paid off by April 30
    AI->>P2: ✅ Plan committed! First milestone:<br/>$2,100 paid off by April 30
```

### 5.2 Shared vs. Personal Goals

```mermaid
graph TB
    subgraph Household["🏠 Household Finances"]
        Joint["Joint Goals<br/>Both partners contribute<br/>Both must approve changes"]
        P1Solo["Partner 1 Personal<br/>Individual goals<br/>Visible but separate"]
        P2Solo["Partner 2 Personal<br/>Individual goals<br/>Visible but separate"]
    end

    subgraph Examples["Examples"]
        JointEx["🏠 Emergency Fund<br/>🏖️ Family Vacation<br/>🚗 New Car Fund<br/>💳 Joint Debt Payoff"]
        P1Ex["🎮 Gaming PC Fund<br/>📚 Course Tuition"]
        P2Ex["👗 Wardrobe Budget<br/>🎸 Guitar Lessons"]
    end

    Joint --- JointEx
    P1Solo --- P1Ex
    P2Solo --- P2Ex

    subgraph Privacy["🔒 Sharing Controls"]
        Full["Full Visibility<br/>Both see everything"]
        Partial["Partial<br/>See totals, not details"]
        Private["Private<br/>Only you see it"]
    end

    P1Solo --> Privacy
    P2Solo --> Privacy
```

---

## 6. Data Model (New Tables)

These additions extend the existing PostgreSQL schema:

```mermaid
erDiagram
    USERS ||--o{ AI_CONVERSATIONS : has
    USERS ||--o{ FINANCIAL_PLANS : creates
    HOUSEHOLDS ||--o{ FINANCIAL_PLANS : owns
    FINANCIAL_PLANS ||--|{ PLAN_MILESTONES : contains
    FINANCIAL_PLANS ||--|{ PLAN_ALLOCATIONS : defines
    FINANCIAL_PLANS }o--o{ SAVINGS_GOALS : targets
    FINANCIAL_PLANS }o--o{ DEBT_ACCOUNTS : targets
    AI_CONVERSATIONS ||--|{ AI_MESSAGES : contains
    USERS ||--o{ PLAN_APPROVALS : gives
    FINANCIAL_PLANS ||--|{ PLAN_APPROVALS : requires
    FINANCIAL_PLANS ||--|{ PLAN_SNAPSHOTS : tracks

    AI_CONVERSATIONS {
        uuid id PK
        uuid user_id FK
        uuid household_id FK
        string title
        string conversation_type "planning|advice|review|general"
        jsonb context_snapshot
        timestamp created_at
        timestamp updated_at
    }

    AI_MESSAGES {
        uuid id PK
        uuid conversation_id FK
        string role "user|assistant|system"
        text content
        jsonb tool_calls
        jsonb tool_results
        int token_count
        timestamp created_at
    }

    FINANCIAL_PLANS {
        uuid id PK
        uuid household_id FK
        uuid created_by FK
        string name
        string plan_type "debt_payoff|savings|emergency|vacation|custom"
        string status "draft|pending_approval|active|paused|completed"
        string framework_level "foundation|attack_debt|build_security|grow_wealth|dream_big"
        decimal monthly_contribution
        date start_date
        date projected_end_date
        jsonb ai_analysis
        jsonb scenarios "best_case|expected|conservative"
        timestamp created_at
        timestamp updated_at
    }

    PLAN_MILESTONES {
        uuid id PK
        uuid plan_id FK
        string title
        string description
        decimal target_amount
        date target_date
        string status "upcoming|in_progress|completed|missed"
        timestamp completed_at
    }

    PLAN_ALLOCATIONS {
        uuid id PK
        uuid plan_id FK
        uuid target_id "savings_goal_id or debt_id"
        string target_type "savings_goal|debt_account"
        decimal monthly_amount
        int priority_order
    }

    PLAN_APPROVALS {
        uuid id PK
        uuid plan_id FK
        uuid user_id FK
        string status "pending|approved|rejected|changes_requested"
        text feedback
        timestamp responded_at
    }

    PLAN_SNAPSHOTS {
        uuid id PK
        uuid plan_id FK
        date snapshot_date
        jsonb financial_state "balances, debts, savings at this point"
        jsonb progress_metrics
        text ai_review_summary
    }
```

---

## 7. API Design (New Endpoints)

### 7.1 AI Chat Endpoints

```
POST   /auth/ai/conversations                  Create new conversation
GET    /auth/ai/conversations                  List user's conversations
GET    /auth/ai/conversations/:id              Get conversation with messages
POST   /auth/ai/conversations/:id/messages     Send message (streams response)
DELETE /auth/ai/conversations/:id              Delete conversation
```

### 7.2 Financial Plan Endpoints

```
POST   /auth/plans                              Create plan (AI generates)
GET    /auth/plans                              List household plans
GET    /auth/plans/:id                          Get plan with milestones
PUT    /auth/plans/:id                          Update plan
POST   /auth/plans/:id/approve                  Partner approves plan
POST   /auth/plans/:id/reject                   Partner rejects with feedback
POST   /auth/plans/:id/pause                    Pause plan
POST   /auth/plans/:id/resume                   Resume plan
POST   /auth/plans/:id/recalculate              AI recalculates based on new data
GET    /auth/plans/:id/scenarios                Get best/expected/conservative
GET    /auth/plans/:id/progress                 Current progress vs. plan
POST   /auth/plans/:id/snapshots                Create monthly snapshot
```

### 7.3 AI Insight Endpoints

```
GET    /auth/ai/nudges                          Get current AI nudges for dashboard
GET    /auth/ai/framework-level                 Get couple's current framework level
POST   /auth/ai/what-if                         Simulate a scenario
GET    /auth/ai/monthly-review                  Generate monthly review
```

---

## 8. Claude Integration Design

### 8.1 Tool Definitions for Claude

The AI assistant uses Claude's **tool use** feature to access real financial data:

```
┌─────────────────────────────────────────────────────────┐
│ Claude Tool Definitions                                  │
├─────────────────────────────────────────────────────────┤
│                                                          │
│ get_financial_snapshot                                    │
│   → Returns: income, expenses, balances, net worth       │
│                                                          │
│ get_debts                                                │
│   → Returns: all debts with balances, APRs, minimums     │
│                                                          │
│ get_savings_goals                                        │
│   → Returns: all goals with current/target amounts       │
│                                                          │
│ get_spending_by_category                                 │
│   → Params: months (1-12)                                │
│   → Returns: categorized spending averages               │
│                                                          │
│ calculate_debt_payoff                                    │
│   → Params: strategy, extra_payment                      │
│   → Returns: month-by-month payoff schedule              │
│                                                          │
│ project_savings                                          │
│   → Params: monthly_amount, target, interest_rate        │
│   → Returns: timeline with compound growth               │
│                                                          │
│ simulate_budget_change                                   │
│   → Params: category, new_amount                         │
│   → Returns: impact on cash flow and goals               │
│                                                          │
│ create_financial_plan                                    │
│   → Params: goals, monthly_budget, strategy              │
│   → Returns: full plan object saved to DB                │
│                                                          │
│ get_partner_status                                       │
│   → Returns: partner's pending reviews, shared goals     │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### 8.2 System Prompt Architecture

```mermaid
flowchart TD
    subgraph Prompt["System Prompt Composition"]
        Base["Base Persona<br/>You are CoupleFlow AI,<br/>a warm financial advisor<br/>for couples..."]
        Framework["Framework Rules<br/>The CoupleFlow Method:<br/>Foundation → Attack Debt →<br/>Build Security → Grow → Dream"]
        Safety["Safety Guardrails<br/>Never recommend specific stocks.<br/>Never shame spending.<br/>Always present options, not orders."]
        Context["Dynamic Context<br/>(injected per request)"]
    end

    subgraph Dynamic["Dynamic Context (per request)"]
        UserCtx["User: Alfred, Partner: [name]<br/>Household income: $X/mo<br/>Framework level: Attack Debt"]
        FinCtx["Cash flow: +$1,200/mo available<br/>Total debt: $8,500<br/>Emergency fund: $1,000"]
        GoalCtx["Active plan: 6-month debt payoff<br/>Progress: Month 2 of 6<br/>On track: Yes"]
        History["Recent conversation summary<br/>(last 5 messages)"]
    end

    Base --> Context
    Framework --> Context
    Safety --> Context
    Context --> Dynamic
```

---

## 9. UX Flow: Key Screens

### 9.1 Navigation Architecture

```mermaid
graph TD
    subgraph TabBar["Bottom Tab Navigation"]
        T1["🏠 Home<br/>Dashboard"]
        T2["💬 AI<br/>Chat"]
        T3["🎯 Goals<br/>Plans"]
        T4["📊 Budget"]
        T5["⚙️ Settings"]
    end

    T1 --> Home
    T2 --> Chat
    T3 --> GoalStack
    T4 --> BudgetStack

    subgraph Home["Home Stack"]
        Dash["Dashboard<br/>Balances, recent txns,<br/>AI nudges, goal rings"]
        Txns["Transaction List"]
        TxnDetail["Transaction Detail"]
    end

    subgraph Chat["AI Chat Stack"]
        ConvoList["Conversation List<br/>Past chats organized<br/>by topic"]
        ActiveChat["Active Chat<br/>Message thread with<br/>rich responses"]
        PlanPreview["Plan Preview<br/>Review AI-generated<br/>plan before committing"]
    end

    subgraph GoalStack["Goals Stack"]
        GoalDash["Goals Dashboard<br/>Framework level indicator,<br/>active plans, progress"]
        PlanDetail["Plan Detail<br/>Timeline, milestones,<br/>partner status"]
        Milestone["Milestone Detail<br/>What to do this month"]
    end

    subgraph BudgetStack["Budget Stack"]
        BudgetOverview["Budget Overview<br/>Category bars,<br/>AI suggestions"]
        CategoryDetail["Category Detail<br/>Spending trends,<br/>AI comparison"]
    end

    Dash -->|"AI nudge tap"| ActiveChat
    Dash -->|"Goal ring tap"| PlanDetail
    ActiveChat -->|"Plan created"| PlanPreview
    PlanPreview -->|"Committed"| PlanDetail
```

### 9.2 AI Chat Interface Concept

```
┌──────────────────────────────────────┐
│  ← CoupleFlow AI          🔄 New    │
├──────────────────────────────────────┤
│                                      │
│  ┌────────────────────────────────┐  │
│  │ 🤖 Based on your finances,    │  │
│  │ here's what I recommend:      │  │
│  │                                │  │
│  │ You have $1,200/mo available   │  │
│  │ after expenses. Here's a plan: │  │
│  │                                │  │
│  │ ┌──────────────────────────┐  │  │
│  │ │ 📊 6-Month Debt Freedom  │  │  │
│  │ │                          │  │  │
│  │ │ Month 1-2: Pay off Visa  │  │  │
│  │ │ Month 3-5: Pay off Amex  │  │  │
│  │ │ Month 6: Build savings   │  │  │
│  │ │                          │  │  │
│  │ │ Total interest saved:    │  │  │
│  │ │ $847 vs minimum payments │  │  │
│  │ │                          │  │  │
│  │ │ [View Full Plan]         │  │  │
│  │ └──────────────────────────┘  │  │
│  │                                │  │
│  │ Want me to adjust anything?    │  │
│  └────────────────────────────────┘  │
│                                      │
│         ┌──────────────────────┐     │
│         │ What if we put $800  │     │
│         │ instead of $700?     │     │
│         └──────────────────────┘     │
│                                      │
├──────────────────────────────────────┤
│  ┌──────────────────────────────┐   │
│  │ Ask CoupleFlow AI...     📎 🎤│   │
│  └──────────────────────────────┘   │
│                                      │
│  Quick: [Review my month]           │
│         [What-if scenario]           │
│         [Adjust our plan]            │
└──────────────────────────────────────┘
```

---

## 10. Background Intelligence

### 10.1 Proactive AI Features

The AI doesn't wait to be asked — it proactively monitors and nudges:

```mermaid
flowchart TD
    subgraph Triggers["⏰ Background Triggers"]
        Daily["Daily Job<br/>Check budgets,<br/>upcoming bills"]
        Weekly["Weekly Job<br/>Spending trend<br/>analysis"]
        Monthly["Monthly Job<br/>Full plan review,<br/>snapshot creation"]
        Event["Event-Driven<br/>Large transaction,<br/>bill paid, goal hit"]
    end

    subgraph Analysis["🧠 AI Analysis"]
        Budget["Budget Alert<br/>'Dining is at 85%<br/>with 12 days left'"]
        Trend["Trend Detection<br/>'Grocery spending up<br/>22% vs last month'"]
        Risk["Risk Alert<br/>'Emergency fund would<br/>only cover 1.2 months'"]
        Win["Win Detection<br/>'You paid off your<br/>first credit card! 🎉'"]
        Replan["Replan Trigger<br/>'Income changed —<br/>want to update the plan?'"]
    end

    subgraph Delivery["📲 Delivery"]
        Push["Push Notification"]
        Nudge["Dashboard Nudge Card"]
        ChatMsg["Chat Message<br/>(next time they open)"]
    end

    Triggers --> Analysis --> Delivery
```

---

## 11. Implementation Phases

### Phase 1: AI Foundation (Weeks 1-3)
- Claude API integration in Go backend
- Conversation storage (new DB tables + migrations)
- Basic AI chat endpoint with streaming
- System prompt with financial advisor persona
- Tool definitions: `get_financial_snapshot`, `get_debts`, `get_savings_goals`
- Frontend: AI chat screen with message UI

### Phase 2: Path Planning Engine (Weeks 4-6)
- Debt payoff calculator (avalanche/snowball/hybrid)
- Savings projection calculator
- Cash flow analyzer
- Financial plan data model + API
- Claude tool: `calculate_debt_payoff`, `project_savings`, `create_financial_plan`
- Frontend: Plan creation flow, plan detail view

### Phase 3: Couple Collaboration (Weeks 7-8)
- Plan approval/rejection flow
- Partner notifications for plan reviews
- Shared vs. personal goal visibility
- Couple decision negotiation via AI
- Frontend: Partner review screens, approval UI

### Phase 4: Framework & Milestones (Weeks 9-10)
- CoupleFlow Method framework level tracking
- Milestone creation and tracking
- Monthly snapshot system
- Progress visualization
- Frontend: Goals dashboard with framework level, milestone cards

### Phase 5: Proactive Intelligence (Weeks 11-12)
- Background jobs for budget monitoring
- AI nudge generation system
- Monthly review automation
- What-if scenario simulator
- Dashboard nudge cards
- Push notification integration

### Phase 6: Polish & Launch (Weeks 13-14)
- UX refinement (glassmorphic design alignment)
- Error handling and edge cases
- Performance optimization
- Testing (unit, integration, E2E)
- App Store preparation

---

## 12. Tech Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| AI Provider | Claude (Anthropic) | Superior reasoning for financial analysis, excellent tool use, conversational quality |
| AI Communication | Server-side streaming (SSE) | Real-time response feel, backend controls context and tools |
| Conversation Storage | PostgreSQL (not vector DB) | Conversations are structured, not semantic search — relational fits |
| Financial Calculations | Go (deterministic) | Debt payoff and savings math must be exact — not AI-generated |
| Plan Explanations | Claude (conversational) | Why this plan works, trade-offs, advice — Claude's strength |
| Background Jobs | Go cron scheduler | Already have scheduler infrastructure, keep it simple |
| Prompt Management | Go templates + DB config | Version and A/B test prompts without redeployment |

---

## 13. Security & Privacy Considerations

- All financial data stays server-side; Claude only receives aggregated summaries, never raw bank credentials
- Conversation history encrypted at rest
- Partner can only see shared goals and joint conversations (respects sharing_preferences)
- AI never stores or logs Plaid tokens
- Rate limiting on AI endpoints (prevent abuse and cost overruns)
- Monthly cost monitoring for Claude API usage
- Users can delete all AI conversation history

---

*This plan builds on the existing CoupleFlow codebase (~55% MVP complete) and adds the AI assistant layer as the primary differentiator. The goal-path planning engine transforms the app from a tracker into a true financial success partner for couples.*
