import React, { useState } from 'react';
import { useEventContext } from '../../context/EventContext';
import { BudgetItem, CostType } from '../../types/event';
import { formatINR, sanitizeNumber, getCostTypeBadgeClass } from '../../utils/eventMath';
import { AlertTriangle, Plus, Trash2, Edit3, Check, X, ShieldCheck, Lock, Sparkles } from 'lucide-react';

export const SmartBudgetArchitect: React.FC = () => {
  const {
    activeEvent,
    activeSubFunction,
    updateBudgetItem,
    addBudgetItem,
    deleteBudgetItem,
    lastMutatedIds,
  } = useEventContext();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState<number>(0);
  const [showAddModal, setShowAddModal] = useState(false);

  // New item form state
  const [newCategory, setNewCategory] = useState('Decor & Florals');
  const [newName, setNewName] = useState('');
  const [newSubFunction, setNewSubFunction] = useState(
    activeSubFunction === 'All Functions' ? activeEvent.subFunctions[1] || 'Main Ceremony' : activeSubFunction
  );
  const [newCostType, setNewCostType] = useState<CostType>('FIXED');
  const [newBaseCost, setNewBaseCost] = useState(50000);
  const [newPerGuestRate, setNewPerGuestRate] = useState(250);

  const filteredItems = activeEvent.budgetItems.filter(
    (b) => activeSubFunction === 'All Functions' || b.subFunction === activeSubFunction || b.subFunction === 'All Functions'
  );

  const startEdit = (item: BudgetItem) => {
    setEditingId(item.id);
    setEditAmount(item.allocatedAmount);
  };

  const saveEdit = (item: BudgetItem) => {
    // Robust validation: prevent NaN, negative, or infinite values
    const safeAmount = Math.max(0, sanitizeNumber(editAmount, 0));

    let perGuestRate = item.perGuestRate || 0;
    let baseFixedCost = item.baseFixedCost || 0;

    if (item.costType === 'VARIABLE_PER_GUEST' && activeEvent.guestCount > 0) {
      perGuestRate = Math.round(safeAmount / activeEvent.guestCount);
      baseFixedCost = 0;
    } else if (item.costType === 'HYBRID' && activeEvent.guestCount > 0) {
      if (safeAmount >= baseFixedCost) {
        perGuestRate = Math.round((safeAmount - baseFixedCost) / activeEvent.guestCount);
      } else {
        baseFixedCost = safeAmount;
        perGuestRate = 0;
      }
    } else if (item.costType === 'FIXED') {
      baseFixedCost = safeAmount;
      perGuestRate = 0;
    }

    updateBudgetItem({
      ...item,
      allocatedAmount: safeAmount,
      baseFixedCost,
      perGuestRate,
    });
    setEditingId(null);
  };

  const handleCreateItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    const safeBaseCost = Math.max(0, sanitizeNumber(newBaseCost, 0));
    const safeRate = Math.max(0, sanitizeNumber(newPerGuestRate, 0));

    let initialAmount = safeBaseCost;
    if (newCostType === 'VARIABLE_PER_GUEST') {
      initialAmount = safeRate * activeEvent.guestCount;
    } else if (newCostType === 'HYBRID') {
      initialAmount = safeBaseCost + safeRate * activeEvent.guestCount;
    }

    addBudgetItem({
      category: newCategory,
      name: newName.trim(),
      subFunction: newSubFunction,
      costType: newCostType,
      baseFixedCost: safeBaseCost,
      perGuestRate: safeRate,
      allocatedAmount: initialAmount,
      notes: `Added manually for ${newSubFunction}`,
    });

    setNewName('');
    setShowAddModal(false);
  };

  const subtotal = filteredItems.reduce((acc, curr) => acc + curr.allocatedAmount, 0);

  return (
    <div className="space-y-4">
      {/* Module Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-2 border-b border-[#E7E5E4]">
        <div>
          <h2 className="font-display text-base font-semibold text-[#1C1917]">
            Smart Budget Architect
          </h2>
          <p className="text-xs text-[#78716C]">
            Live allocation table calibrated for Pune & Tier-1 Indian market benchmarks with auto-scaling rates.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="px-3 py-1.5 text-xs font-semibold text-white bg-[#E05A47] hover:bg-[#D04B38] rounded-md transition-colors flex items-center gap-1.5 shrink-0 shadow-2xs cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Line Item</span>
        </button>
      </div>

      {/* Main Budget Grid Table */}
      <div className="bg-white border border-[#E7E5E4] rounded-lg overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#FAF8F5] border-b border-[#E7E5E4] text-[11px] font-semibold text-[#78716C] uppercase tracking-wider">
                <th className="py-2.5 px-4">Line Item & Category</th>
                <th className="py-2.5 px-3">Sub-Function</th>
                <th className="py-2.5 px-3">Cost Behavior</th>
                <th className="py-2.5 px-3 text-right">Unit / Head Rate</th>
                <th className="py-2.5 px-4 text-right">Allocated (₹)</th>
                <th className="py-2.5 px-3 text-right">% Budget</th>
                <th className="py-2.5 px-4 text-center">Local Benchmark Status</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F5F2EC] text-xs">
              {filteredItems.map((item) => {
                const isEditing = editingId === item.id;
                const pctOfBudget = activeEvent.totalBudget > 0
                  ? ((item.allocatedAmount / activeEvent.totalBudget) * 100).toFixed(1)
                  : '0.0';

                return (
                  <tr
                    key={item.id}
                    className={`hover:bg-[#FAF8F5] transition-colors group ${
                      lastMutatedIds.has(item.id) ? 'animate-pulse bg-indigo-50' : ''
                    }`}
                  >
                    {/* Line Item & Category */}
                    <td className="py-3 px-4">
                      <div className="font-medium text-[#1C1917] flex items-center gap-1.5">
                        <span>{item.name}</span>
                        {item.fromMoodboard && (
                          <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-sm bg-purple-50 text-purple-700 border border-purple-200 shrink-0">
                            From Moodboard
                          </span>
                        )}
                        {item.lockedVendorName && (
                          <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-sm bg-indigo-50 text-indigo-700 border border-indigo-200 shrink-0 flex items-center gap-1">
                            🔒 {item.lockedVendorName}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-[#78716C] flex items-center gap-1">
                        <span>{item.category}</span>
                        {item.notes && (
                          <>
                            <span>·</span>
                            <span className="truncate max-w-[200px]" title={item.notes}>
                              {item.notes}
                            </span>
                          </>
                        )}
                      </div>
                    </td>

                    {/* Sub-Function Tag */}
                    <td className="py-3 px-3">
                      <span className="text-[11px] font-medium text-[#58413D] bg-[#F5F2EC] px-2 py-0.5 rounded-sm whitespace-nowrap">
                        {item.subFunction}
                      </span>
                    </td>

                    {/* Cost Behavior */}
                    <td className="py-3 px-3">
                      <span
                        className={`text-[11px] font-medium px-1.5 py-0.5 rounded-sm whitespace-nowrap ${getCostTypeBadgeClass(
                          item.costType
                        )}`}
                      >
                        {item.costType.replace(/_/g, ' ')}
                      </span>
                    </td>

                    {/* Unit / Head Rate */}
                    <td className="py-3 px-3 text-right font-mono-numbers tabular-nums text-[#58413D] whitespace-nowrap">
                      {item.costType === 'VARIABLE_PER_GUEST' || item.costType === 'HYBRID' ? (
                        <span>₹{item.perGuestRate.toLocaleString('en-IN')}/head</span>
                      ) : (
                        <span className="text-[#A8A29E]">—</span>
                      )}
                    </td>

                    {/* Allocated Amount */}
                    <td className="py-3 px-4 text-right font-mono-numbers tabular-nums font-semibold text-[#1C1917] whitespace-nowrap">
                      {isEditing ? (
                        <div className="flex items-center justify-end gap-1">
                          <input
                            type="number"
                            min="0"
                            value={editAmount}
                            onChange={(e) => setEditAmount(Math.max(0, sanitizeNumber(e.target.value, 0)))}
                            className="w-24 px-1.5 py-0.5 text-xs text-right border border-[#4F46E5] rounded bg-white font-mono-numbers tabular-nums outline-none"
                            autoFocus
                          />
                          <button
                            onClick={() => saveEdit(item)}
                            className="p-1 text-[#16A34A] hover:bg-emerald-50 rounded cursor-pointer"
                            title="Save changes"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="p-1 text-[#78716C] hover:bg-stone-100 rounded cursor-pointer"
                            title="Cancel"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => startEdit(item)}
                          className="hover:underline hover:text-[#4F46E5] cursor-pointer inline-flex items-center gap-1 font-mono-numbers tabular-nums"
                          title="Click to inline edit amount"
                        >
                          <span>{formatINR(item.allocatedAmount)}</span>
                          <Edit3 className="w-2.5 h-2.5 text-[#A8A29E] opacity-0 group-hover:opacity-100" />
                        </button>
                      )}
                    </td>

                    {/* % of Budget */}
                    <td className="py-3 px-3 text-right font-mono-numbers tabular-nums text-[#78716C] whitespace-nowrap">
                      {pctOfBudget}%
                    </td>

                    {/* Local Benchmark Status */}
                    <td className="py-3 px-4 text-center">
                      {item.aiWarning ? (
                        <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-medium text-left">
                          <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" />
                          <span className="truncate max-w-[200px]" title={item.aiWarning}>
                            {item.aiWarning}
                          </span>
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1 text-[#16A34A] text-[11px]">
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>Within Pune Benchmark</span>
                        </div>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-3 text-right">
                      {item.costType !== 'TAX_AND_BUFFER' && (
                        <button
                          onClick={() => deleteBudgetItem(item.id)}
                          className="p-1 text-[#A8A29E] hover:text-[#DC2626] transition-colors rounded cursor-pointer"
                          title="Delete line item"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer Subtotal Strip */}
        <div className="bg-[#FAF8F5] px-4 py-2.5 border-t border-[#E7E5E4] flex items-center justify-between text-xs font-semibold text-[#1C1917]">
          <span>
            {activeSubFunction === 'All Functions'
              ? `Subtotal (${filteredItems.length} line items active)`
              : `Filtered Subtotal: ${activeSubFunction} (${filteredItems.length} items)`}
          </span>
          <span className="font-mono-numbers tabular-nums text-sm text-[#1C1917]">
            {formatINR(subtotal)}
          </span>
        </div>
      </div>

      {/* Add Line Item Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-[#E7E5E4] rounded-xl shadow-xl w-full max-w-md p-5 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#E7E5E4]">
              <h3 className="font-display font-semibold text-[#1C1917] text-sm">
                Add Budget Line Item
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-[#78716C] hover:text-[#1C1917] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateItem} className="space-y-3 text-xs">
              <div>
                <label className="block text-[#58413D] font-medium mb-1">Item Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Vintage Baraat Open Car & Dhol"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full px-3 py-1.5 border border-[#E7E5E4] rounded-md focus:border-[#E05A47] outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#58413D] font-medium mb-1">Category</label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-[#E7E5E4] rounded-md focus:border-[#E05A47] outline-none bg-white"
                  >
                    <option value="Venue & Lawns">Venue & Lawns</option>
                    <option value="Catering & Beverages">Catering & Beverages</option>
                    <option value="Decor & Florals">Decor & Florals</option>
                    <option value="Photography & Film">Photography & Film</option>
                    <option value="Sound, DJ & Licensing">Sound, DJ & Licensing</option>
                    <option value="Favors & Logistics">Favors & Logistics</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[#58413D] font-medium mb-1">Sub-Function</label>
                  <select
                    value={newSubFunction}
                    onChange={(e) => setNewSubFunction(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-[#E7E5E4] rounded-md focus:border-[#E05A47] outline-none bg-white"
                  >
                    {activeEvent.subFunctions.map((sf) => (
                      <option key={sf} value={sf}>
                        {sf}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[#58413D] font-medium mb-1">Cost Behavior</label>
                <select
                  value={newCostType}
                  onChange={(e) => setNewCostType(e.target.value as CostType)}
                  className="w-full px-2.5 py-1.5 border border-[#E7E5E4] rounded-md focus:border-[#E05A47] outline-none bg-white"
                >
                  <option value="FIXED">FIXED (Independent of guest count)</option>
                  <option value="VARIABLE_PER_GUEST">VARIABLE_PER_GUEST (Scales strictly by head)</option>
                  <option value="HYBRID">HYBRID (Base fixed charge + per-guest rate)</option>
                </select>
              </div>

              {newCostType === 'FIXED' && (
                <div>
                  <label className="block text-[#58413D] font-medium mb-1">Allocated Amount (₹)</label>
                  <input
                    type="number"
                    min="0"
                    value={newBaseCost}
                    onChange={(e) => setNewBaseCost(Math.max(0, sanitizeNumber(e.target.value, 0)))}
                    className="w-full px-3 py-1.5 border border-[#E7E5E4] rounded-md focus:border-[#E05A47] outline-none font-mono-numbers tabular-nums"
                  />
                </div>
              )}

              {newCostType === 'VARIABLE_PER_GUEST' && (
                <div>
                  <label className="block text-[#58413D] font-medium mb-1">Rate Per Head (₹)</label>
                  <input
                    type="number"
                    min="0"
                    value={newPerGuestRate}
                    onChange={(e) => setNewPerGuestRate(Math.max(0, sanitizeNumber(e.target.value, 0)))}
                    className="w-full px-3 py-1.5 border border-[#E7E5E4] rounded-md focus:border-[#E05A47] outline-none font-mono-numbers tabular-nums"
                  />
                  <span className="text-[11px] text-[#78716C] mt-1 block font-mono-numbers tabular-nums">
                    Total for {activeEvent.guestCount.toLocaleString('en-IN')} guests: {formatINR(newPerGuestRate * activeEvent.guestCount)}
                  </span>
                </div>
              )}

              {newCostType === 'HYBRID' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[#58413D] font-medium mb-1">Base Fixed (₹)</label>
                    <input
                      type="number"
                      min="0"
                      value={newBaseCost}
                      onChange={(e) => setNewBaseCost(Math.max(0, sanitizeNumber(e.target.value, 0)))}
                      className="w-full px-3 py-1.5 border border-[#E7E5E4] rounded-md focus:border-[#E05A47] outline-none font-mono-numbers tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-[#58413D] font-medium mb-1">Per Guest Rate (₹)</label>
                    <input
                      type="number"
                      min="0"
                      value={newPerGuestRate}
                      onChange={(e) => setNewPerGuestRate(Math.max(0, sanitizeNumber(e.target.value, 0)))}
                      className="w-full px-3 py-1.5 border border-[#E7E5E4] rounded-md focus:border-[#E05A47] outline-none font-mono-numbers tabular-nums"
                    />
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-[#E7E5E4]">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-1.5 text-xs text-[#78716C] hover:text-[#1C1917] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-[#E05A47] hover:bg-[#D04B38] rounded-md cursor-pointer"
                >
                  Save Line Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
