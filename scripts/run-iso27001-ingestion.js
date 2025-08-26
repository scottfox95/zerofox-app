const { neon } = require('@neondatabase/serverless');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const sql = neon(process.env.NEON_DATABASE_URL);

const sourceData = JSON.parse(fs.readFileSync(path.join(__dirname, '../SFT_Controls/iso27001.json'), 'utf8'));

function cleanControlType(controlTypeStr) {
  if (!controlTypeStr || controlTypeStr.trim() === '') return [];
  
  const tokens = controlTypeStr
    .split(/\s*[+\/,;]\s*/)
    .map(token => token.toLowerCase().trim())
    .filter(token => token.length > 0);
  
  const uniqueTokens = [];
  const seen = new Set();
  
  for (const token of tokens) {
    if (!seen.has(token)) {
      seen.add(token);
      uniqueTokens.push(token);
    }
  }
  
  return uniqueTokens;
}

function cleanOpCapabilities(opCapabilityStr) {
  if (!opCapabilityStr || opCapabilityStr.trim() === '') return [];
  
  const tokens = opCapabilityStr
    .split(/\s*[+,]\s*/)
    .map(token => token.toLowerCase().trim())
    .filter(token => token.length > 0);
  
  const uniqueTokens = [];
  const seen = new Set();
  
  for (const token of tokens) {
    if (!seen.has(token)) {
      seen.add(token);
      uniqueTokens.push(token);
    }
  }
  
  return uniqueTokens;
}

function cleanEncodingIssues(text) {
  return text.replace(/([a-zA-Z])�s\b/g, "$1's").replace(/�/g, "'");
}

function normalizeWhitespace(text) {
  return text.replace(/\s+/g, ' ').trim();
}

function cleanControl(source) {
  return {
    control_id: source.ref_code.toUpperCase(),
    title: source.name.trim(),
    requirement_text: normalizeWhitespace(cleanEncodingIssues(source.description.trim())),
    system_level: source.system_level,
    category: source.category.trim(),
    subcategory: source.subcategory.trim(),
    control_type: cleanControlType(source.control_type),
    op_capabilities: cleanOpCapabilities(source.operational_capability),
    references_text: source.references.trim(),
    dti: source.dti.trim(),
    dtc: source.dtc.trim(),
    subcontrols_count: Array.isArray(source.subcontrols) ? source.subcontrols.length : 0
  };
}

async function main() {
  try {
    console.log('🚀 Starting ISO 27001 controls ingestion...');
    
    // Create table
    console.log('🔧 Creating ISO 27001 controls table...');
    await sql`
      CREATE TABLE IF NOT EXISTS iso27001_controls (
        id SERIAL PRIMARY KEY,
        control_id VARCHAR(10) UNIQUE NOT NULL,
        title VARCHAR(500) NOT NULL,
        requirement_text TEXT NOT NULL,
        system_level BOOLEAN NOT NULL,
        category VARCHAR(100) NOT NULL,
        subcategory VARCHAR(100) NOT NULL,
        control_type TEXT[] NOT NULL DEFAULT '{}',
        op_capabilities TEXT[] NOT NULL DEFAULT '{}',
        references_text TEXT NOT NULL DEFAULT '',
        dti VARCHAR(50) NOT NULL DEFAULT '',
        dtc VARCHAR(50) NOT NULL DEFAULT '',
        subcontrols_count INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    
    console.log('✅ Table created successfully');
    console.log(`📁 Processing ${sourceData.length} controls...`);
    
    // Process and insert controls
    let processedCount = 0;
    
    for (const sourceControl of sourceData) {
      const cleanedControl = cleanControl(sourceControl);
      
      await sql`
        INSERT INTO iso27001_controls (
          control_id, title, requirement_text, system_level, category, subcategory,
          control_type, op_capabilities, references_text, dti, dtc, subcontrols_count,
          updated_at
        ) VALUES (
          ${cleanedControl.control_id}, ${cleanedControl.title}, ${cleanedControl.requirement_text}, 
          ${cleanedControl.system_level}, ${cleanedControl.category}, ${cleanedControl.subcategory},
          ${cleanedControl.control_type}, ${cleanedControl.op_capabilities}, ${cleanedControl.references_text},
          ${cleanedControl.dti}, ${cleanedControl.dtc}, ${cleanedControl.subcontrols_count},
          CURRENT_TIMESTAMP
        )
        ON CONFLICT (control_id) DO UPDATE SET
          title = EXCLUDED.title,
          requirement_text = EXCLUDED.requirement_text,
          system_level = EXCLUDED.system_level,
          category = EXCLUDED.category,
          subcategory = EXCLUDED.subcategory,
          control_type = EXCLUDED.control_type,
          op_capabilities = EXCLUDED.op_capabilities,
          references_text = EXCLUDED.references_text,
          dti = EXCLUDED.dti,
          dtc = EXCLUDED.dtc,
          subcontrols_count = EXCLUDED.subcontrols_count,
          updated_at = CURRENT_TIMESTAMP
      `;
      
      processedCount++;
      if (processedCount % 10 === 0) {
        console.log(`✅ Processed ${processedCount}/${sourceData.length} controls`);
      }
    }
    
    console.log(`✅ Successfully processed ${processedCount} controls`);
    
    // Run acceptance checks
    console.log('🧪 Running acceptance checks...');
    
    const countResult = await sql`SELECT COUNT(*) as total FROM iso27001_controls`;
    const totalCount = parseInt(countResult[0].total);
    console.log(`📊 Total controls: ${totalCount}`);
    
    if (totalCount !== 93) {
      throw new Error(`Expected 93 controls, but found ${totalCount}`);
    }
    
    const a51Result = await sql`
      SELECT control_id, title, category, control_type 
      FROM iso27001_controls 
      WHERE control_id = 'A.5.1'
    `;
    
    if (a51Result.length === 0) {
      throw new Error('A.5.1 control not found');
    }
    
    const a51 = a51Result[0];
    if (a51.title !== 'policies for information security') {
      throw new Error(`A.5.1 title incorrect: expected 'policies for information security', got '${a51.title}'`);
    }
    
    if (a51.category !== 'organizational control') {
      throw new Error(`A.5.1 category incorrect: expected 'organizational control', got '${a51.category}'`);
    }
    
    if (!a51.control_type.includes('preventive')) {
      throw new Error(`A.5.1 control_type should contain 'preventive', got: ${JSON.stringify(a51.control_type)}`);
    }
    
    const duplicatesResult = await sql`
      SELECT control_id, COUNT(*) as count 
      FROM iso27001_controls 
      GROUP BY control_id 
      HAVING COUNT(*) > 1
    `;
    
    if (duplicatesResult.length > 0) {
      throw new Error(`Found duplicate control_id values: ${duplicatesResult.map(r => r.control_id).join(', ')}`);
    }
    
    console.log('✅ All acceptance checks passed!');
    console.log(`✅ A.5.1 exists: title="${a51.title}", category="${a51.category}", control_type=${JSON.stringify(a51.control_type)}`);
    console.log('✅ No duplicate control_id values found');
    console.log('🎉 ISO 27001 controls ingestion completed successfully!');
    
  } catch (error) {
    console.error('❌ Error during ingestion:', error);
    process.exit(1);
  }
}

main();