import React from 'react';
import { useEventContext } from '../context/EventContext';
import {
  PieChart,
  CalendarClock,
  FileSpreadsheet,
  Palette,
  ShieldAlert,
  Download,
  Building,
  MapPin,
  Clock,
  Sparkles,
} from 'lucide-react';
import { formatINR } from '../utils/formatters';

export const LeftSidebar: React.FC = () => {
  const {
    activeEvent,
    activeTab,
    setActiveTab,
    updateContingencyRate,
  } = useEventContext();

  const totalAllocated = activeEvent.budgetItems.reduce(
    (sum, b) => sum + (b.costType !== 'TAX_AND_BUFFER' ? b.allocatedAmount : 0),
    0
  );
  const taxBufferItem = activeEvent.budgetItems.find((b) => b.costType === 'TAX_AND_BUFFER');
  const bufferAmount = taxBufferItem ? taxBufferItem.allocatedAmount : 0;
  const grandTotal = totalAllocated + bufferAmount;
  const variance = activeEvent.totalBudget - grandTotal;

  const navItems = [
    {
      id: 'budget' as const,
      label: 'Smart Budget Architect',
      description: 'Tier-1/2 local cost benchmarks',
      icon: PieChart,
      badge: `${activeEvent.budgetItems.length} items`,
    },
    {
      id: 'timeline' as const,
      label: 'Adaptive Timeline',
      description: 'Backward scheduling & DAG',
      icon: CalendarClock,
      badge: `${activeEvent.timelineTasks.length} tasks`,
    },
    {
      id: 'quotes' as const,
      label: 'Vendor Quote Matrix',
      description: 'Contract fine-print scanner',
      icon: FileSpreadsheet,
      badge: `${activeEvent.vendorQuotes.length} quotes`,
    },
    {
      id: 'moodboard' as const,
      label: 'Moodboard & BOM',
      description: 'Actionable rentals & shopping',
      icon: Palette,
      badge: `${activeEvent.themeChecklist.length} specs`,
    },
  ];

  const handleExportCSV = () => {
    let csv = 'Category,Item Name,Sub-Function,Cost Behavior,Allocated (INR),Notes\n';
    activeEvent.budgetItems.forEach((b) => {
      csv += `"${b.category}","${b.name}","${b.subFunction}","${b.costType}","${b.allocatedAmount}","${b.notes || ''}"\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeEvent.name.replace(/\s+/g, '_')}_budget.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <aside className="w-64 bg-white border-r border-[#E7E5E4] flex flex-col justify-between p-4 shrink-0 overflow-y-auto">
      <div className="space-y-6">
        {/* Event Quick Info Card */}
        <div className="bg-[#FAF8F5] border border-[#E7E5E4] rounded-lg p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold text-[#78716C] uppercase tracking-wider">
              Target Blueprint
            </span>
            <span className="text-[11px] font-medium text-[#E05A47]">
              {activeEvent.type.replace('_', ' ')}
            </span>
          </div>
          <div className="space-y-1 text-xs text-[#58413D]">
            <div className="flex items-center gap-1.5 truncate">
              <MapPin className="w-3.5 h-3.5 text-[#78716C] shrink-0" />
              <span className="truncate">{activeEvent.location}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-[#78716C] shrink-0" />
              <span>{activeEvent.eventDate} (T-{activeEvent.daysRemaining}d)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Building className="w-3.5 h-3.5 text-[#78716C] shrink-0" />
              <span>Venue Max: {activeEvent.venueMaxCapacity} guests</span>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div>
          <div className="px-2 pb-2 text-[10px] font-semibold text-[#78716C] uppercase tracking-wider">
            Workspace Modules
          </div>
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full text-left px-3 py-2.5 rounded-lg text-xs transition-all flex items-start gap-3 ${
                    isActive
                      ? 'bg-[#FAF8F5] text-[#1C1917] font-semibold border border-[#E7E5E4] shadow-2xs'
                      : 'text-[#58413D] hover:bg-[#FAF8F5] hover:text-[#1C1917]'
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 mt-0.5 shrink-0 ${
                      isActive ? 'text-[#E05A47]' : 'text-[#78716C]'
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="truncate">{item.label}</span>
                    </div>
                    <p className="text-[11px] text-[#78716C] font-normal truncate">
                      {item.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Dynamic Contingency Buffer Control */}
        <div className="bg-[#FAF8F5] border border-[#E7E5E4] rounded-lg p-3 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#1C1917]">GST & Contingency Buffer</span>
            <span className="text-xs font-bold text-[#4F46E5] font-mono-numbers">
              {Math.round(activeEvent.contingencyRate * 100)}%
            </span>
          </div>
          <input
            type="range"
            min="0.05"
            max="0.15"
            step="0.01"
            value={activeEvent.contingencyRate}
            onChange={(e) => updateContingencyRate(parseFloat(e.target.value))}
            className="w-full accent-[#4F46E5] cursor-pointer h-1.5 bg-[#E7E5E4] rounded-lg"
          />
          <div className="flex justify-between text-[10px] text-[#78716C]">
            <span>5% (Strict)</span>
            <span>8% (Recommended)</span>
            <span>15% (Safe)</span>
          </div>
          <p className="text-[11px] text-[#78716C] leading-snug">
            Automatically reserves{' '}
            <strong className="text-[#1C1917] font-mono-numbers">{formatINR(bufferAmount)}</strong> for
            GST slabs, overtime, and vendor tips.
          </p>
        </div>
      </div>

      {/* Footer Financial Snapshot & Export */}
      <div className="pt-4 border-t border-[#E7E5E4] space-y-3">
        <div className="space-y-1.5 text-xs">
          <div className="flex justify-between text-[#78716C]">
            <span>Target Budget</span>
            <span className="font-mono-numbers text-[#1C1917]">
              {formatINR(activeEvent.totalBudget)}
            </span>
          </div>
          <div className="flex justify-between text-[#78716C]">
            <span>Allocated Spend</span>
            <span className="font-mono-numbers text-[#1C1917]">{formatINR(grandTotal)}</span>
          </div>
          <div className="flex justify-between pt-1 border-t border-[#E7E5E4] font-medium">
            <span className={variance >= 0 ? 'text-[#16A34A]' : 'text-[#DC2626]'}>
              {variance >= 0 ? 'Surplus Available' : 'Budget Overrun'}
            </span>
            <span
              className={`font-mono-numbers font-semibold ${
                variance >= 0 ? 'text-[#16A34A]' : 'text-[#DC2626]'
              }`}
            >
              {variance >= 0 ? `+${formatINR(variance)}` : `-${formatINR(Math.abs(variance))}`}
            </span>
          </div>
        </div>

        <button
          onClick={handleExportCSV}
          className="w-full py-1.5 px-3 text-xs font-medium text-[#1C1917] bg-white border border-[#E7E5E4] hover:bg-[#FAF8F5] rounded-md transition-colors flex items-center justify-center gap-1.5 shadow-2xs"
        >
          <Download className="w-3.5 h-3.5 text-[#78716C]" />
          <span>Export Plan CSV</span>
        </button>
      </div>
    </aside>
  );
};
