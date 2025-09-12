import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const documentId = searchParams.get('id') || '17';
    
    // Check text chunks
    const textChunks = await sql`
      SELECT id, chunk_index, LEFT(chunk_text, 100) as chunk_preview
      FROM text_chunks 
      WHERE document_id = ${documentId}
      ORDER BY chunk_index
      LIMIT 5
    `;
    
    // Check semantic chunks
    const semanticChunks = await sql`
      SELECT id, chunk_index, LEFT(chunk_text, 100) as chunk_preview
      FROM semantic_chunks 
      WHERE document_id = ${documentId}
      ORDER BY chunk_index
      LIMIT 5
    `;
    
    return NextResponse.json({
      documentId,
      textChunks: textChunks.length,
      textChunkSample: textChunks,
      semanticChunks: semanticChunks.length,
      semanticChunkSample: semanticChunks
    });
    
  } catch (error) {
    console.error('Test chunks error:', error);
    return NextResponse.json(
      { error: 'Failed to test chunks' },
      { status: 500 }
    );
  }
}