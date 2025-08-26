const { neon } = require('@neondatabase/serverless');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

console.log('🔍 Checking database connections...');

// Check the connection string (without revealing sensitive parts)
const connectionString = process.env.NEON_DATABASE_URL;
if (connectionString) {
  const url = new URL(connectionString);
  console.log(`\nConnection details:`);
  console.log(`  Protocol: ${url.protocol}`);
  console.log(`  Host: ${url.hostname}`);
  console.log(`  Database: ${url.pathname}`);
  console.log(`  Username: ${url.username}`);
} else {
  console.log('❌ No NEON_DATABASE_URL found');
}

// Test with the exact same connection as the API uses
const sql = neon(process.env.NEON_DATABASE_URL);

async function checkConnections() {
  try {
    // Check all controls in framework 1 just like the API does
    console.log('\n🧪 Testing same query as API...');
    
    const controlsResult = await sql`
      SELECT id, control_id, title 
      FROM controls 
      WHERE framework_id = 1
      ORDER BY control_id
      LIMIT 5
    `;
    
    console.log(`Found ${controlsResult.length} controls in query (limited to 5):`);
    controlsResult.forEach(ctrl => {
      console.log(`  ID: ${ctrl.id}, Control: ${ctrl.control_id}, Title: ${ctrl.title}`);
    });
    
    // Get total count
    const totalCount = await sql`SELECT COUNT(*) as total FROM controls WHERE framework_id = 1`;
    console.log(`\nTotal controls in framework 1: ${totalCount[0].total}`);
    
    // Check if we have both types of controls somehow
    const frameworkControls = await sql`
      SELECT COUNT(*) as count FROM controls WHERE framework_id = 1 AND control_id LIKE 'FRAMEWORK_%'
    `;
    const annexControls = await sql`
      SELECT COUNT(*) as count FROM controls WHERE framework_id = 1 AND control_id LIKE 'A.%.%'
    `;
    
    console.log(`\n📊 Control type breakdown:`);
    console.log(`  FRAMEWORK_* controls: ${frameworkControls[0].count}`);
    console.log(`  A.*.* controls: ${annexControls[0].count}`);
    
    if (frameworkControls[0].count > 0 && annexControls[0].count > 0) {
      console.log('\n⚠️  FOUND BOTH TYPES! This explains the discrepancy.');
      
      // Let's see the ID ranges
      const oldControlIds = await sql`
        SELECT MIN(id) as min_id, MAX(id) as max_id 
        FROM controls 
        WHERE framework_id = 1 AND control_id LIKE 'FRAMEWORK_%'
      `;
      const newControlIds = await sql`
        SELECT MIN(id) as min_id, MAX(id) as max_id 
        FROM controls 
        WHERE framework_id = 1 AND control_id LIKE 'A.%.%'
      `;
      
      console.log(`  Old controls ID range: ${oldControlIds[0].min_id} - ${oldControlIds[0].max_id}`);
      console.log(`  New controls ID range: ${newControlIds[0].min_id} - ${newControlIds[0].max_id}`);
      
      // Since we order by control_id, the FRAMEWORK_ controls come first alphabetically
      console.log('\n💡 The API returns old controls first because "FRAMEWORK_" comes before "A." alphabetically!');
    }
    
  } catch (error) {
    console.error('❌ Error checking connections:', error);
  }
}

checkConnections();