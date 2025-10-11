import NextAuth from 'next-auth';
import GitHub from 'next-auth/providers/github';
// import { PrismaAdapter } from '@auth/prisma-adapter';
import { prisma } from '@/lib/db';

export const { handlers, signIn, signOut, auth } = NextAuth({
  // adapter: PrismaAdapter(prisma) as any,
  providers: [
    GitHub({
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
    async signIn({ user, account, profile }) {
      if (account?.provider === 'github') {
        try {
          // Check if user exists in database
          const existingUser = await prisma.user.findFirst({
            where: {
              OR: [
                { githubId: account.providerAccountId },
                { email: user.email! }
              ]
            }
          });

          if (existingUser) {
            // Update GitHub ID if needed
            if (!existingUser.githubId) {
              await prisma.user.update({
                where: { id: existingUser.id },
                data: { githubId: account.providerAccountId }
              });
            }
          } else {
            // Create new user
            await prisma.user.create({
              data: {
                email: user.email!,
                name: user.name || profile?.name || '',
                githubId: account.providerAccountId,
                githubToken: account.access_token
              }
            });
          }
        } catch (error) {
          console.error('Error in signIn callback:', error);
          return false;
        }
      }
      return true;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        // Get the actual user ID from database
        const dbUser = await prisma.user.findFirst({
          where: {
            OR: [
              { githubId: token.sub },
              { email: session.user.email! }
            ]
          }
        });

        if (dbUser) {
          session.user.id = dbUser.id;
          session.user.githubToken = dbUser.githubToken || undefined;
        } else {
          session.user.id = token.sub;
        }
      }
      return session;
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