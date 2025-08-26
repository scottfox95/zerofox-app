import { NextRequest, NextResponse } from 'next/server';
import { FrameworkStandardizer } from '@/lib/framework';

const standardizer = new FrameworkStandardizer();

export async function POST(request: NextRequest) {
  try {
    const { rawData, filename, aiModel } = await request.json();

    if (!rawData || !filename) {
      return NextResponse.json(
        { error: 'Raw data and filename are required' },
        { status: 400 }
      );
    }

    const result = await standardizer.standardizeFramework(
      rawData, 
      filename, 
      aiModel || 'claude-sonnet'
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    // Generate framework summary
    const summary = standardizer.generateFrameworkSummary(result.framework!);

    return NextResponse.json({
      success: true,
      framework: result.framework,
      summary
    });
  } catch (error) {
    console.error('Framework standardization error:', error);
    return NextResponse.json(
      { error: 'Failed to standardize framework' },
      { status: 500 }
    );
  }
}