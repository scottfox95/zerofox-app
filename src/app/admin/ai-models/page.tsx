'use client';

import { useState, useEffect } from 'react';
import { Play, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

interface AIModel {
  id: string;
  name: string;
  provider: 'anthropic' | 'openai' | 'google';
  model_id: string;
  description: string;
  isActive: boolean;
}

interface TestResult {
  success: boolean;
  response?: string;
  error?: string;
}

export default function AIModelsPage() {
  const [models, setModels] = useState<AIModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [testResults, setTestResults] = useState<Record<string, TestResult>>({});
  const [testingModels, setTestingModels] = useState<Set<string>>(new Set());
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [apiKeyStatus, setApiKeyStatus] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchModels();
  }, []);

  const fetchModels = async () => {
    try {
      const response = await fetch('/api/admin/ai-models');
      const data = await response.json();
      
      if (data.success) {
        setModels(data.models);
        setApiKeyStatus(data.apiKeyStatus || {});
        if (data.models.length > 0 && !selectedModel) {
          setSelectedModel(data.models[0].id);
        }
      }
    } catch (error) {
      console.error('Failed to fetch AI models:', error);
    } finally {
      setLoading(false);
    }
  };

  const testModel = async (modelId: string, customPrompt?: string) => {
    setTestingModels(prev => new Set(Array.from(prev).concat([modelId])));
    
    try {
      const response = await fetch('/api/admin/ai-models/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          modelId,
          prompt: customPrompt || "Hello! Please respond with 'AI model working correctly.'"
        })
      });
      
      const result = await response.json();
      setTestResults(prev => ({ ...prev, [modelId]: result }));
    } catch (error) {
      setTestResults(prev => ({ 
        ...prev, 
        [modelId]: { success: false, error: 'Test request failed' } 
      }));
    } finally {
      setTestingModels(prev => {
        const newSet = new Set(Array.from(prev));
        newSet.delete(modelId);
        return newSet;
      });
    }
  };

  const getProviderIcon = (provider: string) => {
    switch (provider) {
      case 'anthropic':
        return '🤖';
      case 'openai':
        return '🧠';
      case 'google':
        return '🔮';
      default:
        return '⚡';
    }
  };

  const getProviderColor = (provider: string) => {
    switch (provider) {
      case 'anthropic':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'openai':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'google':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-gray-600">Loading AI models...</div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-semibold text-gray-800 mb-4">AI Model Management</h2>
        <p className="text-gray-600 mb-6">Configure and test AI models for compliance analysis.</p>
        
        {models.length === 0 ? (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-center space-x-2">
              <AlertCircle className="h-5 w-5 text-yellow-600" />
              <p className="text-yellow-800">
                No AI models available. Please configure API keys in your environment variables.
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Default Model for Analysis
              </label>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-aravo-red"
              >
                {models.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.name} ({model.provider})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {models.map((model) => (
                <div key={model.id} className="bg-white border rounded-lg p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="text-2xl">{getProviderIcon(model.provider)}</span>
                      <h3 className="text-lg font-semibold text-gray-800">{model.name}</h3>
                    </div>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getProviderColor(model.provider)}`}>
                      {model.provider}
                    </span>
                  </div>
                  
                  <p className="text-sm text-gray-600">{model.description}</p>
                  
                  <div className="text-xs text-gray-500">
                    Model: {model.model_id}
                  </div>
                  
                  {testResults[model.id] && (
                    <div className={`p-3 rounded-lg text-sm ${
                      testResults[model.id].success 
                        ? 'bg-green-50 border border-green-200 text-green-700' 
                        : 'bg-red-50 border border-red-200 text-red-700'
                    }`}>
                      <div className="flex items-center space-x-2 mb-2">
                        {testResults[model.id].success ? (
                          <CheckCircle className="h-4 w-4" />
                        ) : (
                          <XCircle className="h-4 w-4" />
                        )}
                        <span className="font-medium">
                          {testResults[model.id].success ? 'Test Successful' : 'Test Failed'}
                        </span>
                      </div>
                      {testResults[model.id].response && (
                        <div className="text-xs">Response: {testResults[model.id].response}</div>
                      )}
                      {testResults[model.id].error && (
                        <div className="text-xs">Error: {testResults[model.id].error}</div>
                      )}
                    </div>
                  )}
                  
                  <button
                    onClick={() => testModel(model.id)}
                    disabled={testingModels.has(model.id)}
                    className="w-full flex items-center justify-center space-x-2 bg-aravo-gradient text-white py-2 px-4 rounded-lg font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    <Play className="h-4 w-4" />
                    <span>
                      {testingModels.has(model.id) ? 'Testing...' : 'Test Model'}
                    </span>
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Environment Configuration</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-center space-x-3">
            <div className={`w-3 h-3 rounded-full ${
              apiKeyStatus.anthropic ? 'bg-green-500' : 'bg-red-500'
            }`}></div>
            <span className="text-sm text-gray-700">Anthropic API Key</span>
          </div>
          <div className="flex items-center space-x-3">
            <div className={`w-3 h-3 rounded-full ${
              apiKeyStatus.openai ? 'bg-green-500' : 'bg-red-500'
            }`}></div>
            <span className="text-sm text-gray-700">OpenAI API Key</span>
          </div>
          <div className="flex items-center space-x-3">
            <div className={`w-3 h-3 rounded-full ${
              apiKeyStatus.google ? 'bg-green-500' : 'bg-red-500'
            }`}></div>
            <span className="text-sm text-gray-700">Google AI API Key</span>
          </div>
        </div>
      </div>
    </div>
  );
}