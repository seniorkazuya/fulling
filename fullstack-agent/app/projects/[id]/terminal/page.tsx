import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import Terminal from "@/components/terminal";

export default async function TerminalPage({
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
    },
  });

  if (!project) {
    notFound();
  }

  const sandbox = project.sandboxes[0];

  if (!sandbox) {
    redirect(`/projects/${id}`);
  }

  return <Terminal sandbox={sandbox} projectId={id} />;
}