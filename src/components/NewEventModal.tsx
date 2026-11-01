import React, { useState } from 'react';
import { useEventContext } from '../context/EventContext';
import { EventType } from '../types/event';
import { X } from 'lucide-react';
import { sanitizeNumber, clamp } from '../utils/eventMath';

interface NewEventModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NewEventModal: React.FC<NewEventModalProps> = ({ isOpen, onClose }) => {
  const { createNewEvent } = useEventContext();

  const [name, setName] = useState('');
  const [type, setType] = useState<EventType>('WEDDING');
  const [location, setLocation] = useState('Pune, Maharashtra');
  const [eventDate, setEventDate] = useState('2026-12-15');
  const [daysRemaining, setDaysRemaining] = useState(45);
  const [guestCount, setGuestCount] = useState(200);
  const [totalBudget, setTotalBudget] = useState(1000000);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const safeGuestCount = clamp(sanitizeNumber(guestCount, 200), 20, 2000);
    const safeTotalBudget = Math.max(10000, sanitizeNumber(totalBudget, 1000000));
    const safeDays = Math.max(0, sanitizeNumber(daysRemaining, 45));

    createNewEvent({
      name: name.trim(),
      type,
      location: location.trim() || 'Pune, Maharashtra',
      eventDate,
      daysRemaining: safeDays,
      guestCount: safeGuestCount,
      totalBudget: safeTotalBudget,
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-white border border-[#E7E5E4] rounded-xl shadow-xl w-full max-w-lg p-6 space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-[#E7E5E4]">
          <h3 className="font-display font-semibold text-[#1C1917] text-base">
            Create New Event Blueprint
          </h3>
          <button onClick={onClose} className="text-[#78716C] hover:text-[#1C1917] cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          <div>
            <label className="block text-[#58413D] font-medium mb-1">Event Title</label>
            <input
              type="text"
              required
              placeholder="e.g. Maya & Siddharth Destination Sangeet"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-[#E7E5E4] rounded-md focus:border-[#E05A47] outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[#58413D] font-medium mb-1">Event Archetype</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as EventType)}
                className="w-full px-2.5 py-2 border border-[#E7E5E4] rounded-md focus:border-[#E05A47] outline-none bg-white"
              >
                <option value="WEDDING">Wedding (Multi-Day Functions)</option>
                <option value="BIRTHDAY">Milestone Birthday / Social</option>
                <option value="COMMUNITY_EVENT">Campus / Community Fest</option>
              </select>
            </div>

            <div>
              <label className="block text-[#58413D] font-medium mb-1">City / Location</label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Pune, Koregaon Park"
                className="w-full px-3 py-2 border border-[#E7E5E4] rounded-md focus:border-[#E05A47] outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[#58413D] font-medium mb-1">Target Event Date</label>
              <input
                type="date"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
                className="w-full px-3 py-2 border border-[#E7E5E4] rounded-md focus:border-[#E05A47] outline-none font-mono-numbers tabular-nums"
              />
            </div>

            <div>
              <label className="block text-[#58413D] font-medium mb-1">Days Countdown (T-Minus)</label>
              <input
                type="number"
                min="0"
                value={daysRemaining}
                onChange={(e) => setDaysRemaining(Math.max(0, sanitizeNumber(e.target.value, 0)))}
                className="w-full px-3 py-2 border border-[#E7E5E4] rounded-md focus:border-[#E05A47] outline-none font-mono-numbers tabular-nums"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[#58413D] font-medium mb-1">Expected Guests (20 - 2,000)</label>
              <input
                type="number"
                min="20"
                max="2000"
                value={guestCount}
                onChange={(e) => setGuestCount(clamp(sanitizeNumber(e.target.value, 200), 20, 2000))}
                className="w-full px-3 py-2 border border-[#E7E5E4] rounded-md focus:border-[#E05A47] outline-none font-mono-numbers tabular-nums"
              />
            </div>

            <div>
              <label className="block text-[#58413D] font-medium mb-1">Total Target Budget (₹)</label>
              <input
                type="number"
                min="10000"
                step="50000"
                value={totalBudget}
                onChange={(e) => setTotalBudget(Math.max(10000, sanitizeNumber(e.target.value, 10000)))}
                className="w-full px-3 py-2 border border-[#E7E5E4] rounded-md focus:border-[#E05A47] outline-none font-mono-numbers tabular-nums"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-[#E7E5E4]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs text-[#78716C] hover:text-[#1C1917] cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-semibold text-white bg-[#E05A47] hover:bg-[#D04B38] rounded-md shadow-xs transition-colors cursor-pointer"
            >
              Initialize Event
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
