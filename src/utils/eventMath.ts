import { BudgetItem, TimelineTask, TaskStatus, CostType, EventPlan, PlanMutationPayload } from '../types/event';

/**
 * Cleanly sanitize any numeric input to a finite number
 */
export function sanitizeNumber(val: any, fallback = 0): number {
  if (val === null || val === undefined || val === '') return fallback;
  const num = Number(val);
  return isNaN(num) || !isFinite(num) ? fallback : num;
}

/**
 * Clamp a number between min and max
 */
export function clamp(val: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, sanitizeNumber(val, min)));
}

/**
 * Formats a number to Indian Rupees (INR) with standard en-IN grouping (e.g. ₹12,00,000)
 * Uses Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })
 */
export function formatINR(val: number, compact = false): string {
  const num = sanitizeNumber(val, 0);

  if (compact) {
    const abs = Math.abs(num);
    const sign = num < 0 ? '-' : '';
    if (abs >= 10000000) {
      const cr = parseFloat((abs / 10000000).toFixed(2));
      return `${sign}₹${cr} Cr`;
    }
    if (abs >= 100000) {
      const lakh = parseFloat((abs / 100000).toFixed(2));
      return `${sign}₹${lakh} L`;
    }
    if (abs >= 1000) {
      const k = parseFloat((abs / 1000).toFixed(1));
      return `${sign}₹${k}k`;
    }
    return `${sign}₹${abs.toLocaleString('en-IN')}`;
  }

  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(num);
}

/**
 * Recalculate deterministic budget items when guest count or contingency rate changes
 */
export function recalculateBudget(
  items: BudgetItem[],
  guestCount: number,
  contingencyRate: number
): BudgetItem[] {
  const safeGuestCount = Math.max(0, sanitizeNumber(guestCount, 0));
  const safeRate = Math.max(0.01, Math.min(0.3, sanitizeNumber(contingencyRate, 0.08)));
  let nonTaxSubtotal = 0;

  // First pass: update fixed, variable, hybrid items
  const updatedItems = items.map((item) => {
    let newAllocated = sanitizeNumber(item.allocatedAmount, 0);

    if (item.costType === 'FIXED') {
      newAllocated = sanitizeNumber(item.baseFixedCost, item.allocatedAmount);
    } else if (item.costType === 'VARIABLE_PER_GUEST') {
      const rate = sanitizeNumber(item.perGuestRate, 0);
      newAllocated = Math.round(rate * safeGuestCount);
    } else if (item.costType === 'HYBRID') {
      const base = sanitizeNumber(item.baseFixedCost, 0);
      const rate = sanitizeNumber(item.perGuestRate, 0);
      newAllocated = Math.round(base + rate * safeGuestCount);
    }

    if (item.costType !== 'TAX_AND_BUFFER') {
      nonTaxSubtotal += newAllocated;
    }

    return {
      ...item,
      allocatedAmount: newAllocated,
    };
  });

  // Second pass: update tax and contingency buffer line item
  return updatedItems.map((item) => {
    if (item.costType === 'TAX_AND_BUFFER') {
      const bufferAmount = Math.round(nonTaxSubtotal * safeRate);
      return {
        ...item,
        allocatedAmount: bufferAmount,
        notes: `${Math.round(safeRate * 100)}% buffer on ₹${nonTaxSubtotal.toLocaleString('en-IN')} base spend`,
      };
    }
    return item;
  });
}

/**
 * Topologically walks the DAG of timeline tasks to propagate delayed statuses
 * Includes:
 * 1. Cycle detection (prevents infinite loops if circular dependencies exist)
 * 2. Self-healing: When a parent task heals to ON_TRACK or COMPLETED, child tasks
 *    automatically heal back to ON_TRACK unless another parent in dependsOnIds is still delayed.
 */
