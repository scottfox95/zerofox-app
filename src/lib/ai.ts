import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import { consoleLogger } from './console-logger';
import PerformanceMonitor from './performance-monitor';

// AI Model Configuration
export interface AIModelConfig {
  id: string;
  name: string;
  provider: 'anthropic' | 'openai' | 'google';
  model_id: string;
  description: string;
  isActive: boolean;
  reasoning?: 'minimal' | 'low' | 'medium' | 'high';
  verbosity?: 'low' | 'medium' | 'high';
}

// Default AI Models
export const defaultAIModels: AIModelConfig[] = [
  {
    id: 'claude-sonnet',
    name: 'Claude Sonnet 4',
    provider: 'anthropic',
    model_id: 'claude-sonnet-4-20250514',
    description: 'Latest Sonnet model - best for complex analysis and reasoning (Premium)',
    isActive: true
  },
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'openai',
    model_id: 'gpt-4o',
    description: 'OpenAI\'s most capable model (Premium)',
    isActive: true
  },
  {
    id: 'gpt-5-mini',
    name: 'GPT-5 Mini',
    provider: 'openai',
    model_id: 'gpt-5-mini',
    description: 'Fast and cost-effective reasoning model with prompt tuning - perfect for testing (~20x cheaper than premium)',
    isActive: true,
    reasoning: 'minimal',
    verbosity: 'low'
  },
  {
    id: 'gemini-flash',
    name: 'Gemini 2.5 Flash',
    provider: 'google',
    model_id: 'gemini-2.5-flash',
    description: 'Google\'s latest fast and efficient model (Cost-effective)',
    isActive: true
  }
];

// AI Client Setup
class AIService {
  private anthropic: Anthropic | null = null;
  private openai: OpenAI | null = null;
  private gemini: GoogleGenerativeAI | null = null;

  constructor() {
    this.initializeClients();
  }

