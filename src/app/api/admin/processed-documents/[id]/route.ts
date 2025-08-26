import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  console.log(`📄 GET document details for ID: ${params.id}`);
  
  try {
    const documentId = parseInt(params.id);
    
    if (isNaN(documentId)) {
      return NextResponse.json(
        { error: 'Invalid document ID' },
        { status: 400 }
      );
    }

    // Get document details
    const documentResult = await sql`
      SELECT * FROM documents WHERE id = ${documentId}
    `;

    if (documentResult.length === 0) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      );
    }

    // Get document chunks
    const chunksResult = await sql`
      SELECT * FROM text_chunks 
      WHERE document_id = ${documentId}
      ORDER BY chunk_index
    `;

    console.log(`📄 Found document with ${chunksResult.length} chunks`);

    return NextResponse.json({
      success: true,
      document: documentResult[0],
      chunks: chunksResult
    }, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
    
  } catch (error) {
    console.error('📄 Get document details error:', error);
    return NextResponse.json(
      { error: 'Failed to get document details' },
      { status: 500 }
    );
  }
}