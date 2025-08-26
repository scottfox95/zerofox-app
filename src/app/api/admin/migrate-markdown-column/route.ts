import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export async function POST() {
  try {
    console.log('🔧 Adding markdown_content column to documents table...');
    
    // Add markdown_content column for storing full markdown in database
    await sql`
      ALTER TABLE documents 
      ADD COLUMN IF NOT EXISTS markdown_content TEXT
    `;
    
    console.log('✅ Migration completed successfully');
    
    return NextResponse.json({
      success: true,
      message: 'Added markdown_content column to documents table'
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