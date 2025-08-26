import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

interface Params {
  id: string;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Params }
) {
  try {
    const id = parseInt(params.id);
    if (isNaN(id)) {
      return NextResponse.json(
        { success: false, error: 'Invalid prompt ID' },
        { status: 400 }
      );
    }

    const result = await sql`
      SELECT * FROM ai_prompts WHERE id = ${id}
    `;

    if (result.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Prompt not found' },
        { status: 404 }
      );
    }

    const prompt = result[0];
    return NextResponse.json({
      success: true,
      prompt: {
        id: prompt.id,
        name: prompt.name,
        promptText: prompt.prompt_text,
        promptType: prompt.prompt_type,
        version: prompt.version,
        isActive: prompt.is_active,
        createdAt: prompt.created_at
      }
    });
  } catch (error) {
    console.error('Failed to fetch prompt:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch prompt' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Params }
) {
  try {
    const id = parseInt(params.id);
    if (isNaN(id)) {
      return NextResponse.json(
        { success: false, error: 'Invalid prompt ID' },
        { status: 400 }
      );
    }

    const { name, promptText, isActive } = await request.json();

    // Get current prompt
    const currentPrompt = await sql`
      SELECT * FROM ai_prompts WHERE id = ${id}
    `;

    if (currentPrompt.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Prompt not found' },
        { status: 404 }
      );
    }

    // If activating this prompt, deactivate others of the same type
    if (isActive && !currentPrompt[0].is_active) {
      await sql`
        UPDATE ai_prompts 
        SET is_active = false 
        WHERE prompt_type = ${currentPrompt[0].prompt_type} AND is_active = true
      `;
    }

    const result = await sql`
      UPDATE ai_prompts 
      SET 
        name = COALESCE(${name}, name),
        prompt_text = COALESCE(${promptText}, prompt_text),
        is_active = COALESCE(${isActive}, is_active)
      WHERE id = ${id}
      RETURNING *
    `;

    return NextResponse.json({
      success: true,
      prompt: {
        id: result[0].id,
        name: result[0].name,
        promptText: result[0].prompt_text,
        promptType: result[0].prompt_type,
        version: result[0].version,
        isActive: result[0].is_active,
        createdAt: result[0].created_at
      }
    });
  } catch (error) {
    console.error('Failed to update prompt:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update prompt' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Params }
) {
  try {
    const id = parseInt(params.id);
    if (isNaN(id)) {
      return NextResponse.json(
        { success: false, error: 'Invalid prompt ID' },
        { status: 400 }
      );
    }

    const result = await sql`
      DELETE FROM ai_prompts WHERE id = ${id}
      RETURNING id
    `;

    if (result.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Prompt not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Prompt deleted successfully'
    });
  } catch (error) {
    console.error('Failed to delete prompt:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete prompt' },
      { status: 500 }
    );
  }
}