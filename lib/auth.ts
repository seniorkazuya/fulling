import NextAuth from 'next-auth';
import GithubProvider from 'next-auth/providers/github';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { prisma } from '@/lib/db';

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    GithubProvider({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: 'read:user user:email repo',
        },
      },
    }),
  ],
  callbacks: {
    async session({ session, token, user }) {
      if (session.user) {
        session.user.id = user.id;
        // Get the user's GitHub token from the database
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
        });
        if (dbUser?.githubToken) {
          session.user.githubToken = dbUser.githubToken;
        }
      }
      return session;
    },
    async signIn({ user, account }) {
      if (account?.provider === 'github' && account.access_token) {
        // Save the GitHub access token
        await prisma.user.update({
          where: { id: user.id! },
          data: {
            githubToken: account.access_token,
            githubId: account.providerAccountId,
          },
        });
      }
      return true;
    },
  },
  pages: {
    signIn: '/login',
    error: '/error',
  },
  secret: process.env.NEXTAUTH_SECRET,
});

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email?: string | null;
      name?: string | null;
      image?: string | null;
      githubToken?: string;
    };
  }
}