import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

interface Params {
  id: string;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Params }
) {
  try {
    const documentId = parseInt(params.id);
    console.log('📄 Document API called with ID:', documentId);
    
    if (isNaN(documentId)) {
      console.error('❌ Invalid document ID:', params.id);
      return NextResponse.json(
        { success: false, error: 'Invalid document ID' },
        { status: 400 }
      );
    }

    // Get document details including file content from database
    const documentResult = await sql`
      SELECT id, filename, original_name, file_type, file_content, file_size, organization_id
      FROM documents 
      WHERE id = ${documentId}
      LIMIT 1
    `;

    if (documentResult.length === 0) {
      console.error('❌ Document not found in database:', documentId);
      return NextResponse.json(
        { success: false, error: 'Document not found' },
        { status: 404 }
      );
    }

    const document = documentResult[0] as any;
    console.log('📄 Document found:', document.original_name);

    // Security: Check if user has access to this organization's documents
    // TODO: Add proper auth check here when user sessions are implemented
    // For now, we'll serve the document if it exists

    if (!document.file_content) {
      console.error('❌ Document file content is null:', document.original_name);
      return NextResponse.json(
        { success: false, error: 'Document content not found' },
        { status: 404 }
      );
    }

    console.log('✅ File content found, serving document');

    // Use the file content from database
    const fileBuffer = document.file_content;
    
    // Determine content type
    const contentType = getContentType(document.file_type);
    
    // Set appropriate headers
    const headers = new Headers({
      'Content-Type': contentType,
      'Content-Disposition': `inline; filename="${document.original_name}"`,
      'Content-Length': fileBuffer.length.toString(),
      'Cache-Control': 'private, max-age=3600', // Cache for 1 hour
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET',
      'Access-Control-Allow-Headers': 'Content-Type',
    });

    // Return the file
    return new NextResponse(fileBuffer as any, {
      status: 200,
      headers
    });

  } catch (error) {
    console.error('Error serving document:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to serve document' },
      { status: 500 }
    );
  }
}

function getContentType(fileType: string): string {
  switch (fileType.toLowerCase()) {
    case 'pdf':
      return 'application/pdf';
    case 'docx':
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    case 'doc':
      return 'application/msword';
    case 'xlsx':
      return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    case 'xls':
      return 'application/vnd.ms-excel';
    case 'txt':
      return 'text/plain';
    case 'md':
      return 'text/markdown';
    default:
      return 'application/octet-stream';
  }
}