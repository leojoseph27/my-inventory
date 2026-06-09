import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const adminExists = await db.adminUser.findFirst();
    return NextResponse.json({ exists: !!adminExists });
  } catch (error) {
    console.error('Error checking admin:', error);
    return NextResponse.json({ error: 'Failed to check admin' }, { status: 500 });
  }
}
