"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Trash2, Plus, Save, Key, CreditCard, Shield } from "lucide-react";

interface EnvVariable {
  id?: string;
  key: string;
  value: string;
  category: string;
  isSecret: boolean;
}

export default function EnvironmentPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const [envVars, setEnvVars] = useState<EnvVariable[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Authentication config templates
  const [googleAuth, setGoogleAuth] = useState({
    clientId: "",
    clientSecret: "",
  });

  const [githubAuth, setGithubAuth] = useState({
    clientId: "",
    clientSecret: "",
  });

  // Payment config
  const [stripeConfig, setStripeConfig] = useState({
    publishableKey: "",
    secretKey: "",
    webhookSecret: "",
  });

  useEffect(() => {
    fetchEnvironmentVariables();
  }, [projectId]);

  const fetchEnvironmentVariables = async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}/environment`);
      const data = await response.json();

      setEnvVars(data.general || []);

      // Parse auth configs
      const authVars = data.auth || [];
      authVars.forEach((env: EnvVariable) => {
        if (env.key === "GOOGLE_CLIENT_ID") setGoogleAuth(prev => ({ ...prev, clientId: env.value }));
        if (env.key === "GOOGLE_CLIENT_SECRET") setGoogleAuth(prev => ({ ...prev, clientSecret: env.value }));
        if (env.key === "GITHUB_CLIENT_ID") setGithubAuth(prev => ({ ...prev, clientId: env.value }));
        if (env.key === "GITHUB_CLIENT_SECRET") setGithubAuth(prev => ({ ...prev, clientSecret: env.value }));
      });

      // Parse payment configs
      const paymentVars = data.payment || [];
      paymentVars.forEach((env: EnvVariable) => {
        if (env.key === "STRIPE_PUBLISHABLE_KEY") setStripeConfig(prev => ({ ...prev, publishableKey: env.value }));
        if (env.key === "STRIPE_SECRET_KEY") setStripeConfig(prev => ({ ...prev, secretKey: env.value }));
        if (env.key === "STRIPE_WEBHOOK_SECRET") setStripeConfig(prev => ({ ...prev, webhookSecret: env.value }));
      });

      setLoading(false);
    } catch (error) {
      console.error("Error fetching environment variables:", error);
      toast.error("Failed to load environment variables");
      setLoading(false);
    }
  };

  const addEnvVar = () => {
    setEnvVars([...envVars, { key: "", value: "", category: "general", isSecret: false }]);
  };

  const removeEnvVar = (index: number) => {
    setEnvVars(envVars.filter((_, i) => i !== index));
  };

  const updateEnvVar = (index: number, field: keyof EnvVariable, value: any) => {
    const updated = [...envVars];
    updated[index] = { ...updated[index], [field]: value };
    setEnvVars(updated);
  };

  const saveEnvironment = async () => {
    setSaving(true);

    // Prepare all environment variables
    const allVars: EnvVariable[] = [
      ...envVars,
      // Google Auth
      ...(googleAuth.clientId ? [
        { key: "GOOGLE_CLIENT_ID", value: googleAuth.clientId, category: "auth", isSecret: false },
        { key: "GOOGLE_CLIENT_SECRET", value: googleAuth.clientSecret, category: "auth", isSecret: true },
      ] : []),
      // GitHub Auth
      ...(githubAuth.clientId ? [
        { key: "GITHUB_CLIENT_ID", value: githubAuth.clientId, category: "auth", isSecret: false },
        { key: "GITHUB_CLIENT_SECRET", value: githubAuth.clientSecret, category: "auth", isSecret: true },
      ] : []),
      // Stripe
      ...(stripeConfig.publishableKey ? [
        { key: "STRIPE_PUBLISHABLE_KEY", value: stripeConfig.publishableKey, category: "payment", isSecret: false },
        { key: "STRIPE_SECRET_KEY", value: stripeConfig.secretKey, category: "payment", isSecret: true },
        { key: "STRIPE_WEBHOOK_SECRET", value: stripeConfig.webhookSecret, category: "payment", isSecret: true },
      ] : []),
    ];

    try {
      const response = await fetch(`/api/projects/${projectId}/environment`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ variables: allVars }),
      });

      if (!response.ok) {
        throw new Error("Failed to save environment variables");
      }

      toast.success("Environment variables saved successfully");
      router.push(`/projects/${projectId}`);
    } catch (error) {
      console.error("Error saving environment variables:", error);
      toast.error("Failed to save environment variables");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="container mx-auto py-8 px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Environment Configuration</h1>
          <p className="text-gray-400">Configure environment variables for your application</p>
        </div>

        <Tabs defaultValue="general" className="w-full">
          <TabsList className="bg-gray-900 border-gray-800">
            <TabsTrigger value="general" className="data-[state=active]:bg-gray-800">
              <Key className="mr-2 h-4 w-4" />
              General
            </TabsTrigger>
            <TabsTrigger value="auth" className="data-[state=active]:bg-gray-800">
              <Shield className="mr-2 h-4 w-4" />
              Authentication
            </TabsTrigger>
            <TabsTrigger value="payment" className="data-[state=active]:bg-gray-800">
              <CreditCard className="mr-2 h-4 w-4" />
              Payment
            </TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="mt-4">
            <Card className="bg-gray-900 border-gray-800">
              <CardHeader>
                <CardTitle className="text-white">General Environment Variables</CardTitle>
                <CardDescription className="text-gray-400">
                  Add custom environment variables for your application
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {envVars.map((env, index) => (
                  <div key={index} className="flex gap-2">
                    <Input
                      placeholder="KEY"
                      value={env.key}
                      onChange={(e) => updateEnvVar(index, "key", e.target.value.toUpperCase())}
                      className="bg-gray-800 border-gray-700 text-white"
                    />
                    <Input
                      placeholder="Value"
                      type={env.isSecret ? "password" : "text"}
                      value={env.value}
                      onChange={(e) => updateEnvVar(index, "value", e.target.value)}
                      className="bg-gray-800 border-gray-700 text-white"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => removeEnvVar(index)}
                      className="border-gray-700 text-white hover:bg-gray-800"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  onClick={addEnvVar}
                  variant="outline"
                  className="border-gray-700 text-white hover:bg-gray-800"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Variable
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="auth" className="mt-4">
            <div className="space-y-4">
              <Card className="bg-gray-900 border-gray-800">
                <CardHeader>
                  <CardTitle className="text-white">Google Authentication</CardTitle>
                  <CardDescription className="text-gray-400">
                    Configure Google OAuth for your application
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label className="text-white">Client ID</Label>
                    <Input
                      placeholder="your-google-client-id.apps.googleusercontent.com"
                      value={googleAuth.clientId}
                      onChange={(e) => setGoogleAuth({ ...googleAuth, clientId: e.target.value })}
                      className="bg-gray-800 border-gray-700 text-white"
                    />
                  </div>
                  <div>
                    <Label className="text-white">Client Secret</Label>
                    <Input
                      type="password"
                      placeholder="Your Google Client Secret"
                      value={googleAuth.clientSecret}
                      onChange={(e) => setGoogleAuth({ ...googleAuth, clientSecret: e.target.value })}
                      className="bg-gray-800 border-gray-700 text-white"
                    />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gray-900 border-gray-800">
                <CardHeader>
                  <CardTitle className="text-white">GitHub Authentication</CardTitle>
                  <CardDescription className="text-gray-400">
                    Configure GitHub OAuth for your application
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label className="text-white">Client ID</Label>
                    <Input
                      placeholder="Your GitHub OAuth App Client ID"
                      value={githubAuth.clientId}
                      onChange={(e) => setGithubAuth({ ...githubAuth, clientId: e.target.value })}
                      className="bg-gray-800 border-gray-700 text-white"
                    />
                  </div>
                  <div>
                    <Label className="text-white">Client Secret</Label>
                    <Input
                      type="password"
                      placeholder="Your GitHub OAuth App Client Secret"
                      value={githubAuth.clientSecret}
                      onChange={(e) => setGithubAuth({ ...githubAuth, clientSecret: e.target.value })}
                      className="bg-gray-800 border-gray-700 text-white"
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="payment" className="mt-4">
            <Card className="bg-gray-900 border-gray-800">
              <CardHeader>
                <CardTitle className="text-white">Stripe Configuration</CardTitle>
                <CardDescription className="text-gray-400">
                  Configure Stripe payment integration
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-white">Publishable Key</Label>
                  <Input
                    placeholder="pk_test_..."
                    value={stripeConfig.publishableKey}
                    onChange={(e) => setStripeConfig({ ...stripeConfig, publishableKey: e.target.value })}
                    className="bg-gray-800 border-gray-700 text-white"
                  />
                </div>
                <div>
                  <Label className="text-white">Secret Key</Label>
                  <Input
                    type="password"
                    placeholder="sk_test_..."
                    value={stripeConfig.secretKey}
                    onChange={(e) => setStripeConfig({ ...stripeConfig, secretKey: e.target.value })}
                    className="bg-gray-800 border-gray-700 text-white"
                  />
                </div>
                <div>
                  <Label className="text-white">Webhook Secret</Label>
                  <Input
                    type="password"
                    placeholder="whsec_..."
                    value={stripeConfig.webhookSecret}
                    onChange={(e) => setStripeConfig({ ...stripeConfig, webhookSecret: e.target.value })}
                    className="bg-gray-800 border-gray-700 text-white"
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="mt-8 flex gap-4">
          <Button
            onClick={saveEnvironment}
            disabled={saving}
            className="bg-white text-black hover:bg-gray-200"
          >
            <Save className="mr-2 h-4 w-4" />
            {saving ? "Saving..." : "Save Environment"}
          </Button>
          <Button
            onClick={() => router.back()}
            variant="outline"
            className="border-gray-700 text-white hover:bg-gray-800"
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}