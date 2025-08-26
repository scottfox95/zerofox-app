import { sql } from './db';
import { AIService } from './ai';
import { DocumentIntelligenceService, OrganizedDocument, AttributionMap } from './document-intelligence';
import { consoleLogger } from './console-logger';

export interface EvidenceMapping {
  id?: number;
  analysisId: number;
  controlId: number;
  controlTitle: string;
  controlDescription: string;
  status: 'compliant' | 'partial' | 'missing';
  confidenceScore: number;
  reasoning: string;
  createdAt?: Date;
}

export interface EvidenceItem {
  id?: number;
  evidenceMappingId: number;
  documentId: number;
  documentName?: string;
  chunkId: number;
  evidenceText: string;
  pageNumber?: number;
  chunkIndex: number;
  confidence: number;
  relevanceScore: number;
  createdAt?: Date;
}

export interface Analysis {
  id?: number;
  organizationId: number;
  frameworkId: number;
  frameworkName: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  startedAt?: Date;
  completedAt?: Date;
  totalControls: number;
  compliantControls: number;
  partialControls: number;
  missingControls: number;
  averageConfidence: number;
  processingTime?: number;
  createdAt?: Date;
}

export interface AnalysisResult {
  analysis: Analysis;
  evidenceMappings: Array<EvidenceMapping & { evidenceItems: EvidenceItem[] }>;
  gapSummary: {
    missingControls: Array<{ id: number; title: string; description: string; importance: 'high' | 'medium' | 'low' }>;
    lowConfidenceControls: Array<{ id: number; title: string; confidence: number; reasoning: string }>;
    recommendations: string[];
  };
}

export class EvidenceAnalyzer {
  private aiService: AIService;
  private intelligenceService: DocumentIntelligenceService;

  constructor() {
    this.aiService = new AIService();
    this.intelligenceService = new DocumentIntelligenceService();
  }

  // Get active prompt for a specific type
  private async getPrompt(promptType: string): Promise<string | null> {
    try {
      const result = await sql`
        SELECT prompt_text FROM ai_prompts 
        WHERE prompt_type = ${promptType} AND is_active = true 
        LIMIT 1
      `;
      
      return result.length > 0 ? result[0].prompt_text : null;
    } catch (error) {
      console.error(`Failed to fetch prompt for type ${promptType}:`, error);
      return null;
    }
  }

