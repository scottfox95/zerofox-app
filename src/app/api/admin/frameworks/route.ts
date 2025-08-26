import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export async function GET() {
  try {
    // Get frameworks with control counts, handling special case for ISO 27001
    const frameworks = await sql`
      SELECT f.*, 
             CASE 
               WHEN f.name = 'iso_27001_2022' THEN (SELECT COUNT(*) FROM iso27001_controls)
               ELSE COUNT(c.id)
             END as control_count
      FROM frameworks f
      LEFT JOIN controls c ON f.id = c.framework_id AND f.name != 'iso_27001_2022'
      GROUP BY f.id, f.name, f.description, f.version, f.is_active, f.created_at
      ORDER BY f.created_at DESC
    `;
    
    return NextResponse.json({
      success: true,
      frameworks
    });
  } catch (error) {
    console.error('Get frameworks error:', error);
    return NextResponse.json(
      { error: 'Failed to get frameworks' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { name, description, version, controls } = await request.json();

    if (!name || !controls || !Array.isArray(controls)) {
      return NextResponse.json(
        { error: 'Name and controls array are required' },
        { status: 400 }
      );
    }

    // Insert framework
    const frameworkResult = await sql`
      INSERT INTO frameworks (name, description, version, is_active)
      VALUES (${name}, ${description || ''}, ${version || '1.0'}, true)
      RETURNING *
    `;

    const framework = frameworkResult[0];

    // Insert controls
    for (const control of controls) {
      await sql`
        INSERT INTO controls (framework_id, control_id, title, description, category)
        VALUES (${framework.id}, ${control.id}, ${control.title}, ${control.description}, ${control.category || ''})
      `;
    }

    return NextResponse.json({
      success: true,
      framework: {
        ...framework,
        control_count: controls.length
      }
    });
  } catch (error) {
    console.error('Create framework error:', error);
    return NextResponse.json(
      { error: 'Failed to create framework' },
      { status: 500 }
    );
  }
}