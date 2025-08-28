import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { verifyToken } from '@/lib/auth';

// GET /api/admin/organizations - Get all organizations (admin only)
export async function GET(request: NextRequest) {
  try {
    // Get user info from token
    const token = request.cookies.get('token')?.value || 
                  request.headers.get('authorization')?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = verifyToken(token);
    if (!payload || payload.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Get all organizations
    const organizations = await sql`
      SELECT id, name, created_at
      FROM organizations
      ORDER BY name ASC
    `;

    return NextResponse.json({
      success: true,
      organizations: organizations.map(org => ({
        id: org.id,
        name: org.name,
        createdAt: org.created_at
      }))
    });
  } catch (error) {
    console.error('Get organizations error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch organizations' },
      { status: 500 }
    );
  }
}