"use client";

import { useEffect, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Play, RefreshCw } from "lucide-react";
import SandboxProgress from "@/components/sandbox-progress";

interface TerminalComponentProps {
  projectId: string;
  sandboxUrl?: string;
  terminalId?: string;
  startSandboxTrigger?: number;
}

export default function TerminalComponent({ projectId, sandboxUrl, startSandboxTrigger }: TerminalComponentProps) {
  const [sandboxStatus, setSandboxStatus] = useState<string>("checking");
  const [ttydUrl, setTtydUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showProgress, setShowProgress] = useState(false);
  const [isCreating, setIsCreating] = useState(false); // Prevent status reset during creation

  // Use ref to track the latest value of isCreating to avoid closure issues in async functions
  const isCreatingRef = useRef(false);

  // Check sandbox status
  const checkSandboxStatus = async (skipProgressReset = false) => {
    try {
      console.log(`[Terminal] Checking sandbox status, isCreating ref: ${isCreatingRef.current}, skipProgressReset: ${skipProgressReset}`);
      const response = await fetch(`/api/sandbox/${projectId}`);
      const data = await response.json();

      console.log(`[Terminal] Sandbox status response:`, data.status);

      if (data.sandbox?.ttydUrl) {
        if (data.status === "running") {
          setSandboxStatus("running");
          setTtydUrl(data.sandbox.ttydUrl);
          // Don't hide progress if we're currently showing it or in creation mode
          // Use ref to get the latest value
          if (!skipProgressReset && !isCreatingRef.current) {
            console.log(`[Terminal] Setting showProgress to false (running state)`);
            setShowProgress(false);
          } else {
            console.log(`[Terminal] NOT hiding progress: skipProgressReset=${skipProgressReset}, isCreating=${isCreatingRef.current}`);
          }
        } else if (data.status === "creating") {
          setSandboxStatus("creating");
          // Always show progress when status is creating
          if (!skipProgressReset) setShowProgress(true);
        } else {
          setSandboxStatus(data.status || "stopped");
          setTtydUrl(data.sandbox.ttydUrl);
          // Don't hide progress if we're in creation mode
          // Use ref to get the latest value
          if (!skipProgressReset && !isCreatingRef.current) {
            console.log(`[Terminal] Setting showProgress to false (other status: ${data.status})`);
            setShowProgress(false);
          }
        }
      } else if (data.status === "not_created") {
        setSandboxStatus("not_created");
        // Don't hide progress if we're in creation mode
        // Use ref to get the latest value
        if (!skipProgressReset && !isCreatingRef.current) {
          console.log(`[Terminal] Setting showProgress to false (not_created)`);
          setShowProgress(false);
        }
      } else {
        setSandboxStatus(data.status || "stopped");
        // Don't hide progress if we're in creation mode
        // Use ref to get the latest value
        if (!skipProgressReset && !isCreatingRef.current) {
          console.log(`[Terminal] Setting showProgress to false (default case)`);
          setShowProgress(false);
        }
      }
    } catch (err) {
      console.error("[Terminal] Error checking sandbox status:", err);
      setError("Failed to check sandbox status");
    }
  };

  // Start sandbox
  const startSandbox = async () => {
    setLoading(true);
    setError(null);

    // Set creation lock to prevent status resets
    setIsCreating(true);
    isCreatingRef.current = true; // Update ref synchronously

    // Immediately show progress UI for better user experience
    setShowProgress(true);
    setSandboxStatus("creating");
    setLoading(false);

    console.log("[Terminal] Starting sandbox creation...");

    // Call API in background - don't await it
    // The SandboxProgress component will handle all timeout and error logic
    fetch(`/api/sandbox/${projectId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    })
      .then(response => response.json().then(data => ({ response, data })))
      .then(({ response, data }) => {
        if (response.ok) {
          if (data.status === "already_running") {
            // If already running, immediately transition to running state
            console.log("[Terminal] Sandbox already running, transitioning to running state");
            setSandboxStatus("running");
            setTtydUrl(data.sandbox.ttydUrl);
            setShowProgress(false);
            setIsCreating(false); // Release lock
            isCreatingRef.current = false; // Update ref synchronously
          } else if (data.status === "created") {
            // Sandbox is being created, keep showing progress
            console.log("[Terminal] Sandbox creation initiated successfully");
            // Progress component is already showing, it will handle the rest
            // Don't hide progress here! Let SandboxProgress component handle completion
          } else {
            // Unknown success status, keep showing progress
            console.log("[Terminal] Sandbox creation response:", data.status);
            // Don't hide progress here! Let SandboxProgress component handle completion
          }
        } else {
          // API returned error on initial request
          console.error("[Terminal] Sandbox creation API error:", data.error);
          // Only hide progress if the initial API call failed
          // This means the creation never started
          setError(data.error || "Failed to start sandbox creation");
          setShowProgress(false);
          setIsCreating(false);
          isCreatingRef.current = false;
        }
      })
      .catch(err => {
        // Network error on initial request
        console.error("[Terminal] Network error starting sandbox:", err);
        // Only hide progress if the initial API call failed
        setError("Network error: Unable to start sandbox creation");
        setShowProgress(false);
        setIsCreating(false);
        isCreatingRef.current = false;
      });
  };


  // Progress component callbacks
  const handleProgressComplete = (ttydUrl: string) => {
    setSandboxStatus("running");
    setTtydUrl(ttydUrl);
    setShowProgress(false);
    setIsCreating(false); // Release creation lock
    isCreatingRef.current = false; // Update ref synchronously
  };

  const handleProgressError = (error: string) => {
    setError(error);
    setSandboxStatus("error");
    setShowProgress(false);
    setIsCreating(false); // Release creation lock
    isCreatingRef.current = false; // Update ref synchronously
  };

  // Trigger sandbox start when external trigger changes
  useEffect(() => {
    if (startSandboxTrigger && startSandboxTrigger > 0) {
      startSandbox();
    }
  }, [startSandboxTrigger]);

  // Sync isCreating state with ref to ensure they're always in sync
  useEffect(() => {
    isCreatingRef.current = isCreating;
  }, [isCreating]);

  useEffect(() => {
    // Only check initial status on mount if we're not already showing progress
    if (!showProgress && !isCreating) {
      checkSandboxStatus();
    }
  }, [projectId]);

  // Show progress component when showProgress is true
  if (showProgress) {
    return (
      <SandboxProgress
        projectId={projectId}
        onComplete={handleProgressComplete}
        onError={handleProgressError}
      />
    );
  }

  // If sandbox is not running, show control panel
  if (sandboxStatus !== "running") {
    return (
      <div className="h-full w-full bg-black rounded-lg p-4">
        <Card className="bg-gray-900 border-gray-800">
          <CardContent className="p-6">
            <div className="flex flex-col items-center justify-center space-y-4">
              <div className="text-center">
                <h3 className="text-xl font-semibold text-white mb-2">
                  Sandbox Environment
                </h3>
                <p className="text-gray-400">
                  {sandboxStatus === "not_created"
                    ? "No sandbox pod has been created for this project."
                    : sandboxStatus === "terminated"
                    ? "The sandbox pod has been terminated."
                    : "The sandbox pod is currently stopped."}
                </p>
              </div>

              {error && (
                <div className="bg-red-900/20 border border-red-800 rounded p-3 text-red-400 text-sm">
                  {error}
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  onClick={startSandbox}
                  disabled={loading}
                  className="bg-white text-black hover:bg-gray-200"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Starting...
                    </>
                  ) : (
                    <>
                      <Play className="mr-2 h-4 w-4" />
                      Start Sandbox
                    </>
                  )}
                </Button>

                <Button
                  onClick={checkSandboxStatus}
                  variant="outline"
                  className="border-gray-700 text-white hover:bg-gray-800"
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Refresh
                </Button>
              </div>

              <div className="mt-4 p-4 bg-gray-800 rounded-lg max-w-2xl">
                <p className="text-sm text-gray-300 mb-2">
                  <strong>What is a Sandbox?</strong>
                </p>
                <ul className="text-sm text-gray-400 space-y-1 list-disc list-inside">
                  <li>Isolated Kubernetes pod with full development environment</li>
                  <li>Pre-installed with Node.js, Next.js, PostgreSQL client, and Claude Code CLI</li>
                  <li>Web-based terminal powered by ttyd for remote development</li>
                  <li>Dedicated PostgreSQL database for your project</li>
                  <li>Persistent workspace for your project files</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }


  // If sandbox is running, show terminal iframe
  return (
    <div className="h-full w-full bg-black rounded-lg flex flex-col">
      <div className="bg-gray-900 border-b border-gray-800 p-2 flex items-center">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
          <span className="text-sm text-gray-400">Sandbox Pod Running</span>
        </div>
      </div>

      {/* Terminal iframe */}
      {ttydUrl && (
        <iframe
          src={ttydUrl}
          className="flex-1 w-full bg-black"
          style={{ border: "none" }}
          title="Terminal"
        />
      )}
    </div>
  );
}