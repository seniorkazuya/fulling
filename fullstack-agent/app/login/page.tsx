"use client";

import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Github } from "lucide-react";

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center">
      <Card className="w-full max-w-md bg-gray-900 border-gray-800">
        <CardHeader>
          <CardTitle className="text-2xl text-white">Welcome to FullStack Agent</CardTitle>
          <CardDescription className="text-gray-400">
            Sign in with your GitHub account to get started
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={() => signIn("github", { callbackUrl: "/projects" })}
            className="w-full bg-white text-black hover:bg-gray-200"
            size="lg"
          >
            <Github className="mr-2 h-5 w-5" />
            Continue with GitHub
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}