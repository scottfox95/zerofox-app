import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  console.log(`🗑️ DELETE /api/admin/documents/delete/${params.id}`);
  
  try {
    const documentId = parseInt(params.id);
    
    if (isNaN(documentId)) {
      return NextResponse.json(
        { error: 'Invalid document ID' },
        { status: 400 }
      );
    }

    // Delete text chunks first
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