"use client";

import { useTerminal } from "./terminal-provider";
import { useParams } from "next/navigation";

export default function ContentWrapper({ children }: { children: React.ReactNode }) {
  const { isTerminalVisible, currentProjectId } = useTerminal();
  const params = useParams();
  const projectId = params.id as string;

  // Hide content when terminal is visible for this project
  const shouldHide = isTerminalVisible && currentProjectId === projectId;

  if (shouldHide) {
    return null;
  }

  return <>{children}</>;
}