  private initializeClients() {
    // Initialize Anthropic (Claude)
    if (process.env.ANTHROPIC_API_KEY) {
      this.anthropic = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
      });
    }

    // Initialize OpenAI
    if (process.env.OPENAI_API_KEY) {
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
    }

    // Initialize Google AI (Gemini)
    if (process.env.GOOGLE_AI_API_KEY) {
      this.gemini = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY);
    }
  }

  async testModel(modelId: string, prompt: string = "Hello! Please respond with 'AI model working correctly.'"): Promise<{ success: boolean; response?: string; error?: string; usage?: any }> {
    const timer = PerformanceMonitor.startTimer('ai_request', 'testModel', { modelId, provider: 'unknown' });
    
    try {
      const model = defaultAIModels.find(m => m.id === modelId);
      if (!model) {
        await timer.end(false, 'Model not found');
        return { success: false, error: 'Model not found' };
      }

      timer.addMetadata('provider', model.provider);
      timer.addMetadata('modelName', model.model_id);
      
      let response: string;
      let usage: any = {};

      switch (model.provider) {
        case 'anthropic':
          if (!this.anthropic) {
            await timer.end(false, 'Anthropic API key not configured');
            return { success: false, error: 'Anthropic API key not configured' };
          }
          const claudeResponse = await this.anthropic.messages.create({
            model: model.model_id,
            max_tokens: 100,
            messages: [{ role: 'user', content: prompt }]
          });
          response = claudeResponse.content[0].type === 'text' ? claudeResponse.content[0].text : 'Invalid response type';
          usage = {
            input_tokens: claudeResponse.usage.input_tokens,
            output_tokens: claudeResponse.usage.output_tokens,
            total_tokens: claudeResponse.usage.input_tokens + claudeResponse.usage.output_tokens
          };
          break;

        case 'openai':
          if (!this.openai) {
            await timer.end(false, 'OpenAI API key not configured');
            return { success: false, error: 'OpenAI API key not configured' };
          }
          const requestBody: any = {
            model: model.model_id,
            input: prompt,
            max_output_tokens: 100
          };
          if (model.reasoning) {
            requestBody.reasoning = { effort: model.reasoning };
          }
          if (model.verbosity) {
            requestBody.text = { verbosity: model.verbosity };
          }
          const openaiResponse = await this.openai.responses.create(requestBody);
          response = openaiResponse.output_text || 'No response';
          usage = {
            input_tokens: openaiResponse.usage?.input_tokens || 0,
            output_tokens: openaiResponse.usage?.output_tokens || 0,
            total_tokens: openaiResponse.usage?.total_tokens || 0
          };
          break;

        case 'google':
          if (!this.gemini) {
            await timer.end(false, 'Google AI API key not configured');
            return { success: false, error: 'Google AI API key not configured' };
          }
          const geminiModel = this.gemini.getGenerativeModel({ model: model.model_id });
          const geminiResponse = await geminiModel.generateContent(prompt);
          response = geminiResponse.response.text();
          // Note: Gemini usage tracking is more limited
          usage = {
            input_tokens: 0, // Not directly available
            output_tokens: 0, // Not directly available  
            total_tokens: 0 // Estimate based on response length
          };
          break;

        default:
          await timer.end(false, 'Unknown provider');
          return { success: false, error: 'Unknown provider' };
      }

      // Record AI usage metrics
      timer.addMetadata('inputTokens', usage.input_tokens);
      timer.addMetadata('outputTokens', usage.output_tokens);
      timer.addMetadata('totalTokens', usage.total_tokens);
      
      await PerformanceMonitor.recordAIUsage({
        provider: model.provider,
        model: model.model_id,
        promptTokens: usage.input_tokens,
        completionTokens: usage.output_tokens,
        totalTokens: usage.total_tokens,
        operationType: 'test_model',
        duration: Date.now() - timer['startTime'],
        success: true
      });

      await timer.end(true);
      return { success: true, response, usage };
    } catch (error) {
      await timer.end(false, error instanceof Error ? error.message : 'Unknown error');
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async generateCompletion(modelId: string, prompt: string, maxTokens: number = 1000): Promise<{ success: boolean; response?: string; error?: string }> {
    try {
      const model = defaultAIModels.find(m => m.id === modelId);
      if (!model) {
        return { success: false, error: 'Model not found' };
      }

      let response: string;

      switch (model.provider) {
        case 'anthropic':
          if (!this.anthropic) {
            return { success: false, error: 'Anthropic API key not configured' };
          }
          const claudeResponse = await this.anthropic.messages.create({
            model: model.model_id,
            max_tokens: maxTokens,
            messages: [{ role: 'user', content: prompt }]
          });
          response = claudeResponse.content[0].type === 'text' ? claudeResponse.content[0].text : 'Invalid response type';
          break;

        case 'openai':
          if (!this.openai) {
            return { success: false, error: 'OpenAI API key not configured' };
          }
          const requestBody2: any = {
            model: model.model_id,
            input: prompt,
            max_output_tokens: maxTokens
          };
          if (model.reasoning) {
            requestBody2.reasoning = { effort: model.reasoning };
          }
          if (model.verbosity) {
            requestBody2.text = { verbosity: model.verbosity };
          }
          const openaiResponse = await this.openai.responses.create(requestBody2);
          response = openaiResponse.output_text || 'No response';
          break;

        case 'google':
          if (!this.gemini) {
            return { success: false, error: 'Google AI API key not configured' };
          }
          const geminiModel = this.gemini.getGenerativeModel({ 
            model: model.model_id,
            generationConfig: { maxOutputTokens: maxTokens }
          });
          const geminiResponse = await geminiModel.generateContent(prompt);
          response = geminiResponse.response.text();
          break;

        default:
          return { success: false, error: 'Unknown provider' };
      }

      return { success: true, response };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async generateResponse(prompt: string, modelProvider: 'claude' | 'openai' | 'gemini' | string = 'claude', maxTokens: number = 2000, operationType: string = 'analysis'): Promise<string> {
    // Support both legacy provider names and direct model IDs
    const modelMap: Record<string, string> = {
      'claude': 'claude-sonnet',
      'openai': 'gpt-4o', 
      'gemini': 'gemini-flash'
    };
    
    // If it's a direct model ID, use it; otherwise map from provider
    const modelId = modelMap[modelProvider] || modelProvider;
    const timer = PerformanceMonitor.startTimer('ai_request', 'generateResponse', {
      modelId,
      provider: modelProvider,
      operationType,
      promptLength: prompt.length,
      maxTokens
    });
    
    consoleLogger.aiCall(modelId, prompt.substring(0, 200) + '...', undefined, maxTokens);
    
    try {
      const result = await this.generateCompletionWithUsage(modelId, prompt, maxTokens, operationType);
      
      if (result.success && result.response) {
        consoleLogger.aiCall(modelId, 'Response received', result.response.substring(0, 200) + '...', undefined);
        consoleLogger.info(`AI call completed in ${timer.duration || 0}ms`, 'AI', { 
          model: modelId,
          tokens: result.usage?.total_tokens || 0
        });
        
        timer.addMetadata('responseLength', result.response.length);
        timer.addMetadata('totalTokens', result.usage?.total_tokens || 0);
        await timer.end(true);
        
        return result.response;
      } else {
        await timer.end(false, result.error || 'AI generation failed');
        throw new Error(result.error || 'AI generation failed');
      }
    } catch (error) {
      await timer.end(false, error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  private async generateCompletionWithUsage(modelId: string, prompt: string, maxTokens: number = 1000, operationType: string = 'unknown'): Promise<{ success: boolean; response?: string; error?: string; usage?: any }> {
    const startTime = Date.now();
    
    try {
      const model = defaultAIModels.find(m => m.id === modelId);
      if (!model) {
        return { success: false, error: 'Model not found' };
      }

      let response: string;
      let usage: any = {};

      switch (model.provider) {
        case 'anthropic':
          if (!this.anthropic) {
            return { success: false, error: 'Anthropic API key not configured' };
          }
          const claudeResponse = await this.anthropic.messages.create({
            model: model.model_id,
            max_tokens: maxTokens,
            messages: [{ role: 'user', content: prompt }]
          });
          response = claudeResponse.content[0].type === 'text' ? claudeResponse.content[0].text : 'Invalid response type';
          usage = {
            input_tokens: claudeResponse.usage.input_tokens,
            output_tokens: claudeResponse.usage.output_tokens,
            total_tokens: claudeResponse.usage.input_tokens + claudeResponse.usage.output_tokens
          };
          break;

        case 'openai':
          if (!this.openai) {
            return { success: false, error: 'OpenAI API key not configured' };
          }
          const requestBody3: any = {
            model: model.model_id,
            input: prompt,
            max_output_tokens: maxTokens
          };
          if (model.reasoning) {
            requestBody3.reasoning = { effort: model.reasoning };
          }
          if (model.verbosity) {
            requestBody3.text = { verbosity: model.verbosity };
          }
          const openaiResponse = await this.openai.responses.create(requestBody3);
          response = openaiResponse.output_text || 'No response';
          usage = {
            input_tokens: openaiResponse.usage?.input_tokens || 0,
            output_tokens: openaiResponse.usage?.output_tokens || 0,
            total_tokens: openaiResponse.usage?.total_tokens || 0
          };
          break;

        case 'google':
          if (!this.gemini) {
            return { success: false, error: 'Google AI API key not configured' };
          }
          const geminiModel = this.gemini.getGenerativeModel({ 
            model: model.model_id,
            generationConfig: { 
              maxOutputTokens: maxTokens,
              temperature: 0.1,
              topP: 0.8,
              topK: 40
            }
          });
          
          try {
            const geminiResponse = await geminiModel.generateContent(prompt);
            
            // Check if the response was blocked by safety filters
            if (geminiResponse.response.promptFeedback?.blockReason) {
              console.error('Gemini response blocked:', geminiResponse.response.promptFeedback.blockReason);
              return { 
                success: false, 
                error: `Gemini safety filter blocked response: ${geminiResponse.response.promptFeedback.blockReason}` 
              };
            }
            
            // Check if candidates were blocked
            const candidates = geminiResponse.response.candidates;
            if (!candidates || candidates.length === 0) {
              console.error('Gemini returned no candidates');
              return { success: false, error: 'Gemini returned no response candidates' };
            }
            
            const firstCandidate = candidates[0];
            if (firstCandidate.finishReason === 'SAFETY') {
              console.error('Gemini candidate blocked by safety filter');
              return { success: false, error: 'Gemini response blocked by safety filters' };
            }
            
            response = geminiResponse.response.text();
            
            // Estimate token usage for Gemini (rough approximation)
            const estimatedInputTokens = Math.ceil(prompt.length / 4);
            const estimatedOutputTokens = Math.ceil(response.length / 4);
            usage = {
              input_tokens: estimatedInputTokens,
              output_tokens: estimatedOutputTokens,
              total_tokens: estimatedInputTokens + estimatedOutputTokens
            };
          } catch (geminiError) {
            console.error('Gemini generation error:', geminiError);
            return { 
              success: false, 
              error: `Gemini generation failed: ${geminiError instanceof Error ? geminiError.message : 'Unknown error'}` 
            };
          }
          break;

        default:
          return { success: false, error: 'Unknown provider' };
      }

      const duration = Date.now() - startTime;

      // Record detailed AI usage metrics
      await PerformanceMonitor.recordAIUsage({
        provider: model.provider,
        model: model.model_id,
        promptTokens: usage.input_tokens,
        completionTokens: usage.output_tokens,
        totalTokens: usage.total_tokens,
        operationType,
        duration,
        success: true
      });

      return { success: true, response, usage };
    } catch (error) {
      const duration = Date.now() - startTime;
      
      // Record failed AI usage
      const model = defaultAIModels.find(m => m.id === modelId);
      if (model) {
        await PerformanceMonitor.recordAIUsage({
          provider: model.provider,
          model: model.model_id,
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
          operationType,
          duration,
          success: false
        });
      }

      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  getAvailableModels(): AIModelConfig[] {
    return defaultAIModels.filter(model => {
      switch (model.provider) {
        case 'anthropic':
          return !!process.env.ANTHROPIC_API_KEY;
        case 'openai':
          return !!process.env.OPENAI_API_KEY;
        case 'google':
          return !!process.env.GOOGLE_AI_API_KEY;
        default:
          return false;
      }
    });
  }
}

export const aiService = new AIService();
export { AIService };