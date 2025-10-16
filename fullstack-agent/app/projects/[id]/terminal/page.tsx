"use client";

import { useEffect } from "react";
import { useParams } from "next/navigation";
import { useTerminal } from "@/components/terminal-provider";

export default function TerminalPage() {
  const params = useParams();
  const projectId = params.id as string;
  const { showTerminal } = useTerminal();

  useEffect(() => {
    // When this page loads, show the terminal
    showTerminal(projectId);
  }, [projectId, showTerminal]);

  // The actual terminal is rendered in the layout as a persistent component
  // This page just triggers its visibility
  return null;
}