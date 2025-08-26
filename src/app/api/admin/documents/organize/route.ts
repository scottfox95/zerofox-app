import { NextRequest, NextResponse } from 'next/server';
import { DocumentIntelligenceService } from '@/lib/document-intelligence';

const intelligenceService = new DocumentIntelligenceService();

export async function POST(request: NextRequest) {
  try {
    const { organizationId = 1, documentIds } = await request.json();

    if (!documentIds || !Array.isArray(documentIds) || documentIds.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Document IDs array is required'
      }, { status: 400 });
    }

    console.log(`📋 Organizing ${documentIds.length} documents into master document...`);
    
    const result = await intelligenceService.createOrganizedMasterDocument(
      organizationId,
      documentIds
    );

    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: result.error
      }, { status: 400 });
    }

    console.log('✅ Master document created successfully');
    
    return NextResponse.json({
      success: true,
      organizedDocument: result.organizedDocument,
      message: `Successfully organized ${documentIds.length} documents into master document`
    });

  } catch (error) {
    console.error('Document organization failed:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to organize documents'
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const organizationId = parseInt(searchParams.get('organizationId') || '1');

    const organizedDocument = await intelligenceService.getOrganizedDocument(organizationId);
    
    if (!organizedDocument) {
      return NextResponse.json({
        success: false,
        error: 'No organized document found'
      }, { status: 404 });
    }

    const attributions = await intelligenceService.getAttributionMappings(organizedDocument.id!);

    return NextResponse.json({
      success: true,
      organizedDocument,
      attributions
    });

  } catch (error) {
    console.error('Failed to get organized document:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get organized document'
    }, { status: 500 });
  }
}