export type EventType = 'WEDDING' | 'BIRTHDAY' | 'COMMUNITY_EVENT';

export type CostType = 'FIXED' | 'VARIABLE_PER_GUEST' | 'HYBRID' | 'TAX_AND_BUFFER';

export type TaskStatus = 'COMPLETED' | 'ON_TRACK' | 'DELAYED' | 'AT_RISK_DEPENDENCY';

export interface BudgetItem {
  id: string;
  category: string;
  name: string;
  subFunction: string; // e.g. 'Haldi', 'Sangeet', 'Reception', 'General'
  costType: CostType;
  baseFixedCost: number; // For FIXED or HYBRID
  perGuestRate: number;  // For VARIABLE_PER_GUEST or HYBRID
  allocatedAmount: number;
  aiWarning?: string;
  notes?: string;
}

export interface TimelineTask {
  id: string;
  title: string;
  subFunction: string;
  phase: 'T-60_TO_30' | 'T-30_TO_15' | 'T-15_TO_7' | 'WEEK_OF_EVENT' | 'RUN_OF_SHOW';
  daysBeforeEvent: number; // e.g. 45 -> T-45d
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
  gstRatePercent: number; // 5 or 18
  taxesGstAmount: number;
  estimatedHiddenCosts: number;
  normalizedTotal: number;
  hiddenFeesFlagged: string[];
  aiRecommendationBadge?: 'BEST_VALUE' | 'HIGH_RISK_EXCLUSIONS' | 'PREMIUM_PICK';
  negotiationScript: string;
  contactPerson?: string;
}

export interface ChecklistItem {
  id: string;
  itemName: string;
  subFunction: string;
  quantityOrSpec: string;
  estimatedCost: number;
  syncedToBudget: boolean;
}

export interface EventPlan {
  id: string;
  name: string;
  type: EventType;
  eventDate: string; // YYYY-MM-DD
  daysRemaining: number;
  location: string;
  guestCount: number;
  venueMaxCapacity: number;
  totalBudget: number;
  contingencyRate: number; // default 0.08 (8%)
  readinessScore: number; // 0 - 100
  subFunctions: string[];
  budgetItems: BudgetItem[];
  timelineTasks: TimelineTask[];
  vendorQuotes: VendorQuote[];
  themeChecklist: ChecklistItem[];
}

export interface BudgetDiff {
  itemId?: string;
  category: string;
  name: string;
  subFunction: string;
  costType: CostType;
  previousAmount: number;
  newAmount: number;
  aiWarning?: string;
}

export interface TimelineDiff {
  taskId?: string;
  title: string;
  previousStatus: TaskStatus;
  newStatus: TaskStatus;
  previousDaysBefore: number;
  newDaysBefore: number;
  reason: string;
}

export interface ChecklistAddition {
  itemName: string;
  subFunction: string;
  quantityOrSpec: string;
  estimatedCost: number;
}

export interface PlanMutationPayload {
  id: string;
  timestamp: number;
  userPrompt: string;
  assistantReply: string;
  readinessScoreDelta: number;
  budgetDiffs: BudgetDiff[];
  timelineDiffs: TimelineDiff[];
  checklistAdditions: ChecklistAddition[];
  applied: boolean;
}

export interface EventPlanSnapshot {
  mutationId: string;
  timestamp: number;
  plan: EventPlan;
}
