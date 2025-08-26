// Universal Document to Markdown Converter
// Converts all document types to LLM-friendly markdown format

// All imports are lazy to avoid blocking API route compilation

interface ConversionResult {
  success: boolean;
  markdown?: string;
  metadata?: DocumentMetadata;
  error?: string;
  processingTime?: number;
}

interface DocumentMetadata {
  pageCount?: number;
  wordCount?: number;
  hasImages?: boolean;
  hasTables?: boolean;
  title?: string;
  author?: string;
  createdDate?: string;
}

export class DocumentConverter {
  
  /**
   * Convert any supported document format to markdown
   */
  async convertToMarkdown(
    file: File, 
    fileType: string
  ): Promise<ConversionResult> {
    const startTime = Date.now();
    console.log(`🔄 Starting conversion: ${file.name} (${fileType})`);
    
    try {
      let result: ConversionResult;
      
      switch (fileType.toLowerCase()) {
        case 'application/pdf':
          result = await this.convertPdfToMarkdown(file);
          break;
          
        case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
          result = await this.convertDocxToMarkdown(file);
          break;
          
        case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
          result = await this.convertXlsxToMarkdown(file);
          break;
          
        case 'text/html':
          result = await this.convertHtmlToMarkdown(file);
          break;
          
        case 'text/plain':
        case 'text/markdown':
        case 'text/x-markdown':
          result = await this.convertTextToMarkdown(file);
          break;
          
        case 'application/json':
          result = await this.convertJsonToMarkdown(file);
          break;
          
        default:
          return {
            success: false,
            error: `Unsupported file type: ${fileType}`
          };
      }
      
      const processingTime = Date.now() - startTime;
      console.log(`✅ Conversion completed in ${processingTime}ms`);
      
      return {
        ...result,
        processingTime
      };
      
    } catch (error) {
      console.error('🚨 Conversion failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Conversion failed',
        processingTime: Date.now() - startTime
      };
    }
  }
  
  /**
   * Convert PDF to markdown using multiple fallback strategies
   */
  private async convertPdfToMarkdown(file: File): Promise<ConversionResult> {
    console.log('📄 Converting PDF to markdown...');
    
    try {
      // Strategy 1: Use pdf-parse-fork (more reliable than original pdf-parse)
      const { default: pdf } = await import('pdf-parse-fork');
      const buffer = Buffer.from(await file.arrayBuffer());
      
      const data = await pdf(buffer, {
        max: 0, // Parse all pages
        version: 'v1.10.100'
      });
      
      if (data.text && data.text.trim().length > 0) {
        // Sanitize null bytes and other invalid UTF-8 characters
        const sanitizedText = data.text.replace(/\x00/g, '').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
        const markdown = this.formatTextAsMarkdown(sanitizedText, {
          pageCount: data.numpages,
          wordCount: sanitizedText.split(/\s+/).length
        });
        
        return {
          success: true,
          markdown,
          metadata: {
            pageCount: data.numpages,
            wordCount: sanitizedText.split(/\s+/).length
          }
        };
      }
      
      throw new Error('No text extracted from PDF');
      
    } catch (error) {
      console.log('📄 PDF-parse failed, trying binary extraction...');
      return this.extractPdfTextBinary(file);
    }
  }
  
