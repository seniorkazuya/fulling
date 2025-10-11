"use client";

import dynamic from "next/dynamic";

const Terminal = dynamic(() => import("./terminal"), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full bg-black rounded-lg p-4 flex items-center justify-center">
      <p className="text-gray-500">Loading terminal...</p>
    </div>
  ),
});

interface TerminalWrapperProps {
  projectId: string;
  sandboxUrl?: string;
}

export default function TerminalWrapper({ projectId, sandboxUrl }: TerminalWrapperProps) {
  return <Terminal projectId={projectId} sandboxUrl={sandboxUrl} />;
}