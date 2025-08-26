const { neon } = require('@neondatabase/serverless');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const sql = neon(process.env.NEON_DATABASE_URL);

async function verify() {
  console.log('🔍 Verifying ISO 27001 controls ingestion...');
  
  // Sample queries to verify the data
  const samples = await sql`
    SELECT control_id, title, category, control_type, op_capabilities 
    FROM iso27001_controls 
    WHERE control_id IN ('A.5.1', 'A.6.1', 'A.7.1', 'A.8.1')
    ORDER BY control_id
  `;
  
  console.log('📋 Sample controls:');
  samples.forEach(row => {
    console.log(`${row.control_id}: ${row.title}`);
    console.log(`  Category: ${row.category}`);
    console.log(`  Control Types: ${JSON.stringify(row.control_type)}`);
    console.log(`  Op Capabilities: ${JSON.stringify(row.op_capabilities)}`);
    console.log('');
  });
  
  // Check system_level distribution
  const systemLevelStats = await sql`
    SELECT system_level, COUNT(*) as count
    FROM iso27001_controls 
    GROUP BY system_level
    ORDER BY system_level
  `;
  
  console.log('📊 System Level Distribution:');
  systemLevelStats.forEach(stat => {
    console.log(`  ${stat.system_level ? 'System Level' : 'Non-System Level'}: ${stat.count}`);
  });
  
  // Check categories
  const categories = await sql`
    SELECT category, COUNT(*) as count
    FROM iso27001_controls 
    GROUP BY category
    ORDER BY count DESC
  `;
  
  console.log('📊 Category Distribution:');
  categories.forEach(cat => {
    console.log(`  ${cat.category}: ${cat.count}`);
  });
}

verify().catch(console.error);