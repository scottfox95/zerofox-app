# Troubleshooting Guide

## AI Model Integration Issues

### Google Gemini API Model Names (Dec 2024)

**Issue**: Google AI models returning "Model not found" or 404 errors

**Root Cause**: Google frequently updates their model names and deprecates old ones without clear migration notices.

**Symptoms**:
- `[404 Not Found] models/gemini-pro is not found for API version v1beta`
- `models/gemini-1.5-flash is not found`
- `Error: Model not found` in AI service

**Troubleshooting Steps**:
1. **Check Latest Documentation**: Always verify current model names at https://ai.google.dev/gemini-api/docs/quickstart
2. **Use WebFetch Tool**: Fetch the latest docs to get current model IDs
3. **Test with Official Examples**: Use model names exactly as shown in Google's quickstart
4. **Common Model Evolution**:
   - `gemini-pro` → **DEPRECATED** 
   - `gemini-1.5-pro-latest` → **DEPRECATED**
   - `gemini-1.5-flash` → **DEPRECATED** 
   - `gemini-2.5-flash` → **CURRENT** (as of Dec 2024)

**Solution**:
```typescript
// Update in src/lib/ai.ts
{
  id: 'gemini-flash',
  name: 'Gemini 2.5 Flash', 
  provider: 'google',
  model_id: 'gemini-2.5-flash', // ← Always check latest docs
  description: 'Google\'s latest fast and efficient model',
  isActive: true
}
```

**Prevention**:
- Monitor Google AI changelog/release notes
- Implement model listing API call to validate available models
- Add fallback logic for deprecated models
- Consider using model aliases that can be updated centrally

**Test Command**:
```bash
# Test directly via API to verify model name
curl -H "Content-Type: application/json" \
     -d '{"contents":[{"parts":[{"text":"Hello"}]}]}' \
     -H "x-goog-api-key: YOUR_KEY" \
     https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent
```

---

## Environment Variable Issues

### API Key Detection in Next.js

**Issue**: Environment status showing red dots despite configured API keys

**Root Cause**: Client-side code cannot access server-side environment variables (security feature)

**Solution**: Use API endpoints to check configuration status server-side and return status to client.

**Implementation**:
```typescript
// In API route
const apiKeyStatus = {
  anthropic: !!process.env.ANTHROPIC_API_KEY,
  openai: !!process.env.OPENAI_API_KEY, 
  google: !!process.env.GOOGLE_AI_API_KEY
};
```

---

## JWT Authentication in Edge Runtime

### Middleware Token Verification

**Issue**: `The edge runtime does not support Node.js 'crypto' module`

**Root Cause**: Next.js middleware runs in Edge Runtime which doesn't support Node.js crypto module needed by `jsonwebtoken`

**Solution**: Use basic JWT payload parsing for client-side checks, full verification in API routes

**Implementation**:
```typescript
// Edge-compatible token parsing
const payload = JSON.parse(atob(token.split('.')[1]));
```

---

*Last Updated: December 2024*