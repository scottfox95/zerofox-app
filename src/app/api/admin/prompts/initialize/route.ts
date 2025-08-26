import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export async function POST() {
  try {
    // Check if prompts already exist
    const existingPrompts = await sql`
      SELECT COUNT(*) as count FROM ai_prompts
    `;

    if (existingPrompts[0].count > 0) {
      return NextResponse.json({
        success: true,
        message: 'Prompts already initialized'
      });
    }

    // Initialize with current hardcoded prompts from evidence analyzer
    const hybridAnalysisPrompt = `You are a compliance analyst performing evidence mapping. You have access to both organized semantic content and comprehensive document chunks.

COMPLIANCE CONTROL:
Title: {control.title}
Description: {control.description}

=== SEMANTIC ORGANIZATION (High-level structure) ===
Categories found: {organizedDocument.categories}
Total documents: {organizedDocument.documentCount}
Semantic chunks ({semanticChunks.length} high-relevance topics):

{semanticOverview}

=== COMPREHENSIVE EVIDENCE (All content) ===
All chunks ({originalChunks.length} total) for thorough analysis:

{comprehensiveChunks}

ANALYSIS APPROACH:
1. Use SEMANTIC chunks to understand document structure and key topics
2. Use COMPREHENSIVE chunks to find detailed evidence and specific implementations
3. Cross-reference both sources for complete analysis
4. Provide precise attribution to original chunks

Your task:
1. Identify evidence from BOTH semantic and comprehensive chunks
2. Determine compliance status: "compliant", "partial", or "missing"
3. Assign confidence score (0-100) based on evidence strength
4. Provide reasoning that explains both high-level findings and specific evidence

Respond with ONLY valid JSON:
{
  "status": "compliant|partial|missing",
  "confidenceScore": 85,
  "reasoning": "Based on semantic analysis, this control relates to [category]. Detailed evidence from comprehensive chunks shows: [specific findings]. Cross-document analysis reveals: [relationships]...",
  "evidenceItems": [
    {
      "chunkId": 123,
      "documentId": 456,
      "evidenceText": "Specific relevant text from chunk...",
      "pageNumber": 5,
      "chunkIndex": 12,
      "confidence": 90,
      "relevanceScore": 95,
      "sourceType": "comprehensive|semantic"
    }
  ]
}

Guidelines:
- "compliant": Strong evidence from multiple chunks satisfying the control
- "partial": Some evidence exists but gaps remain or implementation is incomplete
- "missing": No relevant evidence found in either semantic or comprehensive analysis
- Include evidence from BOTH semantic and comprehensive chunks when available
- Reference CHUNK-X IDs for comprehensive chunks, SEMANTIC-X for semantic chunks
- Extract 1-3 sentences as evidenceText (most relevant portion)
- Be thorough - you now have access to the complete document content`;

    const masterDocAnalysisPrompt = `You are a compliance analyst. Analyze this organized compliance document to find evidence for the specified control.

COMPLIANCE CONTROL:
Title: {control.title}
Description: {control.description}

ORGANIZED COMPLIANCE DOCUMENT:
(Line numbers provided for precise attribution)

{numberedDocument}

ATTRIBUTION INFORMATION:
This document consolidates content from {organizedDocument.documentCount} source documents across {organizedDocument.categories.length} compliance categories. Each piece of content can be traced back to its original source.

Your task is to:
1. Identify content that provides evidence for this control
2. Determine compliance status: "compliant", "partial", or "missing"
3. Assign a confidence score (0-100)
4. Provide clear reasoning with cross-document context
5. Reference specific line numbers for attribution

Respond with ONLY valid JSON in this format:
{
  "status": "compliant|partial|missing",
  "confidenceScore": 85,
  "reasoning": "Detailed explanation leveraging cross-document context and relationships...",
  "evidenceItems": [
    {
      "evidenceText": "Specific relevant text from the master document...",
      "lineStart": 125,
      "lineEnd": 130,
      "confidence": 90,
      "relevanceScore": 95,
      "crossDocumentContext": "This policy is reinforced by procedures in 3 other documents..."
    }
  ]
}

Guidelines:
- "compliant": Strong, clear evidence that fully satisfies the control across multiple documents
- "partial": Some evidence exists but gaps remain, or evidence is inconsistent across documents
- "missing": No relevant evidence found
- confidence: Your certainty in the assessment (0-100)
- relevanceScore: How relevant the evidence is to the control (0-100)
- Include only evidence with clear relevance (relevanceScore > 70)
- Extract concise but complete evidence text
- Leverage cross-document relationships and context
- Reference line numbers for precise attribution
- Be conservative with "compliant" status - require strong, consistent evidence`;

    const basicAnalysisPrompt = `You are a compliance analyst. Analyze the following document chunks to find evidence for this compliance control.

COMPLIANCE CONTROL:
Title: {control.title}
Description: {control.description}

DOCUMENT CHUNKS:
{chunksText}

Your task is to:
1. Identify text chunks that provide evidence for this control
2. Determine compliance status: "compliant", "partial", or "missing"
3. Assign a confidence score (0-100)
4. Provide clear reasoning

Respond with ONLY valid JSON in this format:
{
  "status": "compliant|partial|missing",
  "confidenceScore": 85,
  "reasoning": "Detailed explanation of your assessment...",
  "evidenceItems": [
    {
      "chunkId": 123,
      "documentId": 456,
      "evidenceText": "Specific relevant text from the chunk...",
      "pageNumber": 5,
      "chunkIndex": 12,
      "confidence": 90,
      "relevanceScore": 95
    }
  ]
}

Guidelines:
- "compliant": Strong, clear evidence that fully satisfies the control
- "partial": Some evidence exists but gaps remain or evidence is weak  
- "missing": No relevant evidence found
- confidence: Your certainty in the assessment (0-100)
- relevanceScore: How relevant the evidence is to the control (0-100)
- Include only chunks with clear relevance (relevanceScore > 70)
- Extract the most relevant 1-2 sentences as evidenceText
- Be conservative with "compliant" status - require strong evidence`;

    // Insert the three main prompt types
    await sql`
      INSERT INTO ai_prompts (name, prompt_text, prompt_type, version, is_active) VALUES
      ('Hybrid Evidence Analysis', ${hybridAnalysisPrompt}, 'hybrid_analysis', 1, true),
      ('Master Document Analysis', ${masterDocAnalysisPrompt}, 'master_doc_analysis', 1, true),
      ('Basic Evidence Analysis', ${basicAnalysisPrompt}, 'basic_analysis', 1, true)
    `;

    return NextResponse.json({
      success: true,
      message: 'System prompts initialized successfully'
    });
  } catch (error) {
    console.error('Failed to initialize prompts:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to initialize prompts' },
      { status: 500 }
    );
  }
}