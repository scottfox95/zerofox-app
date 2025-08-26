const { neon } = require('@neondatabase/serverless');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const sql = neon(process.env.NEON_DATABASE_URL);

async function nuclearFrameworkReset() {
  try {
    console.log('💥 NUCLEAR OPTION: Completely resetting framework 1 controls...');
    
    const frameworkId = 1;
    
    // 1. Delete ALL controls for framework 1 (nuclear option)
    console.log('\n🗑️ Step 1: Deleting ALL controls for framework 1...');
    const deleteResult = await sql`
      DELETE FROM controls WHERE framework_id = ${frameworkId}
    `;
    console.log(`✅ Deleted all controls (affected rows: ${deleteResult.count || 'unknown'})`);
    
    // 2. Verify deletion
    const verifyEmpty = await sql`
      SELECT COUNT(*) as count FROM controls WHERE framework_id = ${frameworkId}
    `;
    console.log(`✅ Verification: Framework 1 now has ${verifyEmpty[0].count} controls`);
    
    // 3. Get all controls from iso27001_controls
    const sourceControls = await sql`
      SELECT * FROM iso27001_controls ORDER BY control_id
    `;
    console.log(`\n📥 Step 2: Found ${sourceControls.length} source controls from iso27001_controls table`);
    
    // 4. Insert them one by one with explicit values
    console.log('\n⬆️ Step 3: Inserting all 93 ISO27001 controls...');
    let insertedCount = 0;
    
    for (const control of sourceControls) {
      await sql`
        INSERT INTO controls (
          framework_id, control_id, title, description, category,
          requirement_text, system_level, subcategory, control_type, 
          op_capabilities, references_text, dti, dtc, subcontrols_count,
          created_at, updated_at
        ) VALUES (
          ${frameworkId}, 
          ${control.control_id}, 
          ${control.title}, 
          ${control.requirement_text}, 
          ${control.category},
          ${control.requirement_text}, 
          ${control.system_level}, 
          ${control.subcategory}, 
          ${control.control_type},
          ${control.op_capabilities}, 
          ${control.references_text}, 
          ${control.dti}, 
          ${control.dtc}, 
          ${control.subcontrols_count},
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP
        )
      `;
      
      insertedCount++;
      if (insertedCount % 20 === 0) {
        console.log(`  ✅ Inserted ${insertedCount}/${sourceControls.length} controls`);
      }
    }
    
    console.log(`\n✅ Step 4: Successfully inserted all ${insertedCount} controls`);
    
    // 5. Final verification with the EXACT same query the API uses
    console.log('\n🧪 Step 5: Testing with EXACT API query...');
    const apiTestResult = await sql`
      SELECT * FROM controls 
      WHERE framework_id = ${frameworkId}
      ORDER BY control_id
    `;
    
    console.log(`API query result: ${apiTestResult.length} controls`);
    if (apiTestResult.length > 0) {
      console.log(`First control: ${apiTestResult[0].control_id} - ${apiTestResult[0].title}`);
      console.log(`Last control: ${apiTestResult[apiTestResult.length - 1].control_id} - ${apiTestResult[apiTestResult.length - 1].title}`);
    }
    
    // 6. Update framework metadata
    await sql`
      UPDATE frameworks 
      SET 
        description = 'ISO/IEC 27001:2022 Information Security Management System - Complete Annex A Controls with enriched metadata',
        version = '2022',
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${frameworkId}
    `;
    
    console.log('\n🎉 NUCLEAR RESET COMPLETE!');
    console.log('🔄 Try the API again - it should now return 93 A.*.* controls');
    
  } catch (error) {
    console.error('❌ Error during nuclear reset:', error);
    process.exit(1);
  }
}

nuclearFrameworkReset();