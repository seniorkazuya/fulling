import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { k8sService } from "@/lib/kubernetes";

export async function GET() {
  const session = await auth();

  if (!session || !session.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json([]);
    }

    const projects = await prisma.project.findMany({
      where: {
        userId: user.id,
      },
      orderBy: {
        updatedAt: "desc",
      },
    });

    return NextResponse.json(projects);
  } catch (error) {
    console.error("Error fetching projects:", error);
    return NextResponse.json({ error: "Failed to fetch projects" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session || !session.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { name, description } = body;

    // First, ensure user exists in database
    let user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      // Create user if doesn't exist
      user = await prisma.user.create({
        data: {
          email: session.user.email,
          name: session.user.name,
          githubId: session.user.id,
        },
      });
    }

    // Create project in database
    const project = await prisma.project.create({
      data: {
        name,
        description,
        userId: user.id,
        status: "READY", // Set to READY for now, skip K8s creation
      },
    });

    // TODO: Enable Kubernetes resources creation later
    // For now, just create a mock sandbox entry
    await prisma.sandbox.create({
      data: {
        projectId: project.id,
        k8sNamespace: "default",
        k8sDeploymentName: `sandbox-${project.id}`,
        k8sServiceName: `sandbox-${project.id}`,
        publicUrl: `https://sandbox-${project.id}.dgkwlntjskms.usw.sealos.io`,
        status: "RUNNING",
      },
    });

    return NextResponse.json(project);
  } catch (error) {
    console.error("Error creating project:", error);
    return NextResponse.json({ error: "Failed to create project" }, { status: 500 });
  }
}