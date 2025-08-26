import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { hashPassword } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const { email, password, name } = await request.json();

    if (!email || !password || !name) {
      return NextResponse.json(
        { error: 'Email, password, and name are required' },
        { status: 400 }
      );
    }

    const hashedPassword = await hashPassword(password);
    
    const result = await sql`
      INSERT INTO users (email, password_hash, name, role)
      VALUES (${email}, ${hashedPassword}, ${name}, 'admin')
      ON CONFLICT (email) DO UPDATE SET
        password_hash = EXCLUDED.password_hash,
        name = EXCLUDED.name,
        role = 'admin'
      RETURNING id, email, name, role, created_at
    `;

    return NextResponse.json({
      success: true,
      message: 'Admin user created successfully',
      user: result[0]
    });

  } catch (error) {
    console.error('Create admin error:', error);
    return NextResponse.json(
      { error: 'Failed to create admin user' },
      { status: 500 }
    );
  }
}