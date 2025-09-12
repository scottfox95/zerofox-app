// Document processing utilities
import { sql } from './db';
import { DocumentIntelligenceService, DocumentClassification } from './document-intelligence';

export interface DocumentUpload {
  id?: number;
  filename: string;
  originalName: string;
  fileType: string;
  fileSize: number;
  markdownPath?: string;
  markdownContent?: string;
  processedAt?: Date;
  createdAt?: Date;
}

export interface TextChunk {
  id?: number;
  documentId: number;
  chunkText: string;
  chunkIndex: number;
  pageNumber?: number;
  createdAt?: Date;
}

export interface ProcessedDocument {
  document: DocumentUpload;
  chunks: TextChunk[];
  totalChunks: number;
  totalCharacters: number;
  processingTime: number;
  conversionTime?: number;
  originalFormat?: string;
  markdownPreview?: string;
  classification?: DocumentClassification;
  semanticChunks?: number;
}

// Supported file types - now expanded with universal markdown conversion
export const SUPPORTED_FILE_TYPES = {
  'application/pdf': 'PDF',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'XLSX',
  'text/plain': 'TXT',
  'text/markdown': 'MD',
  'text/x-markdown': 'MD',
  'text/html': 'HTML',
  'application/json': 'JSON'
} as const;

export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
export const CHUNK_SIZE = 1000; // Characters per chunk
export const CHUNK_OVERLAP = 200; // Character overlap between chunks

export class DocumentProcessor {
  private intelligenceService: DocumentIntelligenceService;
  
  constructor() {
    this.intelligenceService = new DocumentIntelligenceService();
  }
  
  private async ensureDefaultOrganization(): Promise<void> {
    try {
      // Check if default organization exists
      const existingOrg = await sql`
        SELECT id FROM organizations WHERE id = 1
      `;

      if (existingOrg.length === 0) {
        // Create default organization
        await sql`
          INSERT INTO organizations (id, name) 
          VALUES (1, 'Default Organization')
        `;
      }
    } catch (error) {
      console.error('Error ensuring default organization:', error);
      // Don't throw - let the upload continue and potentially fail with a clearer error
    }
  }
  
