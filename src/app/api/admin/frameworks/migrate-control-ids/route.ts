import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

// Helper function to generate proper framework prefix
function generateFrameworkPrefix(frameworkName: string): string {
  // Clean and format prefix
  let prefix = frameworkName
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

export async function POST(request: NextRequest) {
  try {
    console.log('🔧 Starting control ID migration...');
    
    // Get all frameworks with their controls
    const frameworksResult = await sql`
      SELECT f.id, f.name, COUNT(c.id) as control_count
      FROM frameworks f
      LEFT JOIN controls c ON f.id = c.framework_id
      GROUP BY f.id, f.name
      ORDER BY f.id
    `;

    const migrationResults = [];
    let totalUpdated = 0;

    for (const framework of frameworksResult) {
      console.log(`📋 Processing framework: ${framework.name} (${framework.control_count} controls)`);
      
      // Generate proper prefix for this framework
      const newPrefix = generateFrameworkPrefix(framework.name);
      console.log(`🏷️ New prefix: ${newPrefix}`);
      
      // Get all controls for this framework that need updating
      const controlsResult = await sql`
        SELECT id, control_id, title
        FROM controls 
        WHERE framework_id = ${framework.id}
        AND control_id LIKE 'FRAMEWORK_%'
        ORDER BY id
      `;

      if (controlsResult.length === 0) {
        console.log(`✅ Framework "${framework.name}" already has proper control IDs`);
        migrationResults.push({
          framework: framework.name,
          updated: 0,
          message: 'Already properly formatted'
        });
        continue;
      }

      let updated = 0;
      
      // Update each control ID
      for (let i = 0; i < controlsResult.length; i++) {
        const control = controlsResult[i];
        const oldId = control.control_id;
        
        // Extract the number from the old ID (FRAMEWORK_001 -> 001)
        const numberMatch = oldId.match(/FRAMEWORK_(\d+)/);
        const controlNumber = numberMatch ? numberMatch[1] : String(i + 1).padStart(3, '0');
        
        const newId = `${newPrefix}_${controlNumber}`;
        
        // Update the control ID
        await sql`
          UPDATE controls 
          SET control_id = ${newId}
          WHERE id = ${control.id}
        `;
        
        console.log(`  ✏️ ${oldId} → ${newId} (${control.title?.substring(0, 50)}...)`);
        updated++;
      }
      
      totalUpdated += updated;
      migrationResults.push({
        framework: framework.name,
        updated,
        newPrefix,
        message: `Updated ${updated} controls`
      });
    }

    console.log(`✅ Migration complete! Updated ${totalUpdated} controls across ${frameworksResult.length} frameworks`);

    return NextResponse.json({
      success: true,
      message: `Successfully migrated ${totalUpdated} control IDs`,
      results: migrationResults,
      totalFrameworks: frameworksResult.length,
      totalUpdated
    });

  } catch (error) {
    console.error('❌ Migration error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to migrate control IDs',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}