"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, CheckCircle, Clock, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface SandboxProgressProps {
  projectId: string;
  onComplete: (ttydUrl: string) => void;
  onError: (error: string) => void;
}

interface CreationStage {
  id: string;
  title: string;
  description: string;
  status: "pending" | "in_progress" | "completed" | "error";
  duration?: number;
}

export default function SandboxProgress({ projectId, onComplete, onError }: SandboxProgressProps) {
  const [stages, setStages] = useState<CreationStage[]>([
    {
      id: "database",
      title: "Creating PostgreSQL Database",
      description: "Setting up dedicated database instance with KubeBlocks",
      status: "pending",
    },
    {
      id: "container",
      title: "Provisioning Container Environment",
      description: "Creating isolated pod with fullstack-web-runtime image",
      status: "pending",
    },
    {
      id: "networking",
      title: "Configuring Network Access",
      description: "Setting up services and ingress for public access",
      status: "pending",
    },
    {
      id: "terminal",
      title: "Initializing Web Terminal",
      description: "Starting ttyd service for browser-based development",
      status: "pending",
    },
    {
      id: "ready",
      title: "Environment Ready",
      description: "Sandbox is fully operational and ready for development",
      status: "pending",
    },
  ]);

  const [currentStageIndex, setCurrentStageIndex] = useState(0);
  const [startTime, setStartTime] = useState<number>(Date.now());
  const [pollCount, setPollCount] = useState(0);
  const [hasStartedPolling, setHasStartedPolling] = useState(false);
  const [retryMessage, setRetryMessage] = useState<string | null>(null);

  const updateStageStatus = (stageId: string, status: CreationStage["status"]) => {
    setStages(prev => prev.map(stage =>
      stage.id === stageId
        ? { ...stage, status, duration: status === "completed" ? Date.now() - startTime : undefined }
        : stage
    ));
  };

  const getCurrentStage = () => stages[currentStageIndex];

  const checkSandboxProgress = async () => {
    const elapsed = Date.now() - startTime;

    // Don't query API for first 5 seconds, only show animation
    if (!hasStartedPolling && elapsed < 5000) {
      updateStageStatus("database", "in_progress");
      setTimeout(checkSandboxProgress, 1000);
      return;
    }

    // Start polling
    if (!hasStartedPolling) {
      setHasStartedPolling(true);
    }

    try {
      const response = await fetch(`/api/sandbox/${projectId}`);

      // Check if response is ok before parsing
      if (!response.ok) {
        console.error(`[SandboxProgress] API returned ${response.status}: ${response.statusText}`);
        // Treat as temporary error and retry
        if (elapsed < 60000) {
          setRetryMessage(`API error (${response.status}), retrying...`);
          setTimeout(checkSandboxProgress, 5000);
          return;
        } else {
          onError(`API error: ${response.status} ${response.statusText}`);
          return;
        }
      }

      const data = await response.json();

      // Defensive check: ensure data is valid
      if (!data || typeof data !== 'object') {
        console.error("[SandboxProgress] Invalid API response:", data);
        if (elapsed < 60000) {
          setRetryMessage("Invalid response, retrying...");
          setTimeout(checkSandboxProgress, 5000);
          return;
        } else {
          onError("Invalid API response");
          return;
        }
      }

      console.log(`[SandboxProgress] Poll #${pollCount + 1}, Status: ${data.status}, Error: ${data.error || 'none'}, Elapsed: ${Math.floor(elapsed/1000)}s`);
      setPollCount(prev => prev + 1);

      // Simplified logic: Don't show errors within 30 seconds, only show errors after 1 minute when in error state
      const shouldShowError = elapsed >= 60000 && (data.status === "terminated" || data.status === "error");

      if (data.status === "running") {
        // Successfully running
        console.log("[SandboxProgress] Sandbox is running!");
        stages.forEach((stage, index) => {
          updateStageStatus(stage.id, "completed");
        });

        // Defensive check: ensure sandbox object and ttydUrl exist
        if (data.sandbox && data.sandbox.ttydUrl) {
          console.log("[SandboxProgress] Terminal URL available, completing...");
          onComplete(data.sandbox.ttydUrl);
        } else {
          console.warn("[SandboxProgress] Sandbox running but no ttydUrl, data:", data);
          // Even without URL, if within 1 minute, continue retrying
          if (elapsed < 60000) {
            setRetryMessage("Terminal URL not yet available, retrying...");
            setTimeout(checkSandboxProgress, 5000);
          } else {
            onError("Sandbox is running but terminal URL is not available");
          }
        }
        return;
      }

      if (data.status === "creating") {
        // Creating in progress, update progress bar
        console.log("[SandboxProgress] Sandbox is creating, updating progress...");
        const current = getCurrentStage();
        if (current?.status === "pending") {
          updateStageStatus(current.id, "in_progress");
        }

        // Advance stages based on elapsed time
        if (elapsed > 5000 && currentStageIndex === 0) {
          updateStageStatus("database", "completed");
          setCurrentStageIndex(1);
        } else if (elapsed > 10000 && currentStageIndex === 1) {
          updateStageStatus("container", "completed");
          setCurrentStageIndex(2);
        } else if (elapsed > 15000 && currentStageIndex === 2) {
          updateStageStatus("networking", "completed");
          setCurrentStageIndex(3);
        } else if (elapsed > 20000 && currentStageIndex === 3) {
          updateStageStatus("terminal", "completed");
          setCurrentStageIndex(4);
        }

        setTimeout(checkSandboxProgress, 5000);
        return;
      }

      // Handle error states
      if (shouldShowError) {
        // Only report errors after 1 minute and when status is terminated or error
        console.error("[SandboxProgress] Error state after timeout:", data.status);
        const current = getCurrentStage();
        if (current) {
          updateStageStatus(current.id, "error");
        }

        // Display specific error reason
        let errorMessage = "Sandbox creation failed";
        if (data.error) {
          errorMessage = `Sandbox creation failed: ${data.error}`;
        } else if (data.status === "terminated") {
          errorMessage = "Sandbox was terminated during creation";
        } else if (data.status === "error") {
          errorMessage = "Sandbox creation encountered an error";
        }

        onError(errorMessage);
        return;
      }

      // Within 1 minute, show friendly retry messages
      if (data.status === "error" || data.status === "terminated" || data.status === "not_created") {
        let message = "";
        if (data.status === "error") {
          message = "Encountered temporary error, retrying...";
        } else if (data.status === "terminated") {
          message = "Resource was terminated, attempting to recreate...";
        } else if (data.status === "not_created") {
          message = "Waiting for resource creation to begin...";
        }
        console.log(`[SandboxProgress] ${message} (status: ${data.status})`);
        setRetryMessage(message);
      } else {
        setRetryMessage(null);
      }

      // Within 1 minute or status is normal, continue polling
      if (elapsed < 30000) {
        // First 30 seconds, show retrying state
        const current = getCurrentStage();
        if (current?.status === "pending") {
          updateStageStatus(current.id, "in_progress");
        }
      }

      // Poll every 5 seconds
      setTimeout(checkSandboxProgress, 5000);

    } catch (error) {
      console.error("[SandboxProgress] Error checking sandbox progress:", error);

      // Network errors follow the same rule: don't report errors within 1 minute
      if (elapsed >= 60000) {
        const current = getCurrentStage();
        if (current) {
          updateStageStatus(current.id, "error");
        }
        onError(`Network error while checking status: ${error}`);
        return;
      }

      // Within 1 minute, continue retrying
      if (currentStageIndex === 0 && stages[0].status === "pending") {
        updateStageStatus("database", "in_progress");
      }

      setRetryMessage("Network error, retrying...");
      setTimeout(checkSandboxProgress, 5000);
    }
  };

  useEffect(() => {
    setStartTime(Date.now());
    // Start checking progress after a short delay
    // This gives time for the initial animation to show
    setTimeout(checkSandboxProgress, 500);
  }, [projectId]);

  const getStageIcon = (stage: CreationStage) => {
    switch (stage.status) {
      case "completed":
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case "in_progress":
        return <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />;
      case "error":
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      default:
        return <Clock className="h-5 w-5 text-gray-500" />;
    }
  };

  const getElapsedTime = () => {
    const elapsed = Date.now() - startTime;
    return `${Math.floor(elapsed / 1000)}s`;
  };

  return (
    <div className="h-full w-full bg-black rounded-lg p-4">
      <Card className="bg-gray-900 border-gray-800">
        <CardContent className="p-6">
          <div className="flex flex-col space-y-6">
            {/* Header */}
            <div className="text-center">
              <div className="flex items-center justify-center gap-3 mb-4">
                <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
                <h2 className="text-2xl font-semibold text-white">
                  Creating Sandbox Environment
                </h2>
              </div>
              <p className="text-gray-400">
                Setting up your isolated development environment with PostgreSQL database
              </p>
              <p className="text-sm text-gray-500 mt-2">
                Elapsed time: {getElapsedTime()}
              </p>
              {retryMessage && (
                <p className="text-sm text-yellow-500 mt-2 animate-pulse">
                  {retryMessage}
                </p>
              )}
            </div>

            {/* Progress Stages */}
            <div className="space-y-4">
              {stages.map((stage, index) => (
                <div
                  key={stage.id}
                  className={cn(
                    "flex items-start gap-4 p-4 rounded-lg border transition-all duration-300",
                    stage.status === "in_progress"
                      ? "bg-blue-900/20 border-blue-700"
                      : stage.status === "completed"
                      ? "bg-green-900/20 border-green-700"
                      : stage.status === "error"
                      ? "bg-red-900/20 border-red-700"
                      : "bg-gray-800/50 border-gray-700"
                  )}
                >
                  <div className="flex-shrink-0 mt-0.5">
                    {getStageIcon(stage)}
                  </div>

                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className={cn(
                        "font-medium",
                        stage.status === "completed" ? "text-green-400"
                        : stage.status === "in_progress" ? "text-blue-400"
                        : stage.status === "error" ? "text-red-400"
                        : "text-gray-300"
                      )}>
                        {stage.title}
                      </h3>
                      {stage.duration && (
                        <span className="text-xs text-gray-500">
                          ({Math.floor(stage.duration / 1000)}s)
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-400">
                      {stage.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Tips */}
            <div className="mt-6 p-4 bg-gray-800 rounded-lg">
              <p className="text-sm text-gray-300 mb-2">
                <strong>What's happening:</strong>
              </p>
              <ul className="text-sm text-gray-400 space-y-1 list-disc list-inside">
                <li>Creating dedicated PostgreSQL database instance</li>
                <li>Provisioning Kubernetes pod with development tools</li>
                <li>Configuring secure network access and SSL certificates</li>
                <li>Starting web terminal with Claude Code CLI pre-installed</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}