import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    console.log('Fixing analyses table schema...');
    
    // Add missing framework_name column if it doesn't exist
    try {
      await sql`
        ALTER TABLE analyses 
        ADD COLUMN IF NOT EXISTS framework_name VARCHAR(255) DEFAULT 'Unknown Framework'
      `;
      console.log('✅ Added framework_name column to analyses table');
    } catch (error) {
      console.log('⚠️ framework_name column may already exist:', error);
    }

    // Verify the column exists
    const columns = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'analyses' 
      AND table_schema = 'public'
      ORDER BY ordinal_position
    `;
    
    const columnNames = columns.map(col => col.column_name);
    console.log('✅ Analyses table columns:', columnNames);
    
    return NextResponse.json({
      success: true,
      message: 'Analyses table schema fixed',
      columns: columnNames
    });
    
  } catch (error) {
    console.error('Schema fix failed:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Schema fix failed'
    }, { status: 500 });
  }
}