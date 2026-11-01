import React, { useMemo } from 'react';
import { useEventContext } from '../context/EventContext';
import { SmartBudgetArchitect } from './tabs/SmartBudgetArchitect';
import { AdaptiveTimeline } from './tabs/AdaptiveTimeline';
import { VendorQuoteMatrix } from './tabs/VendorQuoteMatrix';
import { MoodboardStudio } from './tabs/MoodboardStudio';
import { formatINR, computeEventFinancials, clamp } from '../utils/eventMath';
import { Users, Clock, AlertTriangle, ShieldCheck, Filter } from 'lucide-react';

export const CenterCanvas: React.FC = () => {
  const {
    activeEvent,
    activeTab,
    activeSubFunction,
    updateGuestCount,
  } = useEventContext();

  // Deterministic financial calculation (Single Source of Truth)
  const financials = useMemo(() => {
    return computeEventFinancials(activeEvent.budgetItems, activeEvent.totalBudget);
  }, [activeEvent.budgetItems, activeEvent.totalBudget]);

  const {
    totalBaseAllocated,
    gstBufferAmount,
    grandTotal,
    surplusOrDeficit,
    isOverBudget,
    basePct,
    bufferPct,
  } = financials;

  // Filtered view subtotal calculation (Fixes Sub-Function Filter vs Total Budget Math Bug)
  const filteredSubtotal = useMemo(() => {
    if (activeSubFunction === 'All Functions') return grandTotal;
    return activeEvent.budgetItems
      .filter((b) => b.subFunction === activeSubFunction || b.subFunction === 'All Functions')
      .reduce((sum, b) => sum + b.allocatedAmount, 0);
  }, [activeEvent.budgetItems, activeSubFunction, grandTotal]);

  const filteredItemsCount = useMemo(() => {
    if (activeSubFunction === 'All Functions') return activeEvent.budgetItems.length;
    return activeEvent.budgetItems.filter(
      (b) => b.subFunction === activeSubFunction || b.subFunction === 'All Functions'
    ).length;
  }, [activeEvent.budgetItems, activeSubFunction]);

  const isOverCapacity = activeEvent.guestCount > activeEvent.venueMaxCapacity;
  const isFiltered = activeSubFunction !== 'All Functions';

  return (
    <main className="flex-1 min-w-0 bg-[#FAF8F5] flex flex-col h-full overflow-hidden">
      {/* Pinned Top Live Telemetry Bar (Never scrolls off-screen) */}
      <section className="p-5 pb-3 shrink-0">
        <div className="bg-white border border-[#E7E5E4] rounded-xl p-4 shadow-2xs space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
            {/* Telemetry 1: Event Date Countdown */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#FAF8F5] border border-[#E7E5E4] flex items-center justify-center shrink-0">
                <Clock className="w-5 h-5 text-[#E05A47]" />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] font-semibold text-[#78716C] uppercase tracking-wider">
                  Event Countdown
                </div>
                <div className="text-base font-bold text-[#1C1917] font-mono-numbers tabular-nums">
                  T-{activeEvent.daysRemaining} Days
                </div>
                <div className="text-[11px] text-[#78716C] truncate">
                  {activeEvent.eventDate} · Backward Sched Active
                </div>
              </div>
            </div>

            {/* Telemetry 2: Interactive What-If Guest Count Slider (Clamped 20 - 2,000) */}
            <div className="space-y-1.5 bg-[#FAF8F5] border border-[#E7E5E4] p-2.5 rounded-lg">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 font-medium text-[#1C1917]">
                  <Users className="w-3.5 h-3.5 text-[#4F46E5]" />
                  <span>What-If Guest Count</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="font-mono-numbers tabular-nums font-bold text-[#1C1917] text-sm">
                    {activeEvent.guestCount.toLocaleString('en-IN')}
                  </span>
                  <span className="text-[10px] text-[#78716C]">guests</span>
                </div>
              </div>

              <input
                type="range"
                min="20"
                max="2000"
                step="5"
                value={activeEvent.guestCount}
                onChange={(e) => updateGuestCount(Number(e.target.value))}
                className="w-full accent-[#E05A47] cursor-pointer h-1.5 bg-[#E7E5E4] rounded-lg"
              />

              <div className="flex items-center justify-between text-[10px] text-[#78716C] font-mono-numbers tabular-nums">
                <span>20 pax</span>
                {isOverCapacity ? (
                  <span className="text-rose-700 font-semibold flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> Exceeds Venue Cap ({activeEvent.venueMaxCapacity})
                  </span>
                ) : (
                  <span>Venue Cap: {activeEvent.venueMaxCapacity} pax</span>
                )}
                <span>2,000 pax</span>
              </div>
            </div>

            {/* Telemetry 3: Total Budget vs Allocated with Sub-Function Disambiguation */}
            <div className="flex flex-col justify-between space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#78716C] font-medium flex items-center gap-1">
                  {isFiltered && <Filter className="w-3 h-3 text-[#E05A47]" />}
                  <span>{isFiltered ? `${activeSubFunction} / Total` : 'Budget Committed'}</span>
                </span>
                <span
                  className={`font-mono-numbers tabular-nums font-bold text-sm ${
                    isOverBudget ? 'text-rose-600' : 'text-[#1C1917]'
                  }`}
                >
                  {isFiltered ? (
                    <>
                      <span className="text-[#E05A47]">{formatINR(filteredSubtotal)}</span>
                      <span className="text-[#78716C] font-normal text-[11px]">
                        {' '}
                        (of {formatINR(grandTotal)})
                      </span>
                    </>
                  ) : (
                    <>
                      {formatINR(grandTotal)}
                      <span className="text-[#78716C] font-normal text-[11px]">
                        {' '}
                        / {formatINR(activeEvent.totalBudget, true)}
                      </span>
                    </>
                  )}
                </span>
              </div>

              {/* Dual-segment Progress Bar */}
              <div className="w-full h-2 bg-[#E7E5E4] rounded-full overflow-hidden flex">
                <div
                  className="h-full bg-[#E05A47] transition-all duration-300"
                  style={{ width: `${basePct}%` }}
                  title={`Base Allocated: ${formatINR(totalBaseAllocated)}`}
                />
                <div
                  className="h-full bg-[#4F46E5] opacity-80 transition-all duration-300"
                  style={{ width: `${bufferPct}%` }}
                  title={`Reserved GST Buffer: ${formatINR(gstBufferAmount)}`}
                />
              </div>

              <div className="flex items-center justify-between text-[10px] text-[#78716C]">
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-[#E05A47]" /> Base Spend
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-[#4F46E5]" /> 8% GST Reserve ({formatINR(gstBufferAmount, true)})
                  </span>
                </div>
                <span
                  className={`font-mono-numbers tabular-nums font-semibold ${
                    surplusOrDeficit >= 0 ? 'text-[#16A34A]' : 'text-[#DC2626]'
                  }`}
                >
                  {surplusOrDeficit >= 0
                    ? `+${formatINR(surplusOrDeficit)} surplus`
                    : `-${formatINR(Math.abs(surplusOrDeficit))} overrun`}
                </span>
              </div>
            </div>
          </div>

          {/* Venue Overflow Critical Alert Banner */}
          {isOverCapacity && (
            <div className="pt-2 border-t border-rose-200 flex items-center justify-between text-xs bg-rose-50 px-3.5 py-2 rounded-lg text-rose-900 border">
              <div className="flex items-center gap-2 font-semibold">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>Venue Overflow Alert:</span>
                <span className="font-normal">
                  Guest count ({activeEvent.guestCount.toLocaleString('en-IN')}) exceeds licensed venue capacity ({activeEvent.venueMaxCapacity.toLocaleString('en-IN')}) by {activeEvent.guestCount - activeEvent.venueMaxCapacity} guests.
                </span>
              </div>
              <span className="text-[11px] font-medium text-rose-700 underline shrink-0">
                Lawn extension or secondary hall required
              </span>
            </div>
          )}

          {/* Sub-function Filter Active Notification Bar */}
          {isFiltered && (
            <div className="pt-2 border-t border-[#F5F2EC] flex items-center justify-between text-[11px] bg-[#FAF8F5] px-3 py-1.5 rounded-md text-[#58413D]">
              <div className="flex items-center gap-1.5 font-medium">
                <Filter className="w-3.5 h-3.5 text-[#E05A47]" />
                <span>
                  Showing <strong>{activeSubFunction}</strong>: {filteredItemsCount} line items totaling{' '}
                  <strong className="text-[#1C1917] font-mono-numbers tabular-nums">{formatINR(filteredSubtotal)}</strong>.
                </span>
              </div>
              <div className="text-[#78716C] font-mono-numbers tabular-nums">
                Global Event Budget: {formatINR(activeEvent.totalBudget, true)} (Grand Total: {formatINR(grandTotal, true)})
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Independently Scrollable Tab Content View */}
      <div className="flex-1 overflow-y-auto px-5 pb-5">
        <section className="bg-white border border-[#E7E5E4] rounded-xl p-5 shadow-2xs min-h-[500px]">
          {activeTab === 'budget' && <SmartBudgetArchitect />}
          {activeTab === 'timeline' && <AdaptiveTimeline />}
          {activeTab === 'quotes' && <VendorQuoteMatrix />}
          {activeTab === 'moodboard' && <MoodboardStudio />}
        </section>
      </div>
    </main>
  );
};
