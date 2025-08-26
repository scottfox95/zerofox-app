const { neon } = require('@neondatabase/serverless');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const sql = neon(process.env.NEON_DATABASE_URL);

async function debugFrameworkAPI() {
  try {
    console.log('🔍 Debugging framework API issue...');
    
    // Check frameworks table
    console.log('\n📋 All Frameworks:');
    const frameworks = await sql`SELECT id, name, description, version FROM frameworks ORDER BY id`;
    frameworks.forEach(fw => {
      console.log(`  ID: ${fw.id}, Name: ${fw.name}, Version: ${fw.version}`);
    });
    
    // Check controls for each framework
    for (const framework of frameworks) {
      const controlCount = await sql`
        SELECT COUNT(*) as count FROM controls WHERE framework_id = ${framework.id}
      `;
      console.log(`  → Framework ${framework.id} has ${controlCount[0].count} controls`);
    }
    
    // Get the main ISO 27001 framework (ID 1) details
    console.log('\n🎯 ISO 27001 Framework Details:');
    const isoFramework = await sql`SELECT * FROM frameworks WHERE id = 1`;
    if (isoFramework.length > 0) {
      console.log(`Name: ${isoFramework[0].name}`);
      console.log(`Description: ${isoFramework[0].description}`);
      console.log(`Version: ${isoFramework[0].version}`);
      
      const controls = await sql`
        SELECT control_id, title, category, system_level, control_type 
        FROM controls 
        WHERE framework_id = 1 
        ORDER BY control_id 
        LIMIT 5
      `;
      
      console.log(`\n📊 Sample Controls (first 5 of total):`);
      controls.forEach(ctrl => {
        console.log(`  ${ctrl.control_id}: ${ctrl.title}`);
        console.log(`    Category: ${ctrl.category}, System: ${ctrl.system_level}`);
        console.log(`    Types: ${JSON.stringify(ctrl.control_type)}`);
      });
      
      // Check if there are any old generic controls mixed in
      const genericControls = await sql`
        SELECT control_id, title 
        FROM controls 
        WHERE framework_id = 1 
        AND (control_id LIKE 'ISO27001_%' OR title LIKE '%Context of the Organization%' OR title LIKE '%Leadership%')
        ORDER BY control_id
      `;
      
      if (genericControls.length > 0) {
        console.log(`\n⚠️  Found ${genericControls.length} old generic controls that need cleanup:`);
        genericControls.forEach(ctrl => {
          console.log(`  ${ctrl.control_id}: ${ctrl.title}`);
        });
      } else {
        console.log('\n✅ No old generic controls found - good!');
      }
      
      // Double-check total count
      const totalCount = await sql`SELECT COUNT(*) as total FROM controls WHERE framework_id = 1`;
      console.log(`\n📊 Total controls for framework 1: ${totalCount[0].total}`);
    }
    
  } catch (error) {
    console.error('❌ Error debugging framework API:', error);
    process.exit(1);
  }
}

debugFrameworkAPI();