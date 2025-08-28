import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { documentId } = body;
    
    if (!documentId) {
      return NextResponse.json(
        { success: false, error: 'Document ID is required' },
        { status: 400 }
      );
    }

    console.log(`🧹 Clearing semantic chunks for document ${documentId}...`);
    
    // Delete existing semantic chunks for this document
    const deleteResult = await sql`
      DELETE FROM semantic_chunks WHERE document_id = ${documentId}
    `;
    
    console.log(`🧹 Deleted ${(deleteResult as any).count || 0} existing semantic chunks`);
    
    return NextResponse.json({
      success: true,
      message: `Cleared ${(deleteResult as any).count || 0} semantic chunks for document ${documentId}`,
      deletedCount: (deleteResult as any).count || 0
    });
    
  } catch (error) {
    console.error('❌ Clear semantic chunks failed:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Clear failed' },
      { status: 500 }
    );
  }
}