  async uploadDocument(
    file: File, 
    organizationId: number = 1 // Default to org 1 for now
  ): Promise<{ success: boolean; document?: DocumentUpload; error?: string }> {
    try {
      // Ensure default organization exists
      await this.ensureDefaultOrganization();

      // Validate file type - check both MIME type and file extension
      const isValidMimeType = Object.keys(SUPPORTED_FILE_TYPES).includes(file.type);
      const fileExtension = this.getFileExtension(file.name).toLowerCase();
      const isValidExtension = ['pdf', 'docx', 'xlsx', 'txt', 'md', 'json', 'html'].includes(fileExtension);
      
      if (!isValidMimeType && !isValidExtension) {
        return { 
          success: false, 
          error: `Unsupported file type: ${file.type || 'unknown'} (${fileExtension}). Supported types: ${Object.values(SUPPORTED_FILE_TYPES).join(', ')}` 
        };
      }

      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        return { 
          success: false, 
          error: `File too large: ${(file.size / 1024 / 1024).toFixed(1)}MB. Max size: ${MAX_FILE_SIZE / 1024 / 1024}MB` 
        };
      }

      // Generate unique filename
      const timestamp = Date.now();
      const extension = this.getFileExtension(file.name);
      const filename = `doc_${timestamp}_${Math.random().toString(36).substr(2, 9)}.${extension}`;
      
      // Convert file to buffer for database storage
      const buffer = Buffer.from(await file.arrayBuffer());

      // Save document record to database with file content
      const documentResult = await sql`
        INSERT INTO documents (organization_id, filename, original_name, file_type, file_size, file_content)
        VALUES (${organizationId}, ${filename}, ${file.name}, ${file.type}, ${file.size}, ${buffer})
        RETURNING id, organization_id, filename, original_name, file_type, file_size, created_at
      `;

      const document = documentResult[0] as DocumentUpload;

      return { success: true, document };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to upload document' 
      };
    }
  }

  async processDocument(
    documentId: number, 
    file?: File // Make file optional since we'll get it from database
  ): Promise<{ success: boolean; result?: ProcessedDocument; error?: string }> {
    try {
      const startTime = Date.now();

      // Get document details including file content
      const documentResult = await sql`
        SELECT * FROM documents WHERE id = ${documentId}
      `;

      if (documentResult.length === 0) {
        return { success: false, error: 'Document not found' };
      }

      const document = documentResult[0] as DocumentUpload & { file_content?: Buffer };

      if (!document.file_content) {
        return { success: false, error: 'Document file content not found' };
      }

      // Create a File object from the stored buffer
      const fileFromDb = new File([document.file_content], document.originalName || document.filename, {
        type: document.fileType
      });

      // Extract text based on file type
      const extractedText = await this.extractText(fileFromDb, document.fileType, document.originalName);
      if (!extractedText.success) {
        return { success: false, error: extractedText.error };
      }

      // Store markdown content directly in database (SaaS-ready)
      await sql`
        UPDATE documents 
        SET markdown_content = ${extractedText.text!}
        WHERE id = ${documentId}
      `;

      // Classify the document
      const classification = await this.intelligenceService.classifyDocument(fileFromDb, extractedText.text!);
      
      // Save classification to database
      await sql`
        INSERT INTO document_classifications (document_id, classification_type, confidence_score, reasoning)
        VALUES (${documentId}, ${classification.type}, ${classification.confidence}, ${classification.reasoning})
        ON CONFLICT (document_id) DO UPDATE SET
          classification_type = EXCLUDED.classification_type,
          confidence_score = EXCLUDED.confidence_score,
          reasoning = EXCLUDED.reasoning
      `;

      // Try to create semantic chunks (don't fail if this doesn't work)
      let semanticChunks: any[] = [];
      try {
        semanticChunks = await this.intelligenceService.createSemanticChunks(
          documentId,
          extractedText.text!,
          classification
        );
      } catch (semanticError) {
        console.warn('Semantic chunking failed, continuing with basic chunks:', semanticError);
        semanticChunks = [];
      }
      
      // Also create basic text chunks for backward compatibility (if needed)
      const basicChunks = this.createTextChunks(extractedText.text!);
      const savedChunks: TextChunk[] = [];
      
      for (let i = 0; i < basicChunks.length; i++) {
        const chunkResult = await sql`
          INSERT INTO text_chunks (document_id, chunk_text, chunk_index, page_number)
          VALUES (${documentId}, ${basicChunks[i].text}, ${i}, ${basicChunks[i].pageNumber || null})
          RETURNING *
        `;
        savedChunks.push(chunkResult[0] as TextChunk);
      }

      // Update document as processed
      await sql`
        UPDATE documents 
        SET processed_at = CURRENT_TIMESTAMP 
        WHERE id = ${documentId}
      `;

      const processingTime = Date.now() - startTime;

      const result: ProcessedDocument = {
        document: { ...document, processedAt: new Date() },
        chunks: savedChunks,
        totalChunks: savedChunks.length,
        totalCharacters: extractedText.text!.length,
        processingTime,
        conversionTime: extractedText.conversionTime,
        originalFormat: extractedText.originalFormat,
        markdownPreview: extractedText.text!.substring(0, 500) + (extractedText.text!.length > 500 ? '...' : ''),
        classification,
        semanticChunks: semanticChunks.length
      };

      return { success: true, result };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to process document' 
      };
    }
  }

  private async extractText(
    file: File, 
    fileType: string,
    filename?: string
  ): Promise<{ success: boolean; text?: string; error?: string; conversionTime?: number; originalFormat?: string }> {
    try {
      // Normalize file type - prioritize file extension over MIME type for accuracy
      const extension = this.getFileExtension(filename || file.name || '').toLowerCase();
      let actualFileType = fileType;
      
      // Override incorrect MIME types based on file extension
      switch (extension) {
        case 'pdf': 
          actualFileType = 'application/pdf'; 
          break;
        case 'docx': 
          actualFileType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'; 
          break;
        case 'xlsx': 
          actualFileType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'; 
          break;
        case 'html': 
        case 'htm':
          actualFileType = 'text/html'; 
          break;
        case 'json': 
          actualFileType = 'application/json'; 
          break;
        case 'md': 
        case 'markdown':
          actualFileType = 'text/markdown'; 
          break;
        case 'txt': 
          // Only use text/plain if no other extension matches
          if (!fileType || fileType === 'undefined' || fileType === 'text/plain') {
            actualFileType = 'text/plain';
          }
          break;
        default: 
          // Keep original if no extension match and fileType is valid
          if (!fileType || fileType === 'undefined') {
            actualFileType = 'text/plain'; // Default fallback
          }
          break;
      }

      console.log(`🔄 Converting ${actualFileType} to markdown using universal converter...`);
      
      // Lazy import the converter to avoid blocking other API routes
      const { documentConverter } = await import('./document-converter');
      const conversionResult = await documentConverter.convertToMarkdown(file, actualFileType);
      
      if (conversionResult.success && conversionResult.markdown) {
        return { 
          success: true, 
          text: conversionResult.markdown,
          conversionTime: conversionResult.processingTime,
          originalFormat: actualFileType
        };
      } else {
        return { 
          success: false, 
          error: conversionResult.error || 'Document conversion failed',
          conversionTime: conversionResult.processingTime,
          originalFormat: actualFileType
        };
      }
      
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Text extraction failed' 
      };
    }
  }

  private jsonToReadableText(jsonData: any, depth: number = 0): string {
    const indent = '  '.repeat(depth);
    let text = '';

    if (Array.isArray(jsonData)) {
      jsonData.forEach((item, index) => {
        if (typeof item === 'object' && item !== null) {
          text += `${indent}Item ${index + 1}:\n`;
          text += this.jsonToReadableText(item, depth + 1);
        } else {
          text += `${indent}${index + 1}. ${item}\n`;
        }
      });
    } else if (typeof jsonData === 'object' && jsonData !== null) {
      Object.entries(jsonData).forEach(([key, value]) => {
        if (typeof value === 'object' && value !== null) {
          text += `${indent}${key}:\n`;
          text += this.jsonToReadableText(value, depth + 1);
        } else {
          text += `${indent}${key}: ${value}\n`;
        }
      });
    } else {
      text += `${indent}${jsonData}\n`;
    }

    return text;
  }

  private createTextChunks(text: string): Array<{ text: string; pageNumber?: number }> {
    const chunks: Array<{ text: string; pageNumber?: number }> = [];
    
    // Simple chunking strategy - split by sentences and group
    const sentences = text.match(/[^\.!?]+[\.!?]+/g) || [text];
    let currentChunk = '';
    let totalProcessedLength = 0;

    for (const sentence of sentences) {
      const trimmedSentence = sentence.trim();
      
      // Check if adding this sentence would exceed chunk size
      if (currentChunk.length + trimmedSentence.length > CHUNK_SIZE && currentChunk.length > 0) {
        // Calculate page number based on total document position (assuming ~2000 chars per page)
        const estimatedPage = Math.floor(totalProcessedLength / 2000) + 1;
        
        // Save current chunk
        chunks.push({ 
          text: currentChunk.trim(), 
          pageNumber: estimatedPage 
        });
        
        totalProcessedLength += currentChunk.length;

        // Start new chunk with overlap
        const words = currentChunk.split(' ');
        const overlapWords = words.slice(-Math.floor(CHUNK_OVERLAP / 10)); // Approximate word overlap
        currentChunk = overlapWords.join(' ') + ' ' + trimmedSentence;
      } else {
        currentChunk += (currentChunk ? ' ' : '') + trimmedSentence;
      }
    }

    // Add final chunk
    if (currentChunk.trim()) {
      const finalPage = Math.floor(totalProcessedLength / 2000) + 1;
      chunks.push({ 
        text: currentChunk.trim(), 
        pageNumber: finalPage 
      });
    }

    return chunks;
  }

  private getFileExtension(filename: string): string {
    return filename.split('.').pop()?.toLowerCase() || 'txt';
  }

  private getFileTypeLabel(mimeType: string): string {
    const typeMap: { [key: string]: string } = {
      'text/plain': 'TXT',
      'text/markdown': 'MD',
      'text/x-markdown': 'MD',
      'application/json': 'JSON',
      'application/pdf': 'PDF',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'XLSX'
    };
    return typeMap[mimeType] || mimeType;
  }

  async getDocuments(organizationId: number = 1): Promise<DocumentUpload[]> {
    try {
      const result = await sql`
        SELECT d.*, COUNT(tc.id) as chunk_count
        FROM documents d
        LEFT JOIN text_chunks tc ON d.id = tc.document_id
        WHERE d.organization_id = ${organizationId}
        GROUP BY d.id
        ORDER BY d.created_at DESC
      `;
      
      return result as DocumentUpload[];
    } catch (error) {
      console.error('Error fetching documents:', error);
      return [];
    }
  }

  async getDocumentWithChunks(documentId: number): Promise<{ document: DocumentUpload; chunks: TextChunk[] } | null> {
    try {
      const documentResult = await sql`
        SELECT * FROM documents WHERE id = ${documentId}
      `;

      if (documentResult.length === 0) {
        return null;
      }

      const chunksResult = await sql`
        SELECT * FROM text_chunks 
        WHERE document_id = ${documentId}
        ORDER BY chunk_index
      `;

      return {
        document: documentResult[0] as DocumentUpload,
        chunks: chunksResult as TextChunk[]
      };
    } catch (error) {
      console.error('Error fetching document with chunks:', error);
      return null;
    }
  }

  async deleteDocument(documentId: number): Promise<{ success: boolean; error?: string }> {
    try {
      // Delete text chunks first (cascade should handle this, but being explicit)
      await sql`DELETE FROM text_chunks WHERE document_id = ${documentId}`;
      
      // Delete document
      const result = await sql`
        DELETE FROM documents WHERE id = ${documentId}
        RETURNING id
      `;

      if (result.length === 0) {
        return { success: false, error: 'Document not found' };
      }

      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to delete document' 
      };
    }
  }
}