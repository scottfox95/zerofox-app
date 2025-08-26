'use client';

import { useState, useEffect } from 'react';
import { Edit3, Save, X, Plus, Eye, EyeOff, Trash2, AlertCircle } from 'lucide-react';

interface AIPrompt {
  id: number;
  name: string;
  promptText: string;
  promptType: string;
  version: number;
  isActive: boolean;
  createdAt: string;
}

export default function PromptsPage() {
  const [prompts, setPrompts] = useState<AIPrompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    promptText: '',
    promptType: '',
    isActive: false
  });
  const [showNewForm, setShowNewForm] = useState(false);
  const [newForm, setNewForm] = useState({
    name: '',
    promptText: '',
    promptType: 'hybrid_analysis'
  });

  useEffect(() => {
    fetchPrompts();
  }, []);

  const fetchPrompts = async () => {
    try {
      const response = await fetch('/api/admin/prompts');
      const data = await response.json();
      
      if (data.success) {
        setPrompts(data.prompts);
      }
    } catch (error) {
      console.error('Failed to fetch prompts:', error);
    } finally {
      setLoading(false);
    }
  };

  const initializePrompts = async () => {
    try {
      const response = await fetch('/api/admin/prompts/initialize', {
        method: 'POST'
      });
      const data = await response.json();
      
      if (data.success) {
        fetchPrompts();
      }
    } catch (error) {
      console.error('Failed to initialize prompts:', error);
    }
  };

  const startEdit = (prompt: AIPrompt) => {
    setEditingId(prompt.id);
    setEditForm({
      name: prompt.name,
      promptText: prompt.promptText,
      promptType: prompt.promptType,
      isActive: prompt.isActive
    });
  };

  const saveEdit = async () => {
    if (!editingId) return;

    try {
      const response = await fetch(`/api/admin/prompts/${editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm)
      });

      const data = await response.json();
      if (data.success) {
        fetchPrompts();
        setEditingId(null);
      }
    } catch (error) {
      console.error('Failed to update prompt:', error);
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({ name: '', promptText: '', promptType: '', isActive: false });
  };

  const createPrompt = async () => {
    try {
      const response = await fetch('/api/admin/prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newForm)
      });

      const data = await response.json();
      if (data.success) {
        fetchPrompts();
        setShowNewForm(false);
        setNewForm({ name: '', promptText: '', promptType: 'hybrid_analysis' });
      }
    } catch (error) {
      console.error('Failed to create prompt:', error);
    }
  };

  const deletePrompt = async (id: number) => {
    if (!confirm('Are you sure you want to delete this prompt?')) return;

    try {
      const response = await fetch(`/api/admin/prompts/${id}`, {
        method: 'DELETE'
      });

      const data = await response.json();
      if (data.success) {
        fetchPrompts();
      }
    } catch (error) {
      console.error('Failed to delete prompt:', error);
    }
  };

  const getPromptTypeLabel = (type: string) => {
    switch (type) {
      case 'hybrid_analysis':
        return 'Hybrid Analysis';
      case 'master_doc_analysis':
        return 'Master Document Analysis';
      case 'basic_analysis':
        return 'Basic Analysis';
      default:
        return type;
    }
  };

  const getPromptTypeColor = (type: string) => {
    switch (type) {
      case 'hybrid_analysis':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'master_doc_analysis':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'basic_analysis':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-gray-600">Loading AI prompts...</div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-2xl font-semibold text-gray-800">AI Prompt Management</h2>
            <p className="text-gray-600 mt-2">
              Configure and optimize system prompts used for evidence analysis.
            </p>
          </div>
          <div className="flex space-x-3">
            {prompts.length === 0 && (
              <button
                onClick={initializePrompts}
                className="bg-aravo-gradient text-white px-4 py-2 rounded-lg font-medium hover:opacity-90 transition-opacity"
              >
                Initialize Default Prompts
              </button>
            )}
            <button
              onClick={() => setShowNewForm(!showNewForm)}
              className="flex items-center space-x-2 bg-aravo-gradient text-white px-4 py-2 rounded-lg font-medium hover:opacity-90 transition-opacity"
            >
              <Plus className="h-4 w-4" />
              <span>New Prompt</span>
            </button>
          </div>
        </div>

        {prompts.length === 0 ? (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
            <div className="flex items-center space-x-2 mb-2">
              <AlertCircle className="h-5 w-5 text-yellow-600" />
              <h3 className="font-medium text-yellow-800">No Prompts Configured</h3>
            </div>
            <p className="text-yellow-700 mb-4">
              System prompts are currently hardcoded. Initialize default prompts to begin managing them through the admin interface.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {prompts.map((prompt) => (
              <div key={prompt.id} className="border rounded-lg p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div>
                      {editingId === prompt.id ? (
                        <input
                          type="text"
                          value={editForm.name}
                          onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                          className="text-lg font-semibold text-gray-800 border-b border-gray-300 focus:outline-none focus:border-aravo-red bg-transparent"
                        />
                      ) : (
                        <h3 className="text-lg font-semibold text-gray-800">{prompt.name}</h3>
                      )}
                      <div className="flex items-center space-x-3 mt-1">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getPromptTypeColor(prompt.promptType)}`}>
                          {getPromptTypeLabel(prompt.promptType)}
                        </span>
                        <span className="text-xs text-gray-500">
                          v{prompt.version}
                        </span>
                        {prompt.isActive && (
                          <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800 border border-green-200">
                            Active
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setExpandedId(expandedId === prompt.id ? null : prompt.id)}
                      className="p-2 text-gray-500 hover:text-gray-700 transition-colors"
                      title={expandedId === prompt.id ? 'Hide prompt' : 'Show prompt'}
                    >
                      {expandedId === prompt.id ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                    {editingId === prompt.id ? (
                      <>
                        <button
                          onClick={saveEdit}
                          className="p-2 text-green-600 hover:text-green-800 transition-colors"
                          title="Save changes"
                        >
                          <Save className="h-4 w-4" />
                        </button>
                        <button
                          onClick={cancelEdit}
                          className="p-2 text-gray-500 hover:text-gray-700 transition-colors"
                          title="Cancel"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => startEdit(prompt)}
                          className="p-2 text-blue-600 hover:text-blue-800 transition-colors"
                          title="Edit prompt"
                        >
                          <Edit3 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => deletePrompt(prompt.id)}
                          className="p-2 text-red-600 hover:text-red-800 transition-colors"
                          title="Delete prompt"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {expandedId === prompt.id && (
                  <div className="border-t pt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Prompt Text
                    </label>
                    {editingId === prompt.id ? (
                      <div className="space-y-4">
                        <textarea
                          value={editForm.promptText}
                          onChange={(e) => setEditForm({ ...editForm, promptText: e.target.value })}
                          rows={20}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-aravo-red font-mono text-sm"
                          placeholder="Enter prompt text..."
                        />
                        <div className="flex items-center space-x-4">
                          <label className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              checked={editForm.isActive}
                              onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked })}
                              className="rounded border-gray-300 text-aravo-red focus:ring-aravo-red"
                            />
                            <span className="text-sm text-gray-700">Active (will deactivate other prompts of same type)</span>
                          </label>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-gray-50 rounded-lg p-4 max-h-96 overflow-y-auto">
                        <pre className="text-sm text-gray-800 whitespace-pre-wrap font-mono">
                          {prompt.promptText}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {showNewForm && (
          <div className="border-t pt-6 mt-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Create New Prompt</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Name
                  </label>
                  <input
                    type="text"
                    value={newForm.name}
                    onChange={(e) => setNewForm({ ...newForm, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-aravo-red"
                    placeholder="Prompt name..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Type
                  </label>
                  <select
                    value={newForm.promptType}
                    onChange={(e) => setNewForm({ ...newForm, promptType: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-aravo-red"
                  >
                    <option value="hybrid_analysis">Hybrid Analysis</option>
                    <option value="master_doc_analysis">Master Document Analysis</option>
                    <option value="basic_analysis">Basic Analysis</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Prompt Text
                </label>
                <textarea
                  value={newForm.promptText}
                  onChange={(e) => setNewForm({ ...newForm, promptText: e.target.value })}
                  rows={15}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-aravo-red font-mono text-sm"
                  placeholder="Enter prompt text..."
                />
              </div>
              <div className="flex items-center space-x-3">
                <button
                  onClick={createPrompt}
                  disabled={!newForm.name || !newForm.promptText}
                  className="bg-aravo-gradient text-white px-6 py-2 rounded-lg font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Create Prompt
                </button>
                <button
                  onClick={() => {
                    setShowNewForm(false);
                    setNewForm({ name: '', promptText: '', promptType: 'hybrid_analysis' });
                  }}
                  className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}