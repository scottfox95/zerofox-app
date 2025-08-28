'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import ProgressiveAnalysis from '@/components/ProgressiveAnalysis';
import Link from 'next/link';

export default function AnalysisProgressPage() {
  const params = useParams();
  const router = useRouter();
  const analysisId = params.id as string;
  const [orgAnalysisNumber, setOrgAnalysisNumber] = useState<number | null>(null);

  // Fetch organization-specific analysis number
  useEffect(() => {
    const fetchAnalysisNumber = async () => {
      try {
        const response = await fetch(`/api/admin/analyses/${analysisId}/org-number`);
        if (response.ok) {
          const data = await response.json();
          setOrgAnalysisNumber(data.orgNumber);
        }
      } catch (error) {
        console.error('Failed to fetch analysis number:', error);
      }
    };

    fetchAnalysisNumber();
  }, [analysisId]);

  const handleAnalysisComplete = (completedAnalysisId: string) => {
    // Redirect to the completed analysis results page
    router.push(`/admin/analyses/${completedAnalysisId}`);
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center space-x-2 text-sm text-gray-600 mb-2">
          <Link href="/admin/analyses" className="hover:text-blue-600">Analyses</Link>
          <span>›</span>
          <span>Analysis #{orgAnalysisNumber || analysisId}</span>
          <span>›</span>
          <span>Progress</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Analysis Progress</h1>
        <p className="text-gray-600">
          Watch the AI-powered compliance analysis in real-time as it processes your documents
        </p>
      </div>

      {/* Progress Component */}
      <div className="max-w-4xl mx-auto">
        <ProgressiveAnalysis 
          analysisId={analysisId}
          onComplete={handleAnalysisComplete}
        />
      </div>

      {/* Help Section */}
      <div className="max-w-4xl mx-auto mt-8 p-6 bg-blue-50 border border-blue-200 rounded-lg">
        <h3 className="font-semibold text-blue-900 mb-2">What's happening?</h3>
        <div className="text-blue-800 text-sm space-y-2">
          <p>• <strong>Document Preparation:</strong> Organizing and indexing your documents for AI analysis</p>
          <p>• <strong>AI Analysis:</strong> Each compliance control is individually analyzed by AI to find supporting evidence</p>
          <p>• <strong>Evidence Mapping:</strong> AI identifies relevant text passages and maps them to specific controls</p>
          <p>• <strong>Confidence Scoring:</strong> Each mapping receives a confidence score based on relevance and completeness</p>
          <p>• <strong>Gap Identification:</strong> Controls without supporting evidence are flagged for attention</p>
        </div>
      </div>
    </div>
  );
}