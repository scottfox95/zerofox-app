import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { join } from 'path';

export async function POST() {
  try {
    // Force update with explicit SQL
    const uploadPath = join(process.cwd(), 'uploads', 'test_document_13.pdf');
    
    console.log('🔧 Force updating document 13 upload_path to:', uploadPath);
    
    // First check current state
    const beforeUpdate = await sql`
      SELECT id, upload_path FROM documents WHERE id = 13
    `;
    
    console.log('🔧 Before update:', beforeUpdate[0]);
    
    // Force update
    const updateResult = await sql`
      UPDATE documents 
      SET upload_path = ${uploadPath}
      WHERE id = 13
      RETURNING id, original_name, upload_path
    `;
    
    console.log('🔧 Update result:', updateResult[0]);
    
    // Verify update
    const afterUpdate = await sql`
      SELECT id, upload_path FROM documents WHERE id = 13
    `;
    
    console.log('🔧 After update:', afterUpdate[0]);

    return NextResponse.json({
      success: true,
      before: beforeUpdate[0],
      updated: updateResult[0],
      after: afterUpdate[0]
    });
  } catch (error) {
    console.error('Error force updating document 13:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Update failed' },
      { status: 500 }
    );
  }
}