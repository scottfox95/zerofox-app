const { neon } = require('@neondatabase/serverless');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const sql = neon(process.env.NEON_DATABASE_URL);

async function globalFrameworkSearch() {
  try {
    console.log('🔍 Global search for ALL FRAMEWORK_* controls in database...');
    
    // Search for ANY FRAMEWORK_* controls anywhere
    const allFrameworkControls = await sql`
      SELECT id, framework_id, control_id, title, created_at
      FROM controls 
      WHERE control_id LIKE 'FRAMEWORK_%'
      ORDER BY id
    `;
    
    console.log(`\nFound ${allFrameworkControls.length} FRAMEWORK_* controls total:`);
    allFrameworkControls.forEach(ctrl => {
      console.log(`  ID: ${ctrl.id}, Framework: ${ctrl.framework_id}, Control: ${ctrl.control_id}, Title: ${ctrl.title}, Created: ${ctrl.created_at}`);
    });
    
    if (allFrameworkControls.length > 0) {
      console.log(`\n🗑️ DELETING ALL ${allFrameworkControls.length} FRAMEWORK_* controls globally...`);
      
      const deleteResult = await sql`
        DELETE FROM controls WHERE control_id LIKE 'FRAMEWORK_%'
      `;
      
      console.log(`✅ Deleted ${deleteResult.count} controls`);
      
      // Verify they're gone
      const verifyResult = await sql`
        SELECT COUNT(*) as count FROM controls WHERE control_id LIKE 'FRAMEWORK_%'
      `;
      console.log(`✅ Verification: ${verifyResult[0].count} FRAMEWORK_* controls remaining`);
    }
    
    // Now check what's in framework 1
    const framework1Controls = await sql`
      SELECT COUNT(*) as count FROM controls WHERE framework_id = 1
    `;
    console.log(`\n📊 Framework 1 now has ${framework1Controls[0].count} controls`);
    
    const sampleControls = await sql`
      SELECT control_id, title FROM controls WHERE framework_id = 1 ORDER BY control_id LIMIT 3
    `;
    console.log('Sample controls:');
    sampleControls.forEach(ctrl => {
      console.log(`  ${ctrl.control_id}: ${ctrl.title}`);
    });
    
  } catch (error) {
    console.error('❌ Error in global framework search:', error);
  }
}

globalFrameworkSearch();