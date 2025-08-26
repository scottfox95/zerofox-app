# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ZeroFox Compliance is a compliance document analysis platform that is currently in the planning/design phase. The main codebase has not yet been implemented.

## Current State

This repository contains only project documentation and planning materials:
- `DevelopementBrief/complete_mvp_development_brief.md` - Complete MVP development specification

## Planned Architecture

Based on the development brief, the planned system will be:
- **Frontend**: Next.js 14 with TypeScript and Tailwind CSS
- **Backend**: Next.js API routes with custom JWT authentication
- **Database**: NeonDB (PostgreSQL)
- **AI Integration**: Multi-model support (Claude, Gemini, OpenAI)
- **File Processing**: Support for PDF, DOCX, XLSX, TXT, MD

## Core Components (To Be Implemented)

1. **Admin Panel**: AI model management, framework standardization
2. **Document Processing**: Batch upload with text extraction and chunking
3. **Evidence Analysis**: AI-powered compliance mapping with attribution
4. **Custom Framework Builder**: Mix standard and custom compliance controls
5. **Results Interface**: Evidence viewer with confidence scoring

## Database Schema (Planned)

Essential tables:
- `users`, `organizations`, `user_organizations`
- `frameworks`, `controls`, `custom_frameworks`, `custom_framework_controls`
- `documents`, `text_chunks`
- `analyses`, `evidence_mappings`, `evidence_items`
- `ai_models`, `ai_prompts`

## Development Commands

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run lint` - Run ESLint
- `npm run test` - Run tests

## Database Access Patterns

**IMPORTANT**: When accessing the NeonDB database for this project:

❌ **DO NOT USE**: `@neondatabase/cli` package - it's not available in npm registry
```bash
# This will fail:
npx @neondatabase/cli sql "SELECT ..."
```

✅ **USE INSTEAD**: API endpoints through the running Next.js server
```bash
# Query frameworks:
curl -X GET "http://localhost:3000/api/admin/frameworks"

# Query specific framework with controls:
curl -X GET "http://localhost:3000/api/admin/frameworks/1"

# Use jq to parse JSON responses:
curl -X GET "http://localhost:3000/api/admin/frameworks/1" | jq '.controls[0:3]'
```

**Database Schema Notes**:
- The project uses standard `controls` table, not separate framework-specific tables
- ISO 27001 controls use FRAMEWORK_001 prefix in their IDs
- All database queries should go through the API endpoints, not direct database access

## Key Features

- Multi-AI model switching for different processing tasks
- Document processing with full transparency and source attribution
- Cross-document evidence aggregation
- Custom compliance framework creation
- Evidence-to-control mapping with confidence scoring