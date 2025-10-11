import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const project = await prisma.project.findFirst({
      where: {
        id: id,
        userId: session.user.id,
      },
      include: {
        environmentVariables: true,
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Group environment variables by category
    const grouped = {
      general: project.environmentVariables.filter(e => !e.category || e.category === "general"),
      auth: project.environmentVariables.filter(e => e.category === "auth"),
      payment: project.environmentVariables.filter(e => e.category === "payment"),
    };

    return NextResponse.json(grouped);
  } catch (error) {
    console.error("Error fetching environment variables:", error);
    return NextResponse.json({ error: "Failed to fetch environment variables" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const project = await prisma.project.findFirst({
      where: {
        id: id,
        userId: session.user.id,
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const body = await request.json();
    const { variables } = body;

    // Delete existing environment variables
    await prisma.environment.deleteMany({
      where: {
        projectId: id,
      },
    });

    // Create new environment variables
    const envPromises = variables
      .filter((v: any) => v.key && v.value)
      .map((v: any) =>
        prisma.environment.create({
          data: {
            projectId: id,
            key: v.key,
            value: v.value,
            category: v.category || "general",
            isSecret: v.isSecret || false,
          },
        })
      );

    await Promise.all(envPromises);

    // TODO: Update Kubernetes ConfigMap with new environment variables

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error saving environment variables:", error);
    return NextResponse.json({ error: "Failed to save environment variables" }, { status: 500 });
  }
}