export function computeCascadingDelays(tasks: TimelineTask[]): TimelineTask[] {
  if (!tasks || tasks.length === 0) return [];

  const taskMap = new Map<string, TimelineTask>();
  tasks.forEach((t) => taskMap.set(t.id, { ...t }));

  // 1. Cycle detection using DFS
  const adj = new Map<string, string[]>();
  tasks.forEach((t) => adj.set(t.id, []));
  tasks.forEach((t) => {
    (t.dependsOnIds || []).forEach((pId) => {
      if (adj.has(pId)) {
        adj.get(pId)!.push(t.id);
      }
    });
  });

  const visited = new Map<string, number>(); // 0: unvisited, 1: visiting, 2: visited
  for (const id of taskMap.keys()) {
    visited.set(id, 0);
  }

  function hasCycleDfs(u: string): boolean {
    visited.set(u, 1);
    const neighbors = adj.get(u) || [];
    for (const v of neighbors) {
      if (visited.get(v) === 1) return true;
      if (visited.get(v) === 0 && hasCycleDfs(v)) return true;
    }
    visited.set(u, 2);
    return false;
  }

  let cycleDetected = false;
  for (const id of taskMap.keys()) {
    if (visited.get(id) === 0) {
      if (hasCycleDfs(id)) {
        cycleDetected = true;
        break;
      }
    }
  }

  if (cycleDetected) {
    console.warn('[DAG Engine] Circular dependency detected in timeline tasks. Capping iterations to prevent infinite loop.');
  }

  // 2. Cascade & Heal Loop
  let changed = true;
  let iterations = 0;
  const maxIterations = Math.min(tasks.length * 2 + 5, 50);

  while (changed && iterations < maxIterations) {
    changed = false;
    iterations++;

    for (const [id, task] of taskMap.entries()) {
      // Completed tasks never change
      if (task.status === 'COMPLETED') continue;

      let hasDelayedParent = false;
      let maxParentSlippage = 0;

      for (const parentId of task.dependsOnIds || []) {
        const parent = taskMap.get(parentId);
        if (parent) {
          if (parent.status === 'DELAYED' || parent.status === 'AT_RISK_DEPENDENCY') {
            hasDelayedParent = true;
            maxParentSlippage = Math.max(maxParentSlippage, sanitizeNumber(parent.slippageDays, 3));
          }
        }
      }

      if (hasDelayedParent) {
        // Cascade: parent delayed -> mark child as AT_RISK_DEPENDENCY
        if (task.status === 'ON_TRACK') {
          task.status = 'AT_RISK_DEPENDENCY';
          task.slippageDays = maxParentSlippage;
          changed = true;
        } else if (task.status === 'AT_RISK_DEPENDENCY' && task.slippageDays !== maxParentSlippage) {
          task.slippageDays = maxParentSlippage;
          changed = true;
        }
      } else {
        // Heal: if parent is no longer delayed, child automatically heals to ON_TRACK
        if (task.status === 'AT_RISK_DEPENDENCY') {
          task.status = 'ON_TRACK';
          task.slippageDays = 0;
          changed = true;
        }
      }
    }
  }

  return Array.from(taskMap.values());
}

/**
 * Validates local benchmarks for Indian tier-1 and tier-2 events.
 * Now delegates per-item logic to the unified evaluateIndianBenchmark evaluator.
 */
export function auditLocalBenchmarks(items: BudgetItem[], totalBudget: number, guestCount: number, eventType = 'WEDDING'): BudgetItem[] {
  return items.map((item) => ({
    ...item,
    aiWarning: evaluateIndianBenchmark(item, guestCount, totalBudget, eventType) ?? item.aiWarning,
  }));
}

/**
 * Computes deterministic financial metrics for an event (Single Source of Truth)
 */
export function computeEventFinancials(budgetItems: BudgetItem[], totalBudget: number) {
  const safeTotalBudget = Math.max(1, sanitizeNumber(totalBudget, 1));

  let totalBaseAllocated = 0;
  let gstBufferAmount = 0;

  (budgetItems || []).forEach((b) => {
    const amt = sanitizeNumber(b.allocatedAmount, 0);
    if (b.costType === 'TAX_AND_BUFFER') {
      gstBufferAmount += amt;
    } else {
      totalBaseAllocated += amt;
    }
  });

  const grandTotal = totalBaseAllocated + gstBufferAmount;
  const surplusOrDeficit = safeTotalBudget - grandTotal;
  const isOverBudget = grandTotal > safeTotalBudget;
  const basePct = Math.min(100, Math.max(0, (totalBaseAllocated / safeTotalBudget) * 100));
  const bufferPct = Math.min(100 - basePct, Math.max(0, (gstBufferAmount / safeTotalBudget) * 100));

  return {
    totalBaseAllocated,
    gstBufferAmount,
    grandTotal,
    surplusOrDeficit,
    isOverBudget,
    basePct,
    bufferPct,
  };
}

/**
 * Computes deterministic readiness score (0 - 100)
 */
export function computeReadinessScore(event: {
  budgetItems: BudgetItem[];
  timelineTasks: TimelineTask[];
  totalBudget: number;
  guestCount: number;
  venueMaxCapacity: number;
}): number {
  let score = 85;

  const financials = computeEventFinancials(event.budgetItems, event.totalBudget);
  if (financials.isOverBudget) {
    score -= 15;
  }

  if (event.guestCount > event.venueMaxCapacity) {
    score -= 15;
  }

  const tasks = event.timelineTasks || [];
  tasks.forEach((t) => {
    if (t.status === 'DELAYED') score -= 8;
    else if (t.status === 'AT_RISK_DEPENDENCY') score -= 4;
    else if (t.status === 'COMPLETED') score += 2;
  });

  return clamp(Math.round(score), 10, 100);
}

/**
 * Returns Tailwind classes for task status badge
 */
export function getTaskStatusBadgeClass(status: TaskStatus): string {
  switch (status) {
    case 'ON_TRACK':
      return 'text-emerald-800 border-emerald-300 bg-emerald-50';
    case 'DELAYED':
      return 'text-rose-800 border-rose-300 bg-rose-50';
    case 'AT_RISK_DEPENDENCY':
      return 'text-amber-800 border-amber-300 bg-amber-50';
    case 'COMPLETED':
      return 'text-slate-700 border-slate-300 bg-slate-100';
    default:
      return 'text-stone-700 border-stone-300 bg-stone-50';
  }
}

/**
 * Returns Tailwind classes for cost behavior badge
 */
export function getCostTypeBadgeClass(costType: CostType): string {
  switch (costType) {
    case 'FIXED':
      return 'text-slate-700 bg-slate-100';
    case 'VARIABLE_PER_GUEST':
      return 'text-emerald-700 bg-emerald-50';
    case 'HYBRID':
      return 'text-indigo-700 bg-indigo-50';
    case 'TAX_AND_BUFFER':
      return 'text-amber-800 bg-amber-50';
    default:
      return 'text-stone-700 bg-stone-100';
  }
}

// ---------------------------------------------------------------------------
// STEP 2: HYPER-REALISTIC INDIAN EVENT DOMAIN ENGINE
// ---------------------------------------------------------------------------

/**
 * Dynamic evaluator for Indian event benchmarks.
 * Called on every budget edit or guest slider drag.
 * Returns an updated aiWarning string (or undefined if within bounds).
 */
export function evaluateIndianBenchmark(
  item: BudgetItem,
  guestCount: number,
  totalBudget: number,
  eventType: string
): string | undefined {
  const safeGuests = Math.max(1, sanitizeNumber(guestCount, 1));
  const safeBudget = Math.max(1, sanitizeNumber(totalBudget, 1));
  const cat = item.category.toLowerCase();
  const nm  = item.name.toLowerCase();
  const amt = sanitizeNumber(item.allocatedAmount, 0);

  // ── 1. Wedding Catering < ₹750/plate ─────────────────────────────────────
  if (cat.includes('catering') || nm.includes('catering') || nm.includes('buffet')) {
    const effectivePerPlate =
      item.perGuestRate > 0
        ? item.perGuestRate
        : safeGuests > 0
        ? amt / safeGuests
        : 0;
    if (effectivePerPlate > 0 && effectivePerPlate < 750) {
      return `⚠️ ₹${Math.round(effectivePerPlate).toLocaleString('en-IN')}/plate is below Tier-1 threshold (₹750 minimum). High risk of unverified ingredients or hidden service charges.`;
    }
    if (effectivePerPlate > 2500) {
      return `💎 Premium tier (₹${Math.round(effectivePerPlate).toLocaleString('en-IN')}/plate). Confirm live counters, service crew, and staffing are bundled.`;
    }
  }

  // ── 2. Decor > 28% of total budget ────────────────────────────────────────
  if (cat.includes('decor') || nm.includes('decor') || nm.includes('floral') || nm.includes('mandap')) {
    const pct = (amt / safeBudget) * 100;
    if (pct > 28) {
      return `🌸 Decor is ${pct.toFixed(0)}% of total budget (>28% benchmark). Verify outside decorator royalty fees or import florals premium.`;
    }
    if (pct > 22 && eventType === 'BIRTHDAY') {
      return `🎂 Decor at ${pct.toFixed(0)}% of budget for a birthday event. Consider rebalancing toward entertainment/catering.`;
    }
  }

  // ── 3. Sound/DJ without PPL/Novex licensing mention ───────────────────────
  if (cat.includes('sound') || nm.includes('dj') || nm.includes('audio') || nm.includes('music')) {
    const hasLicense =
      nm.includes('ppl') || nm.includes('novex') || nm.includes('license') ||
      (item.notes || '').toLowerCase().includes('license');
    if (!hasLicense && amt > 0) {
      return `🎵 PPL/Novex music license (₹18,000–₹35,000) and venue sound-curfew permit not detected in item name or notes. Add or bundle before booking.`;
    }
  }

  // ── 4. Photography budgeted at < ₹25k ────────────────────────────────────
  if (cat.includes('photo') || nm.includes('photo') || nm.includes('cinemat') || nm.includes('video')) {
    if (amt > 0 && amt < 25000 && eventType === 'WEDDING') {
      return `📷 Photography budget (₹${amt.toLocaleString('en-IN')}) appears low for a wedding. Tier-1 candid packages start at ₹40,000–₹80,000 in Pune.`;
    }
  }

  return undefined;
}

/**
 * Parses a natural-language Copilot command and returns a partial
 * PlanMutationPayload. Handles:
 *   - "Cut catering by ₹50k" / "reduce catering by 15%"
 *   - "Add a Mehendi artist for ₹25,000"
 *   - "Delay sound setup by 4 days"
 *   - "We got a ₹1.5L title sponsor"
 *   - Guest count reassignment: "change guests to 320"
 */
export function parseNaturalLanguageMutation(
  prompt: string,
  plan: EventPlan
): Partial<Pick<PlanMutationPayload, 'budgetDiffs' | 'timelineDiffs' | 'checklistAdditions' | 'assistantReply'>> {
  const lower = prompt.toLowerCase();

  // ── Amount parser (handles ₹50k / ₹1.5L / ₹25,000 / 50000) ─────────────
  const parseAmount = (str: string): number => {
    // Strip currency symbol and commas
    let s = str.replace(/[₹,\s]/g, '');
    const multiplier = /l$/i.test(s) ? 100000 : /k$/i.test(s) ? 1000 : /cr$/i.test(s) ? 10000000 : 1;
    s = s.replace(/[lLkKcCrR]/g, '');
    const num = parseFloat(s);
    return isNaN(num) ? 0 : Math.round(num * multiplier);
  };

  // Extract first ₹ amount from prompt
  const amountMatch = prompt.match(/₹\s*([\d,]+(?:\.\d+)?)\s*(L|l|K|k|Cr|cr)?/);
  const extractedAmount = amountMatch
    ? parseAmount(`₹${amountMatch[1]}${amountMatch[2] || ''}`)
    : 0;

  // Extract percentage (e.g. "by 20%")
  const pctMatch = prompt.match(/by\s+(\d+)\s*%/i);
  const extractedPct = pctMatch ? parseInt(pctMatch[1], 10) / 100 : 0;

  // Category keyword → budget item finder
  const categoryKeywords: Record<string, string[]> = {
    catering: ['catering', 'food', 'buffet', 'meal', 'plate'],
    decor:    ['decor', 'floral', 'flower', 'mandap', 'lighting', 'balloon'],
    venue:    ['venue', 'lawn', 'hall', 'banquet', 'ground'],
    sound:    ['sound', 'dj', 'audio', 'music', 'speaker', 'pa system'],
    photo:    ['photo', 'cinemat', 'video', 'camera'],
    mehendi:  ['mehendi', 'henna'],
    transport:['transport', 'baraat', 'car', 'bus'],
  };

  const findItem = (keywords: string[]) =>
    plan.budgetItems.find((b) =>
      keywords.some(
        (kw) =>
          b.category.toLowerCase().includes(kw) ||
          b.name.toLowerCase().includes(kw)
      )
    );

  // Intent detection
  const isCut      = /\b(cut|reduc|trim|lower|decreas|slash)\b/i.test(lower);
  const isAdd      = /\b(add|includ|insert|book|creat|new)\b/i.test(lower);
  const isDelay    = /\b(delay|push|slip|postpone|defer)\b/i.test(lower);
  const isSponsor  = /\b(sponsor|fund|grant|donate|contribut)\b/i.test(lower);
  const isGuest    = /\b(guest|pax|attendee|head count)\b/i.test(lower);

  const budgetDiffs: PlanMutationPayload['budgetDiffs'] = [];
  const timelineDiffs: PlanMutationPayload['timelineDiffs'] = [];
  const checklistAdditions: PlanMutationPayload['checklistAdditions'] = [];
  let assistantReply = '';

  // ── SPONSOR / INFLOW ─────────────────────────────────────────────────────
  if (isSponsor && extractedAmount > 0) {
    assistantReply = `Logged ₹${extractedAmount.toLocaleString('en-IN')} title sponsorship inflow. Increasing contingency reserve proportionally.`;
    const bufferItem = plan.budgetItems.find((b) => b.costType === 'TAX_AND_BUFFER');
    const prevBuf = bufferItem?.allocatedAmount || Math.round(plan.totalBudget * 0.08);
    budgetDiffs.push({
      category: 'Sponsorship & Inflow',
      name: 'Title Sponsor Contribution',
      subFunction: 'All Functions',
      costType: 'FIXED',
      previousAmount: 0,
      newAmount: extractedAmount,
    });
    budgetDiffs.push({
      category: bufferItem?.category || 'Tax & Contingency Reserve',
      name: bufferItem?.name || 'GST Buffer & Contingency',
      subFunction: 'All Functions',
      costType: 'TAX_AND_BUFFER',
      previousAmount: prevBuf,
      newAmount: prevBuf + Math.round(extractedAmount * 0.1),
      aiWarning: 'Reinforced buffer from sponsor inflow.',
    });
    return { budgetDiffs, timelineDiffs, checklistAdditions, assistantReply };
  }

  // ── DELAY TASK ───────────────────────────────────────────────────────────
  if (isDelay) {
    const daysMatch = prompt.match(/(\d+)\s*day/i);
    const delayDays = daysMatch ? parseInt(daysMatch[1], 10) : 3;

    // Find the most relevant task keyword
    let taskTitle = 'Sound Setup & Soundcheck';
    for (const [_cat, kws] of Object.entries(categoryKeywords)) {
      if (kws.some((kw) => lower.includes(kw))) {
        const matchedTask = plan.timelineTasks.find((t) =>
          kws.some((kw) => t.title.toLowerCase().includes(kw))
        );
        if (matchedTask) { taskTitle = matchedTask.title; break; }
      }
    }

    assistantReply = `Slipping "${taskTitle}" by ${delayDays} days and computing cascade effects on downstream tasks.`;
    timelineDiffs.push({
      title: taskTitle,
      previousStatus: 'ON_TRACK',
      newStatus: 'DELAYED',
      previousDaysBefore: 10,
      newDaysBefore: 10 + delayDays,
      reason: `Delayed by ${delayDays} days per planner instruction.`,
    });
    return { budgetDiffs, timelineDiffs, checklistAdditions, assistantReply };
  }

  // ── ADD NEW ITEM ─────────────────────────────────────────────────────────
  if (isAdd && extractedAmount > 0) {
    // Detect what kind of item
    let itemName = 'Custom Event Addition';
    let category = 'Miscellaneous';
    let subFunction = 'All Functions';

    if (/mehendi|henna/i.test(lower)) {
      itemName = 'Mehendi Artist (Bridal + Family)';
      category = 'Artists & Performers';
      subFunction = 'Haldi';
    } else if (/photograp|cinemat/i.test(lower)) {
      itemName = 'Additional Photographer / Videographer';
      category = 'Photography & Film';
      subFunction = 'All Functions';
    } else if (/dj|sound/i.test(lower)) {
      itemName = 'Additional DJ / Sound Extension';
      category = 'Sound, DJ & Licensing';
      subFunction = 'Sangeet';
    } else if (/decor|floral/i.test(lower)) {
      itemName = 'Additional Floral & Decor Arrangement';
      category = 'Decor & Florals';
      subFunction = 'All Functions';
    }

    assistantReply = `Adding "${itemName}" at ₹${extractedAmount.toLocaleString('en-IN')} to the budget.`;
    budgetDiffs.push({
      category,
      name: itemName,
      subFunction,
      costType: 'FIXED',
      previousAmount: 0,
      newAmount: extractedAmount,
    });
    checklistAdditions.push({
      itemName,
      subFunction,
      quantityOrSpec: '1 booking as per vendor quote',
      estimatedCost: extractedAmount,
    });
    return { budgetDiffs, timelineDiffs, checklistAdditions, assistantReply };
  }

  // ── CUT / REDUCE ─────────────────────────────────────────────────────────
  if (isCut) {
    // Detect category
    for (const [catKey, kws] of Object.entries(categoryKeywords)) {
      if (kws.some((kw) => lower.includes(kw))) {
        const item = findItem(kws);
        if (item) {
          const prev = item.allocatedAmount;
          let newAmt: number;
          if (extractedAmount > 0) {
            newAmt = Math.max(0, prev - extractedAmount);
            assistantReply = `Reducing ${item.category} (${item.name}) by ₹${extractedAmount.toLocaleString('en-IN')} from ₹${prev.toLocaleString('en-IN')} to ₹${newAmt.toLocaleString('en-IN')}.`;
          } else if (extractedPct > 0) {
            newAmt = Math.round(prev * (1 - extractedPct));
            assistantReply = `Reducing ${item.category} by ${Math.round(extractedPct * 100)}% (−₹${(prev - newAmt).toLocaleString('en-IN')}).`;
          } else {
            newAmt = Math.round(prev * 0.85);
            assistantReply = `Trimming ${item.category} by 15% as a default cost-optimization measure.`;
          }
          budgetDiffs.push({
            itemId: item.id,
            category: item.category,
            name: item.name,
            subFunction: item.subFunction,
            costType: item.costType,
            previousAmount: prev,
            newAmount: newAmt,
          });
          return { budgetDiffs, timelineDiffs, checklistAdditions, assistantReply };
        }
        // Item not found in budget; still produce a meaningful reply
        assistantReply = `Could not find an active "${catKey}" line item to cut. Please add one first.`;
        return { budgetDiffs, timelineDiffs, checklistAdditions, assistantReply };
      }
    }
  }

  // ── GUEST COUNT ──────────────────────────────────────────────────────────
  if (isGuest) {
    const guestMatch = prompt.match(/\b(\d{2,4})\b/);
    const targetGuests = guestMatch ? parseInt(guestMatch[1], 10) : plan.guestCount;
    const catering = plan.budgetItems.find((b) => b.category.toLowerCase().includes('catering'));
    if (catering && targetGuests !== plan.guestCount) {
      const rate = catering.perGuestRate || Math.round(catering.allocatedAmount / Math.max(1, plan.guestCount));
      const newAmt = rate * targetGuests;
      assistantReply = `Recalibrating catering to ₹${newAmt.toLocaleString('en-IN')} for ${targetGuests} guests at ₹${rate}/plate.`;
      budgetDiffs.push({
        itemId: catering.id,
        category: catering.category,
        name: catering.name,
        subFunction: catering.subFunction,
        costType: 'VARIABLE_PER_GUEST',
        previousAmount: catering.allocatedAmount,
        newAmount: newAmt,
        aiWarning: `Recalculated for ${targetGuests} guests at ₹${rate}/plate.`,
      });
    }
    return { budgetDiffs, timelineDiffs, checklistAdditions, assistantReply };
  }

  // Fallback – generic contingency bump
  const bufferItem = plan.budgetItems.find((b) => b.costType === 'TAX_AND_BUFFER');
  const prevBuf = bufferItem?.allocatedAmount || Math.round(plan.totalBudget * 0.08);
  assistantReply = `Audited ${plan.name}. Reinforcing emergency buffer reserve to 10%.`;
  budgetDiffs.push({
    category: bufferItem?.category || 'Tax & Contingency Reserve',
    name: bufferItem?.name || '8% GST Buffer & Emergency Fund',
    subFunction: 'All Functions',
    costType: 'TAX_AND_BUFFER',
    previousAmount: prevBuf,
    newAmount: Math.round(plan.totalBudget * 0.1),
    aiWarning: 'Emergency buffer reinforced to 10% based on planner audit.',
  });
  return { budgetDiffs, timelineDiffs, checklistAdditions, assistantReply };
}
