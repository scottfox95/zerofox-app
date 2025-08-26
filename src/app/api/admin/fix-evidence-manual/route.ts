import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    console.log('Manually fixing evidence tables schema...');
    
    const results: string[] = [];
    
    // Add missing columns to evidence_mappings
    try {
      await sql`ALTER TABLE evidence_mappings ADD COLUMN control_title VARCHAR(255)`;
      console.log('✅ Added control_title to evidence_mappings');
      results.push('evidence_mappings.control_title');
    } catch (error) {
      console.log('⚠️ control_title may already exist in evidence_mappings');
    }

    try {
      await sql`ALTER TABLE evidence_mappings ADD COLUMN control_description TEXT`;
      console.log('✅ Added control_description to evidence_mappings');
      results.push('evidence_mappings.control_description');
    } catch (error) {
      console.log('⚠️ control_description may already exist in evidence_mappings');
    }

    try {
      await sql`ALTER TABLE evidence_mappings ADD COLUMN reasoning TEXT`;
      console.log('✅ Added reasoning to evidence_mappings');
      results.push('evidence_mappings.reasoning');
    } catch (error) {
      console.log('⚠️ reasoning may already exist in evidence_mappings');
    }

    // Add missing columns to evidence_items
    try {
      await sql`ALTER TABLE evidence_items ADD COLUMN document_id INTEGER`;
      console.log('✅ Added document_id to evidence_items');
      results.push('evidence_items.document_id');
    } catch (error) {
      console.log('⚠️ document_id may already exist in evidence_items');
    }

    try {
      await sql`ALTER TABLE evidence_items ADD COLUMN chunk_id INTEGER`;
      console.log('✅ Added chunk_id to evidence_items');
      results.push('evidence_items.chunk_id');
    } catch (error) {
      console.log('⚠️ chunk_id may already exist in evidence_items');
    }

    try {
      await sql`ALTER TABLE evidence_items ADD COLUMN page_number INTEGER`;
      console.log('✅ Added page_number to evidence_items');
      results.push('evidence_items.page_number');
    } catch (error) {
      console.log('⚠️ page_number may already exist in evidence_items');
    }

    try {
      await sql`ALTER TABLE evidence_items ADD COLUMN chunk_index INTEGER`;
      console.log('✅ Added chunk_index to evidence_items');
      results.push('evidence_items.chunk_index');
    } catch (error) {
      console.log('⚠️ chunk_index may already exist in evidence_items');
    }

    try {
      await sql`ALTER TABLE evidence_items ADD COLUMN confidence INTEGER DEFAULT 0`;
      console.log('✅ Added confidence to evidence_items');
      results.push('evidence_items.confidence');
    } catch (error) {
      console.log('⚠️ confidence may already exist in evidence_items');
    }

    try {
      await sql`ALTER TABLE evidence_items ADD COLUMN relevance_score INTEGER DEFAULT 0`;
      console.log('✅ Added relevance_score to evidence_items');
      results.push('evidence_items.relevance_score');
    } catch (error) {
      console.log('⚠️ relevance_score may already exist in evidence_items');
    }

    // Verify the final schema
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
      message: 'Evidence tables schema manually fixed',
      addedColumns: results,
      evidence_items_columns: evidenceItemsSchema.map(c => c.column_name),
      evidence_mappings_columns: evidenceMappingsSchema.map(c => c.column_name)
    });
    
  } catch (error) {
    console.error('Manual evidence schema fix failed:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Manual evidence schema fix failed'
    }, { status: 500 });
  }
}