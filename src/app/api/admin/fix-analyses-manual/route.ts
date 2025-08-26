import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    console.log('Manually adding missing columns to analyses table...');
    
    const results: string[] = [];
    
    // Add each column individually
    try {
      await sql`ALTER TABLE analyses ADD COLUMN total_controls INTEGER DEFAULT 0`;
      console.log('✅ Added total_controls');
      results.push('total_controls');
    } catch (error) {
      console.log('⚠️ total_controls may already exist');
    }

    try {
      await sql`ALTER TABLE analyses ADD COLUMN started_at TIMESTAMP WITH TIME ZONE`;
      console.log('✅ Added started_at');
      results.push('started_at');
    } catch (error) {
      console.log('⚠️ started_at may already exist');
    }

    try {
      await sql`ALTER TABLE analyses ADD COLUMN compliant_controls INTEGER DEFAULT 0`;
      console.log('✅ Added compliant_controls');
      results.push('compliant_controls');
    } catch (error) {
      console.log('⚠️ compliant_controls may already exist');
    }

    try {
      await sql`ALTER TABLE analyses ADD COLUMN partial_controls INTEGER DEFAULT 0`;
      console.log('✅ Added partial_controls');
      results.push('partial_controls');
    } catch (error) {
      console.log('⚠️ partial_controls may already exist');
    }

    try {
      await sql`ALTER TABLE analyses ADD COLUMN missing_controls INTEGER DEFAULT 0`;
      console.log('✅ Added missing_controls');
      results.push('missing_controls');
    } catch (error) {
      console.log('⚠️ missing_controls may already exist');
    }

    try {
      await sql`ALTER TABLE analyses ADD COLUMN average_confidence DECIMAL(5,2) DEFAULT 0.0`;
      console.log('✅ Added average_confidence');
      results.push('average_confidence');
    } catch (error) {
      console.log('⚠️ average_confidence may already exist');
    }

    try {
      await sql`ALTER TABLE analyses ADD COLUMN processing_time INTEGER`;
      console.log('✅ Added processing_time');
      results.push('processing_time');
    } catch (error) {
      console.log('⚠️ processing_time may already exist');
    }

    // Verify final schema
    const columns = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'analyses' 
      AND table_schema = 'public'
      ORDER BY ordinal_position
    `;
    
    const columnNames = columns.map(col => col.column_name);
    console.log('✅ Final analyses table columns:', columnNames);
    
    return NextResponse.json({
      success: true,
      message: 'Analyses table columns added manually',
      addedColumns: results,
      allColumns: columnNames
    });
    
  } catch (error) {
    console.error('Manual column addition failed:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Manual column addition failed'
    }, { status: 500 });
  }
}