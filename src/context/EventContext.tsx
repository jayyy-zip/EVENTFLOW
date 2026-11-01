import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import {
  EventPlan,
  BudgetItem,
  TimelineTask,
  VendorQuote,
  ChecklistItem,
  PlanMutationPayload,
  EventPlanSnapshot,
} from '../types/event';
import { INITIAL_EVENTS } from '../data/initialEvents';
import {
  recalculateBudget,
  computeCascadingDelays,
  auditLocalBenchmarks,
  sanitizeNumber,
  clamp,
  computeReadinessScore,
  parseNaturalLanguageMutation,
} from '../utils/eventMath';

interface EventContextType {
  events: EventPlan[];
  activeEvent: EventPlan;
  activeTab: 'budget' | 'timeline' | 'quotes' | 'moodboard';
  activeSubFunction: string;
  proposedMutations: PlanMutationPayload[];
  undoStack: EventPlanSnapshot[];
  isThinking: boolean;
  /** IDs of budget items / timeline tasks mutated in the last Apply action (for pulse animation) */
  lastMutatedIds: Set<string>;
  switchEvent: (id: string) => void;
  setActiveTab: (tab: 'budget' | 'timeline' | 'quotes' | 'moodboard') => void;
  setActiveSubFunction: (subFunc: string) => void;
  updateGuestCount: (count: number) => void;
  updateContingencyRate: (rate: number) => void;
  updateBudgetItem: (item: BudgetItem) => void;
  addBudgetItem: (item: Omit<BudgetItem, 'id'>) => void;
  deleteBudgetItem: (id: string) => void;
  updateTimelineTask: (task: TimelineTask) => void;
  addTimelineTask: (task: Omit<TimelineTask, 'id'>) => void;
  autoCompressSchedule: () => void;
  addVendorQuote: (quote: VendorQuote) => void;
  /** Lock & Award a vendor: updates matching budget item and completes the timeline milestone */
  awardVendor: (quote: VendorQuote) => void;
  addChecklistItem: (item: ChecklistItem) => void;
  syncChecklistItemToBudget: (item: ChecklistItem) => void;
  unsyncChecklistItemFromBudget: (item: ChecklistItem) => void;
  sendCopilotCommand: (prompt: string) => Promise<void>;
  applyMutation: (mutationId: string) => void;
  revertMutation: (mutationId: string) => void;
  createNewEvent: (eventData: Partial<EventPlan>) => void;
  resetToDefaultEvents: () => void;
}

const EventContext = createContext<EventContextType | undefined>(undefined);

const STORAGE_KEY = 'eventflow_v2_events';
const MUTATIONS_STORAGE_KEY = 'eventflow_v2_mutations';

export const EventProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [events, setEvents] = useState<EventPlan[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) || localStorage.getItem('eventflow_ai_events_v3');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].id) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Corrupted localStorage detected, safely falling back to defaults:', e);
    }
    return INITIAL_EVENTS;
  });

  const [activeEventId, setActiveEventId] = useState<string>(() => {
    return events[0]?.id || INITIAL_EVENTS[0].id;
  });

  const [activeTab, setActiveTab] = useState<'budget' | 'timeline' | 'quotes' | 'moodboard'>('budget');
  const [activeSubFunction, setActiveSubFunction] = useState<string>('All Functions');

  // Scoped strictly per event.id to prevent cross-preset mutation leaks
  const [proposedMutationsByEvent, setProposedMutationsByEvent] = useState<Record<string, PlanMutationPayload[]>>(() => {
    try {
      const saved = localStorage.getItem(MUTATIONS_STORAGE_KEY) || localStorage.getItem('eventflow_ai_mutations_v3');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed === 'object' && parsed !== null) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Failed to load mutations from localStorage:', e);
    }
    return {};
  });

  // Scoped strictly per event.id for deterministic snapshots
  const [undoStackByEvent, setUndoStackByEvent] = useState<Record<string, EventPlanSnapshot[]>>({});
  const [isThinking, setIsThinking] = useState(false);
  /** IDs mutated by the last applyMutation call – cleared after 2.5 s for pulse animation */
  const [lastMutatedIds, setLastMutatedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
    } catch (e) {
      console.warn('Failed to save events to localStorage:', e);
    }
  }, [events]);

  useEffect(() => {
    try {
      localStorage.setItem(MUTATIONS_STORAGE_KEY, JSON.stringify(proposedMutationsByEvent));
    } catch (e) {
      console.warn('Failed to save mutations to localStorage:', e);
    }
  }, [proposedMutationsByEvent]);

  // Current active event plan
  const activeEvent = useMemo(() => {
    const found = events.find((e) => e.id === activeEventId);
    return found || events[0] || INITIAL_EVENTS[0];
  }, [events, activeEventId]);

  // Proposed mutations strictly scoped to active event
  const proposedMutations = useMemo(() => {
    return proposedMutationsByEvent[activeEvent.id] || [];
  }, [proposedMutationsByEvent, activeEvent.id]);

  // Undo stack strictly scoped to active event
  const undoStack = useMemo(() => {
    return undoStackByEvent[activeEvent.id] || [];
  }, [undoStackByEvent, activeEvent.id]);

  // Helper to mutate a specific event plan by ID (defaults to active event)
  const mutateEventById = useCallback((eventId: string, updater: (prev: EventPlan) => EventPlan) => {
    setEvents((prev) =>
      prev.map((e) => {
        if (e.id === eventId) {
          const updated = updater(e);
          // Deterministically compute readiness score
          const computedReadiness = computeReadinessScore(updated);
          return {
            ...updated,
            readinessScore: computedReadiness,
          };
        }
        return e;
      })
    );
  }, []);

  const mutateActiveEvent = useCallback((updater: (prev: EventPlan) => EventPlan) => {
    mutateEventById(activeEvent.id, updater);
  }, [activeEvent.id, mutateEventById]);

  const switchEvent = useCallback((id: string) => {
    setActiveEventId(id);
    setActiveSubFunction('All Functions');
  }, []);

  const updateGuestCount = useCallback((count: number) => {
    const clampedCount = clamp(count, 20, 2000);
    mutateActiveEvent((prev) => {
      const updatedBudget = recalculateBudget(prev.budgetItems, clampedCount, prev.contingencyRate);
      const audited = auditLocalBenchmarks(updatedBudget, prev.totalBudget, clampedCount, prev.type);
      return {
        ...prev,
        guestCount: clampedCount,
        budgetItems: audited,
      };
    });
  }, [mutateActiveEvent]);

  const updateContingencyRate = useCallback((rate: number) => {
    const clampedRate = clamp(rate, 0.05, 0.25);
    mutateActiveEvent((prev) => {
      const updatedBudget = recalculateBudget(prev.budgetItems, prev.guestCount, clampedRate);
      return {
        ...prev,
        contingencyRate: clampedRate,
        budgetItems: updatedBudget,
      };
    });
  }, [mutateActiveEvent]);

  const updateBudgetItem = useCallback((item: BudgetItem) => {
    mutateActiveEvent((prev) => {
      const safeAmount = Math.max(0, sanitizeNumber(item.allocatedAmount, 0));
      const updatedItem = { ...item, allocatedAmount: safeAmount };

      // Back-calculate perGuestRate if variable or hybrid
      if (updatedItem.costType === 'VARIABLE_PER_GUEST' && prev.guestCount > 0) {
        updatedItem.perGuestRate = Math.round(safeAmount / prev.guestCount);
        updatedItem.baseFixedCost = 0;
      } else if (updatedItem.costType === 'HYBRID' && prev.guestCount > 0) {
        const base = sanitizeNumber(updatedItem.baseFixedCost, 0);
        if (safeAmount >= base) {
          updatedItem.perGuestRate = Math.round((safeAmount - base) / prev.guestCount);
        } else {
          updatedItem.baseFixedCost = safeAmount;
          updatedItem.perGuestRate = 0;
        }
      }

      let updatedItems = prev.budgetItems.map((b) => (b.id === updatedItem.id ? updatedItem : b));
      updatedItems = recalculateBudget(updatedItems, prev.guestCount, prev.contingencyRate);
      const audited = auditLocalBenchmarks(updatedItems, prev.totalBudget, prev.guestCount, prev.type);
      return {
        ...prev,
        budgetItems: audited,
      };
    });
  }, [mutateActiveEvent]);

  const addBudgetItem = useCallback((itemData: Omit<BudgetItem, 'id'>) => {
    mutateActiveEvent((prev) => {
      const safeAllocated = Math.max(0, sanitizeNumber(itemData.allocatedAmount, 0));
      const newItem: BudgetItem = {
        ...itemData,
        id: `b-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        allocatedAmount: safeAllocated,
        baseFixedCost: sanitizeNumber(itemData.baseFixedCost, safeAllocated),
        perGuestRate: sanitizeNumber(itemData.perGuestRate, 0),
      };
      let updatedItems = [...prev.budgetItems, newItem];
      updatedItems = recalculateBudget(updatedItems, prev.guestCount, prev.contingencyRate);
      const audited = auditLocalBenchmarks(updatedItems, prev.totalBudget, prev.guestCount, prev.type);
      return {
        ...prev,
        budgetItems: audited,
      };
    });
  }, [mutateActiveEvent]);

  const deleteBudgetItem = useCallback((id: string) => {
    mutateActiveEvent((prev) => {
      const updatedItems = prev.budgetItems.filter((b) => b.id !== id);
      const recalculated = recalculateBudget(updatedItems, prev.guestCount, prev.contingencyRate);

      // Bidirectional sync: if this was a moodboard-synced row, reset the source checklist item
      let updatedChecklist = prev.themeChecklist;
      if (id.startsWith('b-sync-')) {
        const checklistId = id.replace('b-sync-', '');
        updatedChecklist = prev.themeChecklist.map((c) =>
          c.id === checklistId ? { ...c, syncedToBudget: false } : c
        );
      }

      // If it was from moodboard (has fromMoodboard flag), find by id pattern or notes tag
      const deletedItem = prev.budgetItems.find((b) => b.id === id);
      if (deletedItem?.fromMoodboard) {
        updatedChecklist = prev.themeChecklist.map((c) =>
          `b-sync-${c.id}` === id ? { ...c, syncedToBudget: false } : c
        );
      }

      return {
        ...prev,
        budgetItems: recalculated,
        themeChecklist: updatedChecklist,
      };
    });
  }, [mutateActiveEvent]);

  const updateTimelineTask = useCallback((task: TimelineTask) => {
    mutateActiveEvent((prev) => {
      const updatedTasks = prev.timelineTasks.map((t) => (t.id === task.id ? task : t));
      const withCascades = computeCascadingDelays(updatedTasks);
      return {
        ...prev,
        timelineTasks: withCascades,
      };
    });
  }, [mutateActiveEvent]);

  const addTimelineTask = useCallback((taskData: Omit<TimelineTask, 'id'>) => {
    mutateActiveEvent((prev) => {
      const newTask: TimelineTask = {
        ...taskData,
        id: `t-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      };
      const updatedTasks = [...prev.timelineTasks, newTask];
      const withCascades = computeCascadingDelays(updatedTasks);
      return {
        ...prev,
        timelineTasks: withCascades,
      };
    });
  }, [mutateActiveEvent]);

  const autoCompressSchedule = useCallback(() => {
    mutateActiveEvent((prev) => {
      const compressedTasks = prev.timelineTasks.map((t) => {
        if (t.status === 'AT_RISK_DEPENDENCY' || t.status === 'DELAYED') {
          return {
            ...t,
            status: 'ON_TRACK' as const,
            slippageDays: 0,
            durationDays: Math.max(1, Math.round(t.durationDays * 0.7)),
            notes: (t.notes || '') + ' [Schedule compressed by parallelizing vendor milestones]',
          };
        }
        return t;
      });
      return {
        ...prev,
        readinessScore: Math.min(100, prev.readinessScore + 8),
        timelineTasks: compressedTasks,
      };
    });
  }, [mutateActiveEvent]);

  const addVendorQuote = useCallback((quote: VendorQuote) => {
    // Normalize GST & numbers
    const base = sanitizeNumber(quote.baseCost, 0);
    const gstPct = quote.gstRatePercent === 5 ? 5 : 18;
    const taxes = Math.round(base * (gstPct / 100));
    const hidden = sanitizeNumber(quote.estimatedHiddenCosts, 0);
    const normalized = base + taxes + hidden;

    const sanitizedQuote: VendorQuote = {
      ...quote,
      baseCost: base,
      gstRatePercent: gstPct,
      taxesGstAmount: taxes,
      estimatedHiddenCosts: hidden,
      normalizedTotal: normalized,
    };

    mutateActiveEvent((prev) => ({
      ...prev,
      vendorQuotes: [sanitizedQuote, ...prev.vendorQuotes],
    }));
  }, [mutateActiveEvent]);

  const addChecklistItem = useCallback((item: ChecklistItem) => {
    mutateActiveEvent((prev) => ({
      ...prev,
      themeChecklist: [...prev.themeChecklist, item],
    }));
  }, [mutateActiveEvent]);

  // Idempotent Sync: Prevents duplicate line items in budget & timeline
  const syncChecklistItemToBudget = useCallback((item: ChecklistItem) => {
    mutateActiveEvent((prev) => {
      const budgetSyncId = `b-sync-${item.id}`;
      const timelineSyncId = `t-sync-${item.id}`;

      // 1. Check if already synced in budgetItems
      const alreadyInBudget = prev.budgetItems.some((b) => b.id === budgetSyncId);
      const alreadyInTimeline = prev.timelineTasks.some((t) => t.id === timelineSyncId);

      const estimatedCost = sanitizeNumber(item.estimatedCost, 0);

      const newBudgetItem: BudgetItem = {
        id: budgetSyncId,
        category: 'Decor & Theme Rentals',
        name: item.itemName,
        subFunction: item.subFunction,
        costType: 'FIXED',
        baseFixedCost: estimatedCost,
        perGuestRate: 0,
        allocatedAmount: estimatedCost,
        notes: `Procured from theme checklist: ${item.quantityOrSpec}`,
        fromMoodboard: true,
      };

      const newTimelineTask: TimelineTask = {
        id: timelineSyncId,
        title: `Procure: ${item.itemName}`,
        subFunction: item.subFunction,
        phase: 'T-15_TO_7',
        daysBeforeEvent: 10,
        durationDays: 3,
        slippageDays: 0,
        status: 'ON_TRACK',
        dependsOnIds: [],
        owner: 'Theme Lead',
        notes: item.quantityOrSpec,
      };

      const updatedChecklist = prev.themeChecklist.map((c) =>
        c.id === item.id ? { ...c, syncedToBudget: true } : c
      );

      const updatedBudgetItems = alreadyInBudget
        ? prev.budgetItems
        : [...prev.budgetItems, newBudgetItem];

      const updatedTimelineTasks = alreadyInTimeline
        ? prev.timelineTasks
        : [...prev.timelineTasks, newTimelineTask];

      const updatedBudget = recalculateBudget(
        updatedBudgetItems,
        prev.guestCount,
        prev.contingencyRate
      );

      return {
        ...prev,
        budgetItems: updatedBudget,
        timelineTasks: updatedTimelineTasks,
        themeChecklist: updatedChecklist,
      };
    });
  }, [mutateActiveEvent]);

  /**
   * STEP 1: Tab 3 → Tab 1 & 2 — Lock & Award Vendor
   * Updates the matching budget category with vendor's normalizedTotal,
   * marks it as locked, then completes the first matching timeline milestone.
   */
  const awardVendor = useCallback((quote: VendorQuote) => {
    mutateActiveEvent((prev) => {
      // 1. Upsert budget item for this vendor category
      const existingIdx = prev.budgetItems.findIndex(
        (b) =>
          b.category.toLowerCase().includes(quote.category.toLowerCase()) ||
          b.name.toLowerCase().includes(quote.category.toLowerCase())
      );

      let updatedBudget = [...prev.budgetItems];
      const safeTotal = sanitizeNumber(quote.normalizedTotal, 0);

      if (existingIdx >= 0) {
        const existing = updatedBudget[existingIdx];
        updatedBudget[existingIdx] = {
          ...existing,
          allocatedAmount: safeTotal,
          baseFixedCost: safeTotal,
          perGuestRate:
            existing.costType === 'VARIABLE_PER_GUEST' && prev.guestCount > 0
              ? Math.round(safeTotal / prev.guestCount)
              : existing.perGuestRate,
          lockedVendorId: quote.id,
          lockedVendorName: quote.vendorName,
          notes: `Locked: ${quote.vendorName} — True Effective Total (base + GST + hidden costs)`,
        };
      } else {
        updatedBudget.push({
          id: `b-vendor-${quote.id}`,
          category: quote.category,
          name: `${quote.vendorName} — ${quote.category}`,
          subFunction: 'All Functions',
          costType: 'FIXED',
          baseFixedCost: safeTotal,
          perGuestRate: 0,
          allocatedAmount: safeTotal,
          lockedVendorId: quote.id,
          lockedVendorName: quote.vendorName,
          notes: `Locked: ${quote.vendorName} — True Effective Total`,
        });
      }

      updatedBudget = recalculateBudget(updatedBudget, prev.guestCount, prev.contingencyRate);
      updatedBudget = auditLocalBenchmarks(updatedBudget, prev.totalBudget, prev.guestCount, prev.type);

      // 2. Complete the first matching vendor-booking milestone in the timeline
      const catLower = quote.category.toLowerCase();
      const updatedTimeline = prev.timelineTasks.map((t) => {
        const isVendorTask =
          t.title.toLowerCase().includes('vendor') ||
          t.title.toLowerCase().includes('book') ||
          t.title.toLowerCase().includes(catLower.split(' ')[0]);
        if (isVendorTask && t.status !== 'COMPLETED') {
          return { ...t, status: 'COMPLETED' as const, slippageDays: 0 };
        }
        return t;
      });

      const withCascades = computeCascadingDelays(updatedTimeline);

      return {
        ...prev,
        budgetItems: updatedBudget,
        timelineTasks: withCascades,
      };
    });
  }, [mutateActiveEvent]);

  // 1-Click Unsync: Cleanly removes synced BudgetItem and TimelineTask
  const unsyncChecklistItemFromBudget = useCallback((item: ChecklistItem) => {
    mutateActiveEvent((prev) => {
      const budgetSyncId = `b-sync-${item.id}`;
      const timelineSyncId = `t-sync-${item.id}`;

      const updatedChecklist = prev.themeChecklist.map((c) =>
        c.id === item.id ? { ...c, syncedToBudget: false } : c
      );

      const updatedBudgetItems = prev.budgetItems.filter((b) => b.id !== budgetSyncId);
      const updatedTimelineTasks = prev.timelineTasks.filter((t) => t.id !== timelineSyncId);

      const updatedBudget = recalculateBudget(
        updatedBudgetItems,
        prev.guestCount,
        prev.contingencyRate
      );

      const withCascades = computeCascadingDelays(updatedTimelineTasks);

      return {
        ...prev,
        budgetItems: updatedBudget,
        timelineTasks: withCascades,
        themeChecklist: updatedChecklist,
      };
    });
  }, [mutateActiveEvent]);

  // Stateful Copilot command execution - strictly scoped to targetEventId
  const sendCopilotCommand = useCallback(async (prompt: string) => {
    const targetEventId = activeEvent.id;
    const targetPlan = activeEvent;
    setIsThinking(true);

    try {
      const res = await fetch('/api/plan-mutation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          currentPlan: targetPlan,
          eventId: targetEventId,
        }),
      });

      if (!res.ok) {
        throw new Error(`Server returned status ${res.status}`);
      }

      const rawData = await res.json();

      // Sanitize all incoming numbers
      const sanitizedPayload: PlanMutationPayload = {
        id: rawData.id || `mut-${Date.now()}`,
        eventId: targetEventId,
        timestamp: rawData.timestamp || Date.now(),
        userPrompt: prompt,
        assistantReply: rawData.assistantReply || 'Plan updated with your requested adjustments.',
        readinessScoreDelta: sanitizeNumber(rawData.readinessScoreDelta, 0),
        budgetDiffs: (rawData.budgetDiffs || []).map((b: any) => ({
          category: b.category || 'General',
          name: b.name || 'Custom Item',
          subFunction: b.subFunction || 'All Functions',
          costType: b.costType || 'FIXED',
          previousAmount: sanitizeNumber(b.previousAmount, 0),
          newAmount: sanitizeNumber(b.newAmount, 0),
          aiWarning: b.aiWarning,
        })),
        timelineDiffs: (rawData.timelineDiffs || []).map((t: any) => ({
          title: t.title || 'Timeline Milestone',
          previousStatus: t.previousStatus || 'ON_TRACK',
          newStatus: t.newStatus || 'ON_TRACK',
          previousDaysBefore: sanitizeNumber(t.previousDaysBefore, 0),
          newDaysBefore: sanitizeNumber(t.newDaysBefore, 0),
          reason: t.reason || '',
        })),
        checklistAdditions: (rawData.checklistAdditions || []).map((c: any) => ({
          itemName: c.itemName || 'Checklist Item',
          subFunction: c.subFunction || 'All Functions',
          quantityOrSpec: c.quantityOrSpec || '',
          estimatedCost: sanitizeNumber(c.estimatedCost, 0),
        })),
        applied: false,
      };

      // Store mutation under targetEventId (even if user switched events while thinking)
      setProposedMutationsByEvent((prev) => ({
        ...prev,
        [targetEventId]: [sanitizedPayload, ...(prev[targetEventId] || [])],
      }));
    } catch (err: any) {
      console.warn('API plan-mutation fetch failed, activating resilient local mutation fallback:', err?.message);

      // Resilient local engine fallback — uses the NLP parser for dynamic, context-aware mutations
      const parsed = parseNaturalLanguageMutation(prompt, targetPlan);
      const assistantReply = parsed.assistantReply ||
        `Compiled natural-language instructions for ${targetPlan.name} using verified Indian metro benchmarks.`;

      const fallbackPayload: PlanMutationPayload = {
        id: `mut-${Date.now()}`,
        eventId: targetEventId,
        timestamp: Date.now(),
        userPrompt: prompt,
        assistantReply,
        readinessScoreDelta: 3,
        budgetDiffs: (parsed.budgetDiffs || []).map((b) => ({
          ...b,
          previousAmount: sanitizeNumber(b.previousAmount, 0),
          newAmount: sanitizeNumber(b.newAmount, 0),
        })),
        timelineDiffs: parsed.timelineDiffs || [],
        checklistAdditions: parsed.checklistAdditions || [],
        applied: false,
      };

      setProposedMutationsByEvent((prev) => ({
        ...prev,
        [targetEventId]: [fallbackPayload, ...(prev[targetEventId] || [])],
      }));
    } finally {
      setIsThinking(false);
    }
  }, [activeEvent]);

  // Transactional apply mutation strictly scoped to target event
  const applyMutation = useCallback((mutationId: string) => {
    // Search mutation across events
    let targetMutation: PlanMutationPayload | undefined;
    let targetEventId = activeEvent.id;

    for (const [evtId, muts] of Object.entries(proposedMutationsByEvent)) {
      const found = muts.find((m) => m.id === mutationId);
      if (found) {
        targetMutation = found;
        targetEventId = found.eventId || evtId;
        break;
      }
    }

    if (!targetMutation || targetMutation.applied) return;

    // Snapshot state before mutation strictly under targetEventId
    const targetPlan = events.find((e) => e.id === targetEventId) || activeEvent;
    const snapshot: EventPlanSnapshot = {
      mutationId,
      timestamp: Date.now(),
      plan: JSON.parse(JSON.stringify(targetPlan)),
    };

    setUndoStackByEvent((prev) => ({
      ...prev,
      [targetEventId]: [snapshot, ...(prev[targetEventId] || [])],
    }));

    // Apply state modifications to target event
    const mutatedIds = new Set<string>();

    mutateEventById(targetEventId, (prev) => {
      let updatedBudget = [...prev.budgetItems];
      let updatedTimeline = [...prev.timelineTasks];
      let updatedChecklist = [...prev.themeChecklist];

      // 1. Apply budget diffs with dynamic perGuestRate updates (Fixes Slider-After-AI-Mutation)
      targetMutation!.budgetDiffs.forEach((diff) => {
        const safeNewAmount = Math.max(0, sanitizeNumber(diff.newAmount, 0));

        const existingIdx = updatedBudget.findIndex(
          (b) =>
            (diff.itemId && b.id === diff.itemId) ||
            b.category.toLowerCase() === diff.category.toLowerCase() ||
            b.name.toLowerCase() === diff.name.toLowerCase()
        );

        if (existingIdx >= 0) {
          const item = updatedBudget[existingIdx];
          const newCostType = diff.costType || item.costType;

          let perGuestRate = item.perGuestRate || 0;
          let baseFixedCost = item.baseFixedCost || 0;

          if (newCostType === 'VARIABLE_PER_GUEST') {
            // Dynamically recalculate per-guest rate so guest slider scales proportionally
            perGuestRate = prev.guestCount > 0 ? Math.round(safeNewAmount / prev.guestCount) : perGuestRate;
            baseFixedCost = 0;
          } else if (newCostType === 'HYBRID') {
            // Update rate proportionally
            if (safeNewAmount > baseFixedCost && prev.guestCount > 0) {
              perGuestRate = Math.round((safeNewAmount - baseFixedCost) / prev.guestCount);
            } else {
              baseFixedCost = Math.round(safeNewAmount * 0.5);
              perGuestRate = prev.guestCount > 0 ? Math.round((safeNewAmount - baseFixedCost) / prev.guestCount) : 0;
            }
          } else if (newCostType === 'FIXED') {
            baseFixedCost = safeNewAmount;
            perGuestRate = 0;
          }

          updatedBudget[existingIdx] = {
            ...item,
            costType: newCostType,
            allocatedAmount: safeNewAmount,
            baseFixedCost,
            perGuestRate,
            aiWarning: diff.aiWarning,
          };
          mutatedIds.add(item.id);
        } else {
          // New item insertion
          let perGuestRate = 0;
          let baseFixedCost = safeNewAmount;

          if (diff.costType === 'VARIABLE_PER_GUEST') {
            perGuestRate = prev.guestCount > 0 ? Math.round(safeNewAmount / prev.guestCount) : 0;
            baseFixedCost = 0;
          } else if (diff.costType === 'HYBRID') {
            baseFixedCost = Math.round(safeNewAmount * 0.5);
            perGuestRate = prev.guestCount > 0 ? Math.round((safeNewAmount - baseFixedCost) / prev.guestCount) : 0;
          }

          const newId = `b-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
          updatedBudget.push({
            id: newId,
            category: diff.category,
            name: diff.name,
            subFunction: diff.subFunction || 'All Functions',
            costType: diff.costType,
            baseFixedCost,
            perGuestRate,
            allocatedAmount: safeNewAmount,
            aiWarning: diff.aiWarning,
          });
          mutatedIds.add(newId);
        }
      });

      // Recalculate deterministic buffer & audit
      updatedBudget = recalculateBudget(updatedBudget, prev.guestCount, prev.contingencyRate);
      updatedBudget = auditLocalBenchmarks(updatedBudget, prev.totalBudget, prev.guestCount, prev.type);

      // 2. Apply timeline diffs
      targetMutation!.timelineDiffs.forEach((tdiff) => {
        const existingTaskIdx = updatedTimeline.findIndex(
          (t) =>
            (tdiff.taskId && t.id === tdiff.taskId) ||
            t.title.toLowerCase().includes(tdiff.title.toLowerCase()) ||
            tdiff.title.toLowerCase().includes(t.title.toLowerCase())
        );

        if (existingTaskIdx >= 0) {
          const task = updatedTimeline[existingTaskIdx];
          updatedTimeline[existingTaskIdx] = {
            ...task,
            status: tdiff.newStatus,
            daysBeforeEvent: tdiff.newDaysBefore || task.daysBeforeEvent,
            notes: `${task.notes || ''} [Copilot: ${tdiff.reason}]`,
          };
          mutatedIds.add(task.id);
        } else {
          const newTaskId = `t-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
          updatedTimeline.push({
            id: newTaskId,
            title: tdiff.title,
            subFunction: 'All Functions',
            phase: 'T-15_TO_7',
            daysBeforeEvent: tdiff.newDaysBefore || 14,
            durationDays: 3,
            slippageDays: 0,
            status: tdiff.newStatus,
            dependsOnIds: [],
            owner: 'Event Team',
            notes: tdiff.reason,
          });
          mutatedIds.add(newTaskId);
        }
      });

      const withCascades = computeCascadingDelays(updatedTimeline);

      // 3. Add checklist additions
      targetMutation!.checklistAdditions.forEach((c) => {
        updatedChecklist.push({
          id: `ci-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          itemName: c.itemName,
          subFunction: c.subFunction,
          quantityOrSpec: c.quantityOrSpec,
          estimatedCost: sanitizeNumber(c.estimatedCost, 0),
          syncedToBudget: false,
        });
      });

      return {
        ...prev,
        budgetItems: updatedBudget,
        timelineTasks: withCascades,
        themeChecklist: updatedChecklist,
      };
    });

    // Mark mutation as applied in the designated event
    setProposedMutationsByEvent((prev) => ({
      ...prev,
      [targetEventId]: (prev[targetEventId] || []).map((m) =>
        m.id === mutationId ? { ...m, applied: true } : m
      ),
    }));

    // Trigger visual pulse for mutated budget and timeline items
    if (mutatedIds.size > 0) {
      setLastMutatedIds(new Set(mutatedIds));
      setTimeout(() => setLastMutatedIds(new Set()), 2500);
    }
  }, [events, activeEvent, proposedMutationsByEvent, mutateEventById]);

  // Revert mutation using historical snapshot
  const revertMutation = useCallback((mutationId: string) => {
    let targetSnapshot: EventPlanSnapshot | undefined;
    let targetEventId = activeEvent.id;

    for (const [evtId, snaps] of Object.entries(undoStackByEvent)) {
      const found = snaps.find((s) => s.mutationId === mutationId);
      if (found) {
        targetSnapshot = found;
        targetEventId = evtId;
        break;
      }
    }

    if (!targetSnapshot) return;

    // Restore event plan state
    setEvents((prev) =>
      prev.map((e) => (e.id === targetSnapshot!.plan.id ? targetSnapshot!.plan : e))
    );

    // Remove snapshot from undo stack
    setUndoStackByEvent((prev) => ({
      ...prev,
      [targetEventId]: (prev[targetEventId] || []).filter((s) => s.mutationId !== mutationId),
    }));

    // Mark mutation as not applied
    setProposedMutationsByEvent((prev) => ({
      ...prev,
      [targetEventId]: (prev[targetEventId] || []).map((m) =>
        m.id === mutationId ? { ...m, applied: false } : m
      ),
    }));
  }, [activeEvent.id, undoStackByEvent]);

  const createNewEvent = useCallback((data: Partial<EventPlan>) => {
    const newId = `event-${Date.now()}`;
    const safeGuests = clamp(sanitizeNumber(data.guestCount, 150), 20, 2000);
    const safeBudget = Math.max(10000, sanitizeNumber(data.totalBudget, 500000));
    const eventType = data.type || 'WEDDING';

    let subFunctions = ['All Functions', 'Haldi & Mehendi', 'Sangeet Night', 'Wedding Ceremony', 'Reception'];
    let starterCateringRate = 1150;
    let starterVenueShare = 0.28;

    if (eventType === 'BIRTHDAY') {
      subFunctions = ['All Functions', 'Theme Entry', 'Entertainment & DJ', 'Cake & Dinner'];
      starterCateringRate = 750;
      starterVenueShare = 0.22;
    } else if (eventType === 'COMMUNITY_EVENT') {
      subFunctions = ['All Functions', 'Keynote & Main Stage', 'Workshops', 'Networking & Food'];
      starterCateringRate = 450;
      starterVenueShare = 0.25;
    }

    const venueCost = Math.round(safeBudget * starterVenueShare);
    const cateringCost = starterCateringRate * safeGuests;
    const decorCost = Math.round(safeBudget * 0.2);
    const soundCost = Math.round(safeBudget * 0.1);
    const bufferCost = Math.round((venueCost + cateringCost + decorCost + soundCost) * 0.08);

    const newPlan: EventPlan = {
      id: newId,
      name: data.name || 'New Custom Event',
      type: eventType,
      eventDate: data.eventDate || '2026-12-31',
      daysRemaining: sanitizeNumber(data.daysRemaining, 60),
      location: data.location || 'Pune, Maharashtra',
      guestCount: safeGuests,
      venueMaxCapacity: Math.round(safeGuests * 1.2),
      totalBudget: safeBudget,
      contingencyRate: 0.08,
      readinessScore: 78,
      subFunctions,
      budgetItems: [
        {
          id: `b-init-${Date.now()}-1`,
          category: 'Venue & Lawns',
          name: 'Main Event Space & Banquets',
          subFunction: subFunctions[1] || 'General',
          costType: 'FIXED',
          baseFixedCost: venueCost,
          perGuestRate: 0,
          allocatedAmount: venueCost,
          notes: 'Standard rental contract with basic lighting',
        },
        {
          id: `b-init-${Date.now()}-2`,
          category: 'Catering & Beverages',
          name: 'Full Buffet & Live Counters',
          subFunction: subFunctions[subFunctions.length - 1] || 'General',
          costType: 'VARIABLE_PER_GUEST',
          baseFixedCost: 0,
          perGuestRate: starterCateringRate,
          allocatedAmount: cateringCost,
          notes: `Tier-1 menu package for ${safeGuests} pax`,
        },
        {
          id: `b-init-${Date.now()}-3`,
          category: 'Decor & Florals',
          name: 'Theme Canopy, Backdrop & Florals',
          subFunction: subFunctions[1] || 'General',
          costType: 'FIXED',
          baseFixedCost: decorCost,
          perGuestRate: 0,
          allocatedAmount: decorCost,
          notes: 'Seasonal floral setup and focal stage',
        },
        {
          id: `b-init-${Date.now()}-4`,
          category: 'Sound, DJ & Licensing',
          name: 'Stage Sound System + PPL/Novex License',
          subFunction: subFunctions[2] || 'General',
          costType: 'HYBRID',
          baseFixedCost: soundCost,
          perGuestRate: 0,
          allocatedAmount: soundCost,
          notes: 'Includes PPL and Novex commercial playback permits',
        },
        {
          id: `b-init-${Date.now()}-5`,
          category: 'Tax & Contingency Reserve',
          name: '8% GST Buffer & Emergency Contingency',
          subFunction: 'All Functions',
          costType: 'TAX_AND_BUFFER',
          baseFixedCost: 0,
          perGuestRate: 0,
          allocatedAmount: bufferCost,
          notes: '8% statutory buffer for GST & emergency variance',
        },
      ],
      timelineTasks: [
        {
          id: `t-init-${Date.now()}-1`,
          title: 'Finalize Venue Contract & Token Advance',
          subFunction: subFunctions[1] || 'General',
          phase: 'T-60_TO_30',
          daysBeforeEvent: 50,
          durationDays: 4,
          slippageDays: 0,
          status: 'ON_TRACK',
          dependsOnIds: [],
          owner: 'Host Lead',
          notes: 'Anchor milestone for all vendors',
        },
        {
          id: `t-init-${Date.now()}-2`,
          title: 'Lock Caterer Menu & Food Tasting Session',
          subFunction: subFunctions[subFunctions.length - 1] || 'General',
          phase: 'T-30_TO_15',
          daysBeforeEvent: 25,
          durationDays: 3,
          slippageDays: 0,
          status: 'ON_TRACK',
          dependsOnIds: [`t-init-${Date.now()}-1`],
          owner: 'F&B Coordinator',
          notes: 'Requires venue kitchen access confirmation',
        },
        {
          id: `t-init-${Date.now()}-3`,
          title: 'Audio-Visual Soundcheck & Dry Run',
          subFunction: subFunctions[2] || 'General',
          phase: 'T-15_TO_7',
          daysBeforeEvent: 7,
          durationDays: 2,
          slippageDays: 0,
          status: 'ON_TRACK',
          dependsOnIds: [`t-init-${Date.now()}-1`],
          owner: 'Tech Lead',
          notes: 'PPL license and acoustic limits test',
        },
      ],
      vendorQuotes: [],
      themeChecklist: [],
    };

    setEvents((prev) => [newPlan, ...prev]);
    setActiveEventId(newId);
    setActiveSubFunction('All Functions');
  }, []);

  const resetToDefaultEvents = useCallback(() => {
    setEvents(INITIAL_EVENTS);
    setActiveEventId(INITIAL_EVENTS[0].id);
    setActiveSubFunction('All Functions');
    setProposedMutationsByEvent({});
    setUndoStackByEvent({});
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(MUTATIONS_STORAGE_KEY);
    localStorage.removeItem('eventflow_ai_events_v3');
    localStorage.removeItem('eventflow_ai_mutations_v3');
  }, []);

  return (
    <EventContext.Provider
      value={{
        events,
        activeEvent,
        activeTab,
        activeSubFunction,
        proposedMutations,
        undoStack,
        isThinking,
        lastMutatedIds,
        switchEvent,
        setActiveTab,
        setActiveSubFunction,
        updateGuestCount,
        updateContingencyRate,
        updateBudgetItem,
        addBudgetItem,
        deleteBudgetItem,
        updateTimelineTask,
        addTimelineTask,
        autoCompressSchedule,
        addVendorQuote,
        awardVendor,
        addChecklistItem,
        syncChecklistItemToBudget,
        unsyncChecklistItemFromBudget,
        sendCopilotCommand,
        applyMutation,
        revertMutation,
        createNewEvent,
        resetToDefaultEvents,
      }}
    >
      {children}
    </EventContext.Provider>
  );
};

export const useEventContext = () => {
  const context = useContext(EventContext);
  if (!context) {
    throw new Error('useEventContext must be used within an EventProvider');
  }
  return context;
};
