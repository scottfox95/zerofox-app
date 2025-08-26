import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    console.log('Starting semantic tables migration...');
    
    const results: string[] = [];
    
    // Execute each table creation directly (avoiding file reading issues)
    
    // 1. Semantic chunks table
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS semantic_chunks (
          id SERIAL PRIMARY KEY,
          document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
          chunk_text TEXT NOT NULL,
          chunk_index INTEGER NOT NULL,
          page_number INTEGER,
          topic VARCHAR(255) NOT NULL,
          category VARCHAR(100) NOT NULL,
          semantic_summary TEXT,
          relevance_score INTEGER DEFAULT 50 CHECK (relevance_score >= 0 AND relevance_score <= 100),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          
          CONSTRAINT semantic_chunks_document_index UNIQUE (document_id, chunk_index)
        )
      `;
      console.log('✅ Created semantic_chunks table');
      results.push('semantic_chunks');
    } catch (error) {
      console.log('⚠️ semantic_chunks table may already exist:', error);
    }

    // 2. Semantic chunks indices
    try {
      await sql`CREATE INDEX IF NOT EXISTS idx_semantic_chunks_category ON semantic_chunks(category)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_semantic_chunks_relevance ON semantic_chunks(relevance_score DESC)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_semantic_chunks_document_category ON semantic_chunks(document_id, category)`;
      console.log('✅ Created semantic_chunks indices');
    } catch (error) {
      console.log('⚠️ semantic_chunks indices may already exist:', error);
    }

    // 3. Organized documents table
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS organized_documents (
          id SERIAL PRIMARY KEY,
          organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
          master_markdown TEXT NOT NULL,
          document_count INTEGER NOT NULL DEFAULT 0,
          categories JSONB NOT NULL DEFAULT '[]',
          total_chunks INTEGER NOT NULL DEFAULT 0,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )
      `;
      console.log('✅ Created organized_documents table');
      results.push('organized_documents');
    } catch (error) {
      console.log('⚠️ organized_documents table may already exist:', error);
    }

    // 4. Attribution mappings table
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS attribution_mappings (
          id SERIAL PRIMARY KEY,
          organized_document_id INTEGER NOT NULL REFERENCES organized_documents(id) ON DELETE CASCADE,
          original_text TEXT NOT NULL,
          document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
          document_name VARCHAR(255) NOT NULL,
          page_number INTEGER,
          chunk_index INTEGER NOT NULL,
          line_start INTEGER NOT NULL,
          line_end INTEGER NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )
      `;
      console.log('✅ Created attribution_mappings table');
      results.push('attribution_mappings');
    } catch (error) {
      console.log('⚠️ attribution_mappings table may already exist:', error);
    }

    // 5. Attribution mappings indices
    try {
      await sql`CREATE INDEX IF NOT EXISTS idx_attribution_mappings_organized_doc ON attribution_mappings(organized_document_id)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_attribution_mappings_line_range ON attribution_mappings(organized_document_id, line_start, line_end)`;
      console.log('✅ Created attribution_mappings indices');
    } catch (error) {
      console.log('⚠️ attribution_mappings indices may already exist:', error);
    }

    // 6. Document classifications table
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS document_classifications (
          id SERIAL PRIMARY KEY,
          document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
          classification_type VARCHAR(50) NOT NULL,
          confidence_score INTEGER NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 100),
          reasoning TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          
          CONSTRAINT unique_document_classification UNIQUE (document_id)
        )
      `;
      console.log('✅ Created document_classifications table');
      results.push('document_classifications');
    } catch (error) {
      console.log('⚠️ document_classifications table may already exist:', error);
    }

    // 7. Document classifications index
    try {
      await sql`CREATE INDEX IF NOT EXISTS idx_document_classifications_type ON document_classifications(classification_type)`;
      console.log('✅ Created document_classifications index');
    } catch (error) {
      console.log('⚠️ document_classifications index may already exist:', error);
    }
    
    // Verify tables were created
    const tables = await sql`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('semantic_chunks', 'organized_documents', 'attribution_mappings', 'document_classifications')
      ORDER BY table_name
    `;
    
    const tableNames = tables.map(t => t.table_name);
    console.log('✅ Migration completed. Available tables:', tableNames);
    
    return NextResponse.json({
      success: true,
      message: 'Semantic tables migration completed',
      tablesCreated: tableNames,
      executedOperations: results
    });
    
  } catch (error) {
    console.error('Migration failed:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Migration failed'
    }, { status: 500 });
  }
}