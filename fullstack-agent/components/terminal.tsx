"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Play, Square, RefreshCw, ExternalLink } from "lucide-react";
import SandboxProgress from "@/components/sandbox-progress";

interface TerminalComponentProps {
  projectId: string;
  sandboxUrl?: string;
}

export default function TerminalComponent({ projectId, sandboxUrl }: TerminalComponentProps) {
  const [sandboxStatus, setSandboxStatus] = useState<string>("checking");
  const [ttydUrl, setTtydUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showProgress, setShowProgress] = useState(false);

  // Check sandbox status
  const checkSandboxStatus = async () => {
    try {
      const response = await fetch(`/api/sandbox/${projectId}`);
      const data = await response.json();

      if (data.sandbox?.ttydUrl) {
        if (data.status === "running") {
          setSandboxStatus("running");
          setTtydUrl(data.sandbox.ttydUrl);
          setShowProgress(false);
        } else if (data.status === "creating") {
          setSandboxStatus("creating");
          setShowProgress(true); // Show progress component for existing creating sandbox
        } else {
          setSandboxStatus(data.status || "stopped");
          setTtydUrl(data.sandbox.ttydUrl);
          setShowProgress(false);
        }
      } else if (data.status === "not_created") {
        setSandboxStatus("not_created");
        setShowProgress(false);
      } else {
        setSandboxStatus(data.status || "stopped");
        setShowProgress(false);
      }
    } catch (err) {
      console.error("Error checking sandbox status:", err);
      setError("Failed to check sandbox status");
    }
  };

  // Start sandbox
  const startSandbox = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/sandbox/${projectId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });

      const data = await response.json();

      if (response.ok) {
        if (data.status === "already_running") {
          setSandboxStatus("running");
          setTtydUrl(data.sandbox.ttydUrl);
        } else {
          // Show progress component instead of simple creating state
          setShowProgress(true);
          setSandboxStatus("creating");
        }

        // Show success message
        console.log("Sandbox started:", data);
      } else {
        setError(data.error || "Failed to start sandbox");
      }
    } catch (err) {
      console.error("Error starting sandbox:", err);
      setError("Failed to start sandbox");
    } finally {
      setLoading(false);
    }
  };

  // Stop sandbox
  const stopSandbox = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/sandbox/${projectId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setSandboxStatus("stopped");
        setTtydUrl(null);
        setShowProgress(false);
      } else {
        const data = await response.json();
        setError(data.error || "Failed to stop sandbox");
      }
    } catch (err) {
      console.error("Error stopping sandbox:", err);
      setError("Failed to stop sandbox container");
    } finally {
      setLoading(false);
    }
  };

  // Progress component callbacks
  const handleProgressComplete = (ttydUrl: string) => {
    setSandboxStatus("running");
    setTtydUrl(ttydUrl);
    setShowProgress(false);
  };

  const handleProgressError = (error: string) => {
    setError(error);
    setSandboxStatus("error");
    setShowProgress(false);
  };

  useEffect(() => {
    checkSandboxStatus();
  }, [projectId]);

  // Show progress component during creation
  if (showProgress && sandboxStatus === "creating") {
    return (
      <SandboxProgress
        projectId={projectId}
        onComplete={handleProgressComplete}
        onError={handleProgressError}
      />
    );
  }

  // If sandbox is not running, show control panel
  if (sandboxStatus !== "running" && sandboxStatus !== "creating") {
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
      <div className="bg-gray-900 border-b border-gray-800 p-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
          <span className="text-sm text-gray-400">Sandbox Pod Running</span>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => window.open(ttydUrl!, "_blank")}
            size="sm"
            variant="outline"
            className="border-gray-700 text-white hover:bg-gray-800 text-xs"
          >
            <ExternalLink className="mr-1 h-3 w-3" />
            Open in New Tab
          </Button>
          <Button
            onClick={stopSandbox}
            disabled={loading}
            size="sm"
            variant="outline"
            className="border-gray-700 text-white hover:bg-gray-800 text-xs"
          >
            {loading ? (
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
            ) : (
              <Square className="mr-1 h-3 w-3" />
            )}
            Stop
          </Button>
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