import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export async function POST(request: NextRequest) {
  console.log('🗑️ POST /api/admin/documents/delete-document');
  
  try {
    const { documentId } = await request.json();
    
    if (!documentId || isNaN(parseInt(documentId))) {
      return NextResponse.json(
        { error: 'Valid document ID is required' },
        { status: 400 }
      );
    }

    const id = parseInt(documentId);
    console.log(`🗑️ Deleting document ID: ${id}`);

    // Check if document exists first
    console.log(`🗑️ Checking if document ${id} exists...`);
    const existsCheck = await sql`SELECT id FROM documents WHERE id = ${id}`;
    
    if (existsCheck.length === 0) {
      console.log(`🗑️ Document ${id} not found - likely already deleted`);
      return NextResponse.json({
        success: true,
        message: 'Document already deleted or not found'
      });
    }

    // Delete text chunks first
    console.log(`🗑️ Deleting text chunks for document ${id}...`);
    await sql`DELETE FROM text_chunks WHERE document_id = ${id}`;
    
    // Delete document
    console.log(`🗑️ Deleting document ${id}...`);
    const result = await sql`
      DELETE FROM documents WHERE id = ${id}
      RETURNING id
    `;

    console.log(`🗑️ Successfully deleted document ${id}`);
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