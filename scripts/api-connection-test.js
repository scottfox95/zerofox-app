// Test using the EXACT same connection as the API
const { neon } = require('@neondatabase/serverless');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

// Create the same connection as the API lib
if (!process.env.NEON_DATABASE_URL) {
  throw new Error('NEON_DATABASE_URL environment variable is required');
}
const sql = neon(process.env.NEON_DATABASE_URL);

async function testAPIConnection() {
  try {
    console.log('🧪 Testing with EXACT same connection as API...');
    
    // Use the exact same query as the API route
    const frameworkId = 1;
    
    const controlsResult = await sql`
      SELECT * FROM controls 
      WHERE framework_id = ${frameworkId}
      ORDER BY control_id
    `;
    
    console.log(`API connection result: ${controlsResult.length} controls`);
    if (controlsResult.length > 0) {
      console.log(`First control: ${controlsResult[0].control_id} - ${controlsResult[0].title}`);
      console.log(`Last control: ${controlsResult[controlsResult.length - 1].control_id} - ${controlsResult[controlsResult.length - 1].title}`);
      
      // Show some IDs to understand the data
      console.log(`First control ID: ${controlsResult[0].id}, Created: ${controlsResult[0].created_at}`);
      console.log(`Last control ID: ${controlsResult[controlsResult.length - 1].id}, Created: ${controlsResult[controlsResult.length - 1].created_at}`);
      
      // Check if there are both types
      const frameworkCount = controlsResult.filter(c => c.control_id.startsWith('FRAMEWORK_')).length;
      const annexCount = controlsResult.filter(c => c.control_id.match(/^A\.\d+\.\d+/)).length;
      
      console.log(`\nBreakdown:`);
      console.log(`  FRAMEWORK_* controls: ${frameworkCount}`);
      console.log(`  A.*.* controls: ${annexCount}`);
      console.log(`  Other controls: ${controlsResult.length - frameworkCount - annexCount}`);
      
      if (frameworkCount > 0 && annexCount > 0) {
        console.log('\n⚠️  FOUND BOTH TYPES! The ORDER BY control_id returns FRAMEWORK_* first!');
      }
    }
    
  } catch (error) {
    console.error('❌ Error testing API connection:', error);
  }
}

testAPIConnection();