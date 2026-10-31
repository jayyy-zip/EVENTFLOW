# EventFlow AI — Agentic Event Planning Operating System

EventFlow AI is an agentic, state-authoritative event operating system engineered for Weddings, Milestone Birthdays, and Campus/Community Events. It merges warm editorial hospitality aesthetics with Linear-grade financial and scheduling precision powered by the Gemini API (`@google/genai`).

---

### User Review & Critical Decisions

> [!IMPORTANT]
> The following locked product decisions govern the implementation:

- **Confirmed Currency & Regional Benchmarks**: Indian Rupees (`₹` - INR) formatted strictly with the `en-IN` locale (`₹12,00,000`, `₹1.5L`) and grounded in Tier-1 & Tier-2 Indian city benchmarks (Pune, Mumbai, Delhi NCR, Bengaluru, Nagpur/Nashik). Includes per-plate catering tiers, category-specific GST slabs (5% / 18%), PPL/Novex music license alerts, and 8–12% contingency buffers.
- **Confirmed Copilot Mutation UX**: Interactive **"Proposed Plan Mutation Cards"** rendered directly inside the right Copilot panel showing color-coded red/green diffs across Budget, Timeline, and Checklists, paired with an explicit **"Apply Changes to Plan"** button and a full transactional **"Revert Snapshot"** undo stack.
- **Confirmed Starter Event Presets**: 3 deeply populated, multi-track presets in the Event Switcher:
  1. *Aarav & Priya's Pune Wedding* (`₹12,00,000` budget, 45 days out, 250 guests, sub-functions: `Haldi`, `Sangeet`, `Reception`).
  2. *Rohan's 25th Milestone Birthday* (`₹1,50,000` budget, 20 days out, 80 guests, sub-functions: `Rooftop Sundowner`, `Afterparty`).
  3. *Apex College Tech & Cultural Fest* (`₹6,50,000` budget, 60 days out, 400 attendees, sub-functions: `Day 1 Hackathon`, `Day 2 Pronite`, sponsor tiers & municipal/police NOC permits).

---

### 1. Overview & Core Concept

- **What It Does**: EventFlow AI replaces disconnected spreadsheets, static directory checklists, and ungrounded chatbots with a synchronized, state-aware event cockpit. Moving the Guest Count Slider dynamically recalculates variable and hybrid per-plate line items; delaying a foundational task cascades slippage across downstream dependent tasks; uploading or pasting a vendor quote extracts hidden contract exclusions; and natural-language prompts compile into deterministic state diffs.
- **Target Audience**: Wedding hosts & planners, milestone birthday organizers, and campus/community cultural secretaries who require financial certainty, vendor contract vigilance, and dynamic schedule elasticity.
- **Key Value Proposition**:
  1. **Zero Budget Surprises**: Enforces tax/GST buffers, tracks Fixed vs. Variable Per-Guest vs. Hybrid costs, and flags unrealistic local pricing before money is spent.
  2. **Self-Healing Dependency Timeline**: Uses backward scheduling (`T-Minus Days`) with a multi-parent Directed Acyclic Graph (DAG) to highlight bottlenecks and auto-compress schedules when delays happen.
  3. **Vendor Contract Defense**: Normalizes messy vendor quotes to a true **Effective Cost Per Guest (incl. GST & hidden add-ons)** and generates ready-to-send WhatsApp negotiation scripts.

---

### 2. User Experience & Visual Design

