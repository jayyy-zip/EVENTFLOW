import React, { useState } from 'react';
import { useEventContext } from '../../context/EventContext';
import { ChecklistItem } from '../../types/event';
import { formatINR, sanitizeNumber } from '../../utils/eventMath';
import { Sparkles, Plus, Check, ShoppingBag, X } from 'lucide-react';

export const MoodboardStudio: React.FC = () => {
  const {
    activeEvent,
    activeSubFunction,
    addChecklistItem,
    syncChecklistItemToBudget,
    unsyncChecklistItemFromBudget,
  } = useEventContext();

  const [vibePrompt, setVibePrompt] = useState('');
  const [budgetCap, setBudgetCap] = useState(150000);
  const [isGenerating, setIsGenerating] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [aestheticSummary, setAestheticSummary] = useState(
    'Warm sunlit courtyard with raw terracotta pots, vibrant golden marigold garlands, and hand-beaten brass accents.'
  );
  const [colorPalette, setColorPalette] = useState([
    '#E05A47 (Terracotta)',
    '#F59E0B (Marigold)',
    '#FEF08A (Haldi Yellow)',
    '#451A03 (Teak Wood)',
  ]);

  const presetChips = [
    { label: 'Rustic Courtyard Haldi under ₹1.5L', subFunc: 'Haldi', cap: 150000 },
    { label: 'Cyberpunk College Hackathon Night under ₹80k', subFunc: 'Day 1 Hackathon', cap: 80000 },
    { label: 'Sunset Bohemian Rooftop Sundowner under ₹1.0L', subFunc: 'Rooftop Sundowner', cap: 100000 },
    { label: 'Royal Banarasi Sangeet Evening under ₹2.5L', subFunc: 'Sangeet', cap: 250000 },
  ];

  const handleGenerateBOM = async (promptToUse?: string, capToUse?: number, sfToUse?: string) => {
    const prompt = promptToUse || vibePrompt;
    if (!prompt.trim()) return;

    const safeCap = Math.max(10000, sanitizeNumber(capToUse || budgetCap, 150000));
    const targetSubFunc = sfToUse || (activeSubFunction === 'All Functions' ? 'Haldi' : activeSubFunction);

    setIsGenerating(true);
    try {
      const res = await fetch('/api/moodboard-bom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vibePrompt: prompt,
          budgetCap: safeCap,
          subFunction: targetSubFunc,
        }),
      });

      if (!res.ok) throw new Error('BOM generation failed');
      const data = await res.json();

      if (data.aestheticSummary) setAestheticSummary(data.aestheticSummary);
      if (data.colorPalette) setColorPalette(data.colorPalette);
      if (data.checklist) {
        data.checklist.forEach((item: ChecklistItem) => addChecklistItem(item));
      }
    } catch (err: any) {
      console.warn('Network BOM generation failed, using calibrated fallback:', err);
      // Fallback local BOM
      const fallbackItems: ChecklistItem[] = [
        {
          id: `ci-gen-${Date.now()}-1`,
          itemName: `Fresh Floral Canopy & Accents (${targetSubFunc})`,
          subFunction: targetSubFunc,
          quantityOrSpec: '80 meters woven garland & brass bowl accents',
          estimatedCost: Math.round(safeCap * 0.35),
          syncedToBudget: false,
        },
        {
          id: `ci-gen-${Date.now()}-2`,
          itemName: 'Ambient Fairy Light Canopies & Uplighters',
          subFunction: targetSubFunc,
          quantityOrSpec: '20 warm LED pars + 500m fairy strings',
          estimatedCost: Math.round(safeCap * 0.25),
          syncedToBudget: false,
        },
        {
          id: `ci-gen-${Date.now()}-3`,
          itemName: 'Traditional Seating Lounges & Bolsters',
          subFunction: targetSubFunc,
          quantityOrSpec: '10 low gaddas with handloom covers',
          estimatedCost: Math.round(safeCap * 0.2),
          syncedToBudget: false,
        },
      ];
      fallbackItems.forEach((item) => addChecklistItem(item));
    } finally {
      setIsGenerating(false);
    }
  };

  // Idempotent Sync & 1-Click Remove from Budget Toggle (Fixes Duplicate BOM Sync)
  const handleToggleSync = (item: ChecklistItem) => {
    if (syncingId === item.id) return;
    setSyncingId(item.id);

    try {
      if (item.syncedToBudget) {
        unsyncChecklistItemFromBudget(item);
      } else {
        syncChecklistItemToBudget(item);
      }
    } finally {
      setTimeout(() => setSyncingId(null), 300);
    }
  };

  const filteredChecklist = activeEvent.themeChecklist.filter(
    (item) => activeSubFunction === 'All Functions' || item.subFunction === activeSubFunction || item.subFunction === 'All Functions'
  );

  return (
    <div className="space-y-5">
      {/* Module Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-2 border-b border-[#E7E5E4]">
        <div>
          <h2 className="font-display text-base font-semibold text-[#1C1917]">
            Executable Ideas & Moodboard-to-BOM Studio
          </h2>
          <p className="text-xs text-[#78716C]">
            Translates visual vibes into concrete rental & purchase bills of materials with 1-click sync to your live budget.
          </p>
        </div>
      </div>

      {/* Preset Vibe Chips */}
      <div className="space-y-2">
        <span className="text-[11px] font-semibold text-[#78716C] uppercase tracking-wider block">
          Curated Vibe Benchmarks
        </span>
        <div className="flex flex-wrap gap-2">
          {presetChips.map((chip, idx) => (
            <button
              key={idx}
              onClick={() => {
                setVibePrompt(chip.label);
                setBudgetCap(chip.cap);
                handleGenerateBOM(chip.label, chip.cap, chip.subFunc);
              }}
              className="px-2.5 py-1 text-xs font-medium text-[#1C1917] bg-[#FAF8F5] border border-[#E7E5E4] hover:border-[#D6D3D1] hover:bg-white rounded-md transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Sparkles className="w-3 h-3 text-[#E05A47]" />
              <span>{chip.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Custom Prompt Box */}
      <div className="bg-[#FAF8F5] border border-[#E7E5E4] rounded-xl p-4 space-y-3 shadow-2xs">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <input
            type="text"
            value={vibePrompt}
            onChange={(e) => setVibePrompt(e.target.value)}
            placeholder="Type your event vibe (e.g. 'Minimalist Lavender Mehendi with cane stools under ₹1.2L')..."
            className="flex-1 px-3 py-2 bg-white border border-[#E7E5E4] rounded-lg text-xs outline-none focus:border-[#4F46E5] transition-colors"
          />

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 px-2.5 py-1.5 bg-white border border-[#E7E5E4] rounded-lg text-xs">
              <span className="text-[#78716C]">Cap:</span>
              <input
                type="number"
                min="10000"
                step="10000"
                value={budgetCap}
                onChange={(e) => setBudgetCap(Math.max(10000, sanitizeNumber(e.target.value, 10000)))}
                className="w-24 outline-none text-right font-mono-numbers tabular-nums font-medium"
              />
            </div>

            <button
              onClick={() => handleGenerateBOM()}
              disabled={isGenerating || !vibePrompt.trim()}
              className="px-4 py-2 text-xs font-semibold text-white bg-[#4F46E5] hover:bg-[#4338CA] disabled:opacity-50 rounded-lg transition-colors flex items-center gap-1.5 shrink-0 shadow-xs cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{isGenerating ? 'Compiling BOM...' : 'Generate Checklist'}</span>
            </button>
          </div>
        </div>

        {/* Current Concept & Palette Strip */}
        <div className="p-3 bg-white border border-[#E7E5E4] rounded-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs">
          <div className="space-y-0.5">
            <span className="font-semibold text-[#1C1917] block">Design Language</span>
            <p className="text-[#58413D] leading-snug">{aestheticSummary}</p>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {colorPalette.map((col, idx) => (
              <span
                key={idx}
                className="text-[10px] font-medium px-2 py-0.5 rounded-sm bg-[#FAF8F5] border border-[#E7E5E4] text-[#1C1917]"
              >
                {col}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Bill of Materials (BOM) Table */}
      <div className="bg-white border border-[#E7E5E4] rounded-lg overflow-hidden shadow-2xs">
        <div className="px-4 py-2.5 bg-[#FAF8F5] border-b border-[#E7E5E4] flex items-center justify-between text-xs font-semibold text-[#1C1917]">
          <div className="flex items-center gap-1.5">
            <ShoppingBag className="w-4 h-4 text-[#E05A47]" />
            <span>Actionable Bill of Materials ({filteredChecklist.length} items)</span>
          </div>
          <span className="text-[11px] text-[#78716C] font-normal">
            Click "+ Sync to Plan" to add to Budget & Timeline, or click again to remove.
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#E7E5E4] text-[11px] font-semibold text-[#78716C] uppercase tracking-wider bg-[#FAF8F5]/50">
                <th className="py-2.5 px-4">Rental / Purchase Spec</th>
                <th className="py-2.5 px-3">Sub-Function</th>
                <th className="py-2.5 px-4">Exact Quantity & Sizing</th>
                <th className="py-2.5 px-4 text-right">Est. Price (₹)</th>
                <th className="py-2.5 px-4 text-right">Synchronization Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F5F2EC] text-xs">
              {filteredChecklist.map((item) => (
                <tr key={item.id} className="hover:bg-[#FAF8F5] transition-colors">
                  <td className="py-3 px-4 font-medium text-[#1C1917]">
                    {item.itemName}
                  </td>
                  <td className="py-3 px-3">
                    <span className="text-[11px] font-medium text-[#58413D] bg-[#F5F2EC] px-2 py-0.5 rounded-sm">
                      {item.subFunction}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-[#58413D]">
                    {item.quantityOrSpec}
                  </td>
                  <td className="py-3 px-4 text-right font-mono-numbers tabular-nums font-semibold text-[#1C1917]">
                    {formatINR(item.estimatedCost)}
                  </td>
                  <td className="py-3 px-4 text-right">
                    {item.syncedToBudget ? (
                      <button
                        onClick={() => handleToggleSync(item)}
                        disabled={syncingId === item.id}
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-800 bg-emerald-50 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-300 px-2 py-1 rounded-md border border-emerald-200 transition-colors cursor-pointer group shadow-2xs"
                        title="Click to remove synced item from Budget & Timeline"
                      >
                        <Check className="w-3.5 h-3.5 text-[#16A34A] group-hover:hidden" />
                        <X className="w-3.5 h-3.5 text-rose-600 hidden group-hover:inline" />
                        <span className="group-hover:hidden">Synced to Plan</span>
                        <span className="hidden group-hover:inline font-semibold">Remove from Budget</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => handleToggleSync(item)}
                        disabled={syncingId === item.id}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-white bg-[#E05A47] hover:bg-[#D04B38] px-2.5 py-1 rounded-md transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Sync to Plan</span>
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
