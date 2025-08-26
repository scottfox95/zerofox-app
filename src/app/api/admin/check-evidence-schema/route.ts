import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    // Get evidence_items table schema
    const evidenceItemsColumns = await sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'evidence_items' 
      AND table_schema = 'public'
      ORDER BY ordinal_position
    `;
    
    // Get evidence_mappings table schema
    const evidenceMappingsColumns = await sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'evidence_mappings' 
      AND table_schema = 'public'
      ORDER BY ordinal_position
    `;
    
    return NextResponse.json({
      success: true,
      evidence_items_columns: evidenceItemsColumns,
      evidence_mappings_columns: evidenceMappingsColumns
    });
    
  } catch (error) {
    console.error('Schema check failed:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Schema check failed'
    }, { status: 500 });
  }
}