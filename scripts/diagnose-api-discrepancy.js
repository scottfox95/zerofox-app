const { neon } = require('@neondatabase/serverless');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const sql = neon(process.env.NEON_DATABASE_URL);

async function diagnoseAPIDiscrepancy() {
  try {
    console.log('🔍 Diagnosing API discrepancy...');
    
    // Check exactly what the API query returns
    console.log('\n🎯 Testing the exact API query for framework ID 1:');
    
    // This is the exact query from the API route
    const frameworkResult = await sql`
      SELECT * FROM frameworks WHERE id = 1
    `;
    
    console.log('Framework result:');
    console.log(frameworkResult[0]);
    
    // This is the exact controls query from the API route
    const controlsResult = await sql`
      SELECT * FROM controls 
      WHERE framework_id = 1
      ORDER BY control_id
    `;
    
    console.log(`\nControls result count: ${controlsResult.length}`);
    console.log('First 3 controls:');
    controlsResult.slice(0, 3).forEach(ctrl => {
      console.log(`  ID: ${ctrl.id}, Control ID: ${ctrl.control_id}, Title: ${ctrl.title}, Created: ${ctrl.created_at}`);
    });
    
    // Check if there are multiple entries with same framework_id
    const duplicateCheck = await sql`
      SELECT framework_id, COUNT(*) as count 
      FROM controls 
      GROUP BY framework_id 
      HAVING COUNT(*) > 0
      ORDER BY framework_id
    `;
    
    console.log('\nFramework control counts:');
    duplicateCheck.forEach(row => {
      console.log(`  Framework ${row.framework_id}: ${row.count} controls`);
    });
    
    // Check if there's some ordering issue causing old controls to appear first
    const oldStyleControls = await sql`
      SELECT id, framework_id, control_id, title, created_at
      FROM controls 
      WHERE framework_id = 1 
      AND (control_id LIKE 'FRAMEWORK_%' OR control_id LIKE 'ISO27001_%')
      ORDER BY id
    `;
    
    if (oldStyleControls.length > 0) {
      console.log(`\n⚠️  Found ${oldStyleControls.length} old-style controls still in framework 1:`);
      oldStyleControls.forEach(ctrl => {
        console.log(`  ID: ${ctrl.id}, Control: ${ctrl.control_id}, Title: ${ctrl.title}`);
      });
    } else {
      console.log('\n✅ No old-style controls found in framework 1');
    }
    
    // Check the newest controls (should be our A.*.* ones)
    const newestControls = await sql`
      SELECT id, framework_id, control_id, title, created_at
      FROM controls 
      WHERE framework_id = 1 
      ORDER BY created_at DESC, id DESC
      LIMIT 5
    `;
    
    console.log('\nNewest controls in framework 1:');
    newestControls.forEach(ctrl => {
      console.log(`  ID: ${ctrl.id}, Control: ${ctrl.control_id}, Title: ${ctrl.title}, Created: ${ctrl.created_at}`);
    });
    
    // Make sure we test both id ranges
    const lowIdControls = await sql`
      SELECT id, control_id, title FROM controls WHERE framework_id = 1 AND id < 100 ORDER BY id LIMIT 5
    `;
    const highIdControls = await sql`
      SELECT id, control_id, title FROM controls WHERE framework_id = 1 AND id > 100 ORDER BY id LIMIT 5  
    `;
    
    console.log('\nLow ID controls (< 100):');
    lowIdControls.forEach(ctrl => {
      console.log(`  ID: ${ctrl.id}, Control: ${ctrl.control_id}, Title: ${ctrl.title}`);
    });
    
    console.log('\nHigh ID controls (> 100):');
    highIdControls.forEach(ctrl => {
      console.log(`  ID: ${ctrl.id}, Control: ${ctrl.control_id}, Title: ${ctrl.title}`);
    });
    
  } catch (error) {
    console.error('❌ Error diagnosing API discrepancy:', error);
    process.exit(1);
  }
}

diagnoseAPIDiscrepancy();