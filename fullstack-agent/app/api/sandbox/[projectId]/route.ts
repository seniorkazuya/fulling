import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { k8sService } from "@/lib/kubernetes";
import { NextResponse } from "next/server";

// Get sandbox status
export async function GET(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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
      return NextResponse.json({
        status: "not_created",
        message: "Sandbox not created yet"
      });
    }

    // Check Kubernetes pod status
    try {
      const status = await k8sService.getSandboxStatus(project.name, sandbox.k8sNamespace);

      return NextResponse.json({
        status: status.toLowerCase(),
        sandbox: {
          id: sandbox.id,
          publicUrl: sandbox.publicUrl,
          ttydUrl: sandbox.ttydUrl,
          status: sandbox.status,
        }
      });
    } catch (error) {
      console.error("Error checking sandbox status:", error);
      return NextResponse.json({
        status: "error",
        error: "Failed to check sandbox status"
      });
    }
  } catch (error) {
    console.error("Error getting sandbox status:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Create or start sandbox
export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const envVars = body.envVars || {};

    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        userId: session.user.id,
      },
      include: {
        sandboxes: true,
        environmentVariables: true,
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Check if sandbox already exists
    let sandbox = project.sandboxes[0];
    if (sandbox) {
      // Check if pod is running
      const status = await k8sService.getSandboxStatus(project.name, sandbox.k8sNamespace);

      if (status === 'RUNNING') {
        return NextResponse.json({
          status: "already_running",
          message: "Sandbox is already running",
          sandbox: {
            id: sandbox.id,
            publicUrl: sandbox.publicUrl,
            ttydUrl: sandbox.ttydUrl,
          }
        });
      }

      // If not running, delete the old deployment and create a new one
      try {
        await k8sService.deleteSandbox(project.name, sandbox.k8sNamespace);
      } catch (error) {
        console.log("Failed to delete old sandbox, continuing...");
      }
    }

    // Prepare environment variables from project settings
    const projectEnvVars: Record<string, string> = {};
    project.environmentVariables.forEach(envVar => {
      projectEnvVars[envVar.key] = envVar.value;
    });

    // Merge with additional env vars from request
    const allEnvVars = { ...projectEnvVars, ...envVars };

    // Use the namespace from kubeconfig
    const k8sNamespace = k8sService.getDefaultNamespace();

    try {
      let databaseCredentials = undefined;
      let needCreateDatabase = false;

      // Check if database really exists in Kubernetes
      if (project.databaseUrl) {
        try {
          console.log(`🔍 Checking if database exists for project: ${project.name}`);
          const dbInfo = await k8sService.getDatabaseSecret(project.name, k8sNamespace);
          console.log(`✅ Found existing database: ${dbInfo.clusterName}`);
          databaseCredentials = dbInfo;
        } catch (error) {
          console.log(`⚠️ Database URL exists but cluster not found, will create new database`);
          needCreateDatabase = true;
        }
      } else {
        needCreateDatabase = true;
      }

      // Create database if needed
      if (needCreateDatabase) {
        console.log(`🔧 Creating new database for project: ${project.name}`);
        const dbInfo = await k8sService.createPostgreSQLDatabase(project.name, k8sNamespace);

        // Store database credentials to pass to sandbox
        databaseCredentials = dbInfo;

        // Update project with database URL
        const databaseUrl = `postgresql://${dbInfo.username}:${dbInfo.password}@${dbInfo.host}:${dbInfo.port}/${dbInfo.database}?schema=public`;
        await prisma.project.update({
          where: { id: projectId },
          data: {
            databaseUrl: databaseUrl,
          },
        });

        // Also save DATABASE_URL as an environment variable for easy access
        const existingDbUrlVar = await prisma.environment.findFirst({
          where: {
            projectId: projectId,
            key: "DATABASE_URL",
          },
        });

        if (existingDbUrlVar) {
          await prisma.environment.update({
            where: { id: existingDbUrlVar.id },
            data: {
              value: databaseUrl,
            },
          });
        } else {
          await prisma.environment.create({
            data: {
              projectId: projectId,
              key: "DATABASE_URL",
              value: databaseUrl,
              category: "database",
              isSecret: true,
            },
          });
        }

        console.log(`✅ Database created and environment variables updated`);
      }

      // Create sandbox deployment with database credentials
      const sandboxInfo = await k8sService.createSandbox(project.name, allEnvVars, k8sNamespace, databaseCredentials);

      // Update or create sandbox record with database credentials
      if (sandbox) {
        sandbox = await prisma.sandbox.update({
          where: { id: sandbox.id },
          data: {
            k8sNamespace,
            k8sDeploymentName: sandboxInfo.deploymentName,
            k8sServiceName: sandboxInfo.serviceName,
            publicUrl: sandboxInfo.publicUrl,
            ttydUrl: sandboxInfo.ttydUrl,
            // Save database connection info
            dbHost: databaseCredentials?.host || null,
            dbPort: databaseCredentials?.port || null,
            dbName: databaseCredentials?.database || null,
            dbUser: databaseCredentials?.username || null,
            dbPassword: databaseCredentials?.password || null,
            status: "CREATING",
          },
        });
      } else {
        sandbox = await prisma.sandbox.create({
          data: {
            projectId: projectId,
            k8sNamespace,
            k8sDeploymentName: sandboxInfo.deploymentName,
            k8sServiceName: sandboxInfo.serviceName,
            publicUrl: sandboxInfo.publicUrl,
            ttydUrl: sandboxInfo.ttydUrl,
            // Save database connection info
            dbHost: databaseCredentials?.host || null,
            dbPort: databaseCredentials?.port || null,
            dbName: databaseCredentials?.database || null,
            dbUser: databaseCredentials?.username || null,
            dbPassword: databaseCredentials?.password || null,
            status: "CREATING",
          },
        });
      }

      // Wait a bit for the pod to start
      setTimeout(async () => {
        const status = await k8sService.getSandboxStatus(project.name, k8sNamespace);
        if (status === 'RUNNING') {
          await prisma.sandbox.update({
            where: { id: sandbox.id },
            data: { status: "RUNNING" },
          });
        }
      }, 5000);

      return NextResponse.json({
        status: "created",
        message: "Sandbox is being created",
        sandbox: {
          id: sandbox.id,
          publicUrl: sandboxInfo.publicUrl,
          ttydUrl: sandboxInfo.ttydUrl,
        }
      });
    } catch (error) {
      console.error("Error creating Kubernetes resources:", error);

      // Extract more detailed error information
      let errorMessage = "Failed to create sandbox";
      let errorDetails = {};

      if (error instanceof Error) {
        errorMessage = error.message;
        errorDetails = {
          name: error.name,
          message: error.message,
          stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        };
      } else if (typeof error === 'object' && error !== null) {
        errorDetails = error;
      }

      // Try to get additional context from Kubernetes if possible
      try {
        const status = await k8sService.getSandboxStatus(project.name, k8sNamespace);
        errorDetails = { ...errorDetails, kuberneteStatus: status };
      } catch (statusError) {
        // Ignore status check errors during error handling
      }

      return NextResponse.json(
        {
          error: errorMessage,
          details: errorDetails,
          projectId,
          timestamp: new Date().toISOString()
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Error creating sandbox:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Stop sandbox
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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
      return NextResponse.json({
        status: "not_found",
        message: "No sandbox to delete"
      });
    }

    try {
      // Delete Kubernetes resources
      await k8sService.deleteSandbox(project.name, sandbox.k8sNamespace);

      // Update sandbox status
      await prisma.sandbox.update({
        where: { id: sandbox.id },
        data: { status: "TERMINATED" },
      });

      return NextResponse.json({
        status: "terminated",
        message: "Sandbox has been terminated"
      });
    } catch (error) {
      console.error("Error deleting Kubernetes resources:", error);
      return NextResponse.json({
        status: "error",
        error: "Failed to delete sandbox"
      });
    }
  } catch (error) {
    console.error("Error stopping sandbox:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}