# EventFlow AI

> **Agentic, State-Aware Event Planning Operating System**  
> Calibrated for Indian Weddings, Milestone Celebrations, and Campus / Community Fests.

EventFlow AI is not a generic chatbot. It is a full-stack, state-authoritative planning workspace where an autonomous AI Copilot directly manages and mutates live event parameters across a **Smart Budget Architect**, **Adaptive Backward-Scheduling DAG Timeline**, **Vendor Quote Normalizer & Exclusion Scanner**, and **Moodboard-to-BOM (Bill of Materials) Studio**.

---

## 🚀 Key Features & Architectural Capabilities

### 1. Smart Budget Architect (Tab 1)
- **Indian Financial Localization:** Full formatting in Indian Rupees (`Intl.NumberFormat('en-IN')`) with Lakh/Crore compact notation (`₹12 L`, `₹1.5 Cr`) and `tabular-nums` alignment to prevent visual jitter.
- **Dynamic Benchmark Evaluator (`evaluateIndianBenchmark`):**
  - Flags catering rates below the Pune/Metro Tier-1 quality threshold (`< ₹750/plate`).
  - Flags decor allocations exceeding `28%` of total budget (outside decorator monopoly/royalty check).
  - Flags DJ / Sound systems missing statutory **PPL / Novex** commercial copyright playback licenses (`₹18,000–₹35,000`).
- **Dynamic Cost Behaviors:** Supports `FIXED`, `VARIABLE_PER_GUEST`, `HYBRID` (base fee + per-head charge), and `TAX_AND_BUFFER`. Dragging the **What-If Guest Slider** (clamped 20–2,000 pax) automatically recomputes per-guest rates dynamically, even after AI budget mutations.

### 2. Adaptive Backward-Scheduling DAG Timeline (Tab 2)
- **Backward Scheduling Engine:** All milestones anchor backward from the event date (`T-60d` to `T-0d` Run-of-Show).
- **Self-Healing DAG Cascades:** When a root dependency (e.g., *"Venue Contract Lock-in"*) slips, downstream tasks automatically cascade to `AT_RISK_DEPENDENCY`. When resolved or marked `COMPLETED`, dependent tasks automatically heal back to `ON_TRACK`.
- **Circular Dependency Guard:** DFS-based cycle detection caps traversal to guarantee the DAG never enters infinite loops.
- **Auto-Compress Schedule & AI Bottleneck Resolver:** 1-click schedule compression to parallelize vendor milestones, plus 1-click **"Ask AI"** buttons on delayed tasks to dispatch targeted Copilot lead-time compressions.

### 3. Vendor Quote Matrix & Exclusion Scanner (Tab 3)
- **Multimodal Quote Ingestion:** Ingests unparsed quotes from WhatsApp messages, emails, or uploaded quote images/PDFs.
- **True Effective Cost Normalization:** Accurately normalizes base cost, GST tax slabs (5% outdoor vs 18% banquet/composite), and surfaces unbundled hidden charges (tandoor diesel generators, waitstaff gratuity, post-event cleaning deposits).
- **Horizontal Scroll with Sticky Header & First Column:** Gracefully displays 4th and 5th vendor quotes without UI clipping.
- **Culturally Calibrated Negotiation Scripts:** Generates respectful, firm WhatsApp counter-offer messages with 1-click copy and feedback states.
- **Cross-Tab "Lock & Award Vendor":** Awards the contract to a vendor in 1 click—automatically updating Tab 1's budget with the `normalizedTotal` (`🔒 Locked ✓`) and completing the corresponding vendor booking task in Tab 2's DAG.

### 4. Moodboard-to-BOM Studio (Tab 4)
- **Aesthetic-to-Execution Translation:** Translates creative vibe prompts (e.g., *"Rustic Courtyard Haldi with brass urlis"*) into concrete rental checklists with exact quantities and local price estimates.
- **Bidirectional Idempotent Sync:** "+ Sync to Plan" adds rental items directly into the Budget and Timeline (`fromMoodboard: true`). Deleting the row in Tab 1 automatically resets `syncedToBudget: false` in Tab 4.

### 5. Stateful Copilot Drawer & Local Deterministic Engine
- **Strict Preset Scoping:** Chat histories, mutation diffs, and undo snapshots are partitioned strictly by `event.id`, preventing cross-event state contamination when switching between presets.
- **Structured Mutation Diff Cards:** Copilot commands generate visual diff cards displaying exact rupee adjustments (`previousAmount → newAmount`) and readiness score deltas before the user clicks *"Apply Changes to Plan"*.
- **2-Second Visual Mutation Pulse:** Mutated budget rows and timeline tasks briefly pulse with an Indigo/Emerald highlight on the Center Canvas so the planner's eye is immediately drawn to changes.
- **Offline / Fallback Resilience:** When the Gemini API key is omitted or rate-limited, the built-in domain NLP parser (`parseNaturalLanguageMutation`) dynamically parses amounts (`₹50k`, `₹1.5L`, percentages), categories, and intents (*cut*, *add*, *delay*, *sponsor*).

### 6. Persistence & Executive Export
- **Schema-Versioned Storage:** Persists custom events and mutation logs safely under `eventflow_v2` with `try/catch` migration guards.
- **1-Click Executive Run-of-Show Export:** Generates and downloads a clean, formatted CSV containing the complete Budget Allocation (with INR symbols and GST reserve breakdown) and the chronological T-Minus Schedule.
- **"Reset Preset to Default":** 1-click factory restore button in the Left Rail to wipe local state and rehydrate clean presets.

---

## 🛠️ Tech Stack

