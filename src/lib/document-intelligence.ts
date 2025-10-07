import { sql } from './db';
import { AIService } from './ai';

export interface DocumentClassification {
  type: 'policy' | 'procedure' | 'audit_report' | 'technical_doc' | 'governance' | 'other';
  confidence: number;
  reasoning: string;
}

export interface SemanticChunk {
  id?: number;
  documentId: number;
  chunkText: string;
  chunkIndex: number;
  pageNumber?: number;
  topic: string;
  category: string;
  semanticSummary: string;
  relevanceScore: number;
  createdAt?: Date;
}

export interface OrganizedDocument {
  id?: number;
  organizationId: number;
  masterMarkdown: string;
  documentCount: number;
  categories: string[];
  totalChunks: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface AttributionMap {
  id?: number;
  organizedDocumentId: number;
  originalText: string;
  documentId: number;
  documentName: string;
  pageNumber?: number;
  chunkIndex: number;
  lineStart: number;
  lineEnd: number;
  createdAt?: Date;
}

export class DocumentIntelligenceService {
  private aiService: AIService;
  
  // Common compliance categories
  private readonly COMPLIANCE_CATEGORIES = [
    'access_controls',
    'data_protection',
    'incident_response',
    'risk_management', 
    'governance',
    'audit_logging',
    'training_awareness',
    'physical_security',
    'vendor_management',
    'business_continuity'
  ];

  constructor() {
    this.aiService = new AIService();
  }

  async classifyDocument(
    file: File, 
    extractedText: string
  ): Promise<DocumentClassification> {
    try {
      const classificationPrompt = this.createClassificationPrompt(file.name, extractedText);
      const aiResponse = await this.aiService.generateResponse(classificationPrompt, 'claude');
      
      return this.parseClassificationResponse(aiResponse);
    } catch (error) {
      console.error('Document classification failed:', error);
      return {
        type: 'other',
        confidence: 0,
        reasoning: 'Classification failed'
      };
    }
  }

  async createSemanticChunks(
    documentId: number,
    extractedText: string,
    classification: DocumentClassification
  ): Promise<SemanticChunk[]> {
    try {
      const semanticPrompt = this.createSemanticChunkingPrompt(extractedText, classification);
      const aiResponse = await this.aiService.generateResponse(semanticPrompt, 'claude');
      
      const parsedChunks = this.parseSemanticChunksResponse(aiResponse);
      
      // Save to database and return with IDs
      const savedChunks: SemanticChunk[] = [];
      
      for (let i = 0; i < parsedChunks.length; i++) {
        const chunk = parsedChunks[i];
        const result = await sql`
          INSERT INTO semantic_chunks (
            document_id, 
            chunk_text, 
            chunk_index, 
            page_number,
            topic,
            category,
            semantic_summary,
            relevance_score
          )
          VALUES (
            ${documentId},
            ${chunk.chunkText},
            ${i},
            ${chunk.pageNumber || null},
            ${chunk.topic},
            ${chunk.category},
            ${chunk.semanticSummary},
            ${chunk.relevanceScore}
          )
          RETURNING *
        `;
        
        savedChunks.push(result[0] as SemanticChunk);
      }
      
      return savedChunks;
    } catch (error) {
      console.error('Semantic chunking failed:', error);
      return [];
    }
  }

