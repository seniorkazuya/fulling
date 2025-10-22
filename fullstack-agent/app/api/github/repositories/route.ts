import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createGitHubClient } from "@/lib/github";

// Get user's GitHub repositories
export async function GET(request: NextRequest) {
  const session = await auth();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Get user with GitHub token
    const user = await prisma.user.findUnique({
      where: {
        id: session.user.id,
      },
      select: {
        githubToken: true,
      },
    });

    if (!user || !user.githubToken) {
      return NextResponse.json(
        { error: "GitHub account not connected. Please reconnect your GitHub account." },
        { status: 400 }
      );
    }

    // Fetch repositories using GitHub API
    const githubClient = createGitHubClient(user.githubToken);
    const allRepos = await githubClient.listRepos();

    // Get authenticated user info to filter only owned repos
    const githubUser = await githubClient.getUser();

    // Filter to only include repositories owned by the user
    const ownedRepos = allRepos.filter(
      (repo) => repo.owner.login === githubUser.login
    );

    // Format response with essential information
    const formattedRepos = ownedRepos.map((repo) => ({
      name: repo.name,
      fullName: repo.full_name,
      private: repo.private,
      description: repo.description,
    }));

    return NextResponse.json({
      repositories: formattedRepos,
      count: formattedRepos.length,
    });
  } catch (error: any) {
    console.error("Error fetching GitHub repositories:", error);

    // Handle GitHub API rate limiting
    if (error.status === 403) {
      return NextResponse.json(
        { error: "GitHub API rate limit exceeded. Please try again later." },
        { status: 429 }
      );
    }

    // Handle invalid or expired token
    if (error.status === 401) {
      return NextResponse.json(
        { error: "GitHub token is invalid or expired. Please reconnect your GitHub account." },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: "Failed to fetch GitHub repositories" },
      { status: 500 }
    );
  }
}
