import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    console.log('Force fixing evidence schema with individual operations...');
    
    const operations: string[] = [];
    
    // Drop and recreate evidence_mappings with correct schema
    try {
      await sql`
        DROP TABLE IF EXISTS evidence_mappings CASCADE;
      `;
      console.log('✅ Dropped evidence_mappings table');
      
      await sql`
        CREATE TABLE evidence_mappings (
          id SERIAL PRIMARY KEY,
          analysis_id INTEGER REFERENCES analyses(id) ON DELETE CASCADE,
          control_id VARCHAR(255) NOT NULL,
          control_title VARCHAR(255),
          control_description TEXT,
          status VARCHAR(50),
          confidence_score DECIMAL(5,2) DEFAULT 0.0,
          reasoning TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `;
      console.log('✅ Created evidence_mappings with correct schema');
      operations.push('recreated evidence_mappings');
    } catch (error) {
      console.error('Failed to recreate evidence_mappings:', error);
    }
    
    // Drop and recreate evidence_items with correct schema
    try {
      await sql`
        DROP TABLE IF EXISTS evidence_items CASCADE;
      `;
      console.log('✅ Dropped evidence_items table');
      
      await sql`
        CREATE TABLE evidence_items (
          id SERIAL PRIMARY KEY,
          evidence_mapping_id INTEGER REFERENCES evidence_mappings(id) ON DELETE CASCADE,
          document_id INTEGER,
          chunk_id INTEGER,
          evidence_text TEXT NOT NULL,
          page_number INTEGER,
          chunk_index INTEGER,
          confidence INTEGER DEFAULT 0 CHECK (confidence >= 0 AND confidence <= 100),
          relevance_score INTEGER DEFAULT 0 CHECK (relevance_score >= 0 AND relevance_score <= 100),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `;
      console.log('✅ Created evidence_items with correct schema');
      operations.push('recreated evidence_items');
    } catch (error) {
      console.error('Failed to recreate evidence_items:', error);
    }
    
    // Verify new schema
    const evidenceMappingsSchema = await sql`
      SELECT column_name, data_type FROM information_schema.columns 
      WHERE table_name = 'evidence_mappings' AND table_schema = 'public'
      ORDER BY ordinal_position
    `;

    const evidenceItemsSchema = await sql`
      SELECT column_name, data_type FROM information_schema.columns 
      WHERE table_name = 'evidence_items' AND table_schema = 'public'
      ORDER BY ordinal_position
    `;
    
    return NextResponse.json({
      success: true,
      message: 'Evidence tables forcibly recreated with correct schema',
      operations,
      evidence_mappings_columns: evidenceMappingsSchema,
      evidence_items_columns: evidenceItemsSchema
    });
    
  } catch (error) {
    console.error('Force schema fix failed:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Force schema fix failed'
    }, { status: 500 });
  }
}