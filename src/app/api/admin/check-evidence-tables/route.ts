import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    // Check what tables exist in the database
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `;
    
    const tableNames = tables.map(t => t.table_name);
    console.log('All tables in database:', tableNames);
    
    // Check specifically for evidence tables
    const evidenceTables = ['evidence_mappings', 'evidence_items'];
    const missingEvidenceTables = evidenceTables.filter(table => !tableNames.includes(table));
    
    return NextResponse.json({
      success: true,
      allTables: tableNames,
      evidenceTablesExist: missingEvidenceTables.length === 0,
      missingEvidenceTables
    });
    
  } catch (error) {
    console.error('Table check failed:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Table check failed'
    }, { status: 500 });
  }
}