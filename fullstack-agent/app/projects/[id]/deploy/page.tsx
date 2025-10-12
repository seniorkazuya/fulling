import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { Rocket, Cloud, Globe, Shield, Zap, CheckCircle, AlertCircle, Clock } from "lucide-react";

export default async function DeployPage({
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
  const isDeployed = sandbox?.status === "running";

  return (
    <div className="h-full flex flex-col bg-[#1e1e1e]">
      {/* Header */}
      <div className="border-b border-[#3e3e42] bg-[#252526]">
        <div className="px-6 py-4">
          <h1 className="text-xl font-semibold text-white flex items-center gap-2">
            <Rocket className="h-5 w-5 text-blue-400" />
            Deploy to Production
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Deploy your application to production environment
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl space-y-6">
          {/* Current Status */}
          <div className="bg-[#252526] rounded-lg border border-[#3e3e42] p-6">
            <h2 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
              <Cloud className="h-5 w-5" />
              Deployment Status
            </h2>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-[#1e1e1e] rounded border border-[#3e3e42]">
                <div className="flex items-center gap-3">
                  {isDeployed ? (
                    <CheckCircle className="h-5 w-5 text-green-400" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-yellow-400" />
                  )}
                  <div>
                    <p className="text-sm font-medium text-gray-300">
                      {isDeployed ? "Application is deployed" : "Application not deployed"}
                    </p>
                    {sandbox?.publicUrl && (
                      <a
                        href={sandbox.publicUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-400 hover:text-blue-300 mt-1"
                      >
                        {sandbox.publicUrl}
                      </a>
                    )}
                  </div>
                </div>
                <button className="px-4 py-2 bg-[#0e639c] hover:bg-[#1177bb] text-white text-sm rounded transition-colors">
                  {isDeployed ? "Redeploy" : "Deploy Now"}
                </button>
              </div>

              {/* Environment Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-[#1e1e1e] rounded border border-[#3e3e42]">
                  <p className="text-xs text-gray-400 mb-1">Environment</p>
                  <p className="text-sm text-gray-300">Production</p>
                </div>
                <div className="p-3 bg-[#1e1e1e] rounded border border-[#3e3e42]">
                  <p className="text-xs text-gray-400 mb-1">Region</p>
                  <p className="text-sm text-gray-300">US West</p>
                </div>
                <div className="p-3 bg-[#1e1e1e] rounded border border-[#3e3e42]">
                  <p className="text-xs text-gray-400 mb-1">Last Deploy</p>
                  <p className="text-sm text-gray-300">
                    {sandbox?.updatedAt ? new Date(sandbox.updatedAt).toLocaleDateString() : "Never"}
                  </p>
                </div>
                <div className="p-3 bg-[#1e1e1e] rounded border border-[#3e3e42]">
                  <p className="text-xs text-gray-400 mb-1">Status</p>
                  <p className="text-sm text-gray-300 flex items-center gap-1">
                    <div className={`w-2 h-2 rounded-full ${isDeployed ? 'bg-green-400' : 'bg-gray-400'}`}></div>
                    {isDeployed ? "Running" : "Not deployed"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Deployment Options */}
          <div className="bg-[#252526] rounded-lg border border-[#3e3e42] p-6">
            <h2 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Deployment Configuration
            </h2>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-[#1e1e1e] rounded border border-[#3e3e42]">
                <div className="flex items-center gap-3">
                  <Globe className="h-4 w-4 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-300">Custom Domain</p>
                    <p className="text-xs text-gray-400">Connect your own domain</p>
                  </div>
                </div>
                <button className="px-3 py-1 text-sm text-gray-300 border border-[#3e3e42] rounded hover:bg-[#2a2d2e] transition-colors">
                  Configure
                </button>
              </div>

              <div className="flex items-center justify-between p-3 bg-[#1e1e1e] rounded border border-[#3e3e42]">
                <div className="flex items-center gap-3">
                  <Shield className="h-4 w-4 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-300">SSL Certificate</p>
                    <p className="text-xs text-gray-400">Auto-provisioned with Let's Encrypt</p>
                  </div>
                </div>
                <span className="text-xs text-green-400">Active</span>
              </div>

              <div className="flex items-center justify-between p-3 bg-[#1e1e1e] rounded border border-[#3e3e42]">
                <div className="flex items-center gap-3">
                  <Clock className="h-4 w-4 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-300">Auto-Deploy</p>
                    <p className="text-xs text-gray-400">Deploy on push to main branch</p>
                  </div>
                </div>
                <button className="px-3 py-1 text-sm text-gray-300 border border-[#3e3e42] rounded hover:bg-[#2a2d2e] transition-colors">
                  Enable
                </button>
              </div>
            </div>
          </div>

          {/* Deployment Steps */}
          <div className="bg-[#252526] rounded-lg border border-[#3e3e42] p-6">
            <h3 className="text-sm font-medium text-gray-300 mb-3">
              Deployment Process:
            </h3>
            <ol className="text-xs text-gray-400 space-y-2 list-decimal list-inside">
              <li>Code is built and optimized for production</li>
              <li>Environment variables are securely injected</li>
              <li>Application is containerized and deployed</li>
              <li>SSL certificate is provisioned automatically</li>
              <li>Application becomes available at your URL</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}