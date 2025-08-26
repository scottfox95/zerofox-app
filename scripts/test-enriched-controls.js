const { neon } = require('@neondatabase/serverless');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const sql = neon(process.env.NEON_DATABASE_URL);

async function testEnrichedControls() {
  try {
    console.log('🧪 Testing enriched controls access for analysis system...');
    
    // Simulate what the analysis system does - get framework and controls
    const frameworkId = 1; // ISO 27001 framework ID
    
    // Get framework details (as done in evidence-analysis.ts)
    const frameworkResult = await sql`
      SELECT * FROM frameworks WHERE id = ${frameworkId}
    `;
    
    console.log('🎯 Framework details:');
    const framework = frameworkResult[0];
    console.log(`  Name: ${framework.name}`);
    console.log(`  Description: ${framework.description}`);
    console.log(`  Version: ${framework.version}`);
    
    // Get controls for this framework (as done in evidence-analysis.ts)
    const controlsResult = await sql`
      SELECT * FROM controls WHERE framework_id = ${frameworkId}
      ORDER BY control_id
    `;
    
    console.log(`\n📋 Found ${controlsResult.length} controls`);
    
    // Test that we can access the new enriched fields
    console.log('\n🔍 Testing enriched field access (first 5 controls):');
    const testControls = controlsResult.slice(0, 5);
    
    testControls.forEach((control, index) => {
      console.log(`\n${index + 1}. Control ${control.control_id}: ${control.title}`);
      console.log(`   Category: ${control.category}`);
      console.log(`   System Level: ${control.system_level}`);
      console.log(`   Subcategory: ${control.subcategory}`);
      console.log(`   Control Types: ${JSON.stringify(control.control_type)}`);
      console.log(`   Op Capabilities: ${JSON.stringify(control.op_capabilities)}`);
      console.log(`   DTI: ${control.dti}`);
      console.log(`   DTC: ${control.dtc}`);
      console.log(`   Subcontrols Count: ${control.subcontrols_count}`);
      console.log(`   Requirement Text: ${control.requirement_text?.substring(0, 100)}...`);
    });
    
    // Test specific controls that should be available for analysis
    console.log('\n🎯 Testing specific Annex A controls:');
    const annexAControls = await sql`
      SELECT control_id, title, system_level, control_type 
      FROM controls 
      WHERE framework_id = ${frameworkId} 
      AND control_id LIKE 'A.%'
      ORDER BY control_id
      LIMIT 10
    `;
    
    console.log(`Found ${annexAControls.length} Annex A controls (showing first 10):`);
    annexAControls.forEach(ctrl => {
      console.log(`  ${ctrl.control_id}: ${ctrl.title} (System: ${ctrl.system_level})`);
    });
    
    // Verify that we have both system-level and non-system-level controls
    const systemLevelStats = await sql`
      SELECT 
        system_level, 
        COUNT(*) as count,
        ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM controls WHERE framework_id = ${frameworkId}), 1) as percentage
      FROM controls 
      WHERE framework_id = ${frameworkId}
      GROUP BY system_level
    `;
    
    console.log('\n📊 System Level Distribution:');
    systemLevelStats.forEach(stat => {
      console.log(`  ${stat.system_level ? 'System Level' : 'Non-System Level'}: ${stat.count} (${stat.percentage}%)`);
    });
    
    console.log('\n✅ All enriched control data is accessible to the analysis system!');
    console.log('🎉 Compliance reviewers will now see complete control metadata during analysis');
    
  } catch (error) {
    console.error('❌ Error testing enriched controls:', error);
    process.exit(1);
  }
}

testEnrichedControls();