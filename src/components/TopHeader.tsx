import React, { useState } from 'react';
import { useEventContext } from '../context/EventContext';
import { Sparkles, Plus, Calendar, MapPin, Users, RotateCcw } from 'lucide-react';
import { formatINR } from '../utils/formatters';

interface TopHeaderProps {
  onOpenNewEventModal: () => void;
}

export const TopHeader: React.FC<TopHeaderProps> = ({ onOpenNewEventModal }) => {
  const {
    events,
    activeEvent,
    switchEvent,
    activeSubFunction,
    setActiveSubFunction,
    resetToDefaultEvents,
  } = useEventContext();

  const [showEventDropdown, setShowEventDropdown] = useState(false);

  return (
    <header className="h-16 px-6 bg-white border-b border-[#E7E5E4] flex items-center justify-between gap-8 z-30 shrink-0">
      {/* Zone 1: Single text element wordmark with active event breadcrumb */}
      <div className="flex items-center gap-4 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#E05A47] flex items-center justify-center text-white font-bold text-sm tracking-tight shadow-xs">
            EF
          </div>
          <span className="font-display text-lg font-bold tracking-tight text-[#1C1917] whitespace-nowrap">
            EventFlow<span className="text-[#4F46E5] ml-0.5">AI</span>
          </span>
        </div>

        <span className="text-[#A8A29E] font-light" aria-hidden="true">/</span>

        {/* Event Switcher Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowEventDropdown(!showEventDropdown)}
            className="flex items-center gap-2 px-2.5 py-1.5 text-xs font-semibold text-[#1C1917] bg-[#FAF8F5] border border-[#E7E5E4] rounded-md hover:border-[#D6D3D1] transition-colors whitespace-nowrap"
          >
            <span className="w-2 h-2 rounded-full bg-[#E05A47]" />
            <span className="max-w-[220px] truncate">{activeEvent.name}</span>
            <span className="text-[#78716C] text-[10px]">▼</span>
          </button>

          {showEventDropdown && (
            <div className="absolute top-full left-0 mt-1 w-72 bg-white border border-[#E7E5E4] rounded-lg shadow-lg p-1.5 z-50">
              <div className="px-2 py-1 text-[11px] font-semibold text-[#78716C] uppercase tracking-wider">
                Select Active Event
              </div>
              {events.map((evt) => (
                <button
                  key={evt.id}
                  onClick={() => {
                    switchEvent(evt.id);
                    setShowEventDropdown(false);
                  }}
                  className={`w-full text-left px-2.5 py-2 rounded-md text-xs flex flex-col gap-0.5 transition-colors ${
                    evt.id === activeEvent.id
                      ? 'bg-[#FAF8F5] text-[#1C1917] font-medium border border-[#E7E5E4]'
                      : 'text-[#58413D] hover:bg-[#FAF8F5]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-[#1C1917] truncate">{evt.name}</span>
                    <span className="text-[10px] text-[#78716C] font-mono-numbers">
                      {formatINR(evt.totalBudget, true)}
                    </span>
                  </div>
                  <div className="text-[11px] text-[#78716C] flex items-center gap-1.5">
                    <span>{evt.type.replace('_', ' ')}</span>
                    <span>·</span>
                    <span>{evt.guestCount} guests</span>
                    <span>·</span>
                    <span>T-{evt.daysRemaining}d</span>
                  </div>
                </button>
              ))}

              <div className="border-t border-[#E7E5E4] mt-1 pt-1 flex items-center justify-between px-1">
                <button
                  onClick={() => {
                    setShowEventDropdown(false);
                    onOpenNewEventModal();
                  }}
                  className="text-xs text-[#E05A47] hover:text-[#D04B38] font-medium py-1 px-1.5 flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" />
                  <span>Create New Event</span>
                </button>

                <button
                  onClick={() => {
                    resetToDefaultEvents();
                    setShowEventDropdown(false);
                  }}
                  title="Reset to 3 demo presets"
                  className="text-[11px] text-[#78716C] hover:text-[#1C1917] flex items-center gap-1 py-1 px-1.5"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset Demo</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Zone 2: Sub-Function Segmented Filter Tabs */}
      <div className="hidden lg:flex items-center gap-1.5 p-1 bg-[#F5F2EC] border border-[#E7E5E4] rounded-lg shrink-0">
        {activeEvent.subFunctions.map((subFunc) => {
          const isActive = activeSubFunction === subFunc;
          return (
            <button
              key={subFunc}
              onClick={() => setActiveSubFunction(subFunc)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                isActive
                  ? 'bg-white text-[#1C1917] shadow-xs font-semibold'
                  : 'text-[#78716C] hover:text-[#1C1917]'
              }`}
            >
              {subFunc}
            </button>
          );
        })}
      </div>

      {/* Zone 3: Readiness Score & 1 Primary Action */}
      <div className="flex items-center gap-4 shrink-0">
        <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 bg-white border border-[#E7E5E4] rounded-md">
          <div className="flex flex-col text-right">
            <span className="text-[10px] text-[#78716C] uppercase font-semibold">Readiness</span>
            <span className="text-xs font-semibold text-[#1C1917] font-mono-numbers">
              {activeEvent.readinessScore}%
            </span>
          </div>
          <div className="w-6 h-6 rounded-full border-2 border-[#E7E5E4] relative flex items-center justify-center">
            <div
              className="absolute inset-0 rounded-full border-2 border-[#16A34A]"
              style={{
                clipPath: `polygon(50% 50%, 50% 0%, ${
                  activeEvent.readinessScore > 50 ? '100% 0%, 100% 100%, 0% 100%, 0% 0%' : '100% 0%, 100% 100%'
                }, 50% 50%)`,
              }}
            />
          </div>
        </div>

        <button
          onClick={onOpenNewEventModal}
          className="px-3.5 py-1.5 text-xs font-semibold text-white bg-[#E05A47] hover:bg-[#D04B38] active:bg-[#BA3E2C] rounded-md transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 shadow-xs"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Event</span>
        </button>
      </div>
    </header>
  );
};