- **Frontend:** React 19, TypeScript 7, Tailwind CSS v4, Lucide Icons, Motion
- **Backend Server:** Express 4.21, Node.js (ES Modules), Vite 8.3 (dev middleware)
- **AI / Multimodal SDK:** `@google/genai` (Gemini 3.8 Flash with structured JSON schema)
- **Build & Bundle Tooling:** Vite 8.3, esbuild (Node server bundling), tsx

---

## 📋 Prerequisites

- **Node.js:** v18.0.0 or higher (v20+ / v24 recommended)
- **npm** (comes with Node) or **bun** / **yarn** / **pnpm**

---

## ⚙️ How to Run

### Step 1: Clone and Install Dependencies

```bash
# Navigate to the project root
cd /Users/jaydhokne/EVENTFLOW/EVENTFLOW

# Install project dependencies
npm install
```

### Step 2: Configure Environment Variables (Optional)

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Set your Gemini API key inside `.env`:

```env
GEMINI_API_KEY="your-gemini-api-key-here"
```

> **Note on Offline / Fallback Mode:**  
> If `GEMINI_API_KEY` is not provided, EventFlow AI **does not fail or crash**. The application automatically routes all Copilot queries, vendor quote extractions, and moodboard BOM requests through its built-in local deterministic engine!

### Step 3: Run the Development Server

```bash
npm run dev
```

- Starts `server.ts` via `tsx` on **`http://localhost:3000`** (or `http://0.0.0.0:3000`).
- Vite's development middleware serves the React frontend with hot module reloading (HMR) enabled.
- Open your browser to **`http://localhost:3000`**.

### Step 4: Run the Automated Chaos Simulation & Regression Tests

Run the complete regression suite validating state scoping, number formatting, DAG cascade & healing, circular dependency guards, NLP mutation parsing, and cross-tab vendor award flows:

```bash
npx tsx src/test/chaosSimulation.ts
```

*Expected output: All test scenarios pass with zero assertion errors.*

### Step 5: Build and Run in Production Mode

```bash
# Clean previous build artifacts and compile production bundles
npm run clean && npm run build

# Start the optimized Node server
npm run start
```

- Client bundle is emitted into `dist/`.
- Server bundle is compiled into `server.js` using `esbuild`.
- Serves production traffic on `http://localhost:3000`.

---

## 📂 Project Directory Structure

```text
EVENTFLOW/
├── .env.example                  # Template for environment variables
├── index.html                    # Root HTML entry point
├── package.json                  # Scripts and dependencies
├── server.ts                     # Express API backend & Gemini multimodal integration
├── tsconfig.json                 # TypeScript compiler configuration
├── vite.config.ts                # Vite frontend bundler configuration
│
└── src/
    ├── App.tsx                   # Main 3-pane viewport shell (Left, Center, Copilot)
    ├── main.tsx                  # React 19 client bootstrap
    ├── index.css                 # Global styling & Tailwind directives
    │
    ├── context/
    │   └── EventContext.tsx      # Central state store (events, mutations, scoped undo, cross-tab actions)
    │
    ├── data/
    │   └── initialEvents.ts      # Curated Indian wedding, birthday & community fest demo blueprints
    │
    ├── types/
    │   └── event.ts              # TypeScript interfaces for BudgetItem, TimelineTask, VendorQuote, etc.
    │
    ├── utils/
    │   ├── eventMath.ts          # Core domain algorithms (DAG cascade/heal, formatINR, benchmarks, NLP parser)
    │   └── formatters.ts         # Utility re-exports
    │
    ├── components/
    │   ├── CenterCanvas.tsx      # Pinned Top Telemetry Bar (Countdown, What-If Slider, Budget Progress)
    │   ├── LeftSidebar.tsx       # Navigation tabs, contingency buffer slider, executive CSV export, reset demo
    │   ├── RightCopilotPanel.tsx # Stateful AI Copilot drawer (diff cards, test scenario chips, pinned input)
    │   ├── TopHeader.tsx         # Event switcher dropdown, sub-function pill filters, readiness indicator
    │   ├── NewEventModal.tsx     # Custom blueprint creator (Wedding / Birthday / Community Archetypes)
    │   │
    │   └── tabs/
    │       ├── SmartBudgetArchitect.tsx # Interactive budget table with inline edits & benchmark badges
    │       ├── AdaptiveTimeline.tsx     # Backward scheduling DAG timeline with auto-compress & bottleneck resolver
    │       ├── VendorQuoteMatrix.tsx    # Sticky normalized comparison matrix & WhatsApp negotiation modal
    │       └── MoodboardStudio.tsx      # Curated aesthetic presets & 1-click BOM synchronization
    │
    └── test/
        └── chaosSimulation.ts    # Comprehensive automated test suite for all loops & edge cases
```

---

## 🧪 Available Scripts

| Command | Action |
|---|---|
| `npm run dev` | Runs the full-stack app locally in development mode on port 3000 (`tsx server.ts`). Auto-falls back to 3001+ if 3000 is occupied. |
| `npm run build` | Builds the React frontend with Vite and bundles `server.ts` into `server.js` with `esbuild`. |
| `npm run start` | Runs the compiled production server (`node server.js`). |
| `npm run clean` | Deletes `dist/` and `server.js` output files. |
| `npm run kill` | Force-clears any zombie process holding port 3000 (`lsof -ti:3000 \| xargs kill -9`). |
| `npm run lint` | Runs TypeScript type checking (`tsc --noEmit`) to verify zero type regressions. |
| `npx tsx src/test/chaosSimulation.ts` | Runs the standalone automated chaos test suite verifying all domain logic. |

---

## 🛡️ License

Private project developed for event planners, venue coordinators, and couples managing complex celebrations. All rights reserved.