  async createOrganizedMasterDocument(
    organizationId: number,
    documentIds: number[]
  ): Promise<{ success: boolean; organizedDocument?: OrganizedDocument; error?: string }> {
    try {
      // Get all semantic chunks for the documents
      console.log(`🔍 Fetching semantic chunks for ${documentIds.length} documents:`, documentIds);
      
      let chunks: any[];
      if (documentIds.length === 0) {
        chunks = [];
      } else if (documentIds.length === 1) {
        // Single document - use simple equality
        chunks = await sql`
          SELECT sc.*, d.original_name, d.file_type
          FROM semantic_chunks sc
          JOIN documents d ON sc.document_id = d.id
          WHERE d.organization_id = ${organizationId}
          AND d.id = ${documentIds[0]}
          ORDER BY sc.category, sc.topic, sc.relevance_score DESC
        `;
      } else {
        // Multiple documents - fetch individually and combine
        const chunkArrays = await Promise.all(
          documentIds.map(docId => sql`
            SELECT sc.*, d.original_name, d.file_type
            FROM semantic_chunks sc
            JOIN documents d ON sc.document_id = d.id
            WHERE d.organization_id = ${organizationId}
            AND d.id = ${docId}
            ORDER BY sc.category, sc.topic, sc.relevance_score DESC
          `)
        );
        chunks = chunkArrays.flat();
      }
      console.log(`🔍 Found ${chunks.length} semantic chunks`);

      if (chunks.length === 0) {
        console.log('⚠️ No semantic chunks found, attempting to create them for selected documents...');
        
        // Get document names for better error message
        let docInfo;
        if (documentIds.length === 1) {
          docInfo = await sql`SELECT id, original_name FROM documents WHERE id = ${documentIds[0]}`;
        } else {
          const docInfoArrays = await Promise.all(
            documentIds.map(docId => sql`SELECT id, original_name FROM documents WHERE id = ${docId}`)
          );
          docInfo = docInfoArrays.flat();
        }
        const docNames = docInfo.map(d => `${d.original_name} (ID: ${d.id})`).join(', ');
        
        return { 
          success: false, 
          error: `Selected documents do not have semantic chunks required for analysis: ${docNames}. Please try analyzing all documents (leave selection empty) or select documents that have been fully processed with semantic analysis.` 
        };
      }

      // Group chunks by category
      const categorizedChunks = this.groupChunksByCategory(chunks);
      
      // Generate master markdown document
      const masterMarkdown = this.generateMasterMarkdown(categorizedChunks);
      
      // Create attribution map
      const attributionMap = this.createAttributionMap(masterMarkdown, chunks);
      
      // Save organized document
      const organizedDocResult = await sql`
        INSERT INTO organized_documents (
          organization_id,
          master_markdown,
          document_count,
          categories,
          total_chunks
        )
        VALUES (
          ${organizationId},
          ${masterMarkdown},
          ${documentIds.length},
          ${JSON.stringify(Object.keys(categorizedChunks))},
          ${chunks.length}
        )
        RETURNING *
      `;

      const organizedDocument = organizedDocResult[0] as OrganizedDocument;

      // Save attribution mappings
      for (const attribution of attributionMap) {
        await sql`
          INSERT INTO attribution_mappings (
            organized_document_id,
            original_text,
            document_id,
            document_name,
            page_number,
            chunk_index,
            line_start,
            line_end
          )
          VALUES (
            ${organizedDocument.id},
            ${attribution.originalText},
            ${attribution.documentId},
            ${attribution.documentName},
            ${attribution.pageNumber},
            ${attribution.chunkIndex},
            ${attribution.lineStart},
            ${attribution.lineEnd}
          )
        `;
      }

      return { success: true, organizedDocument };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create organized document'
      };
    }
  }

  private createClassificationPrompt(filename: string, text: string): string {
    const textPreview = text.substring(0, 2000);
    
    return `Analyze this document and classify its type. 

DOCUMENT: ${filename}
CONTENT PREVIEW:
${textPreview}

Classify into one of these types:
- policy: Security policies, compliance policies, governance documents
- procedure: Step-by-step procedures, SOPs, implementation guides  
- audit_report: Audit findings, assessment reports, compliance reviews
- technical_doc: Technical specifications, architecture docs, system documentation
- governance: Organizational charts, roles/responsibilities, governance frameworks
- other: Anything that doesn't fit the above categories

Respond with ONLY valid JSON:
{
  "type": "policy|procedure|audit_report|technical_doc|governance|other",
  "confidence": 85,
  "reasoning": "Brief explanation of classification decision"
}`;
  }

