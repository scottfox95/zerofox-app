import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export async function GET() {
  try {
    const result = await sql`
      SELECT id, original_name, file_type, file_size, upload_path, markdown_path, processed_at, created_at
      FROM documents 
      WHERE id = 13
    `;

    return NextResponse.json({
      success: true,
      found: result.length > 0,
      document: result[0] || null
    });
  } catch (error) {
    console.error('Error checking document 13:', error);
    return NextResponse.json(
      { success: false, error: 'Database error' },
      { status: 500 }
    );
  }
}