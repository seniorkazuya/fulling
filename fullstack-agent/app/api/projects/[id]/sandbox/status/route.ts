import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { k8sService } from "@/lib/kubernetes";

// Get current sandbox status from Kubernetes and update database if needed
export async function GET(
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

    // Get real-time status from Kubernetes
    const k8sNamespace = sandbox.k8sNamespace || k8sService.getDefaultNamespace();
    console.log(`🔍 Getting sandbox status - Project ID: ${project.id}, Project Name: ${project.name}, Namespace: ${k8sNamespace}`);
    const k8sStatus = await k8sService.getSandboxStatus(project.name, k8sNamespace);

    // Update database if status changed
    if (k8sStatus !== sandbox.status) {
      const updatedSandbox = await prisma.sandbox.update({
        where: { id: sandbox.id },
        data: {
          status: k8sStatus,
          updatedAt: new Date(),
        },
      });
      return NextResponse.json({
        status: k8sStatus,
        lastUpdated: updatedSandbox.updatedAt,
        message: `Status updated to ${k8sStatus}`,
      });
    }

    return NextResponse.json({
      status: k8sStatus,
      lastUpdated: sandbox.updatedAt,
    });
  } catch (error: unknown) {
    console.error("Error getting sandbox status:", error);

    // Handle specific Kubernetes errors
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes("not found")) {
      return NextResponse.json({ error: "Sandbox not found in cluster" }, { status: 404 });
    }

    return NextResponse.json(
      { error: "Failed to get sandbox status", details: errorMessage },
      { status: 500 }
    );
  }
}