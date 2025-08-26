import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { join } from 'path';

export async function POST() {
  try {
    // Update document 13 to point to the real Aravo pen test document
    const realDocumentPath = join(process.cwd(), 'uploads', 'Aravo Pen Test 2024_2.pdf');
    
    console.log('🔧 Updating document 13 to use real Aravo document:', realDocumentPath);
    
    const result = await sql`
      UPDATE documents 
      SET upload_path = ${realDocumentPath},
          original_name = 'Aravo Pen Test 2024_2.pdf'
      WHERE id = 13
      RETURNING id, original_name, upload_path
    `;

    return NextResponse.json({
      success: true,
      updated: result[0],
      message: 'Updated to use real Aravo pen test document'
    });
  } catch (error) {
    console.error('Error updating to real document:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Update failed' },
      { status: 500 }
    );
  }
}