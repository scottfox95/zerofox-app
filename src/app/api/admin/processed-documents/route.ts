import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { verifyToken } from '@/lib/auth';

// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  console.log('📋 GET /api/admin/processed-documents - Fresh database query');
  
  try {
    // Get user info from token
    const token = request.cookies.get('token')?.value || 
                  request.headers.get('authorization')?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Admin users can see all documents, others see only their organization's documents
    let documents;
    if (payload.role === 'admin') {
      // Admin sees all documents
      documents = await sql`
        SELECT 
          d.*,
          (SELECT COUNT(*) FROM text_chunks WHERE document_id = d.id) as text_chunk_count,
          (SELECT COUNT(*) FROM semantic_chunks WHERE document_id = d.id) as semantic_chunk_count
        FROM documents d
        ORDER BY d.created_at DESC
      `;
    } else {
      // Client and demo users see only their organization's documents
      documents = await sql`
        SELECT 
          d.*,
          (SELECT COUNT(*) FROM text_chunks WHERE document_id = d.id) as text_chunk_count,
          (SELECT COUNT(*) FROM semantic_chunks WHERE document_id = d.id) as semantic_chunk_count
        FROM documents d
        INNER JOIN user_organizations uo ON d.organization_id = uo.organization_id
        WHERE uo.user_id = ${payload.userId}
        ORDER BY d.created_at DESC
      `;
    }
    
    console.log(`📋 ACTUAL DATABASE STATE: Found ${documents.length} documents`);
    console.log(`📋 Document IDs in database: [${documents.map(d => d.id).join(', ')}]`);
    
    // Log each document for debugging
    documents.forEach((doc, index) => {
      console.log(`📋 Doc ${index + 1}: ID=${doc.id}, Name="${doc.original_name}", Processed=${doc.processed_at ? 'YES' : 'NO'}, TextChunks=${doc.text_chunk_count}, SemanticChunks=${doc.semantic_chunk_count}`);
    });
    
    // Transform documents to match frontend interface
    const transformedDocuments = documents
      .filter(doc => doc.processed_at && (doc.semantic_chunk_count > 0 || doc.text_chunk_count > 0)) // Only include documents with analysis-ready chunks
      .map(doc => ({
        id: doc.id,
        originalName: doc.original_name,
        fileName: doc.filename,
        fileType: doc.file_type,
        fileSize: doc.file_size,
        processedAt: doc.processed_at,
        createdAt: doc.created_at,
        chunkCount: parseInt(doc.text_chunk_count) || 0,
        semanticChunkCount: parseInt(doc.semantic_chunk_count) || 0,
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