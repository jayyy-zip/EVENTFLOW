import React from 'react';
import { useEventContext } from '../context/EventContext';
import { SmartBudgetArchitect } from './tabs/SmartBudgetArchitect';
import { AdaptiveTimeline } from './tabs/AdaptiveTimeline';
import { VendorQuoteMatrix } from './tabs/VendorQuoteMatrix';
import { MoodboardStudio } from './tabs/MoodboardStudio';
import { formatINR } from '../utils/formatters';
import { Users, Clock, AlertTriangle, ShieldCheck, TrendingUp } from 'lucide-react';

export const CenterCanvas: React.FC = () => {
  const {
    activeEvent,
    activeTab,
    updateGuestCount,
  } = useEventContext();

  const totalBaseAllocated = activeEvent.budgetItems.reduce(
    (sum, b) => sum + (b.costType !== 'TAX_AND_BUFFER' ? b.allocatedAmount : 0),
    0
  );

  const taxBufferItem = activeEvent.budgetItems.find((b) => b.costType === 'TAX_AND_BUFFER');
  const bufferAmount = taxBufferItem ? taxBufferItem.allocatedAmount : 0;
  const grandTotal = totalBaseAllocated + bufferAmount;
  const remainingBudget = activeEvent.totalBudget - grandTotal;

  const basePct = Math.min(100, (totalBaseAllocated / activeEvent.totalBudget) * 100);
  const bufferPct = Math.min(100 - basePct, (bufferAmount / activeEvent.totalBudget) * 100);
  const isOverCapacity = activeEvent.guestCount > activeEvent.venueMaxCapacity;
  const isOverBudget = grandTotal > activeEvent.totalBudget;

  return (
    <main className="flex-1 min-w-0 bg-[#FAF8F5] p-5 overflow-y-auto space-y-5">
      {/* Top Live Telemetry Bar */}
      <section className="bg-white border border-[#E7E5E4] rounded-xl p-4 shadow-2xs space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
          {/* Telemetry 1: Event Date Countdown */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#FAF8F5] border border-[#E7E5E4] flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5 text-[#E05A47]" />
            </div>
            <div>
              <div className="text-[10px] font-semibold text-[#78716C] uppercase tracking-wider">
                Event Countdown
              </div>
              <div className="text-base font-bold text-[#1C1917] font-mono-numbers">
                T-{activeEvent.daysRemaining} Days
              </div>
              <div className="text-[11px] text-[#78716C]">
                {activeEvent.eventDate} · Backward Sched Active
              </div>
            </div>
          </div>

          {/* Telemetry 2: Interactive What-If Guest Count Slider */}
          <div className="space-y-1.5 bg-[#FAF8F5] border border-[#E7E5E4] p-2.5 rounded-lg">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5 font-medium text-[#1C1917]">
                <Users className="w-3.5 h-3.5 text-[#4F46E5]" />
                <span>What-If Guest Count</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="font-mono-numbers font-bold text-[#1C1917] text-sm">
                  {activeEvent.guestCount}
                </span>
                <span className="text-[10px] text-[#78716C]">guests</span>
              </div>
            </div>

            <input
              type="range"
              min="50"
              max="500"
              step="5"
              value={activeEvent.guestCount}
              onChange={(e) => updateGuestCount(Number(e.target.value))}
              className="w-full accent-[#E05A47] cursor-pointer h-1.5 bg-[#E7E5E4] rounded-lg"
            />

            <div className="flex items-center justify-between text-[10px] text-[#78716C]">
              <span>50 pax</span>
              {isOverCapacity ? (
                <span className="text-rose-700 font-semibold flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> Exceeds Venue Cap ({activeEvent.venueMaxCapacity})
                </span>
              ) : (
                <span>Venue Cap: {activeEvent.venueMaxCapacity} pax</span>
              )}
              <span>500 pax</span>
            </div>
          </div>

          {/* Telemetry 3: Total Budget vs Allocated */}
          <div className="flex flex-col justify-between space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[#78716C] font-medium">Budget Committed</span>
              <span
                className={`font-mono-numbers font-bold text-sm ${
                  isOverBudget ? 'text-rose-600' : 'text-[#1C1917]'
                }`}
              >
                {formatINR(grandTotal)}
                <span className="text-[#78716C] font-normal text-[11px]">
                  {' '}
                  / {formatINR(activeEvent.totalBudget, true)}
                </span>
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
                title={`Reserved GST Buffer: ${formatINR(bufferAmount)}`}
              />
            </div>

            <div className="flex items-center justify-between text-[10px] text-[#78716C]">
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-[#E05A47]" /> Base Spend
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-[#4F46E5]" /> 8% Tax Buffer
                </span>
              </div>
              <span
                className={`font-mono-numbers font-semibold ${
                  remainingBudget >= 0 ? 'text-[#16A34A]' : 'text-[#DC2626]'
                }`}
              >
                {remainingBudget >= 0
                  ? `+${formatINR(remainingBudget)} surplus`
                  : `-${formatINR(Math.abs(remainingBudget))} overrun`}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Active Tab View */}
      <section className="bg-white border border-[#E7E5E4] rounded-xl p-5 shadow-2xs min-h-[500px]">
        {activeTab === 'budget' && <SmartBudgetArchitect />}
        {activeTab === 'timeline' && <AdaptiveTimeline />}
        {activeTab === 'quotes' && <VendorQuoteMatrix />}
        {activeTab === 'moodboard' && <MoodboardStudio />}
      </section>
    </main>
  );
};
