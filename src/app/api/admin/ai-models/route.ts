import { NextRequest, NextResponse } from 'next/server';
import { aiService } from '@/lib/ai';

export async function GET() {
  try {
    const availableModels = aiService.getAvailableModels();
    
    // Check which API keys are configured
    const apiKeyStatus = {
      anthropic: !!process.env.ANTHROPIC_API_KEY,
      openai: !!process.env.OPENAI_API_KEY,
      google: !!process.env.GOOGLE_AI_API_KEY
    };
    
    return NextResponse.json({
      success: true,
      models: availableModels,
      apiKeyStatus
    });
  } catch (error) {
    console.error('Get AI models error:', error);
    return NextResponse.json(
      { error: 'Failed to get AI models' },
      { status: 500 }
    );
  }
}