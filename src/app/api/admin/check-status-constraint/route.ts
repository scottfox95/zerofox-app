import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    // Get constraint information
    const constraints = await sql`
      SELECT 
        tc.constraint_name,
        tc.constraint_type,
        cc.check_clause
      FROM information_schema.table_constraints tc
      JOIN information_schema.check_constraints cc 
        ON tc.constraint_name = cc.constraint_name
      WHERE tc.table_name = 'analyses'
      AND tc.constraint_type = 'CHECK'
    `;
    
    console.log('Check constraints on analyses table:', constraints);
    
    return NextResponse.json({
      success: true,
      constraints: constraints
    });
    
  } catch (error) {
    console.error('Constraint check failed:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Constraint check failed'
    }, { status: 500 });
  }
}