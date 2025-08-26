import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export async function GET() {
  try {
    const prompts = await sql`
      SELECT * FROM ai_prompts 
      ORDER BY prompt_type, name
    `;

    return NextResponse.json({
      success: true,
      prompts: prompts.map(prompt => ({
        id: prompt.id,
        name: prompt.name,
        promptText: prompt.prompt_text,
        promptType: prompt.prompt_type,
        version: prompt.version,
        isActive: prompt.is_active,
        createdAt: prompt.created_at
      }))
    });
  } catch (error) {
    console.error('Failed to fetch prompts:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch prompts' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { name, promptText, promptType } = await request.json();

    if (!name || !promptText || !promptType) {
      return NextResponse.json(
        { success: false, error: 'Name, prompt text, and prompt type are required' },
        { status: 400 }
      );
    }

    // Check if this prompt type already has an active version
    const existingPrompt = await sql`
      SELECT id FROM ai_prompts 
      WHERE prompt_type = ${promptType} AND is_active = true
    `;

    // If exists, deactivate it and increment version
    let version = 1;
    if (existingPrompt.length > 0) {
      await sql`
        UPDATE ai_prompts 
        SET is_active = false 
        WHERE prompt_type = ${promptType} AND is_active = true
      `;

      const maxVersion = await sql`
        SELECT MAX(version) as max_version 
        FROM ai_prompts 
        WHERE prompt_type = ${promptType}
      `;
      version = (maxVersion[0]?.max_version || 0) + 1;
    }

    const result = await sql`
      INSERT INTO ai_prompts (name, prompt_text, prompt_type, version, is_active)
      VALUES (${name}, ${promptText}, ${promptType}, ${version}, true)
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
    console.error('Failed to create prompt:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create prompt' },
      { status: 500 }
    );
  }
}