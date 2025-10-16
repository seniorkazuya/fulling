"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { useTerminal } from "@/components/terminal-provider";
import { usePathname, useRouter } from "next/navigation";
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
  Terminal,
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
  const { showTerminal, hideTerminal, isTerminalVisible } = useTerminal();
  const pathname = usePathname();
  const router = useRouter();

  const handleSectionClick = (e: React.MouseEvent, sectionId: string, href: string) => {
    e.preventDefault();

    if (sectionId === "terminal") {
      // For terminal, just toggle visibility without navigation
      if (!isTerminalVisible) {
        showTerminal(project.id);
        // Update URL without navigation
        window.history.pushState({}, '', href);
      }
    } else {
      // For other sections, hide terminal and navigate
      hideTerminal();
      router.push(href);
    }
  };

  const sections: Array<{
    id: string;
    label: string;
    icon: any;
    href: string;
  }> = [
    { id: "terminal", label: "Web Terminal", icon: Terminal, href: `/projects/${project.id}/terminal` },
    { id: "database", label: "Database Connection", icon: Database, href: `/projects/${project.id}/database` },
    { id: "environment", label: "Environment Variables", icon: Package, href: `/projects/${project.id}/environment` },
    { id: "secrets", label: "Secret Configuration", icon: Key, href: `/projects/${project.id}/secrets` },
    { id: "auth", label: "Auth Configuration", icon: Shield, href: `/projects/${project.id}/auth` },
    { id: "payment", label: "Payment Configuration", icon: CreditCard, href: `/projects/${project.id}/payment` },
    { id: "deploy", label: "Deploy to Production", icon: Rocket, href: `/projects/${project.id}/deploy` },
    { id: "github", label: "GitHub Repository", icon: Github, href: `/projects/${project.id}/github` },
  ];

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
        <div className="flex-1 overflow-y-auto">
          {sections.map((section) => {
            const Icon = section.icon;
            const isActive = pathname === section.href || (section.id === "terminal" && isTerminalVisible);

            return (
              <a
                key={section.id}
                href={section.href}
                onClick={(e) => handleSectionClick(e, section.id, section.href)}
                className={cn(
                  "w-full flex items-center px-3 py-2 text-sm transition-colors",
                  isActive ? "bg-[#2a2d2e]" : "hover:bg-[#2a2d2e]"
                )}
              >
                <Icon className="h-4 w-4 mr-2 text-gray-400" />
                <span className="text-gray-300">{section.label}</span>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}