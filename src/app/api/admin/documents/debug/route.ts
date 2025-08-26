import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export async function GET(request: NextRequest) {
  console.log('🔍 Debug route - checking documents directly from database');
  
  try {
    // Direct database query without DocumentProcessor
    const documents = await sql`
      SELECT d.*, COUNT(tc.id) as chunk_count
      FROM documents d
      LEFT JOIN text_chunks tc ON d.id = tc.document_id
      WHERE d.organization_id = 1
      GROUP BY d.id
      ORDER BY d.created_at DESC
    `;
    
    console.log(`🔍 Found ${documents.length} documents in database:`);
    documents.forEach((doc, index) => {
      console.log(`🔍 Document ${index + 1}: ${doc.original_name} (ID: ${doc.id}, Processed: ${doc.processed_at ? 'YES' : 'NO'})`);
    });
    
    return NextResponse.json({
      success: true,
      count: documents.length,
      documents: documents.map(doc => ({
        id: doc.id,
        original_name: doc.original_name,
        file_type: doc.file_type,
        file_size: doc.file_size,
        processed_at: doc.processed_at,
        created_at: doc.created_at,
        chunk_count: doc.chunk_count || 0
      }))
    });
  } catch (error) {
    console.error('🔍 Debug route error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Database query failed' },
      { status: 500 }
    );
  }
}