import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Github, Settings, ExternalLink, Terminal as TerminalIcon } from "lucide-react";
import Link from "next/link";
import TerminalWrapper from "@/components/terminal-wrapper";

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
    <div className="min-h-screen bg-black text-white">
      <div className="container mx-auto py-8 px-4">
        <div className="flex justify-between items-start mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">{project.name}</h1>
            <p className="text-gray-400">{project.description || "No description"}</p>
          </div>
          <div className="flex gap-2">
            <Badge variant={getStatusVariant(project.status)}>
              {project.status}
            </Badge>
            <Link href={`/projects/${id}/settings`}>
              <Button variant="outline" size="sm" className="border-gray-700 text-white hover:bg-gray-800">
                <Settings className="h-4 w-4" />
              </Button>
            </Link>
            {project.githubRepo && (
              <a
                href={`https://github.com/${project.githubRepo}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button variant="outline" size="sm" className="border-gray-700 text-white hover:bg-gray-800">
                  <Github className="h-4 w-4" />
                </Button>
              </a>
            )}
          </div>
        </div>

        <Tabs defaultValue="terminal" className="w-full">
          <TabsList className="bg-gray-900 border-gray-800">
            <TabsTrigger value="terminal" className="data-[state=active]:bg-gray-800">
              <TerminalIcon className="mr-2 h-4 w-4" />
              Terminal
            </TabsTrigger>
            <TabsTrigger value="environment" className="data-[state=active]:bg-gray-800">
              Environment
            </TabsTrigger>
            <TabsTrigger value="deployment" className="data-[state=active]:bg-gray-800">
              Deployment
            </TabsTrigger>
          </TabsList>

          <TabsContent value="terminal" className="mt-4">
            <Card className="bg-gray-900 border-gray-800">
              <CardHeader>
                <CardTitle className="text-white">Development Environment</CardTitle>
                <CardDescription className="text-gray-400">
                  Claude Code is running in your isolated sandbox
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[600px]">
                  <TerminalWrapper projectId={id} sandboxUrl={sandbox?.publicUrl} />
                </div>
                {sandbox?.publicUrl && (
                  <div className="mt-4 flex items-center justify-between p-4 bg-gray-800 rounded-lg">
                    <span className="text-sm text-gray-400">Application URL:</span>
                    <a
                      href={sandbox.publicUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center text-blue-400 hover:text-blue-300"
                    >
                      {sandbox.publicUrl}
                      <ExternalLink className="ml-2 h-4 w-4" />
                    </a>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="environment" className="mt-4">
            <Card className="bg-gray-900 border-gray-800">
              <CardHeader>
                <CardTitle className="text-white">Environment Variables</CardTitle>
                <CardDescription className="text-gray-400">
                  Manage your application environment variables
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {project.environmentVariables.length === 0 ? (
                    <p className="text-gray-500">No environment variables configured</p>
                  ) : (
                    project.environmentVariables.map((env) => (
                      <div key={env.id} className="flex justify-between items-center p-3 bg-gray-800 rounded">
                        <span className="font-mono text-sm">{env.key}</span>
                        <Badge variant="outline" className="text-gray-400">
                          {env.category || "general"}
                        </Badge>
                      </div>
                    ))
                  )}
                  <Link href={`/projects/${id}/environment`}>
                    <Button className="bg-white text-black hover:bg-gray-200">
                      Configure Environment
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="deployment" className="mt-4">
            <Card className="bg-gray-900 border-gray-800">
              <CardHeader>
                <CardTitle className="text-white">Deployment</CardTitle>
                <CardDescription className="text-gray-400">
                  Deploy your application to production
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {!project.githubRepo ? (
                    <div>
                      <p className="text-gray-400 mb-4">
                        Connect a GitHub repository to enable deployment
                      </p>
                      <Link href={`/projects/${id}/github`}>
                        <Button className="bg-white text-black hover:bg-gray-200">
                          <Github className="mr-2 h-4 w-4" />
                          Connect GitHub
                        </Button>
                      </Link>
                    </div>
                  ) : (
                    <div>
                      <p className="text-gray-400 mb-4">
                        Ready to deploy to GitHub repository: {project.githubRepo}
                      </p>
                      <Button className="bg-white text-black hover:bg-gray-200">
                        Deploy Now
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
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