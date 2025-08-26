import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export async function GET(request: NextRequest) {
  console.log('📋 GET /api/admin/processed-documents - Fresh database query');
  
  try {
    // Direct query to get EXACTLY what's in the database right now
    const documents = await sql`
      SELECT 
        d.*,
        (SELECT COUNT(*) FROM text_chunks WHERE document_id = d.id) as chunk_count
      FROM documents d
      ORDER BY d.created_at DESC
    `;
    
    console.log(`📋 ACTUAL DATABASE STATE: Found ${documents.length} documents`);
    console.log(`📋 Document IDs in database: [${documents.map(d => d.id).join(', ')}]`);
    
    // Log each document for debugging
    documents.forEach((doc, index) => {
      console.log(`📋 Doc ${index + 1}: ID=${doc.id}, Name="${doc.original_name}", Processed=${doc.processed_at ? 'YES' : 'NO'}, Chunks=${doc.chunk_count}`);
    });
    
    // Transform documents to match frontend interface
    const transformedDocuments = documents
      .filter(doc => doc.processed_at) // Only include processed documents for analysis
      .map(doc => ({
        id: doc.id,
        originalName: doc.original_name,
        fileName: doc.filename,
        fileType: doc.file_type,
        fileSize: doc.file_size,
        processedAt: doc.processed_at,
        createdAt: doc.created_at,
        chunkCount: parseInt(doc.chunk_count) || 0,
        uploadPath: doc.upload_path,
        hasMarkdown: !!doc.markdown_content
      }));
    
    return NextResponse.json({
      success: true,
      count: documents.length,
      documents: transformedDocuments
    }, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
    
  } catch (error) {
    console.error('📋 Database query error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch documents from database' },
      { status: 500 }
    );
  }
}