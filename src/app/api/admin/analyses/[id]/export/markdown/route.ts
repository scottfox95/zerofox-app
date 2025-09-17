import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

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
    
    console.log(`📋 Markdown Export: Analysis ${analysisId}, Status filter: ${statusFilter || 'all'}`);

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
    let evidenceMappings: any[] = [];
    
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

    // Generate markdown report
    const markdown = generateMarkdownReport(
      analysis,
      evidenceMappings,
      evidenceByMapping,
      statusFilter
    );

    // Generate filename with status filter suffix
    let filename = `${analysis.framework_name}_analysis_${analysisId}`;
    if (statusFilter) {
      const statusSuffix = statusFilter.replace(/,/g, '-');
      filename += `_${statusSuffix}`;
    }
    filename += `_${new Date().toISOString().split('T')[0]}.md`;

    return new NextResponse(markdown, {
      headers: {
        'Content-Type': 'text/markdown',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });

  } catch (error) {
    console.error('Export markdown error:', error);
    return NextResponse.json(
      { error: 'Failed to export analysis' },
      { status: 500 }
    );
  }
}

function generateMarkdownReport(
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

  let markdown = `# ${analysis.framework_name} Compliance Analysis Report

## Executive Summary

**Analysis ID:** ${analysis.id}  
**Framework:** ${analysis.framework_name}  
**Status:** ${analysis.status}  
**Generated:** ${formatDate(analysis.created_at)}  
**Completed:** ${analysis.completed_at ? formatDate(analysis.completed_at) : 'In Progress'}  
${statusFilter ? `**Filter Applied:** ${statusFilter.split(',').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(', ')} controls only  ` : ''}

### Compliance Overview

- **Total Controls Analyzed:** ${totalMapped}
- **Compliant:** ${compliantCount} (${totalMapped ? Math.round((compliantCount / totalMapped) * 100) : 0}%)
- **Partial Compliance:** ${partialCount} (${totalMapped ? Math.round((partialCount / totalMapped) * 100) : 0}%)
- **Missing/Non-Compliant:** ${missingCount} (${totalMapped ? Math.round((missingCount / totalMapped) * 100) : 0}%)
- **Average Confidence Score:** ${analysis.average_confidence ? Math.round(analysis.average_confidence) : 'N/A'}%

---

## Detailed Findings

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
  ['compliant', 'partial', 'missing'].forEach(status => {
    if (!byStatus[status] || byStatus[status].length === 0) return;

    const statusTitle = status.charAt(0).toUpperCase() + status.slice(1);
    const statusEmoji = status === 'compliant' ? '✅' : status === 'partial' ? '⚠️' : '❌';
    
    markdown += `### ${statusEmoji} ${statusTitle} Controls (${byStatus[status].length})\n\n`;

    byStatus[status].forEach((mapping: any) => {
      const evidence = evidenceByMapping[mapping.id] || [];
      
      markdown += `#### ${mapping.control_id_string}: ${mapping.control_title}\n\n`;
      markdown += `**Category:** ${mapping.control_category}  \n`;
      markdown += `**Confidence Score:** ${mapping.confidence_score}%  \n`;
      markdown += `**Status:** ${statusEmoji} ${statusTitle}  \n\n`;
      
      markdown += `**Control Description:**  \n`;
      markdown += `${mapping.control_description}\n\n`;
      
      if (mapping.reasoning) {
        markdown += `**Assessment Reasoning:**  \n`;
        markdown += `${mapping.reasoning}\n\n`;
      }

      if (evidence.length > 0) {
        markdown += `**Supporting Evidence (${evidence.length} items):**\n\n`;
        
        evidence.forEach((item: any, index: number) => {
          markdown += `${index + 1}. **${item.document_name}** (Confidence: ${item.confidence}%)\n`;
          if (item.page_number) {
            markdown += `   *Page ${item.page_number}*\n`;
          }
          markdown += `   > ${item.evidence_text.substring(0, 300)}${item.evidence_text.length > 300 ? '...' : ''}\n\n`;
        });
      } else {
        markdown += `**No supporting evidence found.**\n\n`;
      }
      
      markdown += `---\n\n`;
    });
  });

  // Add summary statistics
  markdown += `## Analysis Statistics

- **Processing Duration:** ${analysis.processing_time ? `${Math.round(analysis.processing_time / 1000)}s` : 'N/A'}
- **Total Evidence Items:** ${Object.values(evidenceByMapping).flat().length}
- **Documents Analyzed:** ${[...new Set(Object.values(evidenceByMapping).flat().map((item: any) => item.document_name))].length}

---

*Report generated on ${new Date().toLocaleString()} by ZeroFox Compliance Platform*
`;

  return markdown;
}