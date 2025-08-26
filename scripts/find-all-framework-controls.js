const { neon } = require('@neondatabase/serverless');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const sql = neon(process.env.NEON_DATABASE_URL);

async function findAllFrameworkControls() {
  try {
    console.log('🔍 Finding ALL controls for framework 1...');
    
    // Get absolutely ALL controls for framework_id = 1 without any limits
    const allControls = await sql`
      SELECT id, control_id, title, created_at
      FROM controls 
      WHERE framework_id = 1 
      ORDER BY id
    `;
    
    console.log(`\nTotal controls found: ${allControls.length}`);
    
    // Group by control type
    const oldControls = allControls.filter(c => c.control_id.startsWith('FRAMEWORK_'));
    const newControls = allControls.filter(c => c.control_id.startsWith('A.'));
    const otherControls = allControls.filter(c => !c.control_id.startsWith('FRAMEWORK_') && !c.control_id.startsWith('A.'));
    
    console.log(`\n📊 Control breakdown:`);
    console.log(`  FRAMEWORK_* controls: ${oldControls.length}`);
    console.log(`  A.*.* controls: ${newControls.length}`);
    console.log(`  Other controls: ${otherControls.length}`);
    
    if (oldControls.length > 0) {
      console.log(`\n🔍 Old FRAMEWORK_* controls (showing all ${oldControls.length}):`);
      oldControls.forEach((ctrl, index) => {
        console.log(`  ${index + 1}. ID: ${ctrl.id}, Control: ${ctrl.control_id}, Title: ${ctrl.title}, Created: ${ctrl.created_at}`);
      });
      
      console.log(`\n🗑️ DELETING all ${oldControls.length} old FRAMEWORK_* controls...`);
      
      // Delete them one by one to be sure
      for (const ctrl of oldControls) {
        await sql`DELETE FROM controls WHERE id = ${ctrl.id}`;
        console.log(`  ✅ Deleted ID ${ctrl.id}: ${ctrl.control_id}`);
      }
      
      console.log(`\n✅ Successfully deleted all ${oldControls.length} old controls`);
    }
    
    if (newControls.length > 0) {
      console.log(`\n✅ New A.*.* controls (showing first 5 of ${newControls.length}):`);
      newControls.slice(0, 5).forEach((ctrl, index) => {
        console.log(`  ${index + 1}. ID: ${ctrl.id}, Control: ${ctrl.control_id}, Title: ${ctrl.title}`);
      });
    }
    
    if (otherControls.length > 0) {
      console.log(`\n⚠️  Other controls (${otherControls.length}):`);
      otherControls.forEach((ctrl, index) => {
        console.log(`  ${index + 1}. ID: ${ctrl.id}, Control: ${ctrl.control_id}, Title: ${ctrl.title}`);
      });
    }
    
    // Final verification
    const finalCount = await sql`SELECT COUNT(*) as total FROM controls WHERE framework_id = 1`;
    console.log(`\n🧪 Final count: ${finalCount[0].total} controls`);
    
    // Check what the API should return now
    const apiData = await sql`
      SELECT * FROM controls 
      WHERE framework_id = 1
      ORDER BY control_id
      LIMIT 3
    `;
    
    console.log('\n📡 API should now return:');
    apiData.forEach((ctrl, index) => {
      console.log(`  ${index + 1}. ${ctrl.control_id}: ${ctrl.title}`);
    });
    
  } catch (error) {
    console.error('❌ Error finding framework controls:', error);
    process.exit(1);
  }
}

findAllFrameworkControls();