#### Visual Identity: "Warm Luxury meets Linear Precision"
- **Canvas Base**: Warm Alabaster (`#FAF8F5`) ambient background to reduce eye strain across dense tables.
- **Surface & Cards**: Pure Crisp White (`#FFFFFF`) cards with `1px solid #E7E5E4` (Warm Stone) hairline borders, subtle `0 1px 2px rgba(24,24,27,0.04)` elevation, and zero nested card clutter.
- **Semantic Color System**:
  - **Terracotta Rose (`#E05A47`)**: Brand identity, primary CTA triggers, active sub-function indicators.
  - **Electric Indigo (`#4F46E5`)**: Reserved exclusively for AI intelligence, Copilot state diffs, benchmark reasoning, and multimodal extraction triggers.
  - **Warm Amber (`#D97706` / `#FEF3C7` bg)**: Tier-1/Tier-2 benchmark price warnings, cascading timeline dependency alerts, and hidden vendor fee flags.
  - **Crimson (`#DC2626` / `#FEE2E2` bg)**: Hard budget overruns, delayed root milestones, and critical contract exclusions.
  - **Evergreen (`#16A34A` / `#DCFCE7` bg)**: Locked vendor contracts, balanced budget deltas, and completed milestones.
- **Typography & Scannability**:
  - Headings: `Plus Jakarta Sans` (semi-bold, tight tracking `-0.02em`).
  - UI & Data Tables: `Inter` with mandatory `font-variant-numeric: tabular-nums` (`tabular-nums`) on all currency cells, guest sliders, percentages, and T-minus countdowns.
  - Metadata Discipline: Clean inline metadata separated by middots (`·`) rather than excessive decorative badges.

