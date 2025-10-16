import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '@/lib/db';

const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  name: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Validate input
    const validatedData = registerSchema.parse(body);

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: {
        email: validatedData.email,
      },
    });

    // Hash password
    const hashedPassword = await bcrypt.hash(validatedData.password, 10);

    let user;

    if (existingUser) {
      // If user exists but has no password (OAuth user), add password
      if (!existingUser.password) {
        user = await prisma.user.update({
          where: {
            id: existingUser.id,
          },
          data: {
            password: hashedPassword,
            name: validatedData.name || existingUser.name,
          },
          select: {
            id: true,
            email: true,
            name: true,
          },
        });
      } else {
        // User exists with password
        return NextResponse.json(
          { error: 'User with this email already exists' },
          { status: 400 }
        );
      }
    } else {
      // Create new user
      user = await prisma.user.create({
        data: {
          email: validatedData.email,
          password: hashedPassword,
          name: validatedData.name,
        },
        select: {
          id: true,
          email: true,
          name: true,
        },
      });
    }

    return NextResponse.json(
      {
        message: 'User created successfully',
        user,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      );
    }

    console.error('Registration error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}