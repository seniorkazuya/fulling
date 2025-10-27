import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { k8sService } from "@/lib/kubernetes";

// Sync database info from Kubernetes to database
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

    // Check if database info is already saved
    if (sandbox.dbHost && sandbox.dbPassword) {
      return NextResponse.json({
        message: "Database info already synced",
        database: {
          host: sandbox.dbHost,
          port: sandbox.dbPort,
          name: sandbox.dbName,
          user: sandbox.dbUser,
          password: sandbox.dbPassword,
        }
      });
    }

    // Fetch database info from Kubernetes
    try {
      const k8sNamespace = sandbox.k8sNamespace || k8sService.getDefaultNamespace();
      const dbInfo = await k8sService.getDatabaseSecret(project.name, k8sNamespace);

      // Update sandbox with database info
      const updatedSandbox = await prisma.sandbox.update({
        where: { id: sandbox.id },
        data: {
          dbHost: dbInfo.host,
          dbPort: dbInfo.port,
          dbName: dbInfo.database,
          dbUser: dbInfo.username,
          dbPassword: dbInfo.password,
        },
      });

      return NextResponse.json({
        message: "Database info synced successfully",
        database: {
          host: updatedSandbox.dbHost,
          port: updatedSandbox.dbPort,
          name: updatedSandbox.dbName,
          user: updatedSandbox.dbUser,
          password: updatedSandbox.dbPassword,
        }
      });
    } catch (k8sError) {
      console.error("Failed to get database info from Kubernetes:", k8sError);

      // Try to parse from environment variables or use defaults
      const defaultDb = {
        host: `${project.name.toLowerCase().replace(/[^a-z0-9-]/g, '').substring(0, 20)}-postgresql`,
        port: 5432,
        database: 'postgres',
        username: 'postgres',
        password: null,
      };

      return NextResponse.json({
        error: "Could not fetch database credentials from Kubernetes",
        defaultDatabase: defaultDb,
      }, { status: 500 });
    }
  } catch (error) {
    console.error("Error syncing database info:", error);
    return NextResponse.json({ error: "Failed to sync database info" }, { status: 500 });
  }
}

// Get current database info
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

    // If database info exists in database, return it
    if (sandbox.dbHost && sandbox.dbPassword) {
      return NextResponse.json({
        database: {
          host: sandbox.dbHost,
          port: sandbox.dbPort,
          name: sandbox.dbName,
          user: sandbox.dbUser,
          password: sandbox.dbPassword,
          connectionString: `postgresql://${sandbox.dbUser}:${sandbox.dbPassword}@${sandbox.dbHost}:${sandbox.dbPort}/${sandbox.dbName}?schema=public`
        }
      });
    }

    // Otherwise try to fetch from Kubernetes
    try {
      const k8sNamespace = sandbox.k8sNamespace || k8sService.getDefaultNamespace();
      const dbInfo = await k8sService.getDatabaseSecret(project.name, k8sNamespace);

      // Save it for future use
      await prisma.sandbox.update({
        where: { id: sandbox.id },
        data: {
          dbHost: dbInfo.host,
          dbPort: dbInfo.port,
          dbName: dbInfo.database,
          dbUser: dbInfo.username,
          dbPassword: dbInfo.password,
        },
      });

      return NextResponse.json({
        database: {
          host: dbInfo.host,
          port: dbInfo.port,
          name: dbInfo.database,
          user: dbInfo.username,
          password: dbInfo.password,
          connectionString: `postgresql://${dbInfo.username}:${dbInfo.password}@${dbInfo.host}:${dbInfo.port}/${dbInfo.database}?schema=public`
        }
      });
    } catch (k8sError) {
      return NextResponse.json({
        error: "No database configured",
        message: "Could not fetch database info from Kubernetes"
      }, { status: 404 });
    }
  } catch (error) {
    console.error("Error getting database info:", error);
    return NextResponse.json({ error: "Failed to get database info" }, { status: 500 });
  }
}