  private createSemanticChunkingPrompt(text: string, classification: DocumentClassification): string {
    return `Break this ${classification.type} document into semantic chunks organized by topics and compliance categories.

DOCUMENT TEXT:
${text}

Your task:
1. Identify distinct topics/sections within the document
2. Categorize each chunk into compliance areas: ${this.COMPLIANCE_CATEGORIES.join(', ')}
3. Create topic-based chunks that keep related concepts together
4. Each chunk should be 800-1500 characters
5. Assign relevance scores based on compliance value

Respond with ONLY valid JSON:
{
  "chunks": [
    {
      "chunkText": "Complete section text...",
      "pageNumber": 1,
      "topic": "Password Requirements", 
      "category": "access_controls",
      "semanticSummary": "Brief summary of what this chunk covers",
      "relevanceScore": 95
    }
  ]
}

Guidelines:
- Keep related sentences/paragraphs together
- Don't split mid-sentence or mid-concept
- Higher relevance scores for policy statements, requirements, controls
- Lower scores for boilerplate, examples, background info
- Use meaningful topic names that describe the content`;
  }

  private parseClassificationResponse(response: string): DocumentClassification {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON found');
      
      const parsed = JSON.parse(jsonMatch[0]);
      
      return {
        type: parsed.type || 'other',
        confidence: Math.min(100, Math.max(0, parsed.confidence || 0)),
        reasoning: parsed.reasoning || 'No reasoning provided'
      };
    } catch (error) {
      return {
        type: 'other',
        confidence: 0,
        reasoning: 'Failed to parse classification response'
      };
    }
  }

  private parseSemanticChunksResponse(response: string): Omit<SemanticChunk, 'id' | 'documentId' | 'chunkIndex' | 'createdAt'>[] {
    try {
      // Try multiple JSON extraction strategies
      let jsonStr = '';
      
      // Strategy 1: Find JSON between ```json and ```
      const codeBlockMatch = response.match(/```json\s*([\s\S]*?)\s*```/i);
      if (codeBlockMatch) {
        jsonStr = codeBlockMatch[1].trim();
      } else {
        // Strategy 2: Find first complete JSON object
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          jsonStr = jsonMatch[0];
        }
      }
      
      if (!jsonStr) throw new Error('No JSON found in response');
      
      // Clean up common JSON issues
      jsonStr = jsonStr
        .replace(/,\s*}/g, '}')  // Remove trailing commas
        .replace(/,\s*]/g, ']')  // Remove trailing commas in arrays
        .replace(/\n/g, ' ')     // Replace newlines with spaces
        .trim();
      
      console.log('Parsing JSON:', jsonStr.substring(0, 200) + '...');
      
      // Try to repair common JSON truncation issues
      if (jsonStr.endsWith(',')) {
        jsonStr = jsonStr.slice(0, -1);
      }
      
      // If JSON appears to be truncated (missing closing brackets), try to fix
      let openBraces = (jsonStr.match(/\{/g) || []).length;
      let closeBraces = (jsonStr.match(/\}/g) || []).length;
      let openBrackets = (jsonStr.match(/\[/g) || []).length;
      let closeBrackets = (jsonStr.match(/\]/g) || []).length;
      
      // Add missing closing brackets/braces
      while (openBrackets > closeBrackets) {
        jsonStr += ']';
        closeBrackets++;
      }
      while (openBraces > closeBraces) {
        jsonStr += '}';
        closeBraces++;
      }
      
      const parsed = JSON.parse(jsonStr);
      
      if (!parsed.chunks || !Array.isArray(parsed.chunks)) {
        console.error('Invalid JSON structure - missing chunks array');
        return [];
      }
      
      return parsed.chunks.map((chunk: any) => ({
        chunkText: chunk.chunkText || '',
        pageNumber: chunk.pageNumber,
        topic: chunk.topic || 'Unknown',
        category: chunk.category || 'other',
        semanticSummary: chunk.semanticSummary || '',
        relevanceScore: Math.min(100, Math.max(0, chunk.relevanceScore || 50))
      }));
    } catch (error) {
      console.error('Failed to parse semantic chunks response:', error);
      console.error('Response was:', response.substring(0, 500) + '...');
      return [];
    }
  }

  private groupChunksByCategory(chunks: any[]): { [category: string]: any[] } {
    const grouped: { [category: string]: any[] } = {};
    
    for (const chunk of chunks) {
      const category = chunk.category || 'other';
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(chunk);
    }
    
    return grouped;
  }

  private generateMasterMarkdown(categorizedChunks: { [category: string]: any[] }): string {
    let markdown = '# Compliance Documentation Master Document\n\n';
    markdown += '*This document consolidates compliance-related content from multiple source documents with full attribution.*\n\n';
    
    // Generate table of contents
    markdown += '## Table of Contents\n\n';
    for (const category of Object.keys(categorizedChunks)) {
      const displayName = category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      markdown += `- [${displayName}](#${category.toLowerCase()})\n`;
    }
    markdown += '\n---\n\n';
    
    // Generate content by category
    for (const [category, chunks] of Object.entries(categorizedChunks)) {
      const displayName = category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      
      markdown += `## ${displayName} {#${category.toLowerCase()}}\n\n`;
      
      // Group by topic within category
      const topicGroups: { [topic: string]: any[] } = {};
      for (const chunk of chunks) {
        const topic = chunk.topic || 'General';
        if (!topicGroups[topic]) {
          topicGroups[topic] = [];
        }
        topicGroups[topic].push(chunk);
      }
      
      // Generate content by topic
      for (const [topic, topicChunks] of Object.entries(topicGroups)) {
        if (Object.keys(topicGroups).length > 1) {
          markdown += `### ${topic}\n\n`;
        }
        
        for (const chunk of topicChunks.sort((a, b) => b.relevance_score - a.relevance_score)) {
          markdown += `${chunk.chunk_text}\n\n`;
          markdown += `*Source: ${chunk.original_name}${chunk.page_number ? `, Page ${chunk.page_number}` : ''}*\n\n`;
          markdown += '---\n\n';
        }
      }
    }
    
    return markdown;
  }

  private createAttributionMap(masterMarkdown: string, chunks: any[]): Omit<AttributionMap, 'id' | 'organizedDocumentId' | 'createdAt'>[] {
    const attributions: Omit<AttributionMap, 'id' | 'organizedDocumentId' | 'createdAt'>[] = [];
    const lines = masterMarkdown.split('\n');
    
    let currentLine = 0;
    
    for (const chunk of chunks) {
      // Find where this chunk's text appears in the master document
      const chunkText = chunk.chunk_text;
      const chunkLines = chunkText.split('\n');
      
      for (let i = currentLine; i < lines.length; i++) {
        if (lines[i].includes(chunkText.substring(0, 50))) {
          // Found the start of this chunk
          attributions.push({
            originalText: chunkText,
            documentId: chunk.document_id,
            documentName: chunk.original_name,
            pageNumber: chunk.page_number,
            chunkIndex: chunk.chunk_index,
            lineStart: i + 1,
            lineEnd: i + chunkLines.length
          });
          currentLine = i + chunkLines.length + 2; // Skip source attribution lines
          break;
        }
      }
    }
    
    return attributions;
  }

  async getOrganizedDocument(organizationId: number): Promise<OrganizedDocument | null> {
    try {
      const result = await sql`
        SELECT * FROM organized_documents 
        WHERE organization_id = ${organizationId}
        ORDER BY created_at DESC
        LIMIT 1
      `;
      
      return result.length > 0 ? result[0] as OrganizedDocument : null;
    } catch (error) {
      console.error('Failed to get organized document:', error);
      return null;
    }
  }

  async getAttributionMappings(organizedDocumentId: number): Promise<AttributionMap[]> {
    try {
      const result = await sql`
        SELECT * FROM attribution_mappings 
        WHERE organized_document_id = ${organizedDocumentId}
        ORDER BY line_start
      `;
      
      return result as AttributionMap[];
    } catch (error) {
      console.error('Failed to get attribution mappings:', error);
      return [];
    }
  }
}