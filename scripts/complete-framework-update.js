const { neon } = require('@neondatabase/serverless');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const sql = neon(process.env.NEON_DATABASE_URL);

async function completeUpdate() {
  try {
    console.log('🔧 Completing ISO 27001 framework update...');
    
    // Add updated_at column to frameworks table if it doesn't exist
    await sql`
      ALTER TABLE frameworks 
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    `;
    
    // Find the ISO 27001 framework
    const frameworkResult = await sql`
      SELECT id FROM frameworks 
      WHERE LOWER(name) LIKE '%iso%27001%' OR LOWER(name) LIKE '%iso27001%'
      LIMIT 1
    `;
    
    const frameworkId = frameworkResult[0].id;
    
    // Update framework metadata
    await sql`
      UPDATE frameworks 
      SET description = 'ISO/IEC 27001:2022 Information Security Management System - Complete Annex A Controls with enriched metadata',
          version = '2022',
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${frameworkId}
    `;
    
    console.log('✅ Framework metadata updated');
    
    // Verification
    console.log('🧪 Running final verification checks...');
    
    const controlCount = await sql`
      SELECT COUNT(*) as total FROM controls WHERE framework_id = ${frameworkId}
    `;
    console.log(`📊 Total controls in framework: ${controlCount[0].total}`);
    
    // Check that new fields are populated
    const enrichedControlsCheck = await sql`
      SELECT 
        COUNT(*) as total_controls,
        COUNT(CASE WHEN system_level IS NOT NULL THEN 1 END) as with_system_level,
        COUNT(CASE WHEN control_type IS NOT NULL AND array_length(control_type, 1) > 0 THEN 1 END) as with_control_type,
        COUNT(CASE WHEN op_capabilities IS NOT NULL AND array_length(op_capabilities, 1) > 0 THEN 1 END) as with_op_capabilities
      FROM controls 
      WHERE framework_id = ${frameworkId}
    `;
    
    const stats = enrichedControlsCheck[0];
    console.log('📊 Enriched data statistics:');
    console.log(`  Total controls: ${stats.total_controls}`);
    console.log(`  With system_level: ${stats.with_system_level}`);
    console.log(`  With control_type: ${stats.with_control_type}`);
    console.log(`  With op_capabilities: ${stats.with_op_capabilities}`);
    
    // Sample some controls with new fields
    const sampleControls = await sql`
      SELECT control_id, title, system_level, control_type, op_capabilities
      FROM controls 
      WHERE framework_id = ${frameworkId} 
      AND control_id IN ('A.5.1', 'A.8.1', 'A.6.1')
      ORDER BY control_id
    `;
    
    console.log('📋 Sample controls with enriched data:');
    sampleControls.forEach(ctrl => {
      console.log(`  ${ctrl.control_id}: ${ctrl.title}`);
      console.log(`    System Level: ${ctrl.system_level}`);
      console.log(`    Control Types: ${JSON.stringify(ctrl.control_type)}`);
      console.log(`    Op Capabilities: ${JSON.stringify(ctrl.op_capabilities)}`);
      console.log('');
    });
    
    console.log('🎉 ISO 27001 framework update completed successfully!');
    console.log('📝 Compliance reviewers will now see all enriched control data during analysis');
    
  } catch (error) {
    console.error('❌ Error completing framework update:', error);
    process.exit(1);
  }
}

completeUpdate();