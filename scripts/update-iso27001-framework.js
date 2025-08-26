const { neon } = require('@neondatabase/serverless');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const sql = neon(process.env.NEON_DATABASE_URL);

async function updateFramework() {
  try {
    console.log('🚀 Updating ISO 27001 framework with enriched controls...');
    
    // First, let's expand the controls table to include additional fields
    console.log('🔧 Adding new columns to controls table...');
    
    await sql`
      ALTER TABLE controls 
      ADD COLUMN IF NOT EXISTS requirement_text TEXT,
      ADD COLUMN IF NOT EXISTS system_level BOOLEAN,
      ADD COLUMN IF NOT EXISTS subcategory VARCHAR(100),
      ADD COLUMN IF NOT EXISTS control_type TEXT[],
      ADD COLUMN IF NOT EXISTS op_capabilities TEXT[],
      ADD COLUMN IF NOT EXISTS references_text TEXT DEFAULT '',
      ADD COLUMN IF NOT EXISTS dti VARCHAR(50) DEFAULT '',
      ADD COLUMN IF NOT EXISTS dtc VARCHAR(50) DEFAULT '',
      ADD COLUMN IF NOT EXISTS subcontrols_count INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    `;
    
    console.log('✅ Controls table expanded successfully');
    
    // Find the ISO 27001 framework
    const frameworkResult = await sql`
      SELECT id, name FROM frameworks 
      WHERE LOWER(name) LIKE '%iso%27001%' OR LOWER(name) LIKE '%iso27001%'
      LIMIT 1
    `;
    
    if (frameworkResult.length === 0) {
      throw new Error('ISO 27001 framework not found');
    }
    
    const frameworkId = frameworkResult[0].id;
    console.log(`🎯 Found ISO 27001 framework with ID: ${frameworkId}`);
    
    // Delete existing controls for this framework
    console.log('🗑️ Removing old controls...');
    await sql`DELETE FROM controls WHERE framework_id = ${frameworkId}`;
    
    // Get all controls from iso27001_controls table
    const iso27001Controls = await sql`
      SELECT * FROM iso27001_controls ORDER BY control_id
    `;
    
    console.log(`📋 Found ${iso27001Controls.length} ISO 27001 controls to migrate`);
    
    // Insert the enriched controls
    let insertedCount = 0;
    for (const control of iso27001Controls) {
      await sql`
        INSERT INTO controls (
          framework_id, control_id, title, description, category,
          requirement_text, system_level, subcategory, control_type, 
          op_capabilities, references_text, dti, dtc, subcontrols_count,
          updated_at
        ) VALUES (
          ${frameworkId}, ${control.control_id}, ${control.title}, ${control.requirement_text}, ${control.category},
          ${control.requirement_text}, ${control.system_level}, ${control.subcategory}, ${control.control_type},
          ${control.op_capabilities}, ${control.references_text}, ${control.dti}, ${control.dtc}, ${control.subcontrols_count},
          CURRENT_TIMESTAMP
        )
      `;
      insertedCount++;
      
      if (insertedCount % 10 === 0) {
        console.log(`✅ Inserted ${insertedCount}/${iso27001Controls.length} controls`);
      }
    }
    
    console.log(`✅ Successfully inserted ${insertedCount} enriched controls`);
    
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
    console.log('🧪 Running verification checks...');
    
    const controlCount = await sql`
      SELECT COUNT(*) as total FROM controls WHERE framework_id = ${frameworkId}
    `;
    console.log(`📊 Total controls in framework: ${controlCount[0].total}`);
    
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
    console.error('❌ Error updating framework:', error);
    process.exit(1);
  }
}

updateFramework();