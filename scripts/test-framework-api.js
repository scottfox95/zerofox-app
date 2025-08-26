const { neon } = require('@neondatabase/serverless');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const sql = neon(process.env.NEON_DATABASE_URL);

async function testFrameworkAPI() {
  try {
    console.log('🧪 Testing framework API data retrieval...');
    
    // Simulate what the API does - get framework details with controls
    const frameworkId = 1; // ISO 27001 framework
    
    // Get framework details (as done in the API route)
    const frameworkResult = await sql`
      SELECT * FROM frameworks WHERE id = ${frameworkId}
    `;
    
    // Get all controls for this framework (as done in the API route)
    const controlsResult = await sql`
      SELECT * FROM controls 
      WHERE framework_id = ${frameworkId}
      ORDER BY control_id
    `;
    
    console.log('🎯 API Response would contain:');
    console.log(`Framework: ${frameworkResult[0].name} (${frameworkResult[0].description})`);
    console.log(`Version: ${frameworkResult[0].version}`);
    console.log(`Total Controls: ${controlsResult.length}`);
    
    // Sample a few controls to verify enriched data is available
    console.log('\n📋 Sample Controls with Enriched Data:');
    const sampleControls = controlsResult.slice(0, 3);
    
    sampleControls.forEach((control, index) => {
      console.log(`\n${index + 1}. ${control.control_id}: ${control.title}`);
      console.log(`   Category: ${control.category}`);
      console.log(`   System Level: ${control.system_level}`);
      console.log(`   Subcategory: ${control.subcategory}`);
      console.log(`   Control Types: ${JSON.stringify(control.control_type)}`);
      console.log(`   Op Capabilities: ${JSON.stringify(control.op_capabilities)}`);
      console.log(`   DTI: ${control.dti}`);
      console.log(`   DTC: ${control.dtc}`);
      console.log(`   Requirement Text: ${control.requirement_text ? control.requirement_text.substring(0, 100) + '...' : 'N/A'}`);
    });
    
    // Verify we have the expected distribution
    const categoryStats = await sql`
      SELECT category, COUNT(*) as count
      FROM controls 
      WHERE framework_id = ${frameworkId}
      GROUP BY category
      ORDER BY count DESC
    `;
    
    console.log('\n📊 Control Distribution:');
    categoryStats.forEach(stat => {
      console.log(`   ${stat.category}: ${stat.count} controls`);
    });
    
    // Verify system level distribution
    const systemStats = await sql`
      SELECT system_level, COUNT(*) as count
      FROM controls 
      WHERE framework_id = ${frameworkId}
      GROUP BY system_level
    `;
    
    console.log('\n📊 System Level Distribution:');
    systemStats.forEach(stat => {
      console.log(`   ${stat.system_level ? 'Technological (System Level)' : 'Non-Technological'}: ${stat.count} controls`);
    });
    
    console.log('\n✅ Framework API test completed!');
    console.log('📝 The UI should now display all enriched control metadata');
    
  } catch (error) {
    console.error('❌ Error testing framework API:', error);
    process.exit(1);
  }
}

testFrameworkAPI();