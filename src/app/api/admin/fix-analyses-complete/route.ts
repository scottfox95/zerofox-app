import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    console.log('Fixing analyses table schema completely...');
    
    // Add all missing columns that the evidence analysis code expects
    const columnsToAdd = [
      { name: 'total_controls', type: 'INTEGER DEFAULT 0' },
      { name: 'started_at', type: 'TIMESTAMP WITH TIME ZONE' },
      { name: 'compliant_controls', type: 'INTEGER DEFAULT 0' },
      { name: 'partial_controls', type: 'INTEGER DEFAULT 0' },
      { name: 'missing_controls', type: 'INTEGER DEFAULT 0' },
      { name: 'average_confidence', type: 'DECIMAL(5,2) DEFAULT 0.0' },
      { name: 'processing_time', type: 'INTEGER' }
    ];

    for (const column of columnsToAdd) {
      try {
        await sql.unsafe(`ALTER TABLE analyses ADD COLUMN IF NOT EXISTS ${column.name} ${column.type}`);
        console.log(`✅ Added ${column.name} column`);
      } catch (error) {
        console.log(`⚠️ ${column.name} column may already exist:`, error);
      }
    }

    // Verify all columns exist
    const columns = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'analyses' 
      AND table_schema = 'public'
      ORDER BY ordinal_position
    `;
    
    const columnNames = columns.map(col => col.column_name);
    console.log('✅ Analyses table columns:', columnNames);
    
    // Check if we have all required columns
    const requiredColumns = [
      'id', 'organization_id', 'framework_id', 'framework_name', 'status',
      'total_controls', 'started_at', 'compliant_controls', 'partial_controls', 
      'missing_controls', 'average_confidence', 'processing_time', 'created_at', 'completed_at'
    ];
    
    const missingColumns = requiredColumns.filter(col => !columnNames.includes(col));
    
    if (missingColumns.length > 0) {
      console.error('❌ Still missing columns:', missingColumns);
      return NextResponse.json({
        success: false,
        error: `Still missing columns: ${missingColumns.join(', ')}`,
        currentColumns: columnNames,
        requiredColumns
      });
    }
    
    console.log('✅ All required columns present');
    
    return NextResponse.json({
      success: true,
      message: 'Analyses table schema completely fixed',
      columns: columnNames,
      addedColumns: columnsToAdd.map(c => c.name)
    });
    
  } catch (error) {
    console.error('Complete schema fix failed:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Complete schema fix failed'
    }, { status: 500 });
  }
}