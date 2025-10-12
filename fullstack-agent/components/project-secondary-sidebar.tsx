"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  ChevronLeft,
  ChevronRight,
  Database,
  Key,
  Shield,
  CreditCard,
  Rocket,
  Github,
  Package,
  Eye,
  EyeOff,
} from "lucide-react";
import { Project, Sandbox, EnvironmentVariable } from "@prisma/client";

interface ProjectSecondarySidebarProps {
  project: Project;
  sandboxes: Sandbox[];
  envVars: EnvironmentVariable[];
}

export default function ProjectSecondarySidebar({
  project,
  sandboxes,
  envVars,
}: ProjectSecondarySidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [activeSection, setActiveSection] = useState<string>("environment");
  const [showSecrets, setShowSecrets] = useState<{ [key: string]: boolean }>({});

  const sections = [
    { id: "environment", label: "Environment Variables", icon: Package },
    { id: "secrets", label: "Secret Configuration", icon: Key },
    { id: "auth", label: "Auth Configuration", icon: Shield },
    { id: "payment", label: "Payment Configuration", icon: CreditCard },
    { id: "deploy", label: "Deploy to Production", icon: Rocket },
    { id: "github", label: "GitHub Repository", icon: Github },
  ];

  const groupedEnvVars = {
    database: envVars.filter((v) =>
      v.key.toLowerCase().includes("database") ||
      v.key.toLowerCase().includes("db_")
    ),
    claude: envVars.filter((v) =>
      v.key.toLowerCase().includes("anthropic") ||
      v.key.toLowerCase().includes("claude")
    ),
    auth: envVars.filter((v) => v.category === "auth"),
    payment: envVars.filter((v) => v.category === "payment"),
    general: envVars.filter((v) =>
      !v.category || v.category === "general"
    ).filter((v) =>
      !v.key.toLowerCase().includes("database") &&
      !v.key.toLowerCase().includes("db_") &&
      !v.key.toLowerCase().includes("anthropic") &&
      !v.key.toLowerCase().includes("claude")
    ),
  };

  const toggleSecret = (key: string) => {
    setShowSecrets(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const maskValue = (value: string) => {
    return "•".repeat(Math.min(value.length, 20));
  };

  return (
    <div
      className={cn(
        "bg-[#181818] border-r border-[#3e3e42] flex flex-col transition-all duration-200",
        isCollapsed ? "w-10" : "w-72"
      )}
    >
      {/* Header */}
      <div className="h-12 flex items-center justify-between px-3 border-b border-[#3e3e42]">
        {!isCollapsed && (
          <span className="text-sm font-medium text-gray-300">
            Project Configuration
          </span>
        )}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="text-gray-400 hover:text-gray-200 transition-colors"
        >
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>
      </div>

      {!isCollapsed && (
        <>
          {/* Section Navigation */}
          <div className="border-b border-[#3e3e42]">
            {sections.map((section) => {
              const Icon = section.icon;
              return (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={cn(
                    "w-full flex items-center px-3 py-2 text-sm hover:bg-[#2a2d2e] transition-colors",
                    activeSection === section.id && "bg-[#2a2d2e] text-white"
                  )}
                >
                  <Icon className="h-4 w-4 mr-2 text-gray-400" />
                  <span className="text-gray-300">{section.label}</span>
                </button>
              );
            })}
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-y-auto p-3">
            {activeSection === "environment" && (
              <div className="space-y-4">
                {/* Database Connection */}
                {groupedEnvVars.database.length > 0 && (
                  <div>
                    <div className="flex items-center mb-2">
                      <Database className="h-4 w-4 mr-2 text-blue-400" />
                      <span className="text-sm font-medium text-gray-300">
                        Database Connection
                      </span>
                    </div>
                    <div className="space-y-1">
                      {groupedEnvVars.database.map((env) => (
                        <div
                          key={env.id}
                          className="flex items-center justify-between p-2 bg-[#252526] rounded text-xs"
                        >
                          <span className="text-gray-400 font-mono">{env.key}</span>
                          <div className="flex items-center gap-1">
                            <span className="text-gray-500 font-mono">
                              {showSecrets[env.id] ? env.value : maskValue(env.value)}
                            </span>
                            <button
                              onClick={() => toggleSecret(env.id)}
                              className="text-gray-500 hover:text-gray-300"
                            >
                              {showSecrets[env.id] ? (
                                <EyeOff className="h-3 w-3" />
                              ) : (
                                <Eye className="h-3 w-3" />
                              )}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Claude Configuration */}
                {groupedEnvVars.claude.length > 0 && (
                  <div>
                    <div className="flex items-center mb-2">
                      <Package className="h-4 w-4 mr-2 text-purple-400" />
                      <span className="text-sm font-medium text-gray-300">
                        Claude Code Configuration
                      </span>
                    </div>
                    <div className="space-y-1">
                      {groupedEnvVars.claude.map((env) => (
                        <div
                          key={env.id}
                          className="flex items-center justify-between p-2 bg-[#252526] rounded text-xs"
                        >
                          <span className="text-gray-400 font-mono">{env.key}</span>
                          <div className="flex items-center gap-1">
                            <span className="text-gray-500 font-mono">
                              {showSecrets[env.id] ? env.value : maskValue(env.value)}
                            </span>
                            <button
                              onClick={() => toggleSecret(env.id)}
                              className="text-gray-500 hover:text-gray-300"
                            >
                              {showSecrets[env.id] ? (
                                <EyeOff className="h-3 w-3" />
                              ) : (
                                <Eye className="h-3 w-3" />
                              )}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* General Variables */}
                {groupedEnvVars.general.length > 0 && (
                  <div>
                    <div className="flex items-center mb-2">
                      <Package className="h-4 w-4 mr-2 text-gray-400" />
                      <span className="text-sm font-medium text-gray-300">
                        General Variables
                      </span>
                    </div>
                    <div className="space-y-1">
                      {groupedEnvVars.general.map((env) => (
                        <div
                          key={env.id}
                          className="flex items-center justify-between p-2 bg-[#252526] rounded text-xs"
                        >
                          <span className="text-gray-400 font-mono">{env.key}</span>
                          <span className="text-gray-500 font-mono">
                            {env.value}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {envVars.length === 0 && (
                  <p className="text-sm text-gray-500">
                    No environment variables configured
                  </p>
                )}
              </div>
            )}

            {activeSection === "secrets" && (
              <div className="space-y-3">
                <p className="text-sm text-gray-400">
                  Manage your application secrets and API keys
                </p>
                <button className="w-full py-2 px-3 bg-[#0e639c] hover:bg-[#1177bb] text-white text-sm rounded transition-colors">
                  Configure Secrets
                </button>
              </div>
            )}

            {activeSection === "auth" && (
              <div className="space-y-3">
                {groupedEnvVars.auth.length > 0 ? (
                  <div className="space-y-1">
                    {groupedEnvVars.auth.map((env) => (
                      <div
                        key={env.id}
                        className="p-2 bg-[#252526] rounded text-xs"
                      >
                        <span className="text-gray-400 font-mono">{env.key}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400">
                    No authentication providers configured
                  </p>
                )}
                <button className="w-full py-2 px-3 bg-[#0e639c] hover:bg-[#1177bb] text-white text-sm rounded transition-colors">
                  Configure Auth
                </button>
              </div>
            )}

            {activeSection === "payment" && (
              <div className="space-y-3">
                {groupedEnvVars.payment.length > 0 ? (
                  <div className="space-y-1">
                    {groupedEnvVars.payment.map((env) => (
                      <div
                        key={env.id}
                        className="p-2 bg-[#252526] rounded text-xs"
                      >
                        <span className="text-gray-400 font-mono">{env.key}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400">
                    No payment providers configured
                  </p>
                )}
                <button className="w-full py-2 px-3 bg-[#0e639c] hover:bg-[#1177bb] text-white text-sm rounded transition-colors">
                  Configure Payments
                </button>
              </div>
            )}

            {activeSection === "deploy" && (
              <div className="space-y-3">
                <p className="text-sm text-gray-400">
                  Deploy your application to production
                </p>
                {sandboxes[0]?.status === "RUNNING" ? (
                  <button className="w-full py-2 px-3 bg-green-600 hover:bg-green-700 text-white text-sm rounded transition-colors">
                    Deploy Now
                  </button>
                ) : (
                  <p className="text-sm text-yellow-500">
                    Sandbox must be running to deploy
                  </p>
                )}
              </div>
            )}

            {activeSection === "github" && (
              <div className="space-y-3">
                {project.githubRepo ? (
                  <>
                    <p className="text-sm text-gray-400">
                      Connected to repository:
                    </p>
                    <div className="p-2 bg-[#252526] rounded">
                      <a
                        href={`https://github.com/${project.githubRepo}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-400 hover:text-blue-300"
                      >
                        {project.githubRepo}
                      </a>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-gray-400">
                      Connect your GitHub repository
                    </p>
                    <button className="w-full py-2 px-3 bg-[#0e639c] hover:bg-[#1177bb] text-white text-sm rounded transition-colors">
                      Connect GitHub
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}