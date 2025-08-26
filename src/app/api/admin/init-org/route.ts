import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    // Check if default organization exists
    const existingOrg = await sql`
      SELECT id FROM organizations WHERE id = 1
    `;

    if (existingOrg.length > 0) {
      return NextResponse.json({
        success: true,
        message: 'Default organization already exists',
        organization: existingOrg[0]
      });
    }

    // Create default organization
    const result = await sql`
      INSERT INTO organizations (id, name) 
      VALUES (1, 'Default Organization')
      ON CONFLICT (id) DO NOTHING
      RETURNING *
    `;

    if (result.length === 0) {
      // Try to get the existing organization again
      const existing = await sql`SELECT * FROM organizations WHERE id = 1`;
      if (existing.length > 0) {
        return NextResponse.json({
          success: true,
          message: 'Default organization already exists',
          organization: existing[0]
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Default organization created successfully',
      organization: result[0]
    });
  } catch (error) {
    console.error('Create organization error:', error);
    return NextResponse.json(
      { error: 'Failed to create default organization' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const organizations = await sql`
      SELECT * FROM organizations ORDER BY id
    `;

    return NextResponse.json({
      success: true,
      organizations
    });
  } catch (error) {
    console.error('Get organizations error:', error);
    return NextResponse.json(
      { error: 'Failed to get organizations' },
      { status: 500 }
    );
  }
}