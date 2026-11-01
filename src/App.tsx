import React, { useState } from 'react';
import { EventProvider } from './context/EventContext';
import { TopHeader } from './components/TopHeader';
import { LeftSidebar } from './components/LeftSidebar';
import { CenterCanvas } from './components/CenterCanvas';
import { RightCopilotPanel } from './components/RightCopilotPanel';
import { NewEventModal } from './components/NewEventModal';

export default function App() {
  const [isNewEventModalOpen, setIsNewEventModalOpen] = useState(false);

  return (
    <EventProvider>
      <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#FAF8F5] text-[#1C1917]">
        {/* Top Header - Fixed at top */}
        <TopHeader onOpenNewEventModal={() => setIsNewEventModalOpen(true)} />

        {/* 3-Pane Viewport Locked Workspace */}
        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Left Rail: Navigation, Event Switcher, Buffer Control */}
          <LeftSidebar />

          {/* Center Canvas: Pinned Telemetry Bar & Independently Scrollable Modules */}
          <CenterCanvas />

          {/* Right Dock: Stateful AI Copilot with Pinned Input */}
          <RightCopilotPanel />
        </div>

        {/* New Event Creation Modal */}
        <NewEventModal
          isOpen={isNewEventModalOpen}
          onClose={() => setIsNewEventModalOpen(false)}
        />
      </div>
    </EventProvider>
  );
}
