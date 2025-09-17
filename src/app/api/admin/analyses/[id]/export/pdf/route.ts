import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import puppeteer from 'puppeteer';

const sql = neon(process.env.NEON_DATABASE_URL!);

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const analysisId = parseInt(params.id);
    
    // Get query parameters for filtering
    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get('status'); // e.g., 'compliant', 'partial', 'missing', or 'compliant,partial'
    
    console.log(`📋 PDF Export: Analysis ${analysisId}, Status filter: ${statusFilter || 'all'}`);

    // Get analysis details
    const analysisResult = await sql`
      SELECT 
        a.*,
        f.name as framework_name
      FROM analyses a
      JOIN frameworks f ON a.framework_id = f.id
      WHERE a.id = ${analysisId}
    `;

    if (analysisResult.length === 0) {
      return NextResponse.json(
        { error: 'Analysis not found' },
        { status: 404 }
      );
    }

    const analysis = analysisResult[0];

    // Get evidence mappings with optional status filtering
    let evidenceMappings;
    
    if (statusFilter) {
      const allowedStatuses = statusFilter.split(',').map(s => s.trim()).filter(s => 
        ['compliant', 'partial', 'missing'].includes(s)
      );
      
      if (allowedStatuses.length > 0) {
        evidenceMappings = await sql`
          SELECT 
            em.*,
            c.id as control_id,
            c.control_id as control_id_string,
            c.title as control_title,
            c.description as control_description,
            c.category as control_category
          FROM evidence_mappings em
          JOIN controls c ON em.control_id = c.id::text
          WHERE em.analysis_id = ${analysisId}
          AND em.status = ANY(${allowedStatuses})
          ORDER BY c.control_id, em.confidence_score DESC
        `;
      } else {
        // Invalid status filter, return empty
        evidenceMappings = [];
      }
    } else {
      // No filter, get all
      evidenceMappings = await sql`
        SELECT 
          em.*,
          c.id as control_id,
          c.control_id as control_id_string,
          c.title as control_title,
          c.description as control_description,
          c.category as control_category
        FROM evidence_mappings em
        JOIN controls c ON em.control_id = c.id::text
        WHERE em.analysis_id = ${analysisId}
        ORDER BY c.control_id, em.confidence_score DESC
      `;
    }

    // Get evidence items for each mapping
    const mappingIds = evidenceMappings.map((em: any) => em.id);
    const evidenceItems = mappingIds.length > 0 ? await sql`
      SELECT 
        ei.*,
        d.original_name as document_name
      FROM evidence_items ei
      JOIN documents d ON ei.document_id = d.id
      WHERE ei.evidence_mapping_id = ANY(${mappingIds})
      ORDER BY ei.evidence_mapping_id, ei.confidence DESC
    ` : [];

    // Group evidence items by mapping
    const evidenceByMapping = evidenceItems.reduce((acc: any, item: any) => {
      if (!acc[item.evidence_mapping_id]) {
        acc[item.evidence_mapping_id] = [];
      }
      acc[item.evidence_mapping_id].push(item);
      return acc;
    }, {});

    // Generate HTML for PDF
    const html = generateHTMLReport(
      analysis,
      evidenceMappings,
      evidenceByMapping,
      statusFilter
    );

    // Generate PDF using Puppeteer
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    
    const pdfBuffer = await page.pdf({
      format: 'A4',
      margin: {
        top: '20mm',
        right: '20mm',
        bottom: '20mm',
        left: '20mm'
      },
      displayHeaderFooter: true,
      headerTemplate: `<div style="font-size: 10px; width: 100%; text-align: center; margin: 0 20mm;">
        <span>${analysis.framework_name} Compliance Report${statusFilter ? ` (${statusFilter.split(',').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(', ')})` : ''}</span>
      </div>`,
      footerTemplate: `<div style="font-size: 10px; width: 100%; text-align: center; margin: 0 20mm;">
        <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span> | Generated on ${new Date().toLocaleDateString()}</span>
      </div>`,
      printBackground: true
    });

    await browser.close();

    // Generate filename with status filter suffix
    let filename = `${analysis.framework_name}_analysis_${analysisId}`;
    if (statusFilter) {
      const statusSuffix = statusFilter.replace(/,/g, '-');
      filename += `_${statusSuffix}`;
    }
    filename += `_${new Date().toISOString().split('T')[0]}.pdf`;

    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });

  } catch (error) {
    console.error('Export PDF error:', error);
    return NextResponse.json(
      { error: 'Failed to export analysis as PDF' },
      { status: 500 }
    );
  }
}

