import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    // Get detailed column information including NOT NULL constraints
    const columns = await sql`
      SELECT 
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns 
      WHERE table_name = 'analyses' 
      AND table_schema = 'public'
      ORDER BY ordinal_position
    `;
    
    const notNullColumns = columns.filter(col => col.is_nullable === 'NO');
    
    console.log('Analyses table schema:');
    columns.forEach(col => {
      console.log(`- ${col.column_name}: ${col.data_type}, nullable: ${col.is_nullable}, default: ${col.column_default || 'none'}`);
    });
    
    return NextResponse.json({
      success: true,
      allColumns: columns,
      notNullColumns: notNullColumns.map(col => ({
        name: col.column_name,
        type: col.data_type,
        default: col.column_default
      }))
    });
    
  } catch (error) {
    console.error('Constraint check failed:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Constraint check failed'
    }, { status: 500 });
  }
}