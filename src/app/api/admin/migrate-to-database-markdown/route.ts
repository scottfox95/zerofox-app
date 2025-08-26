import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { readFile } from 'fs/promises';

export async function POST() {
  try {
    console.log('🔧 Migrating existing markdown content to database...');
    
    // Get the markdown content from the file for document 13
    const markdownPath = '/Users/scotttenenbaum/Desktop/zerofox-app/uploads/doc_13_aravo_pen_test.md';
    const markdownContent = await readFile(markdownPath, 'utf8');
    
    // Store it in the database
    await sql`
      UPDATE documents 
      SET markdown_content = ${markdownContent}
      WHERE id = 13
    `;
    
    console.log('✅ Migration completed - markdown content now in database');
    
    return NextResponse.json({
      success: true,
      message: 'Migrated markdown content to database',
      contentLength: markdownContent.length
    });
  } catch (error) {
    console.error('❌ Migration failed:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Migration failed' 
      },
      { status: 500 }
    );
  }
}