function generateHTMLReport(
  analysis: any,
  evidenceMappings: any[],
  evidenceByMapping: any,
  statusFilter?: string | null
): string {
  const formatDate = (date: string) => new Date(date).toLocaleString();
  
  const compliantCount = evidenceMappings.filter(em => em.status === 'compliant').length;
  const partialCount = evidenceMappings.filter(em => em.status === 'partial').length;
  const missingCount = evidenceMappings.filter(em => em.status === 'missing').length;
  const totalMapped = evidenceMappings.length;

  let html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${analysis.framework_name} Compliance Report</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 100%;
            margin: 0;
            padding: 0;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px 0;
            text-align: center;
            margin-bottom: 30px;
        }
        .header h1 {
            margin: 0;
            font-size: 28px;
            font-weight: 600;
        }
        .header .subtitle {
            font-size: 16px;
            opacity: 0.9;
            margin-top: 10px;
        }
        .container {
            padding: 0 20px;
        }
        .summary-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin-bottom: 30px;
        }
        .summary-card {
            background: #f8f9fa;
            border-radius: 8px;
            padding: 20px;
            border-left: 4px solid #667eea;
        }
        .summary-card h3 {
            margin: 0 0 15px 0;
            color: #444;
            font-size: 16px;
        }
        .stat-row {
            display: flex;
            justify-content: space-between;
            margin: 8px 0;
            font-size: 14px;
        }
        .stat-value {
            font-weight: 600;
        }
        .compliant { color: #22c55e; }
        .partial { color: #f59e0b; }
        .missing { color: #ef4444; }
        .control-section {
            margin: 30px 0;
            page-break-inside: avoid;
        }
        .control-section h2 {
            color: #1f2937;
            font-size: 22px;
            margin-bottom: 20px;
            border-bottom: 2px solid #e5e7eb;
            padding-bottom: 10px;
        }
        .control-item {
            background: white;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            margin-bottom: 20px;
            page-break-inside: avoid;
        }
        .control-header {
            padding: 15px 20px;
            border-bottom: 1px solid #e5e7eb;
            background: #f9fafb;
        }
        .control-id {
            font-weight: 700;
            font-size: 16px;
            color: #1f2937;
        }
        .control-title {
            font-size: 14px;
            color: #6b7280;
            margin-top: 5px;
        }
        .control-body {
            padding: 20px;
        }
        .control-meta {
            display: grid;
            grid-template-columns: 1fr 1fr 1fr;
            gap: 15px;
            margin-bottom: 15px;
            font-size: 13px;
        }
        .meta-item {
            text-align: center;
            padding: 8px;
            background: #f3f4f6;
            border-radius: 6px;
        }
        .meta-label {
            font-weight: 600;
            color: #374151;
        }
        .description {
            background: #f9fafb;
            padding: 15px;
            border-radius: 6px;
            border-left: 4px solid #e5e7eb;
            margin: 15px 0;
            font-size: 14px;
            line-height: 1.5;
        }
        .reasoning {
            background: #fff7ed;
            padding: 15px;
            border-radius: 6px;
            border-left: 4px solid #f59e0b;
            margin: 15px 0;
            font-size: 14px;
            line-height: 1.5;
        }
        .evidence-section {
            margin-top: 20px;
        }
        .evidence-section h4 {
            margin: 0 0 10px 0;
            font-size: 16px;
            color: #374151;
        }
        .evidence-item {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            padding: 12px;
            margin: 10px 0;
            font-size: 13px;
        }
        .evidence-source {
            font-weight: 600;
            color: #1e40af;
            margin-bottom: 5px;
        }
        .evidence-text {
            color: #4b5563;
            line-height: 1.4;
        }
        .confidence-badge {
            display: inline-block;
            padding: 2px 8px;
            border-radius: 12px;
            font-size: 11px;
            font-weight: 600;
            color: white;
        }
        .confidence-high { background: #22c55e; }
        .confidence-medium { background: #f59e0b; }
        .confidence-low { background: #ef4444; }
        .footer {
            margin-top: 40px;
            padding: 20px 0;
            border-top: 1px solid #e5e7eb;
            text-align: center;
            font-size: 12px;
            color: #6b7280;
        }
        @media print {
            .control-item {
                page-break-inside: avoid;
            }
            .control-section {
                page-break-inside: avoid;
            }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>${analysis.framework_name} Compliance Analysis Report</h1>
        <div class="subtitle">Analysis ID: ${analysis.id} | Generated: ${formatDate(analysis.created_at)}${statusFilter ? ` | Filter: ${statusFilter.split(',').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(', ')} controls only` : ''}</div>
    </div>

    <div class="container">
        <div class="summary-grid">
            <div class="summary-card">
                <h3>Analysis Overview</h3>
                <div class="stat-row">
                    <span>Status:</span>
                    <span class="stat-value">${analysis.status}</span>
                </div>
                <div class="stat-row">
                    <span>Framework:</span>
                    <span class="stat-value">${analysis.framework_name}</span>
                </div>
                <div class="stat-row">
                    <span>Completed:</span>
                    <span class="stat-value">${analysis.completed_at ? formatDate(analysis.completed_at) : 'In Progress'}</span>
                </div>
                <div class="stat-row">
                    <span>Avg Confidence:</span>
                    <span class="stat-value">${analysis.average_confidence ? Math.round(analysis.average_confidence) : 'N/A'}%</span>
                </div>
            </div>

            <div class="summary-card">
                <h3>Compliance Summary</h3>
                <div class="stat-row">
                    <span class="compliant">✅ Compliant:</span>
                    <span class="stat-value compliant">${compliantCount} (${totalMapped ? Math.round((compliantCount / totalMapped) * 100) : 0}%)</span>
                </div>
                <div class="stat-row">
                    <span class="partial">⚠️ Partial:</span>
                    <span class="stat-value partial">${partialCount} (${totalMapped ? Math.round((partialCount / totalMapped) * 100) : 0}%)</span>
                </div>
                <div class="stat-row">
                    <span class="missing">❌ Missing:</span>
                    <span class="stat-value missing">${missingCount} (${totalMapped ? Math.round((missingCount / totalMapped) * 100) : 0}%)</span>
                </div>
                <div class="stat-row">
                    <span>Total Controls:</span>
                    <span class="stat-value">${totalMapped}</span>
                </div>
            </div>
        </div>
`;

  // Group by status
  const byStatus = evidenceMappings.reduce((acc: any, em: any) => {
    if (!acc[em.status]) {
      acc[em.status] = [];
    }
    acc[em.status].push(em);
    return acc;
  }, {});

  // Process each status group
  const statusConfig = {
    compliant: { title: 'Compliant Controls', emoji: '✅', class: 'compliant' },
    partial: { title: 'Partially Compliant Controls', emoji: '⚠️', class: 'partial' },
    missing: { title: 'Missing/Non-Compliant Controls', emoji: '❌', class: 'missing' }
  };

  Object.entries(statusConfig).forEach(([status, config]: [string, any]) => {
    if (!byStatus[status] || byStatus[status].length === 0) return;

    html += `        <div class="control-section">
            <h2>${config.emoji} ${config.title} (${byStatus[status].length})</h2>
`;

    byStatus[status].forEach((mapping: any) => {
      const evidence = evidenceByMapping[mapping.id] || [];
      const confidenceClass = mapping.confidence_score >= 80 ? 'high' : mapping.confidence_score >= 60 ? 'medium' : 'low';
      
      html += `            <div class="control-item">
                <div class="control-header">
                    <div class="control-id">${mapping.control_id_string}: ${mapping.control_title}</div>
                </div>
                <div class="control-body">
                    <div class="control-meta">
                        <div class="meta-item">
                            <div class="meta-label">Category</div>
                            <div>${mapping.control_category}</div>
                        </div>
                        <div class="meta-item">
                            <div class="meta-label">Status</div>
                            <div class="${config.class}">${config.emoji} ${config.title.split(' ')[0]}</div>
                        </div>
                        <div class="meta-item">
                            <div class="meta-label">Confidence</div>
                            <div><span class="confidence-badge confidence-${confidenceClass}">${mapping.confidence_score}%</span></div>
                        </div>
                    </div>
                    
                    <div class="description">
                        <strong>Control Description:</strong><br>
                        ${mapping.control_description}
                    </div>
`;

      if (mapping.reasoning) {
        html += `                    <div class="reasoning">
                        <strong>Assessment Reasoning:</strong><br>
                        ${mapping.reasoning}
                    </div>
`;
      }

      if (evidence.length > 0) {
        html += `                    <div class="evidence-section">
                        <h4>Supporting Evidence (${evidence.length} items):</h4>
`;
        
        evidence.forEach((item: any) => {
          const itemConfidenceClass = item.confidence >= 80 ? 'high' : item.confidence >= 60 ? 'medium' : 'low';
          html += `                        <div class="evidence-item">
                            <div class="evidence-source">
                                📄 ${item.document_name} 
                                <span class="confidence-badge confidence-${itemConfidenceClass}">${item.confidence}%</span>
                                ${item.page_number ? ` | Page ${item.page_number}` : ''}
                            </div>
                            <div class="evidence-text">${item.evidence_text.substring(0, 400)}${item.evidence_text.length > 400 ? '...' : ''}</div>
                        </div>
`;
        });
        
        html += `                    </div>
`;
      } else {
        html += `                    <div class="evidence-section">
                        <div style="color: #6b7280; font-style: italic;">No supporting evidence found.</div>
                    </div>
`;
      }
      
      html += `                </div>
            </div>
`;
    });

    html += `        </div>
`;
  });

  html += `        
        <div class="footer">
            <div>Analysis Statistics: ${analysis.processing_time ? `Processing Time: ${Math.round(analysis.processing_time / 1000)}s` : ''} | 
                Total Evidence Items: ${Object.values(evidenceByMapping).flat().length} | 
                Documents Analyzed: ${[...new Set(Object.values(evidenceByMapping).flat().map((item: any) => item.document_name))].length}
            </div>
            <div style="margin-top: 10px;">
                Report generated on ${new Date().toLocaleString()} by ZeroFox Compliance Platform
            </div>
        </div>
    </div>
</body>
</html>`;

  return html;
}