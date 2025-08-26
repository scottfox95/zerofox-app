import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import { consoleLogger } from './console-logger';

// AI Model Configuration
export interface AIModelConfig {
  id: string;
  name: string;
  provider: 'anthropic' | 'openai' | 'google';
  model_id: string;
  description: string;
  isActive: boolean;
}

// Default AI Models
export const defaultAIModels: AIModelConfig[] = [
  {
    id: 'claude-sonnet',
    name: 'Claude Sonnet 4',
    provider: 'anthropic',
    model_id: 'claude-sonnet-4-20250514',
    description: 'Latest Sonnet model - best for complex analysis and reasoning',
    isActive: true
  },
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'openai',
    model_id: 'gpt-4o',
    description: 'OpenAI\'s most capable model',
    isActive: true
  },
  {
    id: 'gemini-flash',
    name: 'Gemini 2.5 Flash',
    provider: 'google',
    model_id: 'gemini-2.5-flash',
    description: 'Google\'s latest fast and efficient model',
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

  async testModel(modelId: string, prompt: string = "Hello! Please respond with 'AI model working correctly.'"): Promise<{ success: boolean; response?: string; error?: string }> {
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
            max_tokens: 100,
            messages: [{ role: 'user', content: prompt }]
          });
          response = claudeResponse.content[0].type === 'text' ? claudeResponse.content[0].text : 'Invalid response type';
          break;

        case 'openai':
          if (!this.openai) {
            return { success: false, error: 'OpenAI API key not configured' };
          }
          const openaiResponse = await this.openai.chat.completions.create({
            model: model.model_id,
            max_tokens: 100,
            messages: [{ role: 'user', content: prompt }]
          });
          response = openaiResponse.choices[0]?.message?.content || 'No response';
          break;

        case 'google':
          if (!this.gemini) {
            return { success: false, error: 'Google AI API key not configured' };
          }
          const geminiModel = this.gemini.getGenerativeModel({ model: model.model_id });
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
          const openaiResponse = await this.openai.chat.completions.create({
            model: model.model_id,
            max_tokens: maxTokens,
            messages: [{ role: 'user', content: prompt }]
          });
          response = openaiResponse.choices[0]?.message?.content || 'No response';
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

  async generateResponse(prompt: string, modelProvider: 'claude' | 'openai' | 'gemini' = 'claude', maxTokens: number = 2000): Promise<string> {
    const modelMap = {
      'claude': 'claude-sonnet',
      'openai': 'gpt-4o', 
      'gemini': 'gemini-flash'
    };
    
    const modelId = modelMap[modelProvider];
    const startTime = Date.now();
    consoleLogger.aiCall(modelId, prompt.substring(0, 200) + '...', undefined, maxTokens);
    
    const result = await this.generateCompletion(modelId, prompt, maxTokens);
    const duration = Date.now() - startTime;
    
    if (result.success && result.response) {
      consoleLogger.aiCall(modelId, 'Response received', result.response.substring(0, 200) + '...', undefined);
      consoleLogger.info(`AI call completed in ${duration}ms`, 'AI', { model: modelId });
      return result.response;
    } else {
      throw new Error(result.error || 'AI generation failed');
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