  /**
   * Convert DOCX to markdown using mammoth
   */
  private async convertDocxToMarkdown(file: File): Promise<ConversionResult> {
    console.log('📝 Converting DOCX to markdown...');
    
    try {
      const { default: mammoth } = await import('mammoth');
      const buffer = Buffer.from(await file.arrayBuffer());
      
      // Convert to HTML first, then to markdown
      const result = await mammoth.convertToHtml({ buffer });
      const html = result.value;
      
      if (result.messages.length > 0) {
        console.log('📝 DOCX conversion warnings:', result.messages);
      }
      
      // Convert HTML to markdown
      const markdown = await this.htmlToMarkdown(html);
      
      return {
        success: true,
        markdown,
        metadata: {
          wordCount: markdown.split(/\s+/).length,
          hasTables: markdown.includes('|'),
          hasImages: markdown.includes('![')
        }
      };
      
    } catch (error) {
      return {
        success: false,
        error: `DOCX conversion failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
  
  /**
   * Convert XLSX to markdown table format
   */
  private async convertXlsxToMarkdown(file: File): Promise<ConversionResult> {
    console.log('📊 Converting XLSX to markdown...');
    
    try {
      const XLSX = await import('xlsx');
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      
      let markdown = '# Spreadsheet Data\n\n';
      let totalCells = 0;
      
      workbook.SheetNames.forEach((sheetName, index) => {
        const sheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        
        if (jsonData.length > 0) {
          markdown += `## Sheet: ${sheetName}\n\n`;
          
          // Convert to markdown table
          const rows = jsonData as any[][];
          if (rows.length > 0) {
            // Header row
            const headers = rows[0].map((cell: any) => String(cell || '').trim());
            markdown += '| ' + headers.join(' | ') + ' |\n';
            markdown += '| ' + headers.map(() => '---').join(' | ') + ' |\n';
            
            // Data rows
            for (let i = 1; i < Math.min(rows.length, 1000); i++) { // Limit rows for performance
              const row = rows[i];
              const cells = headers.map((_, j) => String(row[j] || '').trim());
              markdown += '| ' + cells.join(' | ') + ' |\n';
              totalCells += cells.length;
            }
            
            if (rows.length > 1000) {
              markdown += `\n*... ${rows.length - 1000} more rows truncated for display*\n`;
            }
          }
          
          markdown += '\n\n';
        }
      });
      
