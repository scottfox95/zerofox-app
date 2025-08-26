const { neon } = require('@neondatabase/serverless');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const sql = neon(process.env.NEON_DATABASE_URL);

async function examineFrameworks() {
  console.log('🔍 Examining current frameworks and controls...');
  
  // Check existing frameworks
  const frameworks = await sql`
    SELECT id, name, description, version, is_active, created_at
    FROM frameworks 
    ORDER BY created_at
  `;
  
  console.log('📋 Current Frameworks:');
  frameworks.forEach(fw => {
    console.log(`  ID: ${fw.id}`);
    console.log(`  Name: ${fw.name}`);
    console.log(`  Description: ${fw.description || 'N/A'}`);
    console.log(`  Version: ${fw.version || 'N/A'}`);
    console.log(`  Active: ${fw.is_active}`);
    console.log(`  Created: ${fw.created_at}`);
    console.log('');
  });
  
  // Find ISO 27001 2022 framework
  const iso27001Framework = await sql`
    SELECT id, name, description, version
    FROM frameworks 
    WHERE LOWER(name) LIKE '%iso%27001%' OR LOWER(name) LIKE '%iso27001%'
  `;
  
  if (iso27001Framework.length > 0) {
    console.log('🎯 Found ISO 27001 Framework(s):');
    iso27001Framework.forEach(fw => {
      console.log(`  ID: ${fw.id}, Name: ${fw.name}, Version: ${fw.version}`);
    });
    
    // Check existing controls for ISO 27001 framework
    const existingControls = await sql`
      SELECT c.id, c.control_id, c.title, c.description, c.category
      FROM controls c
      JOIN frameworks f ON c.framework_id = f.id
      WHERE f.id = ${iso27001Framework[0].id}
      ORDER BY c.control_id
      LIMIT 10
    `;
    
    console.log(`\n📝 Sample of existing controls (showing first 10 of ${existingControls.length}):`);
    existingControls.forEach(ctrl => {
      console.log(`  ${ctrl.control_id}: ${ctrl.title}`);
      console.log(`    Category: ${ctrl.category}`);
      console.log(`    Description: ${ctrl.description ? ctrl.description.substring(0, 100) + '...' : 'N/A'}`);
      console.log('');
    });
    
    // Count total controls
    const controlCount = await sql`
      SELECT COUNT(*) as total
      FROM controls c
      JOIN frameworks f ON c.framework_id = f.id
      WHERE f.id = ${iso27001Framework[0].id}
    `;
    
    console.log(`📊 Total existing controls: ${controlCount[0].total}`);
  } else {
    console.log('❌ No ISO 27001 framework found');
  }
  
  // Check structure of controls table vs iso27001_controls table
  console.log('\n🗂️ Comparing table structures...');
  
  const controlsSchema = await sql`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns 
    WHERE table_name = 'controls' AND table_schema = 'public'
    ORDER BY ordinal_position
  `;
  
  console.log('Controls table columns:');
  controlsSchema.forEach(col => {
    console.log(`  ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
  });
  
  const iso27001Schema = await sql`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns 
    WHERE table_name = 'iso27001_controls' AND table_schema = 'public'
    ORDER BY ordinal_position
  `;
  
  console.log('\nISO27001_controls table columns:');
  iso27001Schema.forEach(col => {
    console.log(`  ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
  });
}

examineFrameworks().catch(console.error);