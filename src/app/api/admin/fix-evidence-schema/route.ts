import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    console.log('Fixing evidence tables schema...');
    
    // Fix evidence_mappings table - add missing columns
    const evidenceMappingsColumns = [
      { name: 'control_title', type: 'VARCHAR(255)' },
      { name: 'control_description', type: 'TEXT' },
      { name: 'reasoning', type: 'TEXT' }
    ];

    for (const column of evidenceMappingsColumns) {
      try {
        await sql.unsafe(`ALTER TABLE evidence_mappings ADD COLUMN IF NOT EXISTS ${column.name} ${column.type}`);
        console.log(`✅ Added evidence_mappings.${column.name}`);
      } catch (error) {
        console.log(`⚠️ evidence_mappings.${column.name} may already exist`);
      }
    }

    // Fix evidence_items table - add missing columns and rename existing ones
    const evidenceItemsColumns = [
      { name: 'document_id', type: 'INTEGER' },
      { name: 'chunk_id', type: 'INTEGER' },
      { name: 'page_number', type: 'INTEGER' },
      { name: 'chunk_index', type: 'INTEGER' },
      { name: 'confidence', type: 'INTEGER DEFAULT 0 CHECK (confidence >= 0 AND confidence <= 100)' },
      { name: 'relevance_score', type: 'INTEGER DEFAULT 0 CHECK (relevance_score >= 0 AND relevance_score <= 100)' }
    ];

    for (const column of evidenceItemsColumns) {
      try {
        await sql.unsafe(`ALTER TABLE evidence_items ADD COLUMN IF NOT EXISTS ${column.name} ${column.type}`);
        console.log(`✅ Added evidence_items.${column.name}`);
      } catch (error) {
        console.log(`⚠️ evidence_items.${column.name} may already exist`);
      }
    }

    // Verify the updated schema
    const evidenceItemsSchema = await sql`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'evidence_items' AND table_schema = 'public'
      ORDER BY ordinal_position
    `;

    const evidenceMappingsSchema = await sql`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'evidence_mappings' AND table_schema = 'public'
      ORDER BY ordinal_position
    `;
    
    return NextResponse.json({
      success: true,
      message: 'Evidence tables schema fixed',
      evidence_items_columns: evidenceItemsSchema.map(c => c.column_name),
      evidence_mappings_columns: evidenceMappingsSchema.map(c => c.column_name)
    });
    
  } catch (error) {
    console.error('Evidence schema fix failed:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Evidence schema fix failed'
    }, { status: 500 });
  }
}