      return {
        success: true,
        markdown,
        metadata: {
          wordCount: markdown.split(/\s+/).length,
          hasTables: true,
          title: file.name.replace('.xlsx', '')
        }
      };
      
    } catch (error) {
      return {
        success: false,
        error: `XLSX conversion failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
  
  /**
   * Convert HTML to markdown
   */
  private async convertHtmlToMarkdown(file: File): Promise<ConversionResult> {
    console.log('🌐 Converting HTML to markdown...');
    
    try {
      const htmlContent = await file.text();
      const markdown = await this.htmlToMarkdown(htmlContent);
      
      return {
        success: true,
        markdown,
        metadata: {
          wordCount: markdown.split(/\s+/).length,
          hasTables: markdown.includes('|'),
          hasImages: markdown.includes('![')
        }
      };
      
    } catch (error) {
      return {
        success: false,
        error: `HTML conversion failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
  
  /**
   * Convert plain text/markdown to standardized markdown
   */
  private async convertTextToMarkdown(file: File): Promise<ConversionResult> {
    console.log('📄 Processing text file...');
    
    try {
      const content = await file.text();
      
      // Sanitize null bytes and control characters that cause UTF-8 errors
      const sanitizedContent = content.replace(/\x00/g, '').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
      
      // If it's already markdown, clean it up
      // If it's plain text, add basic formatting
      let markdown = sanitizedContent;
      
      // Basic text-to-markdown formatting
      if (!sanitizedContent.includes('#') && !sanitizedContent.includes('*')) {
        // Appears to be plain text, add some structure
        const lines = sanitizedContent.split('\n');
        const formattedLines: string[] = [];
        
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.length === 0) {
            formattedLines.push('');
          } else if (trimmed.length < 80 && !trimmed.includes('.') && trimmed === trimmed.toUpperCase()) {
            // Likely a heading
            formattedLines.push(`## ${trimmed}`);
          } else {
            formattedLines.push(trimmed);
          }
        }
        
        markdown = formattedLines.join('\n');
      }
      
      return {
        success: true,
        markdown,
        metadata: {
          wordCount: markdown.split(/\s+/).length
        }
      };
      
    } catch (error) {
      return {
        success: false,
        error: `Text conversion failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
  
  /**
   * Convert JSON to structured markdown
   */
  private async convertJsonToMarkdown(file: File): Promise<ConversionResult> {
    console.log('📋 Converting JSON to markdown...');
    
    try {
      const jsonContent = await file.text();
      const data = JSON.parse(jsonContent);
      
      const markdown = '# JSON Data\n\n' + this.jsonToMarkdown(data, 0);
      
      return {
        success: true,
        markdown,
        metadata: {
          wordCount: markdown.split(/\s+/).length
        }
      };
      
    } catch (error) {
      return {
        success: false,
        error: `JSON conversion failed: ${error instanceof Error ? error.message : 'Invalid JSON'}`
      };
    }
  }
  
  /**
   * Binary PDF text extraction fallback
   */
  private async extractPdfTextBinary(file: File): Promise<ConversionResult> {
    console.log('📄 Using binary PDF extraction...');
    
    try {
      const buffer = Buffer.from(await file.arrayBuffer());
      const pdfContent = buffer.toString('binary');
      
      let extractedText = '';
      
      // Look for text in PDF streams
      const textMatches = pdfContent.match(/\((.*?)\)/g);
      if (textMatches) {
        textMatches.forEach(match => {
          const text = match.replace(/[()]/g, '').trim();
          if (text.length > 2 && /[a-zA-Z]/.test(text)) {
            extractedText += text + ' ';
          }
        });
      }
      
      if (extractedText.length > 100) {
        // Sanitize null bytes and other invalid UTF-8 characters
        const sanitizedText = extractedText.replace(/\x00/g, '').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
        const markdown = this.formatTextAsMarkdown(sanitizedText);
        return {
          success: true,
          markdown,
          metadata: {
            wordCount: markdown.split(/\s+/).length
          }
        };
      }
      
      return {
        success: false,
        error: 'Could not extract readable text from PDF'
      };
      
    } catch (error) {
      return {
        success: false,
        error: `Binary PDF extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
  
  /**
   * Convert HTML to markdown using turndown
   */
  private async htmlToMarkdown(html: string): Promise<string> {
    const TurndownService = await import('turndown');
    const turndownService = new TurndownService.default({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced',
      emDelimiter: '*'
    });
    
    return turndownService.turndown(html);
  }
  
  /**
   * Format plain text as structured markdown
   */
  private formatTextAsMarkdown(text: string, metadata?: Partial<DocumentMetadata>): string {
    const lines = text.split('\n');
    const formattedLines: string[] = [];
    
    // Add document header
    if (metadata?.pageCount) {
      formattedLines.push(`# Document Content (${metadata.pageCount} pages)\n`);
    } else {
      formattedLines.push('# Document Content\n');
    }
    
    let currentParagraph = '';
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      if (trimmed.length === 0) {
        if (currentParagraph) {
          formattedLines.push(currentParagraph);
          formattedLines.push('');
          currentParagraph = '';
        }
      } else if (trimmed.length < 100 && trimmed === trimmed.toUpperCase() && /^[A-Z\s\d\.]+$/.test(trimmed)) {
        // Likely a heading
        if (currentParagraph) {
          formattedLines.push(currentParagraph);
          formattedLines.push('');
          currentParagraph = '';
        }
        formattedLines.push(`## ${trimmed}`);
        formattedLines.push('');
      } else {
        currentParagraph += (currentParagraph ? ' ' : '') + trimmed;
      }
    }
    
    if (currentParagraph) {
      formattedLines.push(currentParagraph);
    }
    
    return formattedLines.join('\n');
  }
  
  /**
   * Convert JSON to markdown format
   */
  private jsonToMarkdown(data: any, depth: number = 0): string {
    const indent = '  '.repeat(depth);
    let markdown = '';
    
    if (Array.isArray(data)) {
      data.forEach((item, index) => {
        markdown += `${indent}- **Item ${index + 1}:**\n`;
        if (typeof item === 'object' && item !== null) {
          markdown += this.jsonToMarkdown(item, depth + 1);
        } else {
          markdown += `${indent}  ${item}\n`;
        }
      });
    } else if (typeof data === 'object' && data !== null) {
      Object.entries(data).forEach(([key, value]) => {
        if (typeof value === 'object' && value !== null) {
          markdown += `${indent}**${key}:**\n`;
          markdown += this.jsonToMarkdown(value, depth + 1);
        } else {
          markdown += `${indent}**${key}:** ${value}\n`;
        }
      });
    } else {
      markdown += `${indent}${data}\n`;
    }
    
    return markdown;
  }
}

export const documentConverter = new DocumentConverter();