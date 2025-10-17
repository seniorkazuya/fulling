import NextAuth from 'next-auth';
import GitHub from 'next-auth/providers/github';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
// import { PrismaAdapter } from '@auth/prisma-adapter';
import { prisma } from '@/lib/db';

export const { handlers, signIn, signOut, auth } = NextAuth({
  // adapter: PrismaAdapter(prisma) as any,
  providers: [
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: {
            email: credentials.email as string,
          },
        });

        if (!user || !user.password) {
          return null;
        }

        const passwordMatch = await bcrypt.compare(
          credentials.password as string,
          user.password
        );

        if (!passwordMatch) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
        };
      },
    }),
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
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session }) {
      if (session.user && session.user.email) {
        // Always lookup user by email to get the correct database ID
        const dbUser = await prisma.user.findUnique({
          where: {
            email: session.user.email
          }
        });

        if (dbUser) {
          // Set the correct database ID
          session.user.id = dbUser.id;
          session.user.githubToken = dbUser.githubToken || undefined;
        }
      }
      return session;
    },
  },
  session: {
    strategy: 'jwt',
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