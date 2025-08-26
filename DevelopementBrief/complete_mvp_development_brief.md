# ZeroFox Compliance - Essential MVP Development Brief
**Single Phase: Core Features Only**

## 🎯 MVP Objectives (Essential Only)
Build the core compliance document analysis platform:
- **Admin Panel:** Framework management, AI model control, processing transparency
- **Framework Standardization:** Convert your 6 frameworks to unified schema
- **Multi-Model AI:** Claude, Gemini, OpenAI switching
- **Document Processing:** Batch upload with evidence attribution
- **Custom Framework Builder:** Users mix standard + custom controls
- **Basic Results View:** Evidence mapping with source attribution

## 🚫 **Explicitly OUT OF SCOPE (for now):**
- Professional reporting/exports
- Project management features
- Advanced analytics
- Collaboration features
- Performance optimization
- Enterprise features

---

# 🚀 Essential Implementation Tasks

## **TASK 1: Project Foundation**

### **Task 1.1: Project Setup**
- Initialize Next.js 14 with TypeScript and Tailwind
- Install required dependencies only
- Set up basic (admin) and (app) route structure
- Configure environment variables

### **Task 1.2: Database & Auth**
- Connect NeonDB with essential tables only
- Custom JWT authentication (login/register)
- Basic role-based access (admin vs user)
- Admin route protection

---

## **TASK 2: Admin Panel Core**

### **Task 2.1: AI Model Management**
- Setup Claude, Gemini, OpenAI clients
- Admin interface to switch between models
- Basic model testing ("hello world" test)
- Model selection for different tasks

### **Task 2.2: Framework Management**
- Framework standardization interface
- AI-powered conversion of your 6 JSON files
- Review/approve standardized frameworks
- Load approved frameworks into database

---

## **TASK 3: Document Processing**

### **Task 3.1: File Upload**
- Drag-and-drop batch upload
- Support PDF, DOCX, XLSX, TXT, MD
- Basic file validation
- Upload progress tracking

### **Task 3.2: Processing Pipeline**
- Extract text from all file types
- Sentence-level chunking with source attribution
- Store chunks with document/page/paragraph references
- Processing status dashboard (your transparency tool)

---

## **TASK 4: Evidence Analysis**

### **Task 4.1: Evidence Mapping**
- AI analysis of chunks against framework controls
- Cross-document evidence aggregation
- Confidence scoring with explanations
- Evidence source attribution (doc/page/paragraph)

### **Task 4.2: Gap Analysis**
- Identify missing/partial controls
- Flag low confidence mappings with red warnings
- Basic gap summary

---

## **TASK 5: Custom Framework Builder**

### **Task 5.1: Framework Builder Interface**
- Step-by-step framework creation
- Select controls from standardized frameworks
- Add custom controls using simple template
- Save custom frameworks

### **Task 5.2: Custom Framework Analysis**
- Run analysis against custom frameworks
- Evidence mapping for mixed standard/custom controls

---

## **TASK 6: Basic Results Interface**

### **Task 6.1: Evidence Viewer**
- Show evidence mapped to each control
- Display source attribution (document, page, paragraph)
- Confidence indicators with explanations
- Basic compliance status (compliant/partial/missing)

### **Task 6.2: Simple Gap View**
- List missing controls
- Show low-confidence mappings with warnings
- Basic recommendations for missing evidence

---

## 📊 Essential Database Tables
```sql
-- Core only:
users, organizations, user_organizations
frameworks, controls, custom_frameworks, custom_framework_controls  
documents, text_chunks
analyses, evidence_mappings, evidence_items
ai_models, ai_prompts
```

## 🎯 Success Criteria (Essential Only)
- [ ] **Admin can manage frameworks** without touching code
- [ ] **AI models switch** easily between Claude/Gemini/OpenAI
- [ ] **Documents process** with full transparency showing what was extracted
- [ ] **Evidence attribution** shows exactly where evidence was found
- [ ] **Custom frameworks** can be built mixing standard + custom controls
- [ ] **Results show** evidence-to-control mapping with confidence scores
- [ ] **Low confidence** mappings clearly flagged with explanations
- [ ] **Cross-document evidence** works across multiple uploaded documents

## 🤔 Essential Questions Only
1. **Framework Files:** "Provide paths to your 6 compliance framework JSON files"
2. **Admin Email:** "What email for super admin account?"
3. **Default AI Model:** "Which AI model as default?"

**This stripped-down brief focuses ONLY on the core features you need working first.**