import React, { useState } from 'react';
import { useEventContext } from '../../context/EventContext';
import { TimelineTask, TaskStatus } from '../../types/event';
import { getTaskStatusBadgeClass, sanitizeNumber } from '../../utils/eventMath';
import {
  AlertTriangle,
  GitBranch,
  Plus,
  Sparkles,
  X,
  Clock,
  Bot,
} from 'lucide-react';

export const AdaptiveTimeline: React.FC = () => {
  const {
    activeEvent,
    activeSubFunction,
    updateTimelineTask,
    addTimelineTask,
    autoCompressSchedule,
    sendCopilotCommand,
    setActiveTab,
    lastMutatedIds,
  } = useEventContext();

  const [showAddModal, setShowAddModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newSubFunction, setNewSubFunction] = useState(
    activeSubFunction === 'All Functions' ? activeEvent.subFunctions[1] || 'Main Ceremony' : activeSubFunction
  );
  const [newDaysBefore, setNewDaysBefore] = useState(20);
  const [newDuration, setNewDuration] = useState(3);
  const [newDependsOn, setNewDependsOn] = useState<string[]>([]);
  const [newOwner, setNewOwner] = useState('Host / Coordinator');

  const filteredTasks = activeEvent.timelineTasks.filter(
    (t) => activeSubFunction === 'All Functions' || t.subFunction === activeSubFunction || t.subFunction === 'All Functions'
  );

  // Group tasks by phase
  const phases = [
    { key: 'T-60_TO_30', label: 'T-60 to T-30 Days: Core Contracts & Foundations' },
    { key: 'T-30_TO_15', label: 'T-30 to T-15 Days: Design & Vendor Lock-in' },
    { key: 'T-15_TO_7', label: 'T-15 to T-7 Days: Rehearsals & Final Sizing' },
    { key: 'WEEK_OF_EVENT', label: 'Week of Event: Setup & Physical Delivery' },
    { key: 'RUN_OF_SHOW', label: 'Event Day: Run-of-Show Minute-by-Minute' },
  ];

  const handleStatusChange = (task: TimelineTask, newStatus: TaskStatus) => {
    updateTimelineTask({
      ...task,
      status: newStatus,
      slippageDays: newStatus === 'DELAYED' ? Math.max(task.slippageDays || 5, 5) : 0,
    });
  };

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const days = Math.max(0, sanitizeNumber(newDaysBefore, 20));
    const duration = Math.max(1, sanitizeNumber(newDuration, 3));

    let phase: TimelineTask['phase'] = 'T-15_TO_7';
    if (days >= 30) phase = 'T-60_TO_30';
    else if (days >= 15) phase = 'T-30_TO_15';
    else if (days >= 7) phase = 'T-15_TO_7';
    else if (days > 0) phase = 'WEEK_OF_EVENT';
    else phase = 'RUN_OF_SHOW';

    addTimelineTask({
      title: newTitle.trim(),
      subFunction: newSubFunction,
      phase,
      daysBeforeEvent: days,
      durationDays: duration,
      slippageDays: 0,
      status: 'ON_TRACK',
      dependsOnIds: newDependsOn,
      owner: newOwner.trim() || 'Coordinator',
      notes: 'Added from planner console',
    });

    setNewTitle('');
    setNewDependsOn([]);
    setShowAddModal(false);
  };

  const atRiskCount = filteredTasks.filter(
    (t) => t.status === 'AT_RISK_DEPENDENCY' || t.status === 'DELAYED'
  ).length;

  return (
    <div className="space-y-4">
      {/* Header with Auto-Compress Trigger */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-2 border-b border-[#E7E5E4]">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-display text-base font-semibold text-[#1C1917]">
              Adaptive Dependency Timeline
            </h2>
            {atRiskCount > 0 && (
              <span className="text-[11px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full flex items-center gap-1 font-mono-numbers tabular-nums">
                <AlertTriangle className="w-3 h-3 text-amber-600" />
                <span>{atRiskCount} tasks at risk</span>
              </span>
            )}
          </div>
          <p className="text-xs text-[#78716C]">
            Backward scheduling DAG engine with self-healing cascades and circular dependency prevention.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {atRiskCount > 0 && (
            <button
              onClick={autoCompressSchedule}
              className="px-3 py-1.5 text-xs font-semibold text-[#4F46E5] bg-[#EEF2FF] border border-[#C7D2FE] hover:bg-[#E0E7FF] rounded-md transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
              title="Parallelize tasks to eliminate delay bottlenecks"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#4F46E5]" />
              <span>Auto-Compress Schedule</span>
            </button>
          )}

          <button
            onClick={() => setShowAddModal(true)}
            className="px-3 py-1.5 text-xs font-semibold text-white bg-[#E05A47] hover:bg-[#D04B38] rounded-md transition-colors flex items-center gap-1.5 shrink-0 shadow-2xs cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Task</span>
          </button>
        </div>
      </div>

      {/* Timeline Phases */}
      <div className="space-y-5">
        {phases.map((phase) => {
          const phaseTasks = filteredTasks.filter((t) => t.phase === phase.key);
          if (phaseTasks.length === 0) return null;

          return (
            <div key={phase.key} className="space-y-2">
              <div className="text-[11px] font-semibold text-[#78716C] uppercase tracking-wider flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#E05A47]" />
                <span>{phase.label}</span>
                <span className="text-[10px] text-[#A8A29E] font-normal font-mono-numbers tabular-nums">
                  ({phaseTasks.length} tasks)
                </span>
              </div>

              <div className="grid grid-cols-1 gap-2.5">
                {phaseTasks.map((task) => {
                  const parentTasks = activeEvent.timelineTasks.filter((t) =>
                    (task.dependsOnIds || []).includes(t.id)
                  );

                  return (
                    <div
                      key={task.id}
                      className={`p-3.5 rounded-lg border transition-all ${
                        lastMutatedIds.has(task.id)
                          ? 'ring-2 ring-[#4F46E5] animate-pulse bg-indigo-50/70 border-indigo-300'
                          : task.status === 'DELAYED'
                          ? 'bg-rose-50/40 border-rose-200'
                          : task.status === 'AT_RISK_DEPENDENCY'
                          ? 'bg-amber-50/40 border-amber-200'
                          : task.status === 'COMPLETED'
                          ? 'bg-white border-[#E7E5E4] opacity-80'
                          : 'bg-white border-[#E7E5E4] hover:border-[#D6D3D1]'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                        {/* Task Title & Owner */}
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-[#1C1917]">
                              {task.title}
                            </span>
                            <span className="text-[10px] font-medium text-[#78716C] bg-[#FAF8F5] border border-[#E7E5E4] px-1.5 py-0.5 rounded-sm">
                              {task.subFunction}
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 text-[11px] text-[#78716C]">
                            <span className="font-mono-numbers tabular-nums font-medium text-[#1C1917]">
                              T-{task.daysBeforeEvent}d
                            </span>
                            <span>·</span>
                            <span>Owner: {task.owner}</span>
                            <span>·</span>
                            <span className="font-mono-numbers tabular-nums">Duration: {task.durationDays}d</span>
                            {task.slippageDays > 0 && (
                              <>
                                <span>·</span>
                                <span className="text-rose-700 font-medium font-mono-numbers tabular-nums">
                                  +{task.slippageDays}d slippage
                                </span>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Interactive Status Selector */}
                        <div className="flex items-center gap-2 shrink-0">
                          <select
                            value={task.status}
                            onChange={(e) =>
                              handleStatusChange(task, e.target.value as TaskStatus)
                            }
                            className={`text-xs font-medium px-2 py-1 rounded-md border outline-none cursor-pointer ${getTaskStatusBadgeClass(
                              task.status
                            )}`}
                          >
                            <option value="ON_TRACK">ON TRACK</option>
                            <option value="DELAYED">DELAYED (+5d)</option>
                            <option value="AT_RISK_DEPENDENCY">AT RISK (Upstream)</option>
                            <option value="COMPLETED">COMPLETED ✓</option>
                          </select>

                          {/* Tab 2 → Copilot: Ask AI to Resolve Bottleneck */}
                          {(task.status === 'DELAYED' || task.status === 'AT_RISK_DEPENDENCY') && (
                            <button
                              onClick={() => {
                                const contextPrompt = `Task "${task.title}" in ${task.subFunction} is ${task.status}${task.slippageDays > 0 ? ` with ${task.slippageDays}d slippage` : ''}. Compress downstream lead times or reallocate budget for express vendor fulfillment to resolve this bottleneck and restore the timeline.`;
                                sendCopilotCommand(contextPrompt);
                                // Switch focus to copilot panel via a custom event
                                window.dispatchEvent(new CustomEvent('eventflow:focus-copilot'));
                              }}
                              className="px-2 py-1 text-[11px] font-semibold text-[#4F46E5] bg-[#EEF2FF] border border-[#C7D2FE] hover:bg-[#E0E7FF] rounded-md transition-colors flex items-center gap-1 cursor-pointer shrink-0"
                              title="Ask AI Copilot to resolve this bottleneck"
                            >
                              <Bot className="w-3 h-3" />
                              <span>Ask AI</span>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Parent Dependencies & Cascade Explanation */}
                      {(parentTasks.length > 0 || task.status === 'AT_RISK_DEPENDENCY') && (
                        <div className="mt-2.5 pt-2 border-t border-[#F5F2EC] flex flex-wrap items-center gap-2 text-[11px]">
                          {parentTasks.length > 0 && (
                            <div className="flex items-center gap-1 text-[#78716C]">
                              <GitBranch className="w-3 h-3 text-[#78716C]" />
                              <span>Depends on:</span>
                              {parentTasks.map((p) => (
                                <span
                                  key={p.id}
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                    p.status === 'DELAYED'
                                      ? 'bg-rose-100 text-rose-800'
                                      : p.status === 'AT_RISK_DEPENDENCY'
                                      ? 'bg-amber-100 text-amber-800'
                                      : 'bg-[#F5F2EC] text-[#58413D]'
                                  }`}
                                >
                                  {p.title}
                                </span>
                              ))}
                            </div>
                          )}

                          {task.status === 'AT_RISK_DEPENDENCY' && (
                            <div className="text-amber-800 font-medium flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" />
                              <span>Upstream parent milestone delayed. Timeline window compressed.</span>
                            </div>
                          )}
                        </div>
                      )}

                      {task.notes && (
                        <div className="mt-1 text-[11px] text-[#78716C] italic">
                          {task.notes}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Task Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-[#E7E5E4] rounded-xl shadow-xl w-full max-w-md p-5 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#E7E5E4]">
              <h3 className="font-display font-semibold text-[#1C1917] text-sm">
                Add Timeline Milestone
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-[#78716C] hover:text-[#1C1917] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="space-y-3 text-xs">
              <div>
                <label className="block text-[#58413D] font-medium mb-1">Task Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Choreography Rehearsal dry-run"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-3 py-1.5 border border-[#E7E5E4] rounded-md focus:border-[#E05A47] outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
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

                <div>
                  <label className="block text-[#58413D] font-medium mb-1">Owner</label>
                  <input
                    type="text"
                    value={newOwner}
                    onChange={(e) => setNewOwner(e.target.value)}
                    className="w-full px-3 py-1.5 border border-[#E7E5E4] rounded-md focus:border-[#E05A47] outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#58413D] font-medium mb-1">
                    Days Before Event (T-Minus)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={newDaysBefore}
                    onChange={(e) => setNewDaysBefore(Math.max(0, sanitizeNumber(e.target.value, 0)))}
                    className="w-full px-3 py-1.5 border border-[#E7E5E4] rounded-md focus:border-[#E05A47] outline-none font-mono-numbers tabular-nums"
                  />
                </div>

                <div>
                  <label className="block text-[#58413D] font-medium mb-1">
                    Duration (Days)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={newDuration}
                    onChange={(e) => setNewDuration(Math.max(1, sanitizeNumber(e.target.value, 1)))}
                    className="w-full px-3 py-1.5 border border-[#E7E5E4] rounded-md focus:border-[#E05A47] outline-none font-mono-numbers tabular-nums"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[#58413D] font-medium mb-1">
                  Depends On (Parent Tasks)
                </label>
                <div className="max-h-28 overflow-y-auto border border-[#E7E5E4] rounded-md p-2 space-y-1 bg-[#FAF8F5]">
                  {activeEvent.timelineTasks.map((t) => (
                    <label
                      key={t.id}
                      className="flex items-center gap-2 cursor-pointer text-[#58413D] hover:text-[#1C1917]"
                    >
                      <input
                        type="checkbox"
                        checked={newDependsOn.includes(t.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setNewDependsOn([...newDependsOn, t.id]);
                          } else {
                            setNewDependsOn(newDependsOn.filter((id) => id !== t.id));
                          }
                        }}
                        className="rounded accent-[#E05A47]"
                      />
                      <span className="truncate font-mono-numbers tabular-nums">{t.title} (T-{t.daysBeforeEvent}d)</span>
                    </label>
                  ))}
                </div>
              </div>

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
                  Create Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
