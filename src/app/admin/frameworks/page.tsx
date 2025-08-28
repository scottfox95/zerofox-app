'use client';

import { useState, useEffect } from 'react';
import { Upload, FileText, CheckCircle, XCircle, AlertCircle, Eye, Plus } from 'lucide-react';

interface Framework {
  id: number;
  name: string;
  description: string;
  version: string;
  is_active: boolean;
  control_count: number;
  created_at: string;
}

interface StandardizedFramework {
  id: string;
  name: string;
  description: string;
  version: string;
  controls: any[];
  metadata: {
    source: string;
    standardizedAt: Date;
    aiModel: string;
    confidence: number;
  };
}

export default function FrameworksPage() {
  const [user, setUser] = useState<{ role: 'admin' | 'client' | 'demo' } | null>(null);
  const [frameworks, setFrameworks] = useState<Framework[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [rawData, setRawData] = useState<any>(null);
  const [standardizing, setStandardizing] = useState(false);
  const [standardizedFramework, setStandardizedFramework] = useState<StandardizedFramework | null>(null);
  const [selectedModel, setSelectedModel] = useState('claude-sonnet');
  const [message, setMessage] = useState('');
  const [reviewMode, setReviewMode] = useState<'standardize' | 'review' | 'complete' | 'edit'>('standardize');
  const [reviewingExistingId, setReviewingExistingId] = useState<number | null>(null);
  const [editingFramework, setEditingFramework] = useState<StandardizedFramework | null>(null);
  const [migrating, setMigrating] = useState(false);

  useEffect(() => {
    // Get user info from token
    const token = document.cookie
      .split('; ')
      .find(row => row.startsWith('token='))
      ?.split('=')[1];

    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        setUser(payload);
      } catch (error) {
        console.error('Failed to parse token:', error);
      }
    }

    fetchFrameworks();
  }, []);

  const fetchFrameworks = async () => {
    try {
      const response = await fetch('/api/admin/frameworks');
      const data = await response.json();
      
      if (data.success) {
        setFrameworks(data.frameworks);
      }
    } catch (error) {
      console.error('Failed to fetch frameworks:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.json')) {
      setMessage('Please upload a JSON file');
      return;
    }

    setUploadedFile(file);
    setMessage('');

    try {
      const text = await file.text();
      const data = JSON.parse(text);
      setRawData(data);
      setMessage('File uploaded successfully! Review the data and click "Standardize"');
    } catch (error) {
      setMessage('Error parsing JSON file. Please check the file format.');
      setRawData(null);
    }
  };

  const standardizeFramework = async () => {
    if (!rawData || !uploadedFile) return;

    setStandardizing(true);
    setMessage('');

    try {
      const response = await fetch('/api/admin/frameworks/standardize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawData,
          filename: uploadedFile.name,
          aiModel: selectedModel
        })
      });

      const data = await response.json();

      if (data.success) {
        setStandardizedFramework(data.framework);
        setReviewMode('review');
        setMessage(`Framework standardized successfully! Found ${data.summary.totalControls} controls across ${data.summary.categories.length} categories. Please review below.`);
      } else {
        setMessage(`Standardization failed: ${data.error}`);
      }
    } catch (error) {
      setMessage('Error during standardization. Please try again.');
    } finally {
      setStandardizing(false);
    }
  };

  const approveFramework = async () => {
    if (!standardizedFramework) return;

    try {
      const response = await fetch('/api/admin/frameworks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: standardizedFramework?.name,
          description: standardizedFramework?.description,
          version: standardizedFramework?.version,
          controls: standardizedFramework?.controls
        })
      });

      const data = await response.json();

      if (data.success) {
        setReviewMode('complete');
        setMessage('Framework approved and saved to database!');
        setTimeout(() => {
          setStandardizedFramework(null);
          setRawData(null);
          setUploadedFile(null);
          setReviewMode('standardize');
          fetchFrameworks();
        }, 3000);
      } else {
        setMessage(`Failed to save framework: ${data.error}`);
      }
    } catch (error) {
      setMessage('Error saving framework. Please try again.');
    }
  };

  const goBackToStandardize = () => {
    setStandardizedFramework(null);
    setReviewMode('standardize');
    setReviewingExistingId(null);
    setEditingFramework(null);
    setMessage('');
  };

  const editExistingFramework = () => {
    if (standardizedFramework && reviewingExistingId) {
      setEditingFramework({...standardizedFramework});
      setReviewMode('edit');
      setMessage('You can now edit the framework details and controls below.');
    }
  };

  const saveEditedFramework = async () => {
    if (!editingFramework || !reviewingExistingId) return;

    try {
      const response = await fetch(`/api/admin/frameworks/${reviewingExistingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editingFramework.name,
          description: editingFramework.description,
          version: editingFramework.version,
          controls: editingFramework.controls
        })
      });

      const data = await response.json();

      if (data.success) {
        setMessage('Framework updated successfully!');
        setReviewMode('complete');
        setTimeout(() => {
          goBackToStandardize();
          fetchFrameworks();
        }, 2000);
      } else {
        setMessage(`Failed to update framework: ${data.error}`);
      }
    } catch (error) {
      setMessage('Error updating framework. Please try again.');
    }
  };

  const reviewExistingFramework = async (frameworkId: number) => {
    try {
      const response = await fetch(`/api/admin/frameworks/${frameworkId}`);
      const data = await response.json();
      
      if (data.success) {
        // Convert database framework to standardized format for review
        const standardizedFramework: StandardizedFramework = {
          id: data.framework.name.toLowerCase().replace(/[^a-z0-9]/g, '_'),
          name: data.framework.name,
          description: data.framework.description,
          version: data.framework.version,
          controls: data.controls || [],
          metadata: {
            source: 'database',
            standardizedAt: new Date(data.framework.created_at),
            aiModel: 'existing',
            confidence: 1.0
          }
        };
        
        setStandardizedFramework(standardizedFramework);
        setReviewingExistingId(frameworkId);
        setReviewMode('review');
        setMessage(`Reviewing existing framework with ${data.controls?.length || 0} controls.`);
      } else {
        setMessage(`Failed to load framework: ${data.error}`);
      }
    } catch (error) {
      setMessage('Error loading framework for review.');
    }
  };

  const migrateControlIds = async () => {
    if (!confirm('This will update all existing control IDs to use framework-specific prefixes (e.g., FRAMEWORK_001 → ISO27001_001). Continue?')) {
      return;
    }

    setMigrating(true);
    setMessage('🔧 Migrating control IDs to new naming convention...');

    try {
      const response = await fetch('/api/admin/frameworks/migrate-control-ids', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      const data = await response.json();

      if (data.success) {
        setMessage(`✅ Migration complete! Updated ${data.totalUpdated} controls across ${data.totalFrameworks} frameworks.`);
        await fetchFrameworks(); // Refresh the frameworks list
      } else {
        setMessage(`❌ Migration failed: ${data.error}`);
      }
    } catch (error) {
      setMessage('❌ Error during migration. Please try again.');
    } finally {
      setMigrating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-gray-600">Loading frameworks...</div>
      </div>
    );
  }

  const isAdmin = user?.role === 'admin';
  const isDemo = user?.role === 'demo';

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">
          {isAdmin ? 'Framework Management' : isDemo ? 'Frameworks (Demo)' : 'Compliance Frameworks'}
        </h1>
        {isAdmin && (
          <button
            onClick={migrateControlIds}
            disabled={migrating}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {migrating ? '🔧 Migrating...' : '🔄 Fix Control IDs'}
          </button>
        )}
      </div>

      {/* Read-only notice for non-admin users */}
      {!isAdmin && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <Eye className="h-5 w-5 text-blue-600" />
            <div>
              <h3 className="text-lg font-semibold text-blue-800">
                {isDemo ? 'Demo Mode' : 'Framework Viewer'}
              </h3>
              <p className="text-blue-700 text-sm">
                {isDemo 
                  ? 'You are viewing compliance frameworks in demo mode. All frameworks and controls are read-only.'
                  : 'You can view compliance frameworks and their controls, but management features require admin access.'
                }
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Step Indicator - Admin Only */}
      {isAdmin && (
        <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-center space-x-4 mb-4">
          <div className={`flex items-center space-x-2 ${
            reviewMode === 'standardize' ? 'text-aravo-red font-semibold' : 
            reviewMode === 'review' || reviewMode === 'complete' ? 'text-green-600' : 'text-gray-400'
          }`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${
              reviewMode === 'standardize' ? 'bg-aravo-red text-white' :
              reviewMode === 'review' || reviewMode === 'complete' ? 'bg-green-500 text-white' : 'bg-gray-300 text-gray-600'
            }`}>1</div>
            <span>Upload & Standardize</span>
          </div>
          
          <div className="w-8 h-px bg-gray-300"></div>
          
          <div className={`flex items-center space-x-2 ${
            reviewMode === 'review' ? 'text-aravo-red font-semibold' :
            reviewMode === 'complete' ? 'text-green-600' : 'text-gray-400'
          }`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${
              reviewMode === 'review' ? 'bg-aravo-red text-white' :
              reviewMode === 'complete' ? 'bg-green-500 text-white' : 'bg-gray-300 text-gray-600'
            }`}>2</div>
            <span>Review Controls</span>
          </div>
          
          <div className="w-8 h-px bg-gray-300"></div>
          
          <div className={`flex items-center space-x-2 ${
            reviewMode === 'complete' ? 'text-green-600 font-semibold' : 'text-gray-400'
          }`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${
              reviewMode === 'complete' ? 'bg-green-500 text-white' : 'bg-gray-300 text-gray-600'
            }`}>3</div>
            <span>Save to Database</span>
          </div>
        </div>
      </div>
      )}

      {/* Upload and Standardization Section */}
      {reviewMode === 'standardize' && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">Step 1: Framework Standardization</h2>
          <p className="text-gray-600 mb-6">
            Upload your compliance framework JSON files to standardize them using AI.
          </p>

        <div className="space-y-6">
          {/* File Upload */}
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
            <div className="text-center">
              <Upload className="mx-auto h-12 w-12 text-gray-400" />
              <div className="mt-4">
                <label htmlFor="file-upload" className="cursor-pointer">
                  <span className="mt-2 block text-sm font-medium text-gray-900">
                    Upload Framework JSON File
                  </span>
                  <input
                    id="file-upload"
                    name="file-upload"
                    type="file"
                    accept=".json"
                    className="sr-only"
                    onChange={handleFileUpload}
                  />
                  <span className="mt-1 block text-sm text-gray-600">
                    Select a JSON file containing compliance framework data
                  </span>
                </label>
              </div>
            </div>
          </div>

          {/* File Preview */}
          {uploadedFile && rawData && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <div className="flex items-center space-x-3 mb-3">
                <FileText className="h-5 w-5 text-blue-600" />
                <span className="font-medium text-gray-900">{uploadedFile.name}</span>
                <span className="text-sm text-gray-500">
                  ({Math.round(uploadedFile.size / 1024)} KB)
                </span>
              </div>
              <div className="bg-white border border-gray-200 rounded p-3 max-h-40 overflow-y-auto">
                <pre className="text-xs text-gray-700">
                  {JSON.stringify(rawData, null, 2).substring(0, 500)}
                  {JSON.stringify(rawData, null, 2).length > 500 && '...'}
                </pre>
              </div>
            </div>
          )}

          {/* AI Model Selection */}
          {rawData && (
            <div className="flex items-center space-x-4">
              <label className="text-sm font-medium text-gray-700">AI Model:</label>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-aravo-red"
              >
                <option value="claude-sonnet">Claude 3.5 Sonnet</option>
                <option value="gpt-4o">GPT-4o</option>
                <option value="gemini-flash">Gemini 2.5 Flash</option>
              </select>
            </div>
          )}

          {/* Standardize Button */}
          {rawData && (
            <button
              onClick={standardizeFramework}
              disabled={standardizing}
              className="bg-aravo-gradient text-white px-6 py-3 rounded-lg font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {standardizing ? 'Standardizing...' : 'Standardize Framework'}
            </button>
          )}

          {/* Status Message */}
          {message && (
            <div className={`p-4 rounded-lg ${
              message.includes('successfully') || message.includes('approved')
                ? 'bg-green-50 border border-green-200 text-green-700'
                : message.includes('failed') || message.includes('Error')
                ? 'bg-red-50 border border-red-200 text-red-700'
                : 'bg-blue-50 border border-blue-200 text-blue-700'
            }`}>
              {message}
            </div>
          )}
        </div>
      </div>
      )}

      {/* Review Section */}
      {reviewMode === 'review' && standardizedFramework && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">
            {reviewingExistingId ? 'Review Existing Framework' : 'Step 2: Review Standardized Framework'}
          </h2>
          <p className="text-gray-600 mb-6">
            {reviewingExistingId 
              ? `Review this existing framework with ${standardizedFramework?.controls?.length} controls. This framework is already saved in your database.`
              : `Please carefully review all controls before approving. You can scroll through all ${standardizedFramework?.controls?.length} controls below.`
            }
          </p>

          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Framework Name</label>
                <p className="text-gray-900 font-medium">{standardizedFramework?.name}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Version</label>
                <p className="text-gray-900">{standardizedFramework?.version}</p>
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700">Description</label>
              <p className="text-gray-900">{standardizedFramework?.description}</p>
            </div>
            
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-semibold text-blue-800 mb-2">Framework Statistics</h4>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="font-medium text-blue-900">Total Controls:</span>
                  <span className="ml-2 text-blue-700 text-xl font-bold">{standardizedFramework?.controls?.length}</span>
                </div>
                <div>
                  <span className="font-medium text-blue-900">Categories:</span>
                  <span className="ml-2 text-blue-700 text-xl font-bold">
                    {Array.from(new Set(standardizedFramework?.controls?.map(c => c.category).filter(Boolean))).length}
                  </span>
                </div>
                <div>
                  <span className="font-medium text-blue-900">Source:</span>
                  <span className="ml-2 text-blue-700">{standardizedFramework?.metadata.source}</span>
                </div>
              </div>
            </div>

            {/* Controls Detail Review */}
            <div>
              <h4 className="font-semibold text-gray-800 mb-3">📋 All Controls ({standardizedFramework?.controls?.length} total)</h4>
              
              {/* Category Summary */}
              <div className="mb-4">
                <h5 className="text-sm font-medium text-gray-700 mb-2">Controls by Category:</h5>
                <div className="flex flex-wrap gap-2">
                  {Array.from(new Set(standardizedFramework?.controls?.map(c => c.category).filter(Boolean))).map(category => (
                    <span key={category} className="px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded-full">
                      {category}: {standardizedFramework?.controls?.filter(c => c.category === category).length}
                    </span>
                  ))}
                </div>
              </div>

              {/* All Controls List */}
              <div className="border border-gray-200 rounded-lg max-h-96 overflow-y-auto">
                <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 sticky top-0">
                  <span className="text-sm font-medium text-gray-700">
                    📋 Review All {standardizedFramework?.controls?.length} Controls (scroll to see all)
                  </span>
                </div>
                {standardizedFramework?.controls?.length === 0 ? (
                  <div className="p-4 text-center text-red-600">
                    ⚠️ No controls found! This indicates a processing error.
                  </div>
                ) : (
                  standardizedFramework?.controls?.map((control, index) => (
                    <div key={control.id} className="p-4 border-b border-gray-100 last:border-b-0">
                      <div className="flex items-start justify-between mb-2">
                        <h6 className="font-medium text-gray-900 text-sm">
                          #{index + 1}: {control.id || control.control_id} - {control.title || 'No title'}
                        </h6>
                        <div className="flex items-center space-x-1">
                          {control.system_level && (
                            <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded ml-2 flex-shrink-0">
                              System Level
                            </span>
                          )}
                          {control.category && (
                            <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded ml-2 flex-shrink-0">
                              {control.category}
                            </span>
                          )}
                        </div>
                      </div>
                      <p className="text-sm text-gray-600 mb-2">
                        {control.requirement_text || control.description || 'No description available'}
                      </p>
                      
                      {/* Enhanced metadata display */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-gray-500 bg-gray-50 p-2 rounded">
                        {control.control_type && Array.isArray(control.control_type) && control.control_type.length > 0 && (
                          <div>
                            <strong>Control Types:</strong> {control.control_type.join(', ')}
                          </div>
                        )}
                        {control.op_capabilities && Array.isArray(control.op_capabilities) && control.op_capabilities.length > 0 && (
                          <div>
                            <strong>Capabilities:</strong> {control.op_capabilities.join(', ')}
                          </div>
                        )}
                        {control.subcategory && control.subcategory !== control.category && (
                          <div>
                            <strong>Subcategory:</strong> {control.subcategory}
                          </div>
                        )}
                        {(control.dti || control.dtc) && (
                          <div>
                            <strong>Difficulty:</strong> 
                            {control.dti && ` Implement: ${control.dti}`}
                            {control.dtc && ` Comply: ${control.dtc}`}
                          </div>
                        )}
                      </div>
                      
                      {control.requirements && control.requirements.length > 0 && (
                        <div className="text-xs text-gray-500 mt-2">
                          <strong>Requirements:</strong> {control.requirements.join(', ')}
                        </div>
                      )}
                      {control.references && control.references.length > 0 && (
                        <div className="text-xs text-gray-500 mt-1">
                          <strong>References:</strong> {control.references.join(', ')}
                        </div>
                      )}
                      {control.references_text && control.references_text !== control.references?.join(', ') && (
                        <div className="text-xs text-gray-500 mt-1">
                          <strong>References:</strong> {control.references_text}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex space-x-4 pt-6 border-t">
              {reviewingExistingId ? (
                /* Reviewing existing framework */
                <>
                  <button
                    onClick={goBackToStandardize}
                    className="bg-blue-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors flex items-center space-x-2"
                  >
                    <span>← Back to Frameworks</span>
                  </button>
                  <button
                    onClick={editExistingFramework}
                    className="bg-yellow-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-yellow-700 transition-colors flex items-center space-x-2"
                  >
                    <span>✏️ Edit Framework</span>
                  </button>
                </>
              ) : (
                /* Reviewing new standardized framework */
                <>
                  <button
                    onClick={approveFramework}
                    className="bg-green-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-green-700 transition-colors flex items-center space-x-2"
                  >
                    <span>✅ Approve & Save Framework</span>
                  </button>
                  <button
                    onClick={goBackToStandardize}
                    className="bg-gray-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-gray-700 transition-colors flex items-center space-x-2"
                  >
                    <span>🔄 Start Over</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Success Section */}
      {reviewMode === 'complete' && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="text-center">
            <div className="text-6xl mb-4">✅</div>
            <h2 className="text-2xl font-semibold text-green-800 mb-2">Framework Saved Successfully!</h2>
            <p className="text-green-600">Your framework has been approved and saved to the database.</p>
          </div>
        </div>
      )}

      {/* Edit Section */}
      {reviewMode === 'edit' && editingFramework && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">Edit Framework</h2>
          <p className="text-gray-600 mb-6">
            Modify the framework details and controls below. Changes will be saved to the database.
          </p>

          <div className="space-y-6">
            {/* Framework Metadata */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Framework Name</label>
                <input
                  type="text"
                  value={editingFramework.name}
                  onChange={(e) => setEditingFramework({...editingFramework, name: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-aravo-red"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Version</label>
                <input
                  type="text"
                  value={editingFramework.version}
                  onChange={(e) => setEditingFramework({...editingFramework, version: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-aravo-red"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
              <textarea
                value={editingFramework.description}
                onChange={(e) => setEditingFramework({...editingFramework, description: e.target.value})}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-aravo-red"
              />
            </div>

            {/* Controls Editor */}
            <div>
              <h4 className="font-semibold text-gray-800 mb-3">📋 Edit Controls ({editingFramework.controls.length} total)</h4>
              
              <div className="border border-gray-200 rounded-lg max-h-96 overflow-y-auto">
                <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 sticky top-0">
                  <span className="text-sm font-medium text-gray-700">
                    Controls (click to expand and edit)
                  </span>
                </div>
                {editingFramework.controls.map((control, index) => (
                  <div key={control.id || control.control_id || index} className="border-b border-gray-100 last:border-b-0">
                    <div className="p-4 space-y-4">
                      {/* Basic Info */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Control ID</label>
                          <input
                            type="text"
                            value={control.id || control.control_id || ''}
                            onChange={(e) => {
                              const updatedControls = [...editingFramework.controls];
                              updatedControls[index] = {...control, id: e.target.value, control_id: e.target.value};
                              setEditingFramework({...editingFramework, controls: updatedControls});
                            }}
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-aravo-red"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">System Level</label>
                          <div className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              checked={control.system_level || false}
                              onChange={(e) => {
                                const updatedControls = [...editingFramework.controls];
                                updatedControls[index] = {...control, system_level: e.target.checked};
                                setEditingFramework({...editingFramework, controls: updatedControls});
                              }}
                              className="w-4 h-4 text-aravo-red focus:ring-aravo-red border-gray-300 rounded"
                            />
                            <span className="text-xs text-gray-600">Technological control</span>
                          </div>
                        </div>
                      </div>

                      {/* Categories */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Category</label>
                          <input
                            type="text"
                            value={control.category || ''}
                            onChange={(e) => {
                              const updatedControls = [...editingFramework.controls];
                              updatedControls[index] = {...control, category: e.target.value};
                              setEditingFramework({...editingFramework, controls: updatedControls});
                            }}
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-aravo-red"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Subcategory</label>
                          <input
                            type="text"
                            value={control.subcategory || ''}
                            onChange={(e) => {
                              const updatedControls = [...editingFramework.controls];
                              updatedControls[index] = {...control, subcategory: e.target.value};
                              setEditingFramework({...editingFramework, controls: updatedControls});
                            }}
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-aravo-red"
                          />
                        </div>
                      </div>
                      
                      {/* Title */}
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Title</label>
                        <input
                          type="text"
                          value={control.title || ''}
                          onChange={(e) => {
                            const updatedControls = [...editingFramework.controls];
                            updatedControls[index] = {...control, title: e.target.value};
                            setEditingFramework({...editingFramework, controls: updatedControls});
                          }}
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-aravo-red"
                        />
                      </div>
                      
                      {/* Requirements/Description */}
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Requirement Text</label>
                        <textarea
                          value={control.requirement_text || control.description || ''}
                          onChange={(e) => {
                            const updatedControls = [...editingFramework.controls];
                            updatedControls[index] = {...control, requirement_text: e.target.value, description: e.target.value};
                            setEditingFramework({...editingFramework, controls: updatedControls});
                          }}
                          rows={3}
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-aravo-red"
                        />
                      </div>

                      {/* Control Types */}
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Control Types (comma-separated)</label>
                        <input
                          type="text"
                          value={Array.isArray(control.control_type) ? control.control_type.join(', ') : control.control_type || ''}
                          onChange={(e) => {
                            const updatedControls = [...editingFramework.controls];
                            const types = e.target.value.split(',').map(t => t.trim()).filter(t => t.length > 0);
                            updatedControls[index] = {...control, control_type: types};
                            setEditingFramework({...editingFramework, controls: updatedControls});
                          }}
                          placeholder="e.g. preventive, detective, corrective"
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-aravo-red"
                        />
                        <div className="text-xs text-gray-500 mt-1">Common types: preventive, detective, corrective</div>
                      </div>

                      {/* Operational Capabilities */}
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Operational Capabilities (comma-separated)</label>
                        <input
                          type="text"
                          value={Array.isArray(control.op_capabilities) ? control.op_capabilities.join(', ') : control.op_capabilities || ''}
                          onChange={(e) => {
                            const updatedControls = [...editingFramework.controls];
                            const capabilities = e.target.value.split(',').map(c => c.trim()).filter(c => c.length > 0);
                            updatedControls[index] = {...control, op_capabilities: capabilities};
                            setEditingFramework({...editingFramework, controls: updatedControls});
                          }}
                          placeholder="e.g. governance, asset management, information protection"
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-aravo-red"
                        />
                      </div>

                      {/* References and Difficulty */}
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">References</label>
                          <input
                            type="text"
                            value={control.references_text || ''}
                            onChange={(e) => {
                              const updatedControls = [...editingFramework.controls];
                              updatedControls[index] = {...control, references_text: e.target.value};
                              setEditingFramework({...editingFramework, controls: updatedControls});
                            }}
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-aravo-red"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">DTI (Difficulty to Implement)</label>
                          <input
                            type="text"
                            value={control.dti || ''}
                            onChange={(e) => {
                              const updatedControls = [...editingFramework.controls];
                              updatedControls[index] = {...control, dti: e.target.value};
                              setEditingFramework({...editingFramework, controls: updatedControls});
                            }}
                            placeholder="e.g. easy, medium, hard"
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-aravo-red"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">DTC (Difficulty to Comply)</label>
                          <input
                            type="text"
                            value={control.dtc || ''}
                            onChange={(e) => {
                              const updatedControls = [...editingFramework.controls];
                              updatedControls[index] = {...control, dtc: e.target.value};
                              setEditingFramework({...editingFramework, controls: updatedControls});
                            }}
                            placeholder="e.g. easy, medium, hard"
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-aravo-red"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex space-x-4 pt-6 border-t">
              <button
                onClick={saveEditedFramework}
                className="bg-green-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-green-700 transition-colors flex items-center space-x-2"
              >
                <span>💾 Save Changes</span>
              </button>
              <button
                onClick={() => setReviewMode('review')}
                className="bg-gray-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-gray-700 transition-colors flex items-center space-x-2"
              >
                <span>← Back to Review</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Status Message */}
      {message && (
        <div className={`p-4 rounded-lg ${
          message.includes('successfully') || message.includes('approved')
            ? 'bg-green-50 border border-green-200 text-green-700'
            : message.includes('failed') || message.includes('Error')
            ? 'bg-red-50 border border-red-200 text-red-700'
            : 'bg-blue-50 border border-blue-200 text-blue-700'
        }`}>
          {message}
        </div>
      )}

      {/* Original Framework Review (Hidden) */}
      {false && standardizedFramework && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-xl font-semibold text-gray-800 mb-4">Review Standardized Framework</h3>
          
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Name</label>
                <p className="text-gray-900 font-medium">{standardizedFramework?.name}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Version</label>
                <p className="text-gray-900">{standardizedFramework?.version}</p>
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700">Description</label>
              <p className="text-gray-900">{standardizedFramework?.description}</p>
            </div>
            
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-semibold text-blue-800 mb-2">Framework Statistics</h4>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="font-medium text-blue-900">Total Controls:</span>
                  <span className="ml-2 text-blue-700">{standardizedFramework?.controls?.length}</span>
                </div>
                <div>
                  <span className="font-medium text-blue-900">Categories:</span>
                  <span className="ml-2 text-blue-700">
                    {Array.from(new Set(standardizedFramework?.controls?.map(c => c.category).filter(Boolean))).length}
                  </span>
                </div>
                <div>
                  <span className="font-medium text-blue-900">Source:</span>
                  <span className="ml-2 text-blue-700">{standardizedFramework?.metadata.source}</span>
                </div>
              </div>
            </div>

            {/* Controls Detail Review */}
            <div>
              <h4 className="font-semibold text-gray-800 mb-3">Controls Detail ({standardizedFramework?.controls?.length} controls)</h4>
              
              {/* Category Summary */}
              <div className="mb-4">
                <h5 className="text-sm font-medium text-gray-700 mb-2">Controls by Category:</h5>
                <div className="flex flex-wrap gap-2">
                  {Array.from(new Set(standardizedFramework?.controls?.map(c => c.category).filter(Boolean))).map(category => (
                    <span key={category} className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                      {category}: {standardizedFramework?.controls?.filter(c => c.category === category).length}
                    </span>
                  ))}
                </div>
              </div>

              {/* Controls Preview with Show More Option */}
              <div className="border border-gray-200 rounded-lg">
                <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">
                    📋 Control Details ({standardizedFramework?.controls?.length} total controls)
                  </span>
                  <button
                    onClick={() => {
                      const element = document.getElementById('controls-list');
                      element?.classList.toggle('max-h-96');
                      element?.classList.toggle('max-h-none');
                    }}
                    className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200"
                  >
                    Show All Controls
                  </button>
                </div>
                <div id="controls-list" className="max-h-96 overflow-y-auto">
                  {standardizedFramework?.controls?.length === 0 ? (
                    <div className="p-4 text-center text-red-600">
                      ⚠️ No controls found! This might indicate a processing error.
                    </div>
                  ) : (
                    <>
                      {standardizedFramework?.controls?.map((control, index) => (
                        <div key={control.id} className={`p-4 border-b border-gray-100 last:border-b-0 ${
                          index < 5 ? '' : 'bg-gray-50'
                        }`}>
                          <div className="flex items-start justify-between mb-2">
                            <h6 className="font-medium text-gray-900 text-sm">
                              {control.id}: {control.title || 'No title'}
                            </h6>
                            {control.category && (
                              <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded ml-2 flex-shrink-0">
                                {control.category}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-600 mb-2">
                            {control.description || 'No description available'}
                          </p>
                          {control.requirements && control.requirements.length > 0 && (
                            <div className="text-xs text-gray-500 mb-1">
                              <strong>Requirements:</strong> {control.requirements.join(', ')}
                            </div>
                          )}
                          {control.references && control.references.length > 0 && (
                            <div className="text-xs text-gray-500">
                              <strong>References:</strong> {control.references.join(', ')}
                            </div>
                          )}
                          {index === 4 && (standardizedFramework?.controls?.length || 0) > 5 && (
                            <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-700">
                              💡 <strong>Tip:</strong> Click "Show All Controls" above to see all {standardizedFramework?.controls?.length} controls before approving
                            </div>
                          )}
                        </div>
                      ))}
                    </>
                  )}
                </div>
              </div>

              {/* Quick Stats */}
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <h5 className="font-medium text-yellow-800 mb-2">⚡ Quick Review Checklist</h5>
                <div className="text-sm text-yellow-700 space-y-1">
                  <div>✓ Framework Name: <strong>{standardizedFramework?.name}</strong></div>
                  <div>✓ Total Controls: <strong>{standardizedFramework?.controls?.length}</strong></div>
                  <div>✓ Categories: <strong>{[...new Set(standardizedFramework?.controls?.map(c => c.category).filter(Boolean))].length}</strong></div>
                  <div>✓ All Controls Have IDs: <strong>{standardizedFramework?.controls?.every(c => c.id) ? 'Yes' : 'No'}</strong></div>
                  <div>✓ All Controls Have Descriptions: <strong>{standardizedFramework?.controls?.every(c => c.description) ? 'Yes' : 'No'}</strong></div>
                </div>
              </div>
            </div>

            {/* Debug Info */}
            <details className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <summary className="cursor-pointer text-sm font-medium text-gray-700 mb-2">
                🔧 Debug Information (click to expand)
              </summary>
              <div className="text-xs text-gray-600 space-y-2">
                <div><strong>AI Model:</strong> {standardizedFramework?.metadata?.aiModel}</div>
                <div><strong>Processed At:</strong> {standardizedFramework?.metadata?.standardizedAt ? new Date(standardizedFramework!.metadata!.standardizedAt!).toLocaleString() : 'Unknown'}</div>
                <div><strong>Confidence:</strong> {standardizedFramework?.metadata?.confidence ? (standardizedFramework!.metadata!.confidence! * 100).toFixed(1) : 'N/A'}%</div>
              </div>
            </details>

            <div className="flex space-x-4">
              <button
                onClick={approveFramework}
                className="bg-green-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-700 transition-colors"
              >
                ✅ Approve & Save Framework
              </button>
              <button
                onClick={() => setStandardizedFramework(null)}
                className="bg-gray-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-gray-700 transition-colors"
              >
                ❌ Reject & Try Again
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Admin-only upload/management section ends here */}
      
      {/* Existing Frameworks - Available to All Users */}
      {((isAdmin && reviewMode === 'standardize') || !isAdmin) && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-xl font-semibold text-gray-800 mb-4">
            {isAdmin ? 'Existing Frameworks' : 'Available Frameworks'}
          </h3>
          <p className="text-gray-600 mb-6">
            {isAdmin 
              ? 'Click "👁️ Review Controls" on any framework to inspect all its controls and details.'
              : 'View compliance frameworks and their controls. Click "👁️ View Controls" to explore framework details.'
            }
          </p>
        
        {frameworks.length === 0 ? (
          <div className="text-center py-8">
            <FileText className="mx-auto h-12 w-12 text-gray-400" />
            <p className="text-gray-600 mt-4">No frameworks uploaded yet.</p>
            <p className="text-gray-500 text-sm">Upload and standardize your first framework above.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {frameworks.map((framework) => (
              <div key={framework.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold text-gray-900">{framework.name}</h4>
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                    framework.is_active 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {framework.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                
                <p className="text-sm text-gray-600 mb-3">
                  {framework.description || 'No description available'}
                </p>
                
                <div className="flex justify-between items-center text-sm text-gray-500 mb-3">
                  <span>{framework.control_count} controls</span>
                  <span>v{framework.version}</span>
                </div>
                
                <div className="mt-3 text-xs text-gray-400 mb-3">
                  Created: {new Date(framework.created_at).toLocaleDateString()}
                </div>

                <div className="flex space-x-2">
                  <button
                    onClick={() => reviewExistingFramework(framework.id)}
                    className="flex-1 bg-blue-600 text-white px-3 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors"
                  >
                    👁️ {isAdmin ? 'Review Controls' : 'View Controls'}
                  </button>
                  {isAdmin && (
                    <button
                      onClick={async () => {
                        await reviewExistingFramework(framework.id);
                        setTimeout(() => editExistingFramework(), 100);
                      }}
                      className="flex-1 bg-gray-600 text-white px-3 py-2 rounded-lg text-sm font-semibold hover:bg-gray-700 transition-colors"
                    >
                      ✏️ Edit
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        </div>
      )}
    </div>
  );
}