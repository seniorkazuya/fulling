import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Folder, ExternalLink } from "lucide-react";

export default async function ProjectsPage() {
  const session = await auth();

  if (!session || !session.user?.email) {
    redirect("/login");
  }

  // Find user by email
  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });

  const projects = user ? await prisma.project.findMany({
    where: {
      userId: user.id,
    },
    orderBy: {
      updatedAt: "desc",
    },
  }) : [];

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="container mx-auto py-8 px-4">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">Your Projects</h1>
            <p className="text-gray-400">Manage and deploy your AI-powered applications</p>
          </div>
          <Link href="/projects/new">
            <Button className="bg-white text-black hover:bg-gray-200">
              <Plus className="mr-2 h-4 w-4" />
              New Project
            </Button>
          </Link>
        </div>

        {projects.length === 0 ? (
          <Card className="bg-gray-900 border-gray-800">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <Folder className="h-16 w-16 text-gray-600 mb-4" />
              <h2 className="text-xl font-semibold text-white mb-2">No projects yet</h2>
              <p className="text-gray-400 mb-6">Create your first AI-powered application</p>
              <Link href="/projects/new">
                <Button className="bg-white text-black hover:bg-gray-200">
                  <Plus className="mr-2 h-4 w-4" />
                  Create Project
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project) => (
              <Card key={project.id} className="bg-gray-900 border-gray-800 hover:border-gray-700 transition-colors">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-white">{project.name}</CardTitle>
                    <Badge variant={getStatusVariant(project.status)} className="ml-2">
                      {project.status}
                    </Badge>
                  </div>
                  <CardDescription className="text-gray-400">
                    {project.description || "No description"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex justify-between items-center">
                    <Link href={`/projects/${project.id}`}>
                      <Button variant="outline" size="sm" className="border-gray-700 text-white hover:bg-gray-800">
                        Open
                      </Button>
                    </Link>
                    {project.githubRepo && (
                      <a
                        href={`https://github.com/${project.githubRepo}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white">
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </a>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function getStatusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "READY":
    case "DEPLOYED":
      return "default";
    case "INITIALIZING":
    case "DEPLOYING":
      return "secondary";
    case "ERROR":
      return "destructive";
    default:
      return "outline";
  }
}