  // Helper method to substitute variables in prompts
  private substitutePromptVariables(prompt: string, variables: Record<string, string>): string {
    let result = prompt;
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`\\{${key}\\}`, 'g');
      result = result.replace(regex, value);
    }
    return result;
  }

  // Helper method to build semantic overview
  private buildSemanticOverview(semanticChunks: any[]): string {
    return semanticChunks.length > 0 
      ? semanticChunks.map((chunk, index) => 
          `[SEMANTIC-${index}] [TOPIC: ${chunk.topic}] [CATEGORY: ${chunk.category}] [RELEVANCE: ${chunk.relevance_score}]\n${chunk.chunk_text}\n---`
        ).join('\n')
      : "No semantic chunks available.";
  }

  // Helper method to build comprehensive chunks
  private buildComprehensiveChunks(originalChunks: any[]): string {
    return originalChunks.map((chunk, index) => 
      `[CHUNK-${index}] [DOC: ${chunk.original_name}] [PAGE: ${chunk.page_number || 'unknown'}] [CHUNK_ID: ${chunk.id}] [DOC_ID: ${chunk.document_id}]\n${chunk.chunk_text}\n---`
    ).join('\n');
  }

  async startAnalysis(
    organizationId: number, 
    frameworkId: number,
    documentIds?: number[]
  ): Promise<{ success: boolean; analysisId?: number; error?: string }> {
    try {
      consoleLogger.analysisStep('Starting new analysis', `Framework ID: ${frameworkId}, Documents: ${documentIds?.length || 'all'}`);
      
      const startTime = Date.now();
      // Get framework details
      const frameworkResult = await sql`
        SELECT * FROM frameworks WHERE id = ${frameworkId}
      `;

      if (frameworkResult.length === 0) {
        consoleLogger.error('Framework not found', 'ANALYSIS', { frameworkId });
        return { success: false, error: 'Framework not found' };
      }

      const framework = frameworkResult[0];
      consoleLogger.analysisStep('Framework loaded', `${framework.name} with ${framework.controls_count || 0} controls`);

      // Get controls for this framework
      const controlsResult = await sql`
        SELECT * FROM controls WHERE framework_id = ${frameworkId}
        ORDER BY control_id
      `;

      // Create analysis record
      consoleLogger.analysisStep('Creating analysis record', `${controlsResult.length} controls to analyze`);
      const analysisName = `${framework.name} Analysis - ${new Date().toLocaleDateString()}`;
      const analysisResult = await sql`
        INSERT INTO analyses (
          organization_id, 
          framework_id, 
          framework_name,
          name,
          status, 
          total_controls,
          started_at
        )
        VALUES (
          ${organizationId}, 
          ${frameworkId}, 
          ${framework.name},
          ${analysisName},
          'processing', 
          ${controlsResult.length},
          CURRENT_TIMESTAMP
        )
        RETURNING *
      `;

      const analysis = analysisResult[0] as Analysis;

      // Start async analysis process
      this.performAnalysis(analysis.id!, organizationId, controlsResult, documentIds, framework)
        .catch(error => {
          console.error('Analysis failed:', error);
          // Update analysis status to failed
          sql`
            UPDATE analyses 
            SET status = 'failed', completed_at = CURRENT_TIMESTAMP 
            WHERE id = ${analysis.id}
          `.catch(console.error);
        });

      return { success: true, analysisId: analysis.id };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to start analysis' 
      };
    }
  }

  private async performAnalysis(
    analysisId: number, 
    organizationId: number, 
    controls: any[], 
    documentIds?: number[],
    framework?: any
  ): Promise<void> {
    const startTime = Date.now();

    try {
      // Step 1: Determine which documents to use
      let targetDocumentIds = documentIds;
      
      if (!targetDocumentIds || targetDocumentIds.length === 0) {
        // Use all processed documents for the organization
        const allDocs = await sql`
          SELECT id FROM documents 
          WHERE organization_id = ${organizationId} 
          AND processed_at IS NOT NULL
        `;
        targetDocumentIds = allDocs.map(doc => doc.id);
      }

      if (targetDocumentIds.length === 0) {
        throw new Error('No processed documents found for analysis');
      }

      // Step 2: Check if organized master document exists, if not create it
      let organizedDocument = await this.intelligenceService.getOrganizedDocument(organizationId);
      
      if (!organizedDocument) {
        console.log('📋 Creating organized master document for analysis...');
        const organizationResult = await this.intelligenceService.createOrganizedMasterDocument(
          organizationId,
          targetDocumentIds
        );
        
        if (!organizationResult.success || !organizationResult.organizedDocument) {
          throw new Error(`Failed to create organized document: ${organizationResult.error}`);
        }
        
        organizedDocument = organizationResult.organizedDocument;
      }

      // Step 3: Get attribution mappings for source attribution
      const attributions = await this.intelligenceService.getAttributionMappings(organizedDocument.id!);

      // Step 4: Get both semantic chunks and original text chunks for comprehensive analysis
      const semanticChunks = await sql`
        SELECT sc.*, d.original_name, d.id as document_id
        FROM semantic_chunks sc
        JOIN documents d ON sc.document_id = d.id
        WHERE d.organization_id = ${organizationId}
        AND d.id = ANY(${targetDocumentIds})
        ORDER BY sc.relevance_score DESC, sc.chunk_index
      `;

      const originalChunks = await sql`
        SELECT tc.*, d.original_name, d.id as document_id
        FROM text_chunks tc
        JOIN documents d ON tc.document_id = d.id
        WHERE d.organization_id = ${organizationId}
        AND d.id = ANY(${targetDocumentIds})
        ORDER BY tc.document_id, tc.chunk_index
      `;

      console.log(`📊 Analysis data: ${semanticChunks.length} semantic chunks + ${originalChunks.length} original chunks`);

      // Step 5: Process each control using hybrid approach
      let compliantCount = 0;
      let partialCount = 0;
      let missingCount = 0;
      let totalConfidence = 0;

      for (const control of controls) {
        const mappingResult = await this.analyzeControlEvidenceHybrid(
          analysisId,
          control,
          organizedDocument,
          attributions,
          semanticChunks,
          originalChunks,
          framework
        );

        if (mappingResult.status === 'compliant') compliantCount++;
        else if (mappingResult.status === 'partial') partialCount++;
        else missingCount++;

        totalConfidence += mappingResult.confidenceScore;
      }

      const averageConfidence = controls.length > 0 ? totalConfidence / controls.length : 0;
      const processingTime = Date.now() - startTime;

      // Update analysis with results
      await sql`
        UPDATE analyses SET
          status = 'completed',
          completed_at = CURRENT_TIMESTAMP,
          compliant_controls = ${compliantCount},
          partial_controls = ${partialCount},
          missing_controls = ${missingCount},
          average_confidence = ${averageConfidence},
          processing_time = ${processingTime}
        WHERE id = ${analysisId}
      `;

    } catch (error) {
      console.error('Analysis processing failed:', error);
      await sql`
        UPDATE analyses SET
          status = 'failed',
          completed_at = CURRENT_TIMESTAMP
        WHERE id = ${analysisId}
      `;
      throw error;
    }
  }

  private async analyzeControlEvidenceHybrid(
    analysisId: number,
    control: any,
    organizedDocument: OrganizedDocument,
    attributions: AttributionMap[],
    semanticChunks: any[],
    originalChunks: any[],
    framework?: any
  ): Promise<EvidenceMapping> {
    try {
      // Create enhanced hybrid prompt using both organized document and comprehensive chunks
      const analysisPrompt = await this.createHybridAnalysisPrompt(control, organizedDocument, attributions, semanticChunks, originalChunks, framework);
      
      // Get AI analysis
      const aiResponse = await this.aiService.generateResponse(analysisPrompt, 'claude', 4000); // Increase token limit for more comprehensive analysis
      
      // Parse AI response with enhanced attribution mapping
      const parsedResponse = this.parseHybridEvidenceResponse(aiResponse, attributions, originalChunks);

      // Create evidence mapping record
      const mappingResult = await sql`
        INSERT INTO evidence_mappings (
          analysis_id,
          control_id,
          control_title,
          control_description,
          status,
          confidence_score,
          reasoning
        )
        VALUES (
          ${analysisId},
          ${control.id},
          ${control.title},
          ${control.description},
          ${parsedResponse.status},
          ${parsedResponse.confidenceScore},
          ${parsedResponse.reasoning}
        )
        RETURNING *
      `;

      const mapping = mappingResult[0] as EvidenceMapping;

      // Create evidence items with proper attribution
      for (const evidence of parsedResponse.evidenceItems) {
        await sql`
          INSERT INTO evidence_items (
            evidence_mapping_id,
            document_id,
            chunk_id,
            evidence_text,
            page_number,
            chunk_index,
            confidence,
            relevance_score
          )
          VALUES (
            ${mapping.id},
            ${evidence.documentId},
            ${evidence.chunkId || 0},
            ${evidence.evidenceText},
            ${evidence.pageNumber},
            ${evidence.chunkIndex},
            ${evidence.confidence},
            ${evidence.relevanceScore}
          )
        `;
      }

      return mapping;
    } catch (error) {
      console.error(`Failed to analyze control ${control.id}:`, error);
      
      // Create failed mapping record
      const mappingResult = await sql`
        INSERT INTO evidence_mappings (
          analysis_id,
          control_id,
          control_title,
          control_description,
          status,
          confidence_score,
          reasoning
        )
        VALUES (
          ${analysisId},
          ${control.id},
          ${control.title},
          ${control.description},
          'missing',
          0,
          'Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}'
        )
        RETURNING *
      `;

      return mappingResult[0] as EvidenceMapping;
    }
  }

  private async analyzeControlEvidenceWithMasterDoc(
    analysisId: number,
    control: any,
    organizedDocument: OrganizedDocument,
    attributions: AttributionMap[]
  ): Promise<EvidenceMapping> {
    try {
      // Create enhanced prompt using the organized master document
      const analysisPrompt = await this.createMasterDocAnalysisPrompt(control, organizedDocument, attributions);
      
      // Get AI analysis
      const aiResponse = await this.aiService.generateResponse(analysisPrompt, 'claude');
      
      // Parse AI response with attribution mapping
      const parsedResponse = this.parseMasterDocEvidenceResponse(aiResponse, attributions);

      // Create evidence mapping record
      const mappingResult = await sql`
        INSERT INTO evidence_mappings (
          analysis_id,
          control_id,
          control_title,
          control_description,
          status,
          confidence_score,
          reasoning
        )
        VALUES (
          ${analysisId},
          ${control.id},
          ${control.title},
          ${control.description},
          ${parsedResponse.status},
          ${parsedResponse.confidenceScore},
          ${parsedResponse.reasoning}
        )
        RETURNING *
      `;

      const mapping = mappingResult[0] as EvidenceMapping;

      // Create evidence items with proper attribution
      for (const evidence of parsedResponse.evidenceItems) {
        await sql`
          INSERT INTO evidence_items (
            evidence_mapping_id,
            document_id,
            chunk_id,
            evidence_text,
            page_number,
            chunk_index,
            confidence,
            relevance_score
          )
          VALUES (
            ${mapping.id},
            ${evidence.documentId},
            ${evidence.chunkId || 0}, // May not have chunk_id with master doc approach
            ${evidence.evidenceText},
            ${evidence.pageNumber},
            ${evidence.chunkIndex},
            ${evidence.confidence},
            ${evidence.relevanceScore}
          )
        `;
      }

      return mapping;
    } catch (error) {
      console.error(`Failed to analyze control ${control.id}:`, error);
      
      // Create failed mapping record
      const mappingResult = await sql`
        INSERT INTO evidence_mappings (
          analysis_id,
          control_id,
          control_title,
          control_description,
          status,
          confidence_score,
          reasoning
        )
        VALUES (
          ${analysisId},
          ${control.id},
          ${control.title},
          ${control.description},
          'missing',
          0,
          'Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}'
        )
        RETURNING *
      `;

      return mappingResult[0] as EvidenceMapping;
    }
  }

  private async analyzeControlEvidence(
    analysisId: number,
    control: any,
    chunks: any[]
  ): Promise<EvidenceMapping> {
    try {
      // Create prompt for evidence analysis
      const analysisPrompt = await this.createEvidenceAnalysisPrompt(control, chunks);
      
      // Get AI analysis
      const aiResponse = await this.aiService.generateResponse(analysisPrompt, 'claude');
      
      // Parse AI response
      const parsedResponse = this.parseEvidenceResponse(aiResponse);

      // Create evidence mapping record
      const mappingResult = await sql`
        INSERT INTO evidence_mappings (
          analysis_id,
          control_id,
          control_title,
          control_description,
          status,
          confidence_score,
          reasoning
        )
        VALUES (
          ${analysisId},
          ${control.id},
          ${control.title},
          ${control.description},
          ${parsedResponse.status},
          ${parsedResponse.confidenceScore},
          ${parsedResponse.reasoning}
        )
        RETURNING *
      `;

      const mapping = mappingResult[0] as EvidenceMapping;

      // Create evidence items for relevant chunks
      for (const evidence of parsedResponse.evidenceItems) {
        await sql`
          INSERT INTO evidence_items (
            evidence_mapping_id,
            document_id,
            chunk_id,
            evidence_text,
            page_number,
            chunk_index,
            confidence,
            relevance_score
          )
          VALUES (
            ${mapping.id},
            ${evidence.documentId},
            ${evidence.chunkId},
            ${evidence.evidenceText},
            ${evidence.pageNumber},
            ${evidence.chunkIndex},
            ${evidence.confidence},
            ${evidence.relevanceScore}
          )
        `;
      }

      return mapping;
    } catch (error) {
      console.error(`Failed to analyze control ${control.id}:`, error);
      
      // Create failed mapping record
      const mappingResult = await sql`
        INSERT INTO evidence_mappings (
          analysis_id,
          control_id,
          control_title,
          control_description,
          status,
          confidence_score,
          reasoning
        )
        VALUES (
          ${analysisId},
          ${control.id},
          ${control.title},
          ${control.description},
          'missing',
          0,
          'Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}'
        )
        RETURNING *
      `;

      return mappingResult[0] as EvidenceMapping;
    }
  }

  private async createHybridAnalysisPrompt(
    control: any,
    organizedDocument: OrganizedDocument,
    attributions: AttributionMap[],
    semanticChunks: any[],
    originalChunks: any[],
    framework?: any
  ): Promise<string> {
    // Determine which prompt to use based on framework
    let promptType = 'hybrid_analysis'; // Default prompt
    
    // Check if this is ISO 27001 framework
    if (framework && (framework.name.toLowerCase().includes('iso') && framework.name.toLowerCase().includes('27001'))) {
      promptType = 'iso27001_analysis';
      consoleLogger.analysisStep('Using ISO 27001 specialized prompt', `Framework: ${framework.name}`);
    }
    
    // Try to get prompt from database first
    const dbPrompt = await this.getPrompt(promptType);
    
    if (dbPrompt) {
      // Base variables for all prompts
      const baseVariables = {
        'control.title': control.title,
        'control.description': control.description || control.requirement_text || '',
        'organizedDocument.categories': organizedDocument.categories?.join(', ') || 'No categories',
        'organizedDocument.documentCount': organizedDocument.documentCount.toString(),
        'semanticChunks.length': semanticChunks.length.toString(),
        'originalChunks.length': originalChunks.length.toString(),
        'semanticOverview': this.buildSemanticOverview(semanticChunks),
        'comprehensiveChunks': this.buildComprehensiveChunks(originalChunks)
      };

      // Add ISO 27001-specific variables if using ISO prompt
      if (promptType === 'iso27001_analysis') {
        Object.assign(baseVariables, {
          'control.control_id': control.control_id || '',
          'control.requirement_text': control.requirement_text || control.description || '',
          'control.control_type': Array.isArray(control.control_type) ? control.control_type.join(', ') : (control.control_type || 'Not specified'),
          'control.op_capabilities': Array.isArray(control.op_capabilities) ? control.op_capabilities.join(', ') : (control.op_capabilities || 'Not specified'),
          'control.category': control.category || 'Not specified',
          'control.dti': control.dti || 'Not specified'
        });
      }

      // Use database prompt and substitute variables
      return this.substitutePromptVariables(dbPrompt, baseVariables);
    }

    // Fallback to hardcoded prompt
    const semanticOverview = this.buildSemanticOverview(semanticChunks);
    const comprehensiveChunks = this.buildComprehensiveChunks(originalChunks);

    return `You are a compliance analyst performing evidence mapping. You have access to both organized semantic content and comprehensive document chunks.

COMPLIANCE CONTROL:
Title: ${control.title}
Description: ${control.description}

=== SEMANTIC ORGANIZATION (High-level structure) ===
Categories found: ${organizedDocument.categories?.join(', ')}
Total documents: ${organizedDocument.documentCount}
Semantic chunks (${semanticChunks.length} high-relevance topics):

${semanticOverview}

=== COMPREHENSIVE EVIDENCE (All content) ===
All chunks (${originalChunks.length} total) for thorough analysis:

${comprehensiveChunks}

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
  }

  private async createMasterDocAnalysisPrompt(
    control: any, 
    organizedDocument: OrganizedDocument, 
    attributions: AttributionMap[]
  ): Promise<string> {
    // Try to get prompt from database first
    const dbPrompt = await this.getPrompt('master_doc_analysis');
    
    const documentLines = organizedDocument.masterMarkdown.split('\n');
    const numberedDocument = documentLines
      .map((line, index) => `${(index + 1).toString().padStart(4)}: ${line}`)
      .join('\n');
    
    if (dbPrompt) {
      // Use database prompt and substitute variables
      return this.substitutePromptVariables(dbPrompt, {
        'control.title': control.title,
        'control.description': control.description,
        'numberedDocument': numberedDocument,
        'organizedDocument.documentCount': organizedDocument.documentCount.toString(),
        'organizedDocument.categories.length': (organizedDocument.categories?.length || 0).toString()
      });
    }

    // Fallback to hardcoded prompt
    return `You are a compliance analyst. Analyze this organized compliance document to find evidence for the specified control.

COMPLIANCE CONTROL:
Title: ${control.title}
Description: ${control.description}

ORGANIZED COMPLIANCE DOCUMENT:
(Line numbers provided for precise attribution)

${numberedDocument}

ATTRIBUTION INFORMATION:
This document consolidates content from ${organizedDocument.documentCount} source documents across ${organizedDocument.categories?.length || 0} compliance categories. Each piece of content can be traced back to its original source.

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
  }

  private async createEvidenceAnalysisPrompt(control: any, chunks: any[]): Promise<string> {
    // Try to get prompt from database first
    const dbPrompt = await this.getPrompt('basic_analysis');
    
    const chunksText = chunks.map((chunk, index) => 
      `[CHUNK ${index}] [DOC: ${chunk.original_name}] [PAGE: ${chunk.page_number || 'unknown'}] [CHUNK_ID: ${chunk.id}] [DOC_ID: ${chunk.document_id}]\n${chunk.chunk_text}\n---\n`
    ).join('');
    
    if (dbPrompt) {
      // Use database prompt and substitute variables
      return this.substitutePromptVariables(dbPrompt, {
        'control.title': control.title,
        'control.description': control.description,
        'chunksText': chunksText
      });
    }

    // Fallback to hardcoded prompt
    return `You are a compliance analyst. Analyze the following document chunks to find evidence for this compliance control.

COMPLIANCE CONTROL:
Title: ${control.title}
Description: ${control.description}

DOCUMENT CHUNKS:
${chunksText}

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
  }

  private parseHybridEvidenceResponse(
    response: string,
    attributions: AttributionMap[],
    originalChunks: any[]
  ): {
    status: 'compliant' | 'partial' | 'missing';
    confidenceScore: number;
    reasoning: string;
    evidenceItems: Array<{
      chunkId: number;
      documentId: number;
      evidenceText: string;
      pageNumber?: number;
      chunkIndex: number;
      confidence: number;
      relevanceScore: number;
    }>;
  } {
    try {
      // Clean the response to extract JSON
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      
      const evidenceItems = (parsed.evidenceItems || []).map((item: any) => {
        // Handle both semantic and comprehensive chunk references
        let matchingChunk = null;
        let actualChunkId = 0;
        
        // Parse chunk ID - handle both numeric IDs and SEMANTIC-X/CHUNK-X references
        if (typeof item.chunkId === 'string') {
          if (item.chunkId.startsWith('CHUNK-')) {
            // Extract index from CHUNK-X format and find the actual chunk
            const chunkIndex = parseInt(item.chunkId.replace('CHUNK-', ''));
            if (!isNaN(chunkIndex) && chunkIndex < originalChunks.length) {
              matchingChunk = originalChunks[chunkIndex];
              actualChunkId = matchingChunk?.id || 0;
            }
          } else if (item.chunkId.startsWith('SEMANTIC-')) {
            // For semantic chunks, use a placeholder since they have their own IDs
            actualChunkId = 0;
          }
        } else if (typeof item.chunkId === 'number') {
          // Direct chunk ID lookup
          matchingChunk = originalChunks.find(chunk => chunk.id === item.chunkId);
          actualChunkId = item.chunkId;
        }
        
        return {
          chunkId: actualChunkId,
          documentId: matchingChunk?.document_id || item.documentId || 0,
          evidenceText: (item.evidenceText || '').substring(0, 1500),
          pageNumber: matchingChunk?.page_number || item.pageNumber,
          chunkIndex: matchingChunk?.chunk_index || item.chunkIndex || 0,
          confidence: Math.min(100, Math.max(0, item.confidence || 0)),
          relevanceScore: Math.min(100, Math.max(0, item.relevanceScore || 0))
        };
      });
      
      return {
        status: parsed.status || 'missing',
        confidenceScore: Math.min(100, Math.max(0, parsed.confidenceScore || 0)),
        reasoning: parsed.reasoning || 'No reasoning provided',
        evidenceItems
      };
    } catch (error) {
      console.error('Failed to parse hybrid evidence response:', error);
      return {
        status: 'missing',
        confidenceScore: 0,
        reasoning: 'Failed to parse AI analysis response',
        evidenceItems: []
      };
    }
  }

  private parseMasterDocEvidenceResponse(
    response: string,
    attributions: AttributionMap[]
  ): {
    status: 'compliant' | 'partial' | 'missing';
    confidenceScore: number;
    reasoning: string;
    evidenceItems: Array<{
      chunkId: number;
      documentId: number;
      evidenceText: string;
      pageNumber?: number;
      chunkIndex: number;
      confidence: number;
      relevanceScore: number;
    }>;
  } {
    try {
      // Clean the response to extract JSON
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      
      const evidenceItems = (parsed.evidenceItems || []).map((item: any) => {
        // Find the corresponding attribution for this line range
        const matchingAttribution = this.findAttributionForLines(
          item.lineStart,
          item.lineEnd,
          attributions
        );

        return {
          chunkId: matchingAttribution?.chunkIndex || 0,
          documentId: matchingAttribution?.documentId || 0,
          evidenceText: (item.evidenceText || '').substring(0, 1000),
          pageNumber: matchingAttribution?.pageNumber,
          chunkIndex: matchingAttribution?.chunkIndex || 0,
          confidence: Math.min(100, Math.max(0, item.confidence || 0)),
          relevanceScore: Math.min(100, Math.max(0, item.relevanceScore || 0))
        };
      });
      
      return {
        status: parsed.status || 'missing',
        confidenceScore: Math.min(100, Math.max(0, parsed.confidenceScore || 0)),
        reasoning: parsed.reasoning || 'No reasoning provided',
        evidenceItems
      };
    } catch (error) {
      console.error('Failed to parse master doc AI response:', error);
      return {
        status: 'missing',
        confidenceScore: 0,
        reasoning: 'Failed to parse AI analysis response',
        evidenceItems: []
      };
    }
  }

  private findAttributionForLines(
    lineStart: number,
    lineEnd: number,
    attributions: AttributionMap[]
  ): AttributionMap | null {
    // Find attribution that contains these lines
    for (const attribution of attributions) {
      if (lineStart >= attribution.lineStart && lineEnd <= attribution.lineEnd) {
        return attribution;
      }
    }
    
    // If exact match not found, find the closest attribution
    let closest = attributions[0];
    let closestDistance = Math.abs(lineStart - (closest?.lineStart || 0));
    
    for (const attribution of attributions) {
      const distance = Math.abs(lineStart - attribution.lineStart);
      if (distance < closestDistance) {
        closest = attribution;
        closestDistance = distance;
      }
    }
    
    return closest || null;
  }

  private parseEvidenceResponse(response: string): {
    status: 'compliant' | 'partial' | 'missing';
    confidenceScore: number;
    reasoning: string;
    evidenceItems: Array<{
      chunkId: number;
      documentId: number;
      evidenceText: string;
      pageNumber?: number;
      chunkIndex: number;
      confidence: number;
      relevanceScore: number;
    }>;
  } {
    try {
      // Clean the response to extract JSON
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      
      return {
        status: parsed.status || 'missing',
        confidenceScore: Math.min(100, Math.max(0, parsed.confidenceScore || 0)),
        reasoning: parsed.reasoning || 'No reasoning provided',
        evidenceItems: (parsed.evidenceItems || []).map((item: any) => ({
          chunkId: item.chunkId,
          documentId: item.documentId,
          evidenceText: (item.evidenceText || '').substring(0, 1000), // Limit length
          pageNumber: item.pageNumber,
          chunkIndex: item.chunkIndex,
          confidence: Math.min(100, Math.max(0, item.confidence || 0)),
          relevanceScore: Math.min(100, Math.max(0, item.relevanceScore || 0))
        }))
      };
    } catch (error) {
      console.error('Failed to parse AI response:', error);
      return {
        status: 'missing',
        confidenceScore: 0,
        reasoning: 'Failed to parse AI analysis response',
        evidenceItems: []
      };
    }
  }

  async getAnalysisResults(analysisId: number): Promise<AnalysisResult | null> {
    try {
      // Get analysis details
      const analysisResult = await sql`
        SELECT * FROM analyses WHERE id = ${analysisId}
      `;

      if (analysisResult.length === 0) {
        return null;
      }

      // Transform snake_case database fields to camelCase for frontend
      const rawAnalysis = analysisResult[0];
      const analysis = {
        id: rawAnalysis.id,
        organizationId: rawAnalysis.organization_id,
        frameworkId: rawAnalysis.framework_id,
        frameworkName: rawAnalysis.framework_name || '',
        status: rawAnalysis.status,
        startedAt: rawAnalysis.started_at,
        completedAt: rawAnalysis.completed_at,
        totalControls: rawAnalysis.total_controls || 0,
        compliantControls: rawAnalysis.compliant_controls || 0,
        partialControls: rawAnalysis.partial_controls || 0,
        missingControls: rawAnalysis.missing_controls || 0,
        averageConfidence: rawAnalysis.average_confidence || 0,
        processingTime: rawAnalysis.processing_time,
        createdAt: rawAnalysis.created_at
      } as Analysis;

      // Get evidence mappings with items
      const mappingsResult = await sql`
        SELECT 
          em.*,
          json_agg(
            CASE WHEN ei.id IS NOT NULL THEN
              json_build_object(
                'id', ei.id,
                'evidenceMappingId', ei.evidence_mapping_id,
                'documentId', ei.document_id,
                'documentName', d.original_name,
                'chunkId', ei.chunk_id,
                'evidenceText', ei.evidence_text,
                'pageNumber', ei.page_number,
                'chunkIndex', ei.chunk_index,
                'confidence', ei.confidence,
                'relevanceScore', ei.relevance_score,
                'createdAt', ei.created_at
              )
            ELSE NULL END
          ) FILTER (WHERE ei.id IS NOT NULL) as evidence_items
        FROM evidence_mappings em
        LEFT JOIN evidence_items ei ON em.id = ei.evidence_mapping_id
        LEFT JOIN documents d ON ei.document_id = d.id
        WHERE em.analysis_id = ${analysisId}
        GROUP BY em.id, em.analysis_id, em.control_id, em.control_title, 
                 em.control_description, em.status, em.confidence_score, 
                 em.reasoning, em.created_at
        ORDER BY em.control_id
      `;

      const evidenceMappings = mappingsResult.map(mapping => ({
        id: mapping.id,
        analysisId: mapping.analysis_id,
        controlId: mapping.control_id,
        controlTitle: mapping.control_title,
        controlDescription: mapping.control_description,
        status: mapping.status,
        confidenceScore: mapping.confidence_score,
        reasoning: mapping.reasoning,
        createdAt: mapping.created_at,
        evidenceItems: mapping.evidence_items || []
      }));

      // Generate gap summary
      const gapSummary = this.generateGapSummary(evidenceMappings);

      return {
        analysis,
        evidenceMappings,
        gapSummary
      };
    } catch (error) {
      console.error('Failed to get analysis results:', error);
      return null;
    }
  }

  private generateGapSummary(mappings: Array<EvidenceMapping & { evidenceItems: EvidenceItem[] }>) {
    const missingControls = mappings
      .filter(m => m.status === 'missing')
      .map(m => ({
        id: m.controlId,
        title: m.controlTitle,
        description: m.controlDescription,
        importance: 'high' as const // Could be enhanced with priority logic
      }));

    const lowConfidenceControls = mappings
      .filter(m => m.confidenceScore < 70 && m.status !== 'missing')
      .map(m => ({
        id: m.controlId,
        title: m.controlTitle,
        confidence: m.confidenceScore,
        reasoning: m.reasoning
      }));

    const recommendations = [];
    
    if (missingControls.length > 0) {
      recommendations.push(`${missingControls.length} controls have no supporting evidence. Review and provide documentation for these controls.`);
    }
    
    if (lowConfidenceControls.length > 0) {
      recommendations.push(`${lowConfidenceControls.length} controls have low confidence scores. Additional evidence may be needed.`);
    }

    const partialControls = mappings.filter(m => m.status === 'partial').length;
    if (partialControls > 0) {
      recommendations.push(`${partialControls} controls are partially compliant. Review gaps and provide additional documentation.`);
    }

    return {
      missingControls,
      lowConfidenceControls,
      recommendations
    };
  }

  async getAnalysesList(organizationId: number): Promise<Analysis[]> {
    try {
      const result = await sql`
        SELECT * FROM analyses 
        WHERE organization_id = ${organizationId}
        ORDER BY created_at DESC
      `;
      
      // Transform snake_case database fields to camelCase for frontend
      return result.map(row => ({
        id: row.id,
        organizationId: row.organization_id,
        frameworkId: row.framework_id,
        frameworkName: row.framework_name || '',
        status: row.status,
        startedAt: row.started_at,
        completedAt: row.completed_at,
        totalControls: row.total_controls || 0,
        compliantControls: row.compliant_controls || 0,
        partialControls: row.partial_controls || 0,
        missingControls: row.missing_controls || 0,
        averageConfidence: row.average_confidence || 0,
        processingTime: row.processing_time,
        createdAt: row.created_at
      })) as Analysis[];
    } catch (error) {
      console.error('Failed to get analyses list:', error);
      return [];
    }
  }

  async deleteAnalysis(analysisId: number): Promise<{ success: boolean; error?: string }> {
    try {
      const result = await sql`
        DELETE FROM analyses WHERE id = ${analysisId}
        RETURNING id
      `;

      if (result.length === 0) {
        return { success: false, error: 'Analysis not found' };
      }

      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to delete analysis' 
      };
    }
  }
}