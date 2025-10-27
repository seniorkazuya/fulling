"use client";

import { useTerminal } from "./terminal-provider";
import TerminalComponent from "./terminal";

interface PersistentTerminalProps {
  projectId: string;
  className?: string;
}

export default function PersistentTerminal({ projectId, className = "" }: PersistentTerminalProps) {
  const { isTerminalVisible, currentProjectId } = useTerminal();

  // Check if this terminal should be visible
  const shouldShow = isTerminalVisible && currentProjectId === projectId;

  if (!shouldShow) {
    return null;
  }

  // When terminal is visible, it should take up the full main content area
  return (
    <div className="flex-1 flex flex-col min-w-0">
      <TerminalComponent projectId={projectId} />
    </div>
  );
}