import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import ProjectSidebar from "@/components/project-sidebar";
import ProjectSecondarySidebar from "@/components/project-secondary-sidebar";
import { TerminalProvider } from "@/components/terminal-provider";
import PersistentTerminal from "@/components/persistent-terminal";
import ContentWrapper from "@/components/content-wrapper";

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  const { id } = await params;

  const project = await prisma.project.findFirst({
    where: {
      id: id,
      userId: session.user.id,
    },
    include: {
      sandboxes: true,
      environmentVariables: true,
    },
  });

  if (!project) {
    notFound();
  }

  // Get all user projects for sidebar
  const projects = await prisma.project.findMany({
    where: {
      userId: session.user.id,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return (
    <TerminalProvider>
      <div className="h-screen flex bg-[#1e1e1e] text-white overflow-hidden">
        {/* Primary Sidebar - VSCode style */}
        <ProjectSidebar
          projects={projects}
          currentProjectId={id}
          userId={session.user.id}
        />

        {/* Secondary Sidebar - Project Settings */}
        <ProjectSecondarySidebar
          project={project}
          sandboxes={project.sandboxes}
          envVars={project.environmentVariables}
        />

        {/* Main Content Area */}
        <ContentWrapper projectId={id}>
          <div className="flex-1 flex flex-col min-w-0 relative">
            {/* Regular Page Content */}
            {children}
          </div>
        </ContentWrapper>

        {/* Persistent Terminal (hidden by default) - separate from main content */}
        <PersistentTerminal projectId={id} />
      </div>
    </TerminalProvider>
  );
}