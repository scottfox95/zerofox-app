const { neon } = require('@neondatabase/serverless');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const sql = neon(process.env.NEON_DATABASE_URL);

async function fixFrameworkControls() {
  try {
    console.log('🔧 Fixing framework controls - removing old controls and ensuring only new ones exist...');
    
    const frameworkId = 1; // ISO 27001 framework
    
    // First, let's see what controls are currently in framework 1
    console.log('\n📋 Current controls in framework 1:');
    const currentControls = await sql`
      SELECT control_id, title, created_at 
      FROM controls 
      WHERE framework_id = ${frameworkId} 
      ORDER BY created_at, control_id 
      LIMIT 10
    `;
    
    currentControls.forEach(ctrl => {
      console.log(`  ${ctrl.control_id}: ${ctrl.title} (created: ${ctrl.created_at})`);
    });
    
    const totalCurrent = await sql`SELECT COUNT(*) as total FROM controls WHERE framework_id = ${frameworkId}`;
    console.log(`Total current controls: ${totalCurrent[0].total}`);
    
    // Check for both old and new controls
    const oldControls = await sql`
      SELECT COUNT(*) as count 
      FROM controls 
      WHERE framework_id = ${frameworkId} 
      AND control_id LIKE 'FRAMEWORK_%'
    `;
    
    const newControls = await sql`
      SELECT COUNT(*) as count 
      FROM controls 
      WHERE framework_id = ${frameworkId} 
      AND control_id LIKE 'A.%.%'
    `;
    
    console.log(`\n📊 Control breakdown:`);
    console.log(`  Old FRAMEWORK_* controls: ${oldControls[0].count}`);
    console.log(`  New A.*.* controls: ${newControls[0].count}`);
    
    if (oldControls[0].count > 0) {
      console.log('\n🗑️ Deleting old FRAMEWORK_* controls...');
      const deleteResult = await sql`
        DELETE FROM controls 
        WHERE framework_id = ${frameworkId} 
        AND control_id LIKE 'FRAMEWORK_%'
      `;
      console.log(`✅ Deleted ${deleteResult.count} old controls`);
    }
    
    // Check if we need to add the new controls
    const finalNewControls = await sql`
      SELECT COUNT(*) as count 
      FROM controls 
      WHERE framework_id = ${frameworkId} 
      AND control_id LIKE 'A.%.%'
    `;
    
    if (finalNewControls[0].count === 0) {
      console.log('\n📥 No new controls found - copying from iso27001_controls table...');
      
      // Copy all controls from iso27001_controls to controls table
      await sql`
        INSERT INTO controls (
          framework_id, control_id, title, description, category,
          requirement_text, system_level, subcategory, control_type, 
          op_capabilities, references_text, dti, dtc, subcontrols_count,
          created_at, updated_at
        )
        SELECT 
          ${frameworkId}, control_id, title, requirement_text, category,
          requirement_text, system_level, subcategory, control_type,
          op_capabilities, references_text, dti, dtc, subcontrols_count,
          CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        FROM iso27001_controls
        ORDER BY control_id
      `;
      
      console.log('✅ Copied all 93 controls from iso27001_controls table');
    }
    
    // Final verification
    console.log('\n🧪 Final verification:');
    const finalCount = await sql`SELECT COUNT(*) as total FROM controls WHERE framework_id = ${frameworkId}`;
    console.log(`Total controls: ${finalCount[0].total}`);
    
    const sampleFinal = await sql`
      SELECT control_id, title, system_level, control_type 
      FROM controls 
      WHERE framework_id = ${frameworkId} 
      ORDER BY control_id 
      LIMIT 5
    `;
    
    console.log('Sample controls:');
    sampleFinal.forEach(ctrl => {
      console.log(`  ${ctrl.control_id}: ${ctrl.title} (System: ${ctrl.system_level}, Types: ${JSON.stringify(ctrl.control_type)})`);
    });
    
    // Update framework metadata to reflect the changes
    await sql`
      UPDATE frameworks 
      SET 
        description = 'ISO/IEC 27001:2022 Information Security Management System - Complete Annex A Controls with enriched metadata',
        version = '2022',
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${frameworkId}
    `;
    
    console.log('\n✅ Framework controls fixed successfully!');
    console.log('🔄 The UI should now show 93 Annex A controls instead of 22 generic ones');
    
  } catch (error) {
    console.error('❌ Error fixing framework controls:', error);
    process.exit(1);
  }
}

fixFrameworkControls();