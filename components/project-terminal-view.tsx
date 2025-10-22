"use client";

import { useState, useEffect } from "react";
import { Project, Sandbox } from "@prisma/client";
import { cn } from "@/lib/utils";
import {
  Plus,
  X,
  Network,
  Play,
  Square,
  RotateCw,
  Trash2,
  ChevronDown,
  Terminal as TerminalIcon,
  Globe,
  Server,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import TerminalWrapper from "@/components/terminal-wrapper";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ProjectTerminalViewProps {
  project: Project;
  sandbox: Sandbox | undefined;
}

interface Terminal {
  id: string;
  name: string;
  isActive: boolean;
}

interface NetworkEndpoint {
  domain: string;
  port: number;
  protocol: string;
}

export default function ProjectTerminalView({
  project,
  sandbox,
}: ProjectTerminalViewProps) {
  const [terminals, setTerminals] = useState<Terminal[]>([
    { id: "1", name: "Terminal 1", isActive: true },
  ]);
  const [activeTerminalId, setActiveTerminalId] = useState("1");
  const [showNetworkDialog, setShowNetworkDialog] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentOperation, setCurrentOperation] = useState<string | null>(null);
  const [sandboxStatus, setSandboxStatus] = useState<string | null>(null);

  // Mock network endpoints - in production, these would come from the backend
  const networkEndpoints: NetworkEndpoint[] = [
    { domain: sandbox?.publicUrl || "", port: 3000, protocol: "HTTPS" },
    { domain: sandbox?.publicUrl?.replace("sandbox", "sandbox-ttyd") || "", port: 7681, protocol: "HTTPS" },
  ];

  const addTerminal = () => {
    const newId = (terminals.length + 1).toString();
    const newTerminal: Terminal = {
      id: newId,
      name: `Terminal ${newId}`,
      isActive: false,
    };
    setTerminals([...terminals, newTerminal]);
    setActiveTerminalId(newId);
  };

  const closeTerminal = (id: string) => {
    if (terminals.length === 1) return; // Keep at least one terminal

    const newTerminals = terminals.filter(t => t.id !== id);
    setTerminals(newTerminals);

    if (activeTerminalId === id) {
      setActiveTerminalId(newTerminals[0].id);
    }
  };

  const [startSandboxTrigger, setStartSandboxTrigger] = useState(0);

  // Fetch current sandbox status on component mount
  useEffect(() => {
    if (sandbox) {
      const fetchSandboxStatus = async () => {
        try {
          const response = await fetch(`/api/projects/${project.id}/sandbox/status`);
          if (response.ok) {
            const data = await response.json();
            setSandboxStatus(data.status);
          }
        } catch (error) {
          console.error("Failed to fetch sandbox status:", error);
        }
      };

      fetchSandboxStatus();
      // Poll status every 10 seconds
      const interval = setInterval(fetchSandboxStatus, 10000);
      return () => clearInterval(interval);
    }
  }, [project.id, sandbox]);

  const handleOperation = async (operation: string) => {
    if (operation === "start") {
      // Handle sandbox start via API
      await handleStartSandbox();
      return;
    }

    if (operation === "stop") {
      // Handle sandbox stop via API
      await handleStopSandbox();
      return;
    }

    if (operation === "restart") {
      // Restart = stop then start
      await handleStopSandbox();
      // Wait a bit before starting
      setTimeout(async () => {
        await handleStartSandbox();
      }, 2000);
      return;
    }

    if (operation === "delete") {
      // TODO: Implement delete functionality
      toast.error("Delete functionality not yet implemented");
      return;
    }

    console.log(`Performing operation: ${operation}`);
  };

  const handleStartSandbox = async () => {
    if (!sandbox) {
      toast.error("No sandbox found");
      return;
    }

    setIsLoading(true);
    setCurrentOperation("start");

    try {
      const response = await fetch(`/api/projects/${project.id}/sandbox/start`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to start sandbox");
      }

      const result = await response.json();
      toast.success(result.message || "Sandbox started successfully");

      // Trigger terminal component to refresh
      setStartSandboxTrigger(prev => prev + 1);

      // After a successful start, check real-time status
      setTimeout(async () => {
        try {
          const statusResponse = await fetch(`/api/projects/${project.id}/sandbox/status`);
          if (statusResponse.ok) {
            const statusData = await statusResponse.json();
            console.log("Updated sandbox status:", statusData.status);
          }
        } catch (statusError) {
          console.error("Failed to fetch updated status:", statusError);
        }
      }, 2000); // Check after 2 seconds
    } catch (error: any) {
      console.error("Error starting sandbox:", error);
      toast.error(error.message || "Failed to start sandbox");
    } finally {
      setIsLoading(false);
      setCurrentOperation(null);
    }
  };

  const handleStopSandbox = async () => {
    if (!sandbox) {
      toast.error("No sandbox found");
      return;
    }

    setIsLoading(true);
    setCurrentOperation("stop");
    setSandboxStatus("STOPPING");

    try {
      const response = await fetch(`/api/projects/${project.id}/sandbox/stop`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to stop sandbox");
      }

      const result = await response.json();
      toast.success(result.message || "Sandbox stopped successfully");

      // Update status immediately after successful stop
      setTimeout(async () => {
        try {
          const statusResponse = await fetch(`/api/projects/${project.id}/sandbox/status`);
          if (statusResponse.ok) {
            const statusData = await statusResponse.json();
            setSandboxStatus(statusData.status);
          }
        } catch (statusError) {
          console.error("Failed to fetch updated status:", statusError);
        }
      }, 1000);
    } catch (error: any) {
      console.error("Error stopping sandbox:", error);
      toast.error(error.message || "Failed to stop sandbox");
    } finally {
      setIsLoading(false);
      setCurrentOperation(null);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#1e1e1e]">
      {/* Header Bar */}
      <div className="h-9 bg-[#2d2d30] border-b border-[#3e3e42] flex items-center justify-between px-2">
        {/* Terminal Tabs */}
        <div className="flex items-center gap-1 flex-1 min-w-0">
          {terminals.map((terminal) => (
            <div
              key={terminal.id}
              className={cn(
                "flex items-center gap-1 px-2 py-1 rounded text-xs cursor-pointer transition-colors",
                activeTerminalId === terminal.id
                  ? "bg-[#1e1e1e] text-white"
                  : "text-gray-400 hover:bg-[#37373d]"
              )}
              onClick={() => setActiveTerminalId(terminal.id)}
            >
              <TerminalIcon className="h-3 w-3" />
              <span className="truncate max-w-[100px]">{terminal.name}</span>
              {terminals.length > 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTerminal(terminal.id);
                  }}
                  className="ml-1 hover:text-white"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}
          <button
            onClick={addTerminal}
            className="p-1 text-gray-400 hover:text-white hover:bg-[#37373d] rounded transition-colors"
          >
            <Plus className="h-3 w-3" />
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1">
          {/* Sandbox Status */}
          {sandboxStatus && (
            <div className="px-2 py-1 text-xs text-gray-300 flex items-center gap-1">
              {sandboxStatus === 'RUNNING' && (
                <>
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-green-400">Running</span>
                </>
              )}
              {sandboxStatus === 'STOPPING' && (
                <>
                  <Loader2 className="h-3 w-3 text-yellow-500 animate-spin" />
                  <span className="text-yellow-400">Stopping...</span>
                </>
              )}
              {sandboxStatus === 'STOPPED' && (
                <>
                  <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                  <span className="text-red-400">Stopped</span>
                </>
              )}
              {sandboxStatus === 'CREATING' && (
                <>
                  <Loader2 className="h-3 w-3 text-blue-500 animate-spin" />
                  <span className="text-blue-400">Creating...</span>
                </>
              )}
            </div>
          )}

          {/* Network Button */}
          <button
            onClick={() => setShowNetworkDialog(true)}
            className="px-2 py-1 text-xs text-gray-300 hover:text-white hover:bg-[#37373d] rounded transition-colors flex items-center gap-1"
          >
            <Network className="h-3 w-3" />
            Network
          </button>

          {/* Operations Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="px-2 py-1 text-xs text-gray-300 hover:text-white hover:bg-[#37373d] rounded transition-colors flex items-center gap-1">
                Operations
                <ChevronDown className="h-3 w-3" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-[#252526] border-[#3e3e42] text-gray-300">
              <DropdownMenuItem
                onClick={() => handleOperation("start")}
                className="hover:bg-[#37373d] focus:bg-[#37373d]"
                disabled={isLoading}
              >
                {currentOperation === "start" ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Play className="h-4 w-4 mr-2" />
                )}
                Start Sandbox
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleOperation("stop")}
                className="hover:bg-[#37373d] focus:bg-[#37373d]"
                disabled={isLoading}
              >
                {currentOperation === "stop" ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Square className="h-4 w-4 mr-2" />
                )}
                Stop Sandbox
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleOperation("restart")}
                className="hover:bg-[#37373d] focus:bg-[#37373d]"
                disabled={isLoading}
              >
                {currentOperation?.includes("restart") || (currentOperation === "stop" || currentOperation === "start") ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RotateCw className="h-4 w-4 mr-2" />
                )}
                Restart Sandbox
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-[#3e3e42]" />
              <DropdownMenuItem
                onClick={() => handleOperation("delete")}
                className="hover:bg-[#37373d] focus:bg-[#37373d] text-red-400"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Sandbox
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Terminal Content */}
      <div className="flex-1 bg-black">
        {terminals.map((terminal) => (
          <div
            key={terminal.id}
            className={cn(
              "h-full",
              activeTerminalId === terminal.id ? "block" : "hidden"
            )}
          >
            <TerminalWrapper
              projectId={project.id}
              sandboxUrl={sandbox?.publicUrl}
              terminalId={terminal.id}
              startSandboxTrigger={startSandboxTrigger}
            />
          </div>
        ))}
      </div>

      {/* Network Dialog */}
      <Dialog open={showNetworkDialog} onOpenChange={setShowNetworkDialog}>
        <DialogContent className="bg-[#252526] border-[#3e3e42] text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Network className="h-5 w-5" />
              Network Endpoints
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              All publicly accessible endpoints for this sandbox
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {networkEndpoints.map((endpoint, index) => (
              <div
                key={index}
                className="p-3 bg-[#1e1e1e] rounded border border-[#3e3e42]"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {endpoint.port === 3000 ? (
                      <Globe className="h-4 w-4 text-blue-400" />
                    ) : (
                      <Server className="h-4 w-4 text-green-400" />
                    )}
                    <span className="text-sm font-medium">
                      Port {endpoint.port}
                    </span>
                  </div>
                  <span className="text-xs text-gray-400">{endpoint.protocol}</span>
                </div>
                <a
                  href={endpoint.domain}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-400 hover:text-blue-300 break-all"
                >
                  {endpoint.domain}
                </a>
              </div>
            ))}
          </div>
          <div className="mt-4">
            <button
              onClick={() => setShowNetworkDialog(false)}
              className="w-full px-3 py-2 bg-[#0e639c] hover:bg-[#1177bb] text-white text-sm rounded transition-colors"
            >
              Close
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}