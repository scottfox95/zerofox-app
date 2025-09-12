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
      SELECT id, filename, original_name, file_type, file_content, file_size, upload_path, organization_id
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

    let fileBuffer: Buffer;

    if (document.file_content) {
      // New method: file stored in database
      console.log('✅ File content found in database, serving document');
      fileBuffer = document.file_content;
    } else if (document.upload_path) {
      // Legacy method: file stored on filesystem
      try {
        console.log('📄 File stored on filesystem, reading from:', document.upload_path);
        const { readFile } = await import('fs/promises');
        fileBuffer = await readFile(document.upload_path);
        console.log('✅ File read from filesystem successfully');
      } catch (error) {
        console.error('❌ Failed to read file from filesystem:', error);
        return NextResponse.json(
          { success: false, error: 'File not found on filesystem' },
          { status: 404 }
        );
      }
    } else {
      console.error('❌ Document has no file content or upload path:', document.original_name);
      return NextResponse.json(
        { success: false, error: 'Document content not found' },
        { status: 404 }
      );
    }
    
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