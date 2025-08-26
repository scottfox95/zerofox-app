import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';

interface Params {
  id: string;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Params }
) {
  try {
    const documentId = parseInt(params.id);
    
    if (isNaN(documentId)) {
      return NextResponse.json(
        { error: 'Invalid document ID' },
        { status: 400 }
      );
    }

    // Get document details from database
    const documentResult = await sql`
      SELECT id, original_name, markdown_content
      FROM documents 
      WHERE id = ${documentId}
      LIMIT 1
    `;

    if (documentResult.length === 0) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      );
    }

    const document = documentResult[0];
    
    // Return markdown content from database (SaaS-ready)
    if (document.markdown_content) {
      return new NextResponse(document.markdown_content, {
        status: 200,
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'private, max-age=3600',
        }
      });
    }

    // Fallback: try to extract from text_chunks if markdown file doesn't exist
    const chunksResult = await sql`
      SELECT chunk_text, chunk_index
      FROM text_chunks 
      WHERE document_id = ${documentId}
      ORDER BY chunk_index ASC
    `;

    if (chunksResult.length > 0) {
      const reconstructedText = chunksResult
        .map((chunk: any) => chunk.chunk_text)
        .join('\n\n');
      
      return new NextResponse(reconstructedText, {
        status: 200,
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'private, max-age=3600',
        }
      });
    }

    return NextResponse.json(
      { error: 'No markdown content available for this document' },
      { status: 404 }
    );

  } catch (error) {
    console.error('Error serving markdown:', error);
    return NextResponse.json(
      { error: 'Failed to serve markdown content' },
      { status: 500 }
    );
  }
}