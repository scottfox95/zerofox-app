// Framework standardization utilities
import { aiService } from './ai';

export interface FrameworkControl {
  id: string;
  title: string;
  description: string;
  category?: string;
  requirements?: string[];
  references?: string[];
}

export interface StandardizedFramework {
  id: string;
  name: string;
  description: string;
  version: string;
  controls: FrameworkControl[];
  metadata: {
    source: string;
    standardizedAt: Date;
    aiModel: string;
    confidence: number;
  };
}

export interface RawFrameworkFile {
  filename: string;
  content: any;
  size: number;
  uploadedAt: Date;
}

// Framework standardization prompts
const STANDARDIZATION_PROMPT = `
You are a compliance framework standardization expert. Your task is to convert various compliance framework formats into a unified, standardized schema.

CRITICAL: Process ALL controls/requirements/items found in the input data. Do not truncate or limit the number of controls.

STANDARDIZED SCHEMA:
{
  "id": "unique_framework_id",
  "name": "Framework Name",
  "description": "Brief description of the framework",
  "version": "1.0",
  "controls": [
    {
      "id": "control_id",
      "title": "Control Title",
      "description": "Detailed description of what this control requires",
      "category": "Category (e.g., Access Control, Data Protection)",
      "requirements": ["List of specific requirements"],
      "references": ["Related standards or documents"]
    }
  ]
}

PROCESSING INSTRUCTIONS:
1. Carefully analyze the ENTIRE input data structure
2. Look for ALL controls, requirements, or items regardless of nesting level
3. Common field names to look for: controls, requirements, items, sections, clauses, standards, policies
4. Extract EVERY control found - do not limit or truncate
5. Create sequential control IDs (FRAMEWORK_001, FRAMEWORK_002, etc.)
6. Group controls into logical categories based on content
7. Preserve all original text and requirements
8. Generate meaningful descriptions from available data
9. Return complete JSON with ALL controls processed

OUTPUT REQUIREMENTS:
- Return ONLY valid JSON in the standardized schema
- DO NOT include any explanatory text, markdown formatting, or code blocks
- DO NOT add any text before or after the JSON
- Your response must start with { and end with }
- Process ALL controls - aim for completeness over brevity

INPUT FRAMEWORK DATA:
`;

export class FrameworkStandardizer {
  
  // Helper method to estimate if framework is too large for single processing
  private isLargeFramework(data: any): boolean {
    const jsonStr = JSON.stringify(data);
    return jsonStr.length > 50000; // ~50KB threshold
  }

