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

  const updateStageStatus = (stageId: string, status: CreationStage["status"]) => {
    setStages(prev => prev.map(stage =>
      stage.id === stageId
        ? { ...stage, status, duration: status === "completed" ? Date.now() - startTime : undefined }
        : stage
    ));
  };

  const getCurrentStage = () => stages[currentStageIndex];

  const checkSandboxProgress = async () => {
    try {
      const response = await fetch(`/api/sandbox/${projectId}`);
      const data = await response.json();

      setPollCount(prev => prev + 1);

      // Simulate stage progression based on poll count and status
      if (data.status === "not_created") {
        // Still not created, shouldn't happen if we're in progress
        onError("Sandbox creation failed to start");
        return;
      }

      if (data.status === "creating") {
        // Progress through stages based on time elapsed
        const elapsed = Date.now() - startTime;
        const current = getCurrentStage();

        // Mark current stage as in progress
        if (current?.status === "pending") {
          updateStageStatus(current.id, "in_progress");
        }

        // Progress through stages based on elapsed time and poll count
        if (elapsed > 2000 && currentStageIndex === 0) {
          // Database creation typically takes 2-3 seconds
          updateStageStatus("database", "completed");
          setCurrentStageIndex(1);
        } else if (elapsed > 5000 && currentStageIndex === 1) {
          // Container provisioning
          updateStageStatus("container", "completed");
          setCurrentStageIndex(2);
        } else if (elapsed > 8000 && currentStageIndex === 2) {
          // Networking setup
          updateStageStatus("networking", "completed");
          setCurrentStageIndex(3);
        } else if (elapsed > 12000 && currentStageIndex === 3) {
          // Terminal initialization
          updateStageStatus("terminal", "completed");
          setCurrentStageIndex(4);
        }

        // Continue polling
        setTimeout(checkSandboxProgress, 2000);
      } else if (data.status === "running") {
        // Complete all remaining stages
        stages.forEach((stage, index) => {
          if (index <= currentStageIndex) {
            updateStageStatus(stage.id, "completed");
          }
        });
        updateStageStatus("ready", "completed");

        if (data.sandbox?.ttydUrl) {
          onComplete(data.sandbox.ttydUrl);
        } else {
          onError("Sandbox is running but terminal URL is not available");
        }
      } else if (data.status === "error" || data.status === "terminated") {
        // Mark current stage as error
        const current = getCurrentStage();
        if (current) {
          updateStageStatus(current.id, "error");
        }
        onError(data.error || "Sandbox creation failed");
      }
    } catch (error) {
      console.error("Error checking sandbox progress:", error);
      const current = getCurrentStage();
      if (current) {
        updateStageStatus(current.id, "error");
      }
      onError("Failed to check sandbox creation status");
    }
  };

  useEffect(() => {
    setStartTime(Date.now());
    // Start checking progress immediately
    setTimeout(checkSandboxProgress, 1000);
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