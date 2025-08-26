const { neon } = require('@neondatabase/serverless');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const sql = neon(process.env.NEON_DATABASE_URL);

async function fullDatabaseAudit() {
  try {
    console.log('🔍 COMPREHENSIVE DATABASE AUDIT for framework 1...\n');
    
    // Get ALL controls for framework 1, ordered by ID (not control_id)
    const allControls = await sql`
      SELECT id, framework_id, control_id, title, created_at
      FROM controls 
      WHERE framework_id = 1
      ORDER BY id
    `;
    
    console.log(`Total controls in framework 1: ${allControls.length}\n`);
    
    // Group by creation date and type
    const frameworkControls = allControls.filter(c => c.control_id.startsWith('FRAMEWORK_'));
    const annexControls = allControls.filter(c => c.control_id.match(/^A\.\d+\.\d+/));
    
    console.log('📊 BREAKDOWN:');
    console.log(`  FRAMEWORK_* controls: ${frameworkControls.length}`);
    console.log(`  A.*.* controls: ${annexControls.length}`);
    console.log(`  Other: ${allControls.length - frameworkControls.length - annexControls.length}\n`);
    
    if (frameworkControls.length > 0) {
      console.log('🗂️  FRAMEWORK_* CONTROLS:');
      console.log(`  ID Range: ${frameworkControls[0].id} - ${frameworkControls[frameworkControls.length - 1].id}`);
      console.log(`  Created: ${frameworkControls[0].created_at}`);
      console.log(`  Count: ${frameworkControls.length}`);
      console.log(`  First: ${frameworkControls[0].control_id}`);
      console.log(`  Last: ${frameworkControls[frameworkControls.length - 1].control_id}\n`);
    }
    
    if (annexControls.length > 0) {
      console.log('📋 A.*.* CONTROLS:');
      console.log(`  ID Range: ${annexControls[0].id} - ${annexControls[annexControls.length - 1].id}`);
      console.log(`  Created: ${annexControls[0].created_at}`);
      console.log(`  Count: ${annexControls.length}`);
      console.log(`  First: ${annexControls[0].control_id}`);
      console.log(`  Last: ${annexControls[annexControls.length - 1].control_id}\n`);
    }
    
    // Now test the EXACT query the API uses
    console.log('🧪 TESTING API QUERY: ORDER BY control_id');
    const apiQuery = await sql`
      SELECT id, control_id, title, created_at
      FROM controls 
      WHERE framework_id = 1
      ORDER BY control_id
      LIMIT 5
    `;
    
    console.log('First 5 results from API query:');
    apiQuery.forEach(ctrl => {
      console.log(`  ID: ${ctrl.id}, Control: ${ctrl.control_id}, Created: ${ctrl.created_at}`);
    });
    
    console.log(`\n💡 EXPLANATION:`);
    if (frameworkControls.length > 0 && annexControls.length > 0) {
      console.log(`The API returns FRAMEWORK_* controls because "FRAMEWORK_" comes before "A." alphabetically!`);
      console.log(`Since there are ${frameworkControls.length} FRAMEWORK_* controls, the API only shows those.`);
      console.log(`The ${annexControls.length} newer A.*.* controls are hidden by the alphabetical ordering.`);
    } else if (frameworkControls.length > 0) {
      console.log(`Only old FRAMEWORK_* controls exist.`);
    } else if (annexControls.length > 0) {
      console.log(`Only new A.*.* controls exist.`);
    }
    
  } catch (error) {
    console.error('❌ Error in database audit:', error);
  }
}

fullDatabaseAudit();