import { NextRequest, NextResponse } from 'next/server';
import { DocumentProcessor } from '@/lib/document';

const documentProcessor = new DocumentProcessor();

export async function POST(request: NextRequest) {
  console.log('📄 Starting document processing...');
  
  try {
    const body = await request.json();
    const documentId = body.documentId;

    console.log(`📄 Processing document ID: ${documentId}`);

    if (!documentId) {
      return NextResponse.json(
        { error: 'Document ID is required' },
        { status: 400 }
      );
    }

    console.log('📄 Calling document processor...');
    const result = await documentProcessor.processDocument(parseInt(documentId));
    
    console.log(`📄 Processing result: ${result.success ? 'SUCCESS' : 'FAILED'}`);
    if (!result.success) {
      console.log(`📄 Processing error: ${result.error}`);
    }

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    console.log('📄 Document processing completed successfully');
    return NextResponse.json({
      success: true,
      ...result.result,
      message: 'Document processed successfully'
    });
  } catch (error) {
    console.error('Process document error:', error);
    return NextResponse.json(
      { error: 'Failed to process document' },
      { status: 500 }
    );
  }
}