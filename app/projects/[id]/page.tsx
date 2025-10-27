import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import ProjectTerminalView from "@/components/project-terminal-view";

export default async function ProjectDetailPage({
  params,
}: {
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

  const sandbox = project.sandboxes[0];

  return (
    <ProjectTerminalView
      project={project}
      sandbox={sandbox}
    />
  );
}