import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, name } = body;

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    // Check if admin already exists
    const existing = await db.adminUser.findFirst();
    if (existing) {
      return NextResponse.json({ error: 'Admin user already exists' }, { status: 400 });
    }

    const hashedPassword = createHash('sha256').update(password).digest('hex');

    const user = await db.adminUser.create({
      data: {
        email,
        password: hashedPassword,
        name: name || 'Admin',
      },
    });

    return NextResponse.json({ id: user.id, email: user.email, name: user.name }, { status: 201 });
  } catch (error) {
    console.error('Error seeding admin:', error);
    return NextResponse.json({ error: 'Failed to create admin user' }, { status: 500 });
  }
}