  // Process large frameworks in chunks
  async standardizeLargeFramework(
    rawData: any,
    filename: string,
    selectedModel: string = 'claude-sonnet'
  ): Promise<{ success: boolean; framework?: StandardizedFramework; error?: string }> {
    try {
      // Extract framework metadata first
      const metadataResult = await this.extractFrameworkMetadata(rawData, filename, selectedModel);
      if (!metadataResult.success) {
        return metadataResult;
      }

      // Process controls in chunks
      const controls = this.extractControlsFromData(rawData);
      const frameworkPrefix = this.generateFrameworkPrefix(metadataResult.metadata.name, filename);
      const chunkSize = 10; // Process 10 controls at a time for better AI processing
      const allControls = [];

      console.log(`🏷️ Using framework prefix: ${frameworkPrefix}`);

      for (let i = 0; i < controls.length; i += chunkSize) {
        const chunk = controls.slice(i, i + chunkSize);
        console.log(`📦 Processing controls ${i + 1}-${Math.min(i + chunkSize, controls.length)} of ${controls.length}`);
        
        const chunkResult = await this.standardizeControlChunk(chunk, i, selectedModel, frameworkPrefix);
        if (chunkResult.success) {
          allControls.push(...chunkResult.controls);
        } else {
          console.warn(`⚠️ Failed to process chunk ${i}-${i + chunkSize}:`, (chunkResult as any).error);
        }
      }

      const framework: StandardizedFramework = {
        ...metadataResult.metadata,
        controls: allControls,
        metadata: {
          source: filename,
          standardizedAt: new Date(),
          aiModel: selectedModel,
          confidence: 0.9
        }
      };

      return { success: true, framework };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error in large framework processing'
      };
    }
  }

  async standardizeFramework(
    rawData: any, 
    filename: string, 
    selectedModel: string = 'claude-sonnet'
  ): Promise<{ success: boolean; framework?: StandardizedFramework; error?: string }> {
    try {
      // Log input data structure for debugging
      console.log('🔍 Framework input data structure:', {
        filename,
        dataKeys: Object.keys(rawData),
        dataType: typeof rawData,
        isArray: Array.isArray(rawData),
        firstLevelKeys: Array.isArray(rawData) ? 'Array items' : Object.keys(rawData).slice(0, 10)
      });

      // Check if framework is too large for single processing
      if (this.isLargeFramework(rawData)) {
        console.log('📊 Large framework detected, using chunked processing');
        return this.standardizeLargeFramework(rawData, filename, selectedModel);
      }

      // Generate framework prefix for single processing
      const frameworkName = rawData.name || filename.replace(/\.(json|txt|md)$/i, '');
      const frameworkPrefix = this.generateFrameworkPrefix(frameworkName, filename);
      console.log(`🏷️ Using framework prefix: ${frameworkPrefix}`);

      // Create dynamic prompt with framework-specific IDs
      const dynamicPrompt = STANDARDIZATION_PROMPT.replace(/FRAMEWORK_/g, `${frameworkPrefix}_`);
      const prompt = dynamicPrompt + JSON.stringify(rawData, null, 2);
      console.log('📝 Prompt length:', prompt.length, 'characters');
      
      // Adjust max tokens based on model limits
      const maxTokens = selectedModel === 'claude-sonnet' ? 8000 : 
                       selectedModel === 'gpt-4o' ? 15000 : 
                       8000; // Default safe limit
      
      const result = await aiService.generateCompletion(selectedModel, prompt, maxTokens);
      
      if (!result.success || !result.response) {
        return { success: false, error: result.error || 'No response from AI' };
      }

      console.log('🤖 AI Response length:', result.response.length, 'characters');
      console.log('🤖 AI Response preview:', result.response.substring(0, 300) + '...');

      // Parse the AI response
      let standardizedFramework;
      try {
        // Extract JSON from the response (in case AI adds explanatory text)
        let jsonStr = result.response;
        
        // Try multiple extraction methods for better compatibility
        // Method 1: Look for complete JSON object
        const jsonMatch = result.response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          jsonStr = jsonMatch[0];
        } else {
          // Method 2: Look between ```json blocks
          const codeBlockMatch = result.response.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
          if (codeBlockMatch) {
            jsonStr = codeBlockMatch[1];
          } else {
            // Method 3: Try to find JSON-like content
            const jsonLikeMatch = result.response.match(/(\{[\s\S]*"controls"[\s\S]*\})/);
            if (jsonLikeMatch) {
              jsonStr = jsonLikeMatch[1];
            }
          }
        }
        
        standardizedFramework = JSON.parse(jsonStr);
      } catch (parseError) {
        // Return more detailed error for debugging
        console.error('JSON Parse Error:', parseError);
        console.error('AI Response:', result.response.substring(0, 500));
        return { 
          success: false, 
          error: `Failed to parse AI response as JSON. Response preview: ${result.response.substring(0, 200)}...` 
        };
      }

      // Validate the standardized framework
      if (!this.validateFramework(standardizedFramework)) {
        return { success: false, error: 'AI response does not match expected schema' };
      }

      // Add metadata
      const framework: StandardizedFramework = {
        ...standardizedFramework,
        metadata: {
          source: filename,
          standardizedAt: new Date(),
          aiModel: selectedModel,
          confidence: 0.85 // TODO: Implement confidence scoring
        }
      };

      return { success: true, framework };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  private validateFramework(framework: any): boolean {
    if (!framework.id || !framework.name || !framework.controls) {
      return false;
    }

    if (!Array.isArray(framework.controls)) {
      return false;
    }

    // Validate each control has required fields
    for (const control of framework.controls) {
      if (!control.id || !control.title || !control.description) {
        return false;
      }
    }

    return true;
  }

  async suggestCategories(controls: FrameworkControl[]): Promise<string[]> {
    const existingCategories = [...new Set(controls.map(c => c.category).filter((cat): cat is string => Boolean(cat)))];
    
    // Common compliance categories
    const standardCategories = [
      'Access Control',
      'Data Protection', 
      'Security Governance',
      'Risk Management',
      'Incident Response',
      'Business Continuity',
      'Compliance Monitoring',
      'Asset Management',
      'Network Security',
      'Application Security',
      'Physical Security',
      'Human Resources Security'
    ];

    return [...new Set([...existingCategories, ...standardCategories])];
  }

  // Helper methods for chunked processing
  private generateFrameworkPrefix(frameworkName: string, filename: string): string {
    // Extract framework name for prefix
    let prefix = frameworkName || filename.replace(/\.(json|txt|md)$/i, '');
    
    // Clean and format prefix
    prefix = prefix
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')  // Remove non-alphanumeric
      .replace(/\s+/g, '')        // Remove spaces
      .substring(0, 12);          // Limit length
    
    // Common framework abbreviations
    const abbreviations: { [key: string]: string } = {
      'ISO27001': 'ISO27001',
      'ISO270012022': 'ISO27001',
      'CISV8': 'CISV8',
      'CISCRITICALCONTROLS': 'CISV8',
      'NIST80053': 'NIST80053',
      'NISTCYBERSECURITY': 'NISTCSF',
      'SOC2': 'SOC2',
      'HIPAA': 'HIPAA',
      'GDPR': 'GDPR',
      'PCIDSS': 'PCIDSS'
    };
    
    return abbreviations[prefix] || prefix || 'FRAMEWORK';
  }

  private extractControlsFromData(data: any): any[] {
    // Extract controls from various possible structures
    if (Array.isArray(data)) return data;
    if (data.controls) return Array.isArray(data.controls) ? data.controls : [data.controls];
    if (data.requirements) return Array.isArray(data.requirements) ? data.requirements : [data.requirements];
    if (data.items) return Array.isArray(data.items) ? data.items : [data.items];
    
    // If it's an object, try to find array fields
    const arrayFields = Object.values(data).filter(v => Array.isArray(v));
    return arrayFields.length > 0 ? arrayFields[0] : [data];
  }

  private async extractFrameworkMetadata(data: any, filename: string, model: string) {
    // Simple metadata extraction
    return {
      success: true,
      metadata: {
        id: filename.replace('.json', '').toLowerCase().replace(/[^a-z0-9]/g, '_'),
        name: data.name || filename.replace('.json', ''),
        description: data.description || `Framework imported from ${filename}`,
        version: data.version || '1.0'
      }
    };
  }

  private async standardizeControlChunk(controls: any[], startIndex: number, model: string, frameworkPrefix: string = 'FRAMEWORK') {
    // Enhanced chunk processing with AI to generate proper descriptions
    const chunkPrompt = `
Convert these compliance controls to standardized format with proper descriptions:

${JSON.stringify(controls, null, 2)}

For each control, create:
- id: ${frameworkPrefix}_${String(startIndex + 1).padStart(3, '0')} (increment for each)
- title: Clear, descriptive title
- description: Detailed description of what this control requires (NEVER leave empty)
- category: Logical category
- requirements: Array of specific requirements
- references: Array of references

Return JSON array ONLY:
[{"id": "${frameworkPrefix}_001", "title": "...", "description": "...", "category": "...", "requirements": [...], "references": [...]}]
`;

    try {
      const result = await aiService.generateCompletion(model, chunkPrompt, 4000);
      
      if (result.success && result.response) {
        try {
          // Extract JSON from response
          const jsonMatch = result.response.match(/\[[\s\S]*\]/);
          const jsonStr = jsonMatch ? jsonMatch[0] : result.response;
          const aiProcessedControls = JSON.parse(jsonStr);
          
          // Validate the AI response
          if (Array.isArray(aiProcessedControls) && aiProcessedControls.length > 0) {
            return { success: true, controls: aiProcessedControls };
          }
        } catch (parseError) {
          console.warn('Failed to parse AI chunk response, using fallback');
        }
      }
    } catch (aiError) {
      console.warn('AI processing failed for chunk, using enhanced fallback');
    }

    // Enhanced fallback with better field detection
    const processedControls = controls.map((control, index) => {
      // Try multiple field combinations for description
      let description = control.description || 
                       control.details || 
                       control.requirement || 
                       control.guidance ||
                       control.implementation ||
                       control.rationale ||
                       control.purpose ||
                       control.objective;

      // If still no description, generate one from title
      if (!description || description === 'No description available') {
        const title = control.title || control.name || control.requirement || `Control ${startIndex + index + 1}`;
        description = `This control requires implementation of ${title.toLowerCase()}. Organizations must ensure proper ${title.toLowerCase()} procedures are in place and regularly reviewed.`;
      }

      return {
        id: `${frameworkPrefix}_${String(startIndex + index + 1).padStart(3, '0')}`,
        title: control.title || control.name || control.requirement || `Control ${startIndex + index + 1}`,
        description: description,
        category: control.category || control.section || control.domain || control.family || 'General',
        requirements: Array.isArray(control.requirements) ? control.requirements : 
                     control.requirements ? [control.requirements] : 
                     control.implementation ? [control.implementation] : [],
        references: Array.isArray(control.references) ? control.references : 
                   control.references ? [control.references] :
                   control.source ? [control.source] : []
      };
    });

    return { success: true, controls: processedControls };
  }

  generateFrameworkSummary(framework: StandardizedFramework): {
    totalControls: number;
    categories: string[];
    coverage: { [category: string]: number };
  } {
    const categories = [...new Set(framework.controls.map(c => c.category).filter((cat): cat is string => Boolean(cat)))];
    const coverage: { [category: string]: number } = {};
    
    categories.forEach(category => {
      coverage[category] = framework.controls.filter(c => c.category === category).length;
    });

    return {
      totalControls: framework.controls.length,
      categories,
      coverage
    };
  }
}