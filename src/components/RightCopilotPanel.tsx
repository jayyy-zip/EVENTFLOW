import React, { useState } from 'react';
import { useEventContext } from '../context/EventContext';
import { formatINR } from '../utils/formatters';
import {
  Sparkles,
  Send,
  Check,
  RotateCcw,
  TrendingDown,
  TrendingUp,
  Clock,
  PlusCircle,
  HelpCircle,
  Bot,
} from 'lucide-react';

export const RightCopilotPanel: React.FC = () => {
  const {
    activeEvent,
    proposedMutations,
    isThinking,
    sendCopilotCommand,
    applyMutation,
    revertMutation,
  } = useEventContext();

  const [promptText, setPromptText] = useState('');

  const testPrompts = [
    {
      title: 'Test 1: Decor-to-DJ Shift',
      text: 'Cut the floral budget by 20% and move it to the DJ, and shift the Sangeet start time by 1 hour.',
    },
    {
      title: 'Test 2: Guest Jump & Cap Lock',
      text: 'Our guest count just jumped from 250 to 320, and we still have not booked the venue. Keep the total budget locked at ₹12,00,000 by trimming non-essential decor and photography extras, and update the timeline risk status.',
    },
    {
      title: 'Test 3: Contingency Recalibration',
      text: 'Audit our overall event plan for Pune local benchmark risk and increase emergency buffer reserve to 10%.',
    },
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!promptText.trim() || isThinking) return;
    sendCopilotCommand(promptText);
    setPromptText('');
  };

  return (
    <aside className="w-96 bg-white border-l border-[#E7E5E4] flex flex-col justify-between shrink-0 h-full overflow-hidden">
      {/* Copilot Header */}
      <div className="p-4 border-b border-[#E7E5E4] bg-[#FAF8F5] space-y-2 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-[#4F46E5] flex items-center justify-center text-white shadow-2xs">
              <Sparkles className="w-3.5 h-3.5" />
            </div>
            <h3 className="font-display text-xs font-bold text-[#1C1917] tracking-tight">
              Stateful AI Copilot
            </h3>
          </div>
          <span className="text-[10px] font-semibold text-[#4F46E5] bg-[#EEF2FF] border border-[#C7D2FE] px-2 py-0.5 rounded-full">
            gemini-3.8-flash
          </span>
        </div>

        {/* Live Context Pill */}
        <div className="text-[11px] text-[#58413D] flex items-center gap-1.5 font-medium truncate">
          <span>{activeEvent.name}</span>
          <span>·</span>
          <span>{activeEvent.guestCount} guests</span>
          <span>·</span>
          <span>{formatINR(activeEvent.totalBudget, true)}</span>
        </div>
      </div>

      {/* Chat & Mutation Cards Stream */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Intro Message */}
        <div className="bg-[#FAF8F5] border border-[#E7E5E4] rounded-lg p-3 text-xs space-y-1.5 text-[#58413D]">
          <div className="flex items-center gap-1.5 font-semibold text-[#1C1917]">
            <Bot className="w-4 h-4 text-[#4F46E5]" />
            <span>State-Authoritative Assistant</span>
          </div>
          <p className="leading-relaxed">
            I don&apos;t just chat—I directly compile your natural-language directions into state mutations
            across your Budget, DAG Timeline, and Checklists.
          </p>
        </div>

        {/* Quick Scenario Test Chips */}
        <div className="space-y-1.5">
          <span className="text-[10px] font-semibold text-[#78716C] uppercase tracking-wider block">
            Click to Run Test Scenarios
          </span>
          <div className="space-y-1.5">
            {testPrompts.map((tp, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setPromptText(tp.text);
                  sendCopilotCommand(tp.text);
                }}
                disabled={isThinking}
                className="w-full text-left p-2 rounded-md bg-[#FAF8F5] border border-[#E7E5E4] hover:border-[#4F46E5] text-[11px] text-[#1C1917] transition-all disabled:opacity-50"
              >
                <div className="font-semibold text-[#E05A47] flex items-center justify-between">
                  <span>{tp.title}</span>
                  <span className="text-[10px] text-[#78716C]">Run →</span>
                </div>
                <div className="text-[#58413D] line-clamp-2 mt-0.5">{tp.text}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Thinking Indicator */}
        {isThinking && (
          <div className="p-3 bg-indigo-50/50 border border-indigo-100 rounded-lg flex items-center gap-2 text-xs text-[#4F46E5] animate-pulse">
            <Sparkles className="w-4 h-4 text-[#4F46E5]" />
            <span>Reasoning over current event state & computing diffs...</span>
          </div>
        )}

        {/* Proposed Plan Mutation Cards */}
        {proposedMutations.map((mutation) => (
          <div
            key={mutation.id}
            className={`border rounded-xl p-3.5 space-y-3 transition-all shadow-xs ${
              mutation.applied
                ? 'bg-emerald-50/30 border-emerald-200'
                : 'bg-white border-[#4F46E5]/40 ring-1 ring-[#4F46E5]/20'
            }`}
          >
            {/* User Prompt Echo */}
            <div className="text-[11px] text-[#78716C] italic border-b border-[#E7E5E4] pb-1.5">
              &quot;{mutation.userPrompt}&quot;
            </div>

            {/* AI Assistant Rationale */}
            <div className="text-xs text-[#1C1917] font-medium leading-relaxed">
              {mutation.assistantReply}
            </div>

            {/* Proposed Plan Mutation Card Header */}
            <div className="pt-1 text-[11px] font-semibold text-[#4F46E5] uppercase tracking-wider flex items-center justify-between">
              <span>Proposed Plan Mutation Card</span>
              {mutation.readinessScoreDelta !== 0 && (
                <span className="text-[10px] text-[#16A34A] font-mono-numbers">
                  {mutation.readinessScoreDelta > 0
                    ? `+${mutation.readinessScoreDelta}% Readiness`
                    : `${mutation.readinessScoreDelta}% Readiness`}
                </span>
              )}
            </div>

            {/* Diff Rows */}
            <div className="space-y-1.5 text-xs">
              {/* Budget Diffs */}
              {mutation.budgetDiffs.map((bd, i) => {
                const delta = bd.newAmount - bd.previousAmount;
                return (
                  <div
                    key={i}
                    className="p-1.5 rounded bg-[#FAF8F5] border border-[#E7E5E4] flex items-center justify-between font-mono-numbers text-[11px]"
                  >
                    <div className="truncate max-w-[170px]">
                      <span className="font-semibold text-[#1C1917]">{bd.category}: </span>
                      <span className="text-[#58413D]">{bd.name}</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[#78716C] line-through">
                        {formatINR(bd.previousAmount, true)}
                      </span>
                      <span>→</span>
                      <span className="font-bold text-[#1C1917]">
                        {formatINR(bd.newAmount, true)}
                      </span>
                      <span
                        className={`text-[10px] font-bold ${
                          delta > 0 ? 'text-[#16A34A]' : 'text-rose-600'
                        }`}
                      >
                        ({delta > 0 ? `+${formatINR(delta, true)}` : `-${formatINR(Math.abs(delta), true)}`})
                      </span>
                    </div>
                  </div>
                );
              })}

              {/* Timeline Diffs */}
              {mutation.timelineDiffs.map((td, i) => (
                <div
                  key={i}
                  className="p-1.5 rounded bg-amber-50/50 border border-amber-200 text-[11px] text-amber-900 space-y-0.5"
                >
                  <div className="font-semibold truncate">{td.title}</div>
                  <div className="text-[10px] text-amber-800 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-amber-600" />
                    <span>Status: {td.newStatus} · {td.reason}</span>
                  </div>
                </div>
              ))}

              {/* Checklist Additions */}
              {mutation.checklistAdditions.map((ca, i) => (
                <div
                  key={i}
                  className="p-1.5 rounded bg-emerald-50/50 border border-emerald-200 text-[11px] text-emerald-900 flex items-center justify-between"
                >
                  <span className="truncate">+ {ca.itemName}</span>
                  <span className="font-mono-numbers font-semibold shrink-0">
                    {formatINR(ca.estimatedCost, true)}
                  </span>
                </div>
              ))}
            </div>

            {/* Mutation Action CTA Button */}
            <div className="pt-2 border-t border-[#E7E5E4] flex items-center justify-end gap-2">
              {mutation.applied ? (
                <div className="flex items-center justify-between w-full">
                  <span className="text-[11px] font-semibold text-[#16A34A] flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" /> Applied to Active State
                  </span>
                  <button
                    onClick={() => revertMutation(mutation.id)}
                    className="text-[11px] font-medium text-[#78716C] hover:text-[#DC2626] flex items-center gap-1 py-1 px-2 rounded hover:bg-stone-100"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Revert</span>
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => applyMutation(mutation.id)}
                  className="w-full py-2 text-xs font-semibold text-white bg-[#4F46E5] hover:bg-[#4338CA] active:bg-[#3730A3] rounded-md transition-colors flex items-center justify-center gap-1.5 shadow-xs"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Apply Changes to Plan</span>
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Input Box */}
      <form onSubmit={handleSubmit} className="p-3 border-t border-[#E7E5E4] bg-white space-y-2 shrink-0">
        <div className="relative">
          <input
            type="text"
            value={promptText}
            onChange={(e) => setPromptText(e.target.value)}
            placeholder="Instruct Copilot (e.g. 'Cut decor by 20% and shift Sangeet')..."
            disabled={isThinking}
            className="w-full pl-3 pr-10 py-2 bg-[#FAF8F5] border border-[#E7E5E4] rounded-lg text-xs placeholder:text-[#A8A29E] outline-none focus:border-[#4F46E5] focus:bg-white transition-colors"
          />
          <button
            type="submit"
            disabled={!promptText.trim() || isThinking}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 text-white bg-[#4F46E5] hover:bg-[#4338CA] disabled:opacity-40 rounded-md transition-colors"
          >
            <Send className="w-3 h-3" />
          </button>
        </div>
        <div className="text-[10px] text-[#A8A29E] text-center">
          Commands emit structured diffs for your review before applying.
        </div>
      </form>
    </aside>
  );
};
