import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

// Debug environment and connection
console.log(`API called at ${new Date().toISOString()}`);
console.log(`DATABASE URL: ${process.env.NEON_DATABASE_URL?.slice(0, 50)}...`);
console.log(`NODE_ENV: ${process.env.NODE_ENV}`);

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const frameworkId = parseInt(params.id);
    
    if (isNaN(frameworkId)) {
      return NextResponse.json(
        { error: 'Invalid framework ID' },
        { status: 400 }
      );
    }

    // Get framework details
    const frameworkResult = await sql`
      SELECT * FROM frameworks WHERE id = ${frameworkId}
    `;

    if (frameworkResult.length === 0) {
      return NextResponse.json(
        { error: 'Framework not found' },
        { status: 404 }
      );
    }

    const framework = frameworkResult[0];
    let controlsResult;
    
    // Use dedicated table for ISO 27001, standard controls table for others
    if (framework.name === 'iso_27001_2022') {
      controlsResult = await sql`
        SELECT * FROM iso27001_controls 
        ORDER BY control_id
      `;
    } else {
      controlsResult = await sql`
        SELECT * FROM controls 
        WHERE framework_id = ${frameworkId}
        ORDER BY control_id
      `;
    }

    // Debug logging
    console.log(`DEBUG: Framework ${frameworkId} has ${controlsResult.length} controls`);
    if (controlsResult.length > 0) {
      console.log(`DEBUG: First control: ${controlsResult[0].control_id} - ${controlsResult[0].title}`);
      console.log(`DEBUG: Last control: ${controlsResult[controlsResult.length - 1].control_id} - ${controlsResult[controlsResult.length - 1].title}`);
      console.log(`DEBUG: First control ID: ${controlsResult[0].id}, Created: ${controlsResult[0].created_at}`);
      console.log(`DEBUG: Last control ID: ${controlsResult[controlsResult.length - 1].id}, Created: ${controlsResult[controlsResult.length - 1].created_at}`);
      
      // Check for both types of controls
      const frameworkCount = controlsResult.filter(c => c.control_id.startsWith('FRAMEWORK_')).length;
      const annexCount = controlsResult.filter(c => c.control_id.match(/^A\.\d+\.\d+/)).length;
      console.log(`DEBUG: FRAMEWORK_* controls: ${frameworkCount}, A.*.* controls: ${annexCount}`);
      
      if (frameworkCount > 0 && annexCount > 0) {
        console.log('DEBUG: ⚠️  BOTH TYPES FOUND! ORDER BY control_id returns FRAMEWORK_* first!');
        
        // Show the exact IDs to understand the data
        const first5 = controlsResult.slice(0, 5).map(c => `ID:${c.id} ${c.control_id}`);
        const last5 = controlsResult.slice(-5).map(c => `ID:${c.id} ${c.control_id}`);
        console.log(`DEBUG: First 5: ${first5.join(', ')}`);
        console.log(`DEBUG: Last 5: ${last5.join(', ')}`);
      }
    }

    return NextResponse.json({
      success: true,
      framework: frameworkResult[0],
      controls: controlsResult
    });
  } catch (error) {
    console.error('Get framework details error:', error);
    return NextResponse.json(
      { error: 'Failed to get framework details' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const frameworkId = parseInt(params.id);
    
    if (isNaN(frameworkId)) {
      return NextResponse.json(
        { error: 'Invalid framework ID' },
        { status: 400 }
      );
    }

    const { name, description, version, controls } = await request.json();

    if (!name || !controls || !Array.isArray(controls)) {
      return NextResponse.json(
        { error: 'Name and controls array are required' },
        { status: 400 }
      );
    }

    // Get framework details to determine which table to use
    const frameworkResult = await sql`
      SELECT * FROM frameworks WHERE id = ${frameworkId}
    `;
    
    if (frameworkResult.length === 0) {
      return NextResponse.json(
        { error: 'Framework not found' },
        { status: 404 }
      );
    }

    const framework = frameworkResult[0];

    // Update framework metadata
    await sql`
      UPDATE frameworks 
      SET name = ${name}, description = ${description || ''}, version = ${version || '1.0'}
      WHERE id = ${frameworkId}
    `;

    // Handle updates based on framework type
    if (framework.name === 'iso_27001_2022') {
      // For ISO 27001, update the dedicated iso27001_controls table
      // Delete existing controls
      await sql`DELETE FROM iso27001_controls`;

      // Insert updated controls with proper ISO schema
      for (const control of controls) {
        await sql`
          INSERT INTO iso27001_controls (
            control_id, title, requirement_text, system_level, category,
            subcategory, control_type, op_capabilities, references_text, 
            dti, dtc, subcontrols_count, updated_at
          ) VALUES (
            ${control.id || control.control_id}, 
            ${control.title}, 
            ${control.requirement_text || control.description || ''}, 
            ${control.system_level || false}, 
            ${control.category || 'organizational control'},
            ${control.subcategory || control.category || 'organizational control'}, 
            ${control.control_type || ['preventive']},
            ${control.op_capabilities || ['governance']}, 
            ${control.references_text || ''}, 
            ${control.dti || 'medium'}, 
            ${control.dtc || 'medium'}, 
            ${control.subcontrols_count || 0},
            CURRENT_TIMESTAMP
          )
        `;
      }
    } else {
      // For other frameworks, use the standard controls table
      // Delete existing controls
      await sql`DELETE FROM controls WHERE framework_id = ${frameworkId}`;

      // Insert updated controls
      for (const control of controls) {
        await sql`
          INSERT INTO controls (
            framework_id, control_id, title, description, category,
            requirement_text, system_level, subcategory, control_type, 
            op_capabilities, references_text, dti, dtc, subcontrols_count,
            updated_at
          ) VALUES (
            ${frameworkId}, ${control.id}, ${control.title}, ${control.description || control.requirement_text || ''}, ${control.category || ''},
            ${control.requirement_text || control.description || ''}, 
            ${control.system_level || false}, 
            ${control.subcategory || control.category || ''}, 
            ${control.control_type || []},
            ${control.op_capabilities || []}, 
            ${control.references_text || ''}, 
            ${control.dti || ''}, 
            ${control.dtc || ''}, 
            ${control.subcontrols_count || 0},
            CURRENT_TIMESTAMP
          )
        `;
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Framework updated successfully'
    });
  } catch (error) {
    console.error('Update framework error:', error);
    return NextResponse.json(
      { error: 'Failed to update framework' },
      { status: 500 }
    );
  }
}