#### 3-Pane Split Workspace Architecture

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ Top Header: Brand "EventFlow AI" · Active Preset Switcher · Sub-Function Filter Bar · Readiness Score (84%)  │
├──────────────────┬───────────────────────────────────────────────────────────────┬───────────────────────────┤
│ LEFT RAIL        │ CENTER WORKSPACE CANVAS                                       │ RIGHT DOCKED COPILOT      │
│ (250px Fixed)    │ (Fluid 1fr, Scrollable)                                       │ (380px Fixed)             │
│                  │                                                               │                           │
│ • Event Switcher │ ┌───────────────────────────────────────────────────────────┐ │ • Gemini 3.8 Flash Badge  │
│   (3 Presets +   │ │ Live Telemetry Bar: T-45d Countdown · Interactive What-If │ │ • Context Pill:           │
│   Custom Modal)  │ │ Guest Slider (50–500) · Allocated + GST vs Total Budget   │ │   "Pune · 250 Guests"     │
│                  │ └───────────────────────────────────────────────────────────┘ │                           │
│ • Workspace Tabs │                                                               │ • Chat & Reasoning Stream │
│   1. Budget      │ ┌───────────────────────────────────────────────────────────┐ │                           │
│   2. Timeline    │ │ Active Module View:                                       │ │ • Proposed Plan Mutation  │
│   3. Quotes      │ │  - Tab 1: Smart Budget Architect (Hybrid Guest Scaling)   │ │   Card (Diff Preview):    │
│   4. Moodboard   │ │  - Tab 2: Adaptive Dependency DAG (Cascade Slippage)      │ │   [Decor: -₹30,000]       │
│                  │ │  - Tab 3: Vendor Quote Matrix & Vision Exclusion Scanner  │ │   [Sound/DJ: +₹30,000]    │
│ • Financial      │ │  - Tab 4: Executable Moodboard-to-BOM Studio              │ │   [Sangeet: Shift +1 hr]  │
│   Controls:      │ └───────────────────────────────────────────────────────────┘ │   [✓ Apply] [↺ Revert]    │
│   - GST & Buffer │                                                               │                           │
│     Slider (8%)  │                                                               │ • Prompt Input + Upload   │
│   - Export CSV   │                                                               │ • 3 Scenario Test Chips   │
└──────────────────┴───────────────────────────────────────────────────────────────┴───────────────────────────┘
```

---

### 3. Center Canvas Interactive Modules (Deep Specification)

#### Module 0: Top Live Telemetry & Sub-Function Bar
- **Sub-Function Segmented Filter**: Switch between `All Functions` or specific tracks (e.g., `Haldi` · `Sangeet` · `Reception` for Weddings; `Hackathon` · `Pronite` for Campus Fest). Filtering updates the visible budget rows and timeline tasks while showing the proportion of total spend.
- **Deterministic "What-If Guest Count Slider" (50 to 500 Guests)**:
  - Dragging the slider immediately recalculates every `VARIABLE_PER_GUEST` item (`newAmount = perGuestRate * guestCount`) and `HYBRID` item (`newAmount = baseFixedCost + (perGuestRate * guestCount)`).
  - Automatically checks if the new guest count breaches the current Venue's `maxCapacity` and triggers an instant Amber capacity alert if exceeded.
- **Dual-Segment Budget Progress Bar**: Visualizes `Base Allocated Spend` (Terracotta), `Reserved GST & Contingency Buffer` (Indigo Stripe), and `Remaining Unallocated / Overrun Delta` (Evergreen or Crimson).

#### Tab 1: Smart Budget Architect
- **Structured Columns**: `Category & Item` | `Sub-Function` | `Cost Behavior` (`FIXED`, `VARIABLE_PER_GUEST`, `HYBRID`, `TAX_AND_BUFFER`) | `Unit / Per-Plate Rate` | `Total Allocated (₹)` | `% of Budget` | `AI Local Benchmark Status`.
- **Indian Benchmark Intelligence Engine**:
  - Evaluates line items against city-specific heuristics (e.g., if Pune Wedding Per-Plate Catering < `₹750`, flags *"Below Pune Tier-1 quality threshold (₹850–₹1,400/plate)"*; if Decor > `28%` of total budget, flags *"High Decor allocation; verify if floral imports or venue monopoly royalty is inflating cost"*).
- **Bidirectional Inline Editing**: Editing a total amount on a `VARIABLE_PER_GUEST` row automatically updates its `perGuestRate` (`allocatedAmount / guestCount`) so subsequent Guest Slider movements remain mathematically consistent.

#### Tab 2: Adaptive Dependency Timeline (Backward DAG Engine)
- **T-Minus Backward Scheduling**: Tasks are anchored by `daysBeforeEvent` (`T-45d`, `T-30d`, `T-7d`, `T-0h Event Run-of-Show`) and computed into real calendar dates based on `eventDate`.
- **Multi-Parent Dependency Propagation**:
  - Each task stores `dependsOnIds: string[]`, `durationDays: number`, and `slippageDays: number`.
  - When a user toggles a parent task to `DELAYED` (or increments its delay by `+7 days`), a topological graph traversal automatically marks all downstream child/grandchild tasks as `AT_RISK_DEPENDENCY` and computes their compressed deadline window.
- **"Auto-Heal Schedule" Action**: A 1-click AI action on at-risk chains that proposes parallelizing tasks or adjusting lead times via a Copilot Mutation Card.

#### Tab 3: Vendor Quote Comparator & Multimodal Exclusion Scanner
- **Side-by-Side Normalized Matrix**: Compares up to 3 vendors per category across:
  - `Quoted Base Price`
  - `Per-Plate / Per-Unit Rate`
  - `GST Slab Applied (5% vs 18%)`
  - `Hidden Exclusions Quantified (₹ Est.)`
  - **`True Effective Total (Normalized)`** — the real out-of-pocket number.
- **Red-Flag Exclusion Scanner (Indian Event Specifics)**:
  - Flags fine-print traps: *Generator Diesel Backup extra (₹8,000/shift)*, *PPL/Novex DJ Music License excluded (₹25,000)*, *Venue Outside-Decorator Royalty (15%)*, *Late-night overtime past 11:00 PM (₹15,000/hr)*, *Corkage / Bartender charges*.
- **Dual Input (Live Multimodal + Instant Sample Presets)**:
  - Users can paste raw WhatsApp/Email quote text, upload an image/screenshot (`base64` sent to `gemini-3.8-flash` Vision), OR click **"Load Sample Unparsed Quote"** to watch Gemini extract and append a 4th vendor column in real time.
- **1-Click WhatsApp Counter-Offer Generator**: Opens a modal with a copyable, culturally polite yet firm Indian vendor negotiation message citing local benchmarks and requesting fee waivers.

#### Tab 4: Executable Ideas & Moodboard-to-BOM (Bill of Materials) Studio
- **Vibe & Budget Constraint Input**: Users select a preset chip or type a custom prompt (e.g., *"Rustic Marigold Courtyard Haldi in Pune under ₹1.2L"* or *"Cyberpunk College Hackathon Arena under ₹80k"*).
- **Executable Bill of Materials (BOM)**: Instead of vague inspiration text, Gemini outputs a structured table of concrete rental/purchase line items:
  - `Item Name` | `Exact Spec & Quantity` (e.g., `300m Warm Fairy String Lights`, `45 Brass Urli Bowls`) | `Est. Local Rental Cost (₹)` | `[+ Sync to Budget & Timeline]` button.
- Clicking **"+ Sync to Budget & Timeline"** dispatches the items directly into Tab 1 (Budget) and creates a procurement task in Tab 2 (Timeline).

---

### 4. Right Docked Stateful AI Copilot & Undo Architecture

- **Context-Injected Prompts**: Every request to `/api/plan-mutation` automatically includes a compact JSON serialization of the current active `EventPlan` state so Gemini reasons over the user's *exact* current numbers, guest count, and delayed tasks.
- **Interactive "Proposed Plan Mutation Card"**:
  - Displays a human-readable rationale plus categorized diff rows:
    - **Budget Diffs**: `Category Name`: `₹Old` → `₹New` (`+₹Delta` in Evergreen or `-₹Delta` in Terracotta/Red).
    - **Timeline Diffs**: `Task Title`: `Old Status/Date` → `New Status/Date`.
    - **BOM / Checklist Additions**: `+ Item Name (₹Cost)`.
  - **Transactional State Application**:
    - Clicking **"Apply Changes to Plan"** pushes a deep clone of the current `EventPlan` onto `undoStack: EventPlan[]`, applies the mutations atomically, and flips the card state to `Applied ✓` with an inline **"Revert This Change"** button.

---

### 5. Technical Architecture & Gemini SDK Integration

```
┌──────────────────────────────────────────────────────────────────────────┐
│                          REACT FRONTEND (Vite + TS)                      │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │ EventStoreContext (Immutable State + Undo Snapshot Stack)          │  │
│  │  • Deterministic Guest Slider Recalculator (Fixed/Variable/Hybrid) │  │
│  │  • Topological Dependency Graph Walker (Cascade Slippage Engine)   │  │
│  │  • Indian Currency Formatter (Intl.NumberFormat('en-IN'))          │  │
│  └───────────────┬────────────────────────────────────┬───────────────┘  │
│                  │                                    │                  │
│                  ▼                                    ▼                  │
│  ┌───────────────────────────────┐    ┌───────────────────────────────┐  │
│  │ 4 Interactive Workspace Tabs  │    │ Stateful AI Copilot Drawer    │  │
│  └───────────────────────────────┘    └───────────────┬───────────────┘  │
└───────────────────────────────────────────────────────┼──────────────────┘
                                                        │ POST /api/*
                                                        ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                        EXPRESS SERVER (server.ts)                        │
│                                                                          │
│  • SDK: import { GoogleGenAI, Type } from '@google/genai'                │
│  • Model: 'gemini-3.8-flash'                                             │
│  • Endpoints:                                                            │
│     1. POST /api/plan-mutation (Chat + Current State -> JSON Diffs)      │
│     2. POST /api/vendor-extract (Text / Base64 Image -> VendorQuote)     │
│     3. POST /api/moodboard-bom (Vibe + Budget Cap -> Executable BOM)     │
│  • Deterministic Fallback Engine: If GEMINI_API_KEY is absent or         │
│    rate-limited, computes context-aware structured mutations locally.    │
└──────────────────────────────────────────────────────────────────────────┘
```

#### Complete TypeScript Data Schema (`src/types/event.ts`)

```typescript
export type EventType = 'WEDDING' | 'BIRTHDAY' | 'COMMUNITY_EVENT';
export type CostType = 'FIXED' | 'VARIABLE_PER_GUEST' | 'HYBRID' | 'TAX_AND_BUFFER';
export type TaskStatus = 'COMPLETED' | 'ON_TRACK' | 'DELAYED' | 'AT_RISK_DEPENDENCY';

export interface BudgetItem {
  id: string;
  category: string;
  name: string;
  subFunction: string; // e.g., 'Haldi', 'Sangeet', 'Reception', 'Main Event'
  costType: CostType;
  baseFixedCost: number; // Used when costType === 'FIXED' or 'HYBRID'
  perGuestRate: number;  // Used when costType === 'VARIABLE_PER_GUEST' or 'HYBRID'
  allocatedAmount: number;
  aiWarning?: string;
}

export interface TimelineTask {
  id: string;
  title: string;
  subFunction: string;
  phase: 'T-60_TO_30' | 'T-30_TO_15' | 'T-15_TO_7' | 'WEEK_OF_EVENT' | 'RUN_OF_SHOW';
  daysBeforeEvent: number;
  durationDays: number;
  slippageDays: number;
  status: TaskStatus;
  dependsOnIds: string[]; // Multi-parent DAG support
  owner: string;
  notes?: string;
}

export interface VendorQuote {
  id: string;
  vendorName: string;
  category: string;
  baseCost: number;
  perPlateCost?: number;
  gstRatePercent: number;
  taxesGstAmount: number;
  estimatedHiddenCosts: number;
  normalizedTotal: number;
  hiddenFeesFlagged: string[];
  aiRecommendationBadge?: 'BEST_VALUE' | 'HIGH_RISK_EXCLUSIONS' | 'PREMIUM_PICK';
  negotiationScript: string;
}

export interface ChecklistItem {
  id: string;
  itemName: string;
  subFunction: string;
  quantityOrSpec: string;
  estimatedCost: number;
  syncedToBudget: boolean;
}

export interface PlanMutationPayload {
  id: string;
  assistantReply: string;
  readinessScoreDelta: number;
  budgetDiffs: Array<{
    itemId?: string;
    category: string;
    name: string;
    subFunction: string;
    costType: CostType;
    previousAmount: number;
    newAmount: number;
    aiWarning?: string;
  }>;
  timelineDiffs: Array<{
    taskId?: string;
    title: string;
    previousStatus: TaskStatus;
    newStatus: TaskStatus;
    previousDaysBefore: number;
    newDaysBefore: number;
    reason: string;
  }>;
  checklistAdditions: Array<{
    itemName: string;
    subFunction: string;
    quantityOrSpec: string;
    estimatedCost: number;
  }>;
}
```

---

### 6. End-to-End Verification & Acceptance Criteria

1. **Guest Slider Mathematical Integrity**: Dragging the guest slider from `250` to `320` on *Aarav & Priya's Pune Wedding* immediately scales Catering & Favor rows, updates the `8% GST/Contingency` reserve, recalculates the surplus/deficit header in `en-IN` format, and triggers a Venue Capacity warning if `> 300`.
2. **DAG Cascade Verification**: Marking *"Lock Baner Lawns & Banquet Contract"* as `DELAYED (+10 days)` in Tab 2 immediately flips child tasks (*"Finalize Mandap & Stage Blueprint"*, *"Apply for Sound/PPL License"*) to `AT_RISK_DEPENDENCY` with an Amber cascade badge.
3. **Copilot Diff -> Apply -> Undo Loop**: Clicking Quick Prompt 1 (*"Cut floral budget by 20% and move to DJ, and shift Sangeet start time by 1 hour"*) renders a `Proposed Plan Mutation Card` with exact ₹ diffs. Clicking **Apply** mutates Tab 1 and Tab 2; clicking **Revert** restores the exact prior snapshot.
4. **Vendor Quote Multimodal & Text Extraction**: Pasting a raw caterer quote or uploading an image in Tab 3 extracts normalized per-plate rates, highlights missing generator/royalty clauses in red, and generates a one-click WhatsApp negotiation message.
