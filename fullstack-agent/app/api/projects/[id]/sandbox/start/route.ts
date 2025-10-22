import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { k8sService } from "@/lib/kubernetes";

// Start sandbox by setting deployment replicas to 1
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: projectId } = await params;

  try {
    // Get project with sandbox
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        userId: session.user.id,
      },
      include: {
        sandboxes: true,
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const sandbox = project.sandboxes[0];
    if (!sandbox) {
      return NextResponse.json({ error: "No sandbox found" }, { status: 404 });
    }

    // Call Kubernetes service to start the sandbox
    const k8sNamespace = sandbox.k8sNamespace || k8sService.getDefaultNamespace();
    await k8sService.startSandbox(project.id, k8sNamespace);

    // Update sandbox status in database
    const updatedSandbox = await prisma.sandbox.update({
      where: { id: sandbox.id },
      data: {
        status: "RUNNING",
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({
      message: "Sandbox started successfully",
      sandbox: {
        id: updatedSandbox.id,
        status: updatedSandbox.status,
        updatedAt: updatedSandbox.updatedAt,
      },
    });
  } catch (error: unknown) {
    console.error("Error starting sandbox:", error);

    // Handle specific Kubernetes errors
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes("not found")) {
      return NextResponse.json({ error: "Sandbox not found in cluster" }, { status: 404 });
    }

    return NextResponse.json(
      { error: "Failed to start sandbox", details: errorMessage },
      { status: 500 }
    );
  }
}