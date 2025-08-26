import { NextRequest, NextResponse } from 'next/server';
import { DocumentProcessor } from '@/lib/document';

const documentProcessor = new DocumentProcessor();

export async function POST(request: NextRequest) {
  console.log('📄 Starting document processing...');
  
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const documentId = formData.get('documentId') as string;

    console.log(`📄 Processing file: ${file?.name} (${file?.size} bytes) for document ID: ${documentId}`);

    if (!documentId || !file) {
      return NextResponse.json(
        { error: 'Document ID and file are required' },
        { status: 400 }
      );
    }

    console.log('📄 Calling document processor...');
    const result = await documentProcessor.processDocument(parseInt(documentId), file);
    
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