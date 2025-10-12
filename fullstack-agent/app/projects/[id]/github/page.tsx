import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { Github as GithubIcon, GitBranch, GitCommit, GitPullRequest, Link2, ExternalLink, Plus, Check, X } from "lucide-react";

export default async function GitHubRepositoryPage({
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
  });

  if (!project) {
    notFound();
  }

  const isConnected = !!project.githubRepo;

  return (
    <div className="h-full flex flex-col bg-[#1e1e1e]">
      {/* Header */}
      <div className="border-b border-[#3e3e42] bg-[#252526]">
        <div className="px-6 py-4">
          <h1 className="text-xl font-semibold text-white flex items-center gap-2">
            <GithubIcon className="h-5 w-5 text-blue-400" />
            GitHub Repository
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Connect and manage your GitHub repository
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl space-y-6">
          {/* Connection Status */}
          <div className="bg-[#252526] rounded-lg border border-[#3e3e42] p-6">
            <h2 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
              <Link2 className="h-5 w-5" />
              Repository Connection
            </h2>

            {isConnected ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-[#1e1e1e] rounded border border-[#3e3e42]">
                  <div className="flex items-center gap-3">
                    <Check className="h-5 w-5 text-green-400" />
                    <div>
                      <p className="text-sm font-medium text-gray-300">Connected to GitHub</p>
                      <a
                        href={`https://github.com/${project.githubRepo}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 mt-1"
                      >
                        {project.githubRepo}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </div>
                  <button className="px-3 py-1.5 text-sm text-red-400 border border-red-400/30 rounded hover:bg-red-400/10 transition-colors">
                    Disconnect
                  </button>
                </div>

                {/* Repository Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-[#1e1e1e] rounded border border-[#3e3e42]">
                    <p className="text-xs text-gray-400 mb-1 flex items-center gap-1">
                      <GitBranch className="h-3 w-3" />
                      Default Branch
                    </p>
                    <p className="text-sm text-gray-300">main</p>
                  </div>
                  <div className="p-3 bg-[#1e1e1e] rounded border border-[#3e3e42]">
                    <p className="text-xs text-gray-400 mb-1 flex items-center gap-1">
                      <GitCommit className="h-3 w-3" />
                      Last Commit
                    </p>
                    <p className="text-sm text-gray-300">2 hours ago</p>
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="flex gap-3">
                  <a
                    href={`https://github.com/${project.githubRepo}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 bg-[#0e639c] hover:bg-[#1177bb] text-white text-sm rounded transition-colors flex items-center gap-2"
                  >
                    <GithubIcon className="h-4 w-4" />
                    View on GitHub
                  </a>
                  <button className="px-4 py-2 border border-[#3e3e42] text-gray-300 text-sm rounded hover:bg-[#2a2d2e] transition-colors flex items-center gap-2">
                    <GitPullRequest className="h-4 w-4" />
                    Create Pull Request
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-[#1e1e1e] rounded border border-[#3e3e42]">
                  <div className="flex items-center gap-3">
                    <X className="h-5 w-5 text-gray-400" />
                    <div>
                      <p className="text-sm font-medium text-gray-300">Not connected</p>
                      <p className="text-xs text-gray-400 mt-1">Connect a GitHub repository to enable version control</p>
                    </div>
                  </div>
                </div>

                {/* Connect Options */}
                <div className="space-y-3">
                  <button className="w-full p-4 bg-[#1e1e1e] hover:bg-[#252526] border border-[#3e3e42] rounded text-left transition-colors group">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Plus className="h-5 w-5 text-gray-400 group-hover:text-gray-300" />
                        <div>
                          <p className="text-sm text-gray-300">Create New Repository</p>
                          <p className="text-xs text-gray-400">Create a new GitHub repository for this project</p>
                        </div>
                      </div>
                      <span className="text-gray-400 group-hover:text-gray-300">→</span>
                    </div>
                  </button>

                  <button className="w-full p-4 bg-[#1e1e1e] hover:bg-[#252526] border border-[#3e3e42] rounded text-left transition-colors group">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Link2 className="h-5 w-5 text-gray-400 group-hover:text-gray-300" />
                        <div>
                          <p className="text-sm text-gray-300">Connect Existing Repository</p>
                          <p className="text-xs text-gray-400">Link an existing GitHub repository</p>
                        </div>
                      </div>
                      <span className="text-gray-400 group-hover:text-gray-300">→</span>
                    </div>
                  </button>
                </div>

                <div className="mt-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-300">Repository Name</label>
                    <input
                      type="text"
                      placeholder="username/repository"
                      className="w-full px-3 py-2 bg-[#1e1e1e] border border-[#3e3e42] rounded text-sm text-gray-300"
                    />
                    <p className="text-xs text-gray-400">Format: username/repository-name</p>
                  </div>
                  <button className="mt-3 px-4 py-2 bg-[#0e639c] hover:bg-[#1177bb] text-white text-sm rounded transition-colors">
                    Connect Repository
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* GitHub Integration Features */}
          <div className="bg-[#252526] rounded-lg border border-[#3e3e42] p-6">
            <h2 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
              <GithubIcon className="h-5 w-5" />
              GitHub Features
            </h2>

            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-green-400 rounded-full mt-1.5"></div>
                <div>
                  <p className="text-sm text-gray-300">Version Control</p>
                  <p className="text-xs text-gray-400">Track changes and collaborate with Git</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-green-400 rounded-full mt-1.5"></div>
                <div>
                  <p className="text-sm text-gray-300">Automatic Commits</p>
                  <p className="text-xs text-gray-400">AI commits changes with descriptive messages</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-green-400 rounded-full mt-1.5"></div>
                <div>
                  <p className="text-sm text-gray-300">Pull Request Integration</p>
                  <p className="text-xs text-gray-400">Create and manage pull requests</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-gray-400 rounded-full mt-1.5"></div>
                <div>
                  <p className="text-sm text-gray-300">GitHub Actions (Coming Soon)</p>
                  <p className="text-xs text-gray-400">Automated CI/CD workflows</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}