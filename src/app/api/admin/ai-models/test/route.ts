import { NextRequest, NextResponse } from 'next/server';
import { aiService } from '@/lib/ai';

export async function POST(request: NextRequest) {
  try {
    const { modelId, prompt } = await request.json();

    if (!modelId) {
      return NextResponse.json(
        { error: 'Model ID is required' },
        { status: 400 }
      );
    }

    const result = await aiService.testModel(modelId, prompt);
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('AI model test error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to test AI model' },
      { status: 500 }
    );
  }
}