import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { join } from 'path';

export async function POST() {
  try {
    // Get the test PDF path
    const testPdfPath = join(process.cwd(), 'uploads', 'test_document_13.pdf');
    
    // Update document 13 with the test PDF path
    const result = await sql`
      UPDATE documents 
      SET upload_path = ${testPdfPath}
      WHERE id = 13
      RETURNING id, original_name, upload_path
    `;

    return NextResponse.json({
      success: true,
      updated: result.length,
      document: result[0] || null,
      message: 'Fixed document upload path'
    });
  } catch (error) {
    console.error('Error fixing document paths:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fix document paths' },
      { status: 500 }
    );
  }
}