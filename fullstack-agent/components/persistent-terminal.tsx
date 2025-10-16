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

  return (
    <div className="absolute inset-0 z-10 h-full w-full">
      <TerminalComponent projectId={projectId} />
    </div>
  );
}