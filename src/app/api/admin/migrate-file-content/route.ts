import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    console.log('🔄 Adding file_content column to documents table...');
    
    // Add file_content BYTEA column to documents table
    await sql`
      ALTER TABLE documents 
      ADD COLUMN IF NOT EXISTS file_content BYTEA;
    `;
    
    console.log('✅ Successfully added file_content column');
    
    // Check the column was added
    const result = await sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'documents' 
      AND column_name = 'file_content';
    `;
    
    return NextResponse.json({
      success: true,
      message: 'file_content column added successfully',
      column: result[0]
    });
    
  } catch (error) {
    console.error('Migration error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Migration failed' 
      },
      { status: 500 }
    );
  }
}