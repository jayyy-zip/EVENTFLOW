import { BudgetItem, TimelineTask } from '../types/event';

/**
 * Formats a number to Indian Rupees (INR) with standard en-IN grouping (e.g. ₹12,00,000)
 */
export function formatINR(val: number, compact = false): string {
  if (isNaN(val)) return '₹0';
  
  if (compact) {
    const abs = Math.abs(val);
    const sign = val < 0 ? '-' : '';
    if (abs >= 10000000) {
      return `${sign}₹${(abs / 10000000).toFixed(2).replace(/\.00$/, '')} Cr`;
    }
    if (abs >= 100000) {
      return `${sign}₹${(abs / 100000).toFixed(2).replace(/\.00$/, '')} L`;
    }
    if (abs >= 1000) {
      return `${sign}₹${(abs / 1000).toFixed(1).replace(/\.0$/, '')}k`;
    }
    return `${sign}₹${abs.toLocaleString('en-IN')}`;
  }

  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(val);
}

/**
 * Recalculate deterministic budget items when guest count or contingency rate changes
 */
export function recalculateBudget(
  items: BudgetItem[],
  guestCount: number,
  contingencyRate: number
): BudgetItem[] {
  let nonTaxSubtotal = 0;

  // First pass: update fixed, variable, hybrid items
  const updatedItems = items.map((item) => {
    let newAllocated = item.allocatedAmount;

    if (item.costType === 'FIXED') {
      newAllocated = item.baseFixedCost || item.allocatedAmount;
    } else if (item.costType === 'VARIABLE_PER_GUEST') {
      newAllocated = Math.round(item.perGuestRate * guestCount);
    } else if (item.costType === 'HYBRID') {
      newAllocated = Math.round((item.baseFixedCost || 0) + (item.perGuestRate * guestCount));
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
      const bufferAmount = Math.round(nonTaxSubtotal * contingencyRate);
      return {
        ...item,
        allocatedAmount: bufferAmount,
        notes: `${Math.round(contingencyRate * 100)}% buffer on ₹${nonTaxSubtotal.toLocaleString('en-IN')} base spend`,
      };
    }
    return item;
  });
}

/**
 * Topologically walks the DAG of timeline tasks to propagate delayed statuses
 */
export function computeCascadingDelays(tasks: TimelineTask[]): TimelineTask[] {
  const taskMap = new Map<string, TimelineTask>();
  tasks.forEach((t) => taskMap.set(t.id, { ...t }));

  let changed = true;
  let iterations = 0;
  const maxIterations = tasks.length * 2;

  while (changed && iterations < maxIterations) {
    changed = false;
    iterations++;

    for (const [id, task] of taskMap.entries()) {
      if (task.status === 'COMPLETED') continue;

      let hasDelayedParent = false;
      let maxParentSlippage = 0;

      for (const parentId of task.dependsOnIds) {
        const parent = taskMap.get(parentId);
        if (parent && (parent.status === 'DELAYED' || parent.status === 'AT_RISK_DEPENDENCY')) {
          hasDelayedParent = true;
          maxParentSlippage = Math.max(maxParentSlippage, parent.slippageDays || 3);
        }
      }

      if (hasDelayedParent && task.status === 'ON_TRACK') {
        task.status = 'AT_RISK_DEPENDENCY';
        task.slippageDays = maxParentSlippage;
        changed = true;
      }
    }
  }

  return Array.from(taskMap.values());
}

/**
 * Validates local benchmarks for Indian tier-1 and tier-2 events
 */
export function auditLocalBenchmarks(items: BudgetItem[], totalBudget: number, guestCount: number): BudgetItem[] {
  return items.map((item) => {
    let aiWarning = item.aiWarning;

    // Catering check
    if (item.category.toLowerCase().includes('catering') || item.name.toLowerCase().includes('catering')) {
      const effectivePerPlate = item.perGuestRate || (guestCount > 0 ? item.allocatedAmount / guestCount : 0);
      if (effectivePerPlate > 0 && effectivePerPlate < 800) {
        aiWarning = 'Below Pune Tier-1 quality threshold (₹850–₹1,400/plate). High risk of unverified ingredients or hidden service charges.';
      } else if (effectivePerPlate > 2500) {
        aiWarning = 'High premium catering tier (>₹2,500/plate). Ensure live counters and service crew are bundled.';
      }
    }

    // Decor allocation percentage
    if (item.category.toLowerCase().includes('decor') || item.name.toLowerCase().includes('decor')) {
      const pct = (item.allocatedAmount / totalBudget) * 100;
      if (pct > 26) {
        aiWarning = `Decor is ${pct.toFixed(0)}% of total budget (>25% benchmark). Verify outside decorator royalty fee or import premiums.`;
      }
    }

    // DJ & Sound without license
    if (item.category.toLowerCase().includes('sound') || item.name.toLowerCase().includes('dj')) {
      if (!item.name.toLowerCase().includes('ppl') && !item.name.toLowerCase().includes('license') && item.allocatedAmount < 70000) {
        aiWarning = 'Check if PPL/Novex music license (₹15k-₹35k) and venue sound curfew permission are included.';
      }
    }

    return {
      ...item,
      aiWarning,
    };
  });
}
