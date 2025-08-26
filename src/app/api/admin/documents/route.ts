import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export async function GET(request: NextRequest) {
  console.log('📄 GET /api/admin/documents - Starting direct database query...');
  
  try {
    // Add a small delay to ensure database consistency after deletes
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Direct database query to avoid DocumentProcessor import issues
    const documents = await sql`
      SELECT d.*, COUNT(tc.id) as chunk_count
      FROM documents d
      LEFT JOIN text_chunks tc ON d.id = tc.document_id
      WHERE d.organization_id = 1
      GROUP BY d.id
      ORDER BY d.created_at DESC
    `;
    
    console.log(`📄 Retrieved ${documents.length} documents from database`);
    
    // Log document IDs for debugging
    if (documents.length > 0) {
      console.log(`📄 Document IDs: ${documents.map(d => d.id).join(', ')}`);
    }
    
    return NextResponse.json({
      success: true,
      documents
    });
  } catch (error) {
    console.error('📄 Get documents error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch documents' },
      { status: 500 }
    );
  }
}