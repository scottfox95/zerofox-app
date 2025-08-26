import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { writeFile } from 'fs/promises';
import { join } from 'path';

export async function POST() {
  try {
    console.log('🔧 Creating markdown version of document 13...');
    
    // Get text chunks for document 13
    const chunksResult = await sql`
      SELECT chunk_text, chunk_index
      FROM text_chunks 
      WHERE document_id = 13
      ORDER BY chunk_index ASC
    `;
    
    if (chunksResult.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No text chunks found for document 13'
      }, { status: 404 });
    }
    
    // Combine chunks into markdown content
    const markdownContent = chunksResult
      .map((chunk: any) => chunk.chunk_text)
      .join('\n\n');
    
    // Create markdown file
    const markdownPath = join(process.cwd(), 'uploads', 'doc_13_aravo_pen_test.md');
    await writeFile(markdownPath, markdownContent, 'utf8');
    
    // Update document record with markdown path
    await sql`
      UPDATE documents 
      SET markdown_path = ${markdownPath}
      WHERE id = 13
    `;
    
    console.log('✅ Created markdown file at:', markdownPath);
    
    return NextResponse.json({
      success: true,
      markdownPath,
      chunksUsed: chunksResult.length,
      contentLength: markdownContent.length
    });
  } catch (error) {
    console.error('❌ Failed to create markdown:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to create markdown' 
      },
      { status: 500 }
    );
  }
}