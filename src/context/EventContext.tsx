import React, { createContext, useContext, useState, useEffect } from 'react';
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
} from '../utils/formatters';

interface EventContextType {
  events: EventPlan[];
  activeEvent: EventPlan;
  activeTab: 'budget' | 'timeline' | 'quotes' | 'moodboard';
  activeSubFunction: string;
  proposedMutations: PlanMutationPayload[];
  undoStack: EventPlanSnapshot[];
  isThinking: boolean;
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
  addChecklistItem: (item: ChecklistItem) => void;
  syncChecklistItemToBudget: (item: ChecklistItem) => void;
  sendCopilotCommand: (prompt: string) => Promise<void>;
  applyMutation: (mutationId: string) => void;
  revertMutation: (mutationId: string) => void;
  createNewEvent: (eventData: Partial<EventPlan>) => void;
  resetToDefaultEvents: () => void;
}

const EventContext = createContext<EventContextType | undefined>(undefined);

const STORAGE_KEY = 'eventflow_ai_events_v2';

export const EventProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [events, setEvents] = useState<EventPlan[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.warn('Failed to load events from localStorage:', e);
    }
    return INITIAL_EVENTS;
  });

  const [activeEventId, setActiveEventId] = useState<string>(INITIAL_EVENTS[0].id);
  const [activeTab, setActiveTab] = useState<'budget' | 'timeline' | 'quotes' | 'moodboard'>('budget');
  const [activeSubFunction, setActiveSubFunction] = useState<string>('All Functions');
  const [proposedMutations, setProposedMutations] = useState<PlanMutationPayload[]>([]);
  const [undoStack, setUndoStack] = useState<EventPlanSnapshot[]>([]);
  const [isThinking, setIsThinking] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
    } catch (e) {
      console.warn('Failed to save events to localStorage:', e);
    }
  }, [events]);

  const activeEvent = events.find((e) => e.id === activeEventId) || events[0];

  // Helper to update current event state
  const mutateActiveEvent = (updater: (prev: EventPlan) => EventPlan) => {
    setEvents((prev) =>
      prev.map((e) => {
        if (e.id === activeEventId) {
          return updater(e);
        }
        return e;
      })
    );
  };

  const switchEvent = (id: string) => {
    setActiveEventId(id);
    setActiveSubFunction('All Functions');
  };

  const updateGuestCount = (count: number) => {
    mutateActiveEvent((prev) => {
      const updatedBudget = recalculateBudget(prev.budgetItems, count, prev.contingencyRate);
      const audited = auditLocalBenchmarks(updatedBudget, prev.totalBudget, count);
      return {
        ...prev,
        guestCount: count,
        budgetItems: audited,
      };
    });
  };

  const updateContingencyRate = (rate: number) => {
    mutateActiveEvent((prev) => {
      const updatedBudget = recalculateBudget(prev.budgetItems, prev.guestCount, rate);
      return {
        ...prev,
        contingencyRate: rate,
        budgetItems: updatedBudget,
      };
    });
  };

  const updateBudgetItem = (item: BudgetItem) => {
    mutateActiveEvent((prev) => {
      let updatedItems = prev.budgetItems.map((b) => (b.id === item.id ? item : b));
      // If user directly edited allocatedAmount of a variable item, back-calculate perGuestRate
      if (item.costType === 'VARIABLE_PER_GUEST' && prev.guestCount > 0) {
        item.perGuestRate = Math.round(item.allocatedAmount / prev.guestCount);
      }
      updatedItems = recalculateBudget(updatedItems, prev.guestCount, prev.contingencyRate);
      const audited = auditLocalBenchmarks(updatedItems, prev.totalBudget, prev.guestCount);
      return {
        ...prev,
        budgetItems: audited,
      };
    });
  };

  const addBudgetItem = (itemData: Omit<BudgetItem, 'id'>) => {
    mutateActiveEvent((prev) => {
      const newItem: BudgetItem = {
        ...itemData,
        id: `b-${Date.now()}`,
      };
      let updatedItems = [...prev.budgetItems, newItem];
      updatedItems = recalculateBudget(updatedItems, prev.guestCount, prev.contingencyRate);
      const audited = auditLocalBenchmarks(updatedItems, prev.totalBudget, prev.guestCount);
      return {
        ...prev,
        budgetItems: audited,
      };
    });
  };

  const deleteBudgetItem = (id: string) => {
    mutateActiveEvent((prev) => {
      const updatedItems = prev.budgetItems.filter((b) => b.id !== id);
      const recalculated = recalculateBudget(updatedItems, prev.guestCount, prev.contingencyRate);
      return {
        ...prev,
        budgetItems: recalculated,
      };
    });
  };

  const updateTimelineTask = (task: TimelineTask) => {
    mutateActiveEvent((prev) => {
      const updatedTasks = prev.timelineTasks.map((t) => (t.id === task.id ? task : t));
      const withCascades = computeCascadingDelays(updatedTasks);
      return {
        ...prev,
        timelineTasks: withCascades,
      };
    });
  };

  const addTimelineTask = (taskData: Omit<TimelineTask, 'id'>) => {
    mutateActiveEvent((prev) => {
      const newTask: TimelineTask = {
        ...taskData,
        id: `t-${Date.now()}`,
      };
      const updatedTasks = [...prev.timelineTasks, newTask];
      const withCascades = computeCascadingDelays(updatedTasks);
      return {
        ...prev,
        timelineTasks: withCascades,
      };
    });
  };

  const autoCompressSchedule = () => {
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
  };

  const addVendorQuote = (quote: VendorQuote) => {
    mutateActiveEvent((prev) => ({
      ...prev,
      vendorQuotes: [quote, ...prev.vendorQuotes],
    }));
  };

  const addChecklistItem = (item: ChecklistItem) => {
    mutateActiveEvent((prev) => ({
      ...prev,
      themeChecklist: [...prev.themeChecklist, item],
    }));
  };

  const syncChecklistItemToBudget = (item: ChecklistItem) => {
    mutateActiveEvent((prev) => {
      // 1. Add as BudgetItem
      const newBudgetItem: BudgetItem = {
        id: `b-sync-${item.id}`,
        category: 'Decor & Theme Rentals',
        name: item.itemName,
        subFunction: item.subFunction,
        costType: 'FIXED',
        baseFixedCost: item.estimatedCost,
        perGuestRate: 0,
        allocatedAmount: item.estimatedCost,
        notes: `Procured from theme checklist: ${item.quantityOrSpec}`,
      };

      // 2. Add as procurement task in timeline
      const newTimelineTask: TimelineTask = {
        id: `t-sync-${item.id}`,
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

      // 3. Mark checklist item synced
      const updatedChecklist = prev.themeChecklist.map((c) =>
        c.id === item.id ? { ...c, syncedToBudget: true } : c
      );

      const updatedBudget = recalculateBudget(
        [...prev.budgetItems, newBudgetItem],
        prev.guestCount,
        prev.contingencyRate
      );

      return {
        ...prev,
        budgetItems: updatedBudget,
        timelineTasks: [...prev.timelineTasks, newTimelineTask],
        themeChecklist: updatedChecklist,
      };
    });
  };

  // Stateful Copilot command execution
  const sendCopilotCommand = async (prompt: string) => {
    setIsThinking(true);
    try {
      const res = await fetch('/api/plan-mutation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          currentPlan: activeEvent,
        }),
      });

      if (!res.ok) {
        throw new Error(`Server returned ${res.status}`);
      }

      const data: PlanMutationPayload = await res.json();
      setProposedMutations((prev) => [data, ...prev]);
    } catch (err: any) {
      console.error('Failed to get plan mutation:', err);
    } finally {
      setIsThinking(false);
    }
  };

  // Transactional apply mutation with snapshot pushing
  const applyMutation = (mutationId: string) => {
    const mutation = proposedMutations.find((m) => m.id === mutationId);
    if (!mutation || mutation.applied) return;

    // Snapshot current state before mutation
    const snapshot: EventPlanSnapshot = {
      mutationId,
      timestamp: Date.now(),
      plan: JSON.parse(JSON.stringify(activeEvent)),
    };
    setUndoStack((prev) => [snapshot, ...prev]);

    mutateActiveEvent((prev) => {
      let updatedBudget = [...prev.budgetItems];
      let updatedTimeline = [...prev.timelineTasks];
      let updatedChecklist = [...prev.themeChecklist];

      // 1. Apply budget diffs
      mutation.budgetDiffs.forEach((diff) => {
        const existingIdx = updatedBudget.findIndex(
          (b) => b.category.toLowerCase() === diff.category.toLowerCase() || b.name.toLowerCase() === diff.name.toLowerCase()
        );

        if (existingIdx >= 0) {
          updatedBudget[existingIdx] = {
            ...updatedBudget[existingIdx],
            allocatedAmount: diff.newAmount,
            baseFixedCost: diff.costType === 'FIXED' || diff.costType === 'HYBRID' ? diff.newAmount : updatedBudget[existingIdx].baseFixedCost,
            aiWarning: diff.aiWarning,
          };
        } else {
          updatedBudget.push({
            id: `b-${Date.now()}-${Math.random().toString(36).substring(7)}`,
            category: diff.category,
            name: diff.name,
            subFunction: diff.subFunction || 'All Functions',
            costType: diff.costType,
            baseFixedCost: diff.newAmount,
            perGuestRate: diff.costType === 'VARIABLE_PER_GUEST' ? Math.round(diff.newAmount / prev.guestCount) : 0,
            allocatedAmount: diff.newAmount,
            aiWarning: diff.aiWarning,
          });
        }
      });

      // Recalculate deterministic buffer
      updatedBudget = recalculateBudget(updatedBudget, prev.guestCount, prev.contingencyRate);

      // 2. Apply timeline diffs
      mutation.timelineDiffs.forEach((tdiff) => {
        const existingTaskIdx = updatedTimeline.findIndex((t) =>
          t.title.toLowerCase().includes(tdiff.title.toLowerCase()) || tdiff.title.toLowerCase().includes(t.title.toLowerCase())
        );

        if (existingTaskIdx >= 0) {
          updatedTimeline[existingTaskIdx] = {
            ...updatedTimeline[existingTaskIdx],
            status: tdiff.newStatus,
            daysBeforeEvent: tdiff.newDaysBefore || updatedTimeline[existingTaskIdx].daysBeforeEvent,
            notes: `${updatedTimeline[existingTaskIdx].notes || ''} [Copilot: ${tdiff.reason}]`,
          };
        } else {
          updatedTimeline.push({
            id: `t-${Date.now()}-${Math.random().toString(36).substring(7)}`,
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
        }
      });

      const withCascades = computeCascadingDelays(updatedTimeline);

      // 3. Add checklist additions
      mutation.checklistAdditions.forEach((c) => {
        updatedChecklist.push({
          id: `ci-${Date.now()}-${Math.random().toString(36).substring(7)}`,
          itemName: c.itemName,
          subFunction: c.subFunction,
          quantityOrSpec: c.quantityOrSpec,
          estimatedCost: c.estimatedCost,
          syncedToBudget: false,
        });
      });

      return {
        ...prev,
        readinessScore: Math.min(100, Math.max(0, prev.readinessScore + mutation.readinessScoreDelta)),
        budgetItems: updatedBudget,
        timelineTasks: withCascades,
        themeChecklist: updatedChecklist,
      };
    });

    // Mark mutation as applied
    setProposedMutations((prev) =>
      prev.map((m) => (m.id === mutationId ? { ...m, applied: true } : m))
    );
  };

  // Revert mutation using historical snapshot
  const revertMutation = (mutationId: string) => {
    const snapshot = undoStack.find((s) => s.mutationId === mutationId);
    if (!snapshot) return;

    // Restore plan state
    setEvents((prev) =>
      prev.map((e) => (e.id === snapshot.plan.id ? snapshot.plan : e))
    );

    // Remove snapshot from undo stack
    setUndoStack((prev) => prev.filter((s) => s.mutationId !== mutationId));

    // Mark mutation as not applied
    setProposedMutations((prev) =>
      prev.map((m) => (m.id === mutationId ? { ...m, applied: false } : m))
    );
  };

  const createNewEvent = (data: Partial<EventPlan>) => {
    const newId = `event-${Date.now()}`;
    const newPlan: EventPlan = {
      id: newId,
      name: data.name || 'New Custom Event',
      type: data.type || 'WEDDING',
      eventDate: data.eventDate || '2026-12-31',
      daysRemaining: data.daysRemaining || 60,
      location: data.location || 'Pune, Maharashtra',
      guestCount: data.guestCount || 150,
      venueMaxCapacity: (data.guestCount || 150) + 50,
      totalBudget: data.totalBudget || 500000,
      contingencyRate: 0.08,
      readinessScore: 50,
      subFunctions: ['All Functions', 'Main Ceremony', 'Celebration'],
      budgetItems: [
        {
          id: 'b-init-1',
          category: 'Venue',
          name: 'Main Event Space',
          subFunction: 'Main Ceremony',
          costType: 'FIXED',
          baseFixedCost: Math.round((data.totalBudget || 500000) * 0.3),
          perGuestRate: 0,
          allocatedAmount: Math.round((data.totalBudget || 500000) * 0.3),
        },
        {
          id: 'b-init-2',
          category: 'Catering',
          name: 'Buffet & Refreshments',
          subFunction: 'Celebration',
          costType: 'VARIABLE_PER_GUEST',
          baseFixedCost: 0,
          perGuestRate: 1000,
          allocatedAmount: 1000 * (data.guestCount || 150),
        },
        {
          id: 'b-init-3',
          category: 'Tax & Buffer',
          name: '8% Contingency Reserve',
          subFunction: 'All Functions',
          costType: 'TAX_AND_BUFFER',
          baseFixedCost: 0,
          perGuestRate: 0,
          allocatedAmount: Math.round((data.totalBudget || 500000) * 0.08),
        },
      ],
      timelineTasks: [
        {
          id: 't-init-1',
          title: 'Finalize Venue Contract',
          subFunction: 'Main Ceremony',
          phase: 'T-60_TO_30',
          daysBeforeEvent: 50,
          durationDays: 5,
          slippageDays: 0,
          status: 'ON_TRACK',
          dependsOnIds: [],
          owner: 'Host',
        },
      ],
      vendorQuotes: [],
      themeChecklist: [],
    };

    setEvents((prev) => [newPlan, ...prev]);
    setActiveEventId(newId);
  };

  const resetToDefaultEvents = () => {
    setEvents(INITIAL_EVENTS);
    setActiveEventId(INITIAL_EVENTS[0].id);
    setProposedMutations([]);
    setUndoStack([]);
    localStorage.removeItem(STORAGE_KEY);
  };

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
        addChecklistItem,
        syncChecklistItemToBudget,
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
