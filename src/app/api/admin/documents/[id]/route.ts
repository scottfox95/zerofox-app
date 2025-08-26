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

    return NextResponse.json({
      success: true,
      document: documentResult[0],
      chunks: chunksResult
    });
  } catch (error) {
    console.error('📄 Get document details error:', error);
    return NextResponse.json(
      { error: 'Failed to get document details' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  console.log(`🗑️ DELETE document ID: ${params.id}`);
  
  try {
    const documentId = parseInt(params.id);
    
    if (isNaN(documentId)) {
      return NextResponse.json(
        { error: 'Invalid document ID' },
        { status: 400 }
      );
    }

    // Delete text chunks first (cascade should handle this, but being explicit)
    console.log(`🗑️ Deleting text chunks for document ${documentId}...`);
    await sql`DELETE FROM text_chunks WHERE document_id = ${documentId}`;
    
    // Delete document
    console.log(`🗑️ Deleting document ${documentId}...`);
    const result = await sql`
      DELETE FROM documents WHERE id = ${documentId}
      RETURNING id
    `;

    if (result.length === 0) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      );
    }

    console.log(`🗑️ Successfully deleted document ${documentId}`);
    return NextResponse.json({
      success: true,
      message: 'Document deleted successfully'
    });
  } catch (error) {
    console.error('🗑️ Delete document error:', error);
    return NextResponse.json(
      { error: 'Failed to delete document' },
      { status: 500 }
    );
  }
}