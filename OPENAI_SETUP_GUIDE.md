# OpenAI API Setup Guide for Rork Environment

## Current Issue
You're getting "Failed to fetch" errors when trying to use the OpenAI gpt-image-1-mini API through your backend.

## Root Cause
The `OPENAI_API_KEY` environment variable is not accessible to your backend server running in the Rork environment.

## Solution Steps

### 1. Set Environment Variable in Rork Platform

Since you're running in the Rork environment (not locally), you need to set the environment variable on the **server side** through the Rork platform:

1. Go to your Rork project settings
2. Find the "Environment Variables" section
3. Add a new environment variable:
   - **Name**: `OPENAI_API_KEY`
   - **Value**: Your OpenAI API key (starts with `sk-proj-...`)
   - **Type**: Server-side (NOT client-side)

### 2. Verify the Setup

After setting the environment variable, restart your development server and run the diagnostics:

1. Navigate to the Admin page in your app
2. Scroll down to "Backend Diagnostics"
3. Click "Run Diagnostics Again"
4. Check the results:
   - ✅ "OpenAI Config" should show: `status: "configured"`
   - ✅ "Health Check" should show: `OPENAI_API_KEY: 'configured'`

### 3. Test the API

Once the diagnostics pass, try generating or editing a sticker:

1. Go to the Edit screen
2. Enter a prompt (e.g., "make it watercolor style")
3. Click "Apply Edit"
4. The API should now work correctly

## Current API Configuration

Your OpenAI API calls are correctly configured with:

```typescript
{
  model: 'gpt-image-1-mini',
  size: '1024x1024',
  background: 'transparent',
  content_moderation: 'low',    // ✅ Set as requested
  quality: 'medium',             // ✅ Set as requested
  output_format: 'png',
  timeout: 120000
}
```

## Architecture Overview

```
Frontend (React Native)
    ↓
tRPC Client (lib/trpc.ts)
    ↓
Backend Server (backend/hono.ts)
    ↓
OpenAI API (uses OPENAI_API_KEY from server env)
```

**Important**: The API key is only accessible on the server side, never exposed to the client. This is the correct security pattern.

## Troubleshooting

### If diagnostics still fail after setting the environment variable:

1. **Restart the development server**
   - The server needs to restart to pick up new environment variables
   - In Rork, this might happen automatically, or you may need to trigger a rebuild

2. **Check the server logs**
   - Look for `[backend] OpenAI API key check:` in the logs
   - It should show: `Key present (sk-proj-...)`

3. **Verify the base URL**
   - Current: `https://dev-m7gyp7dzka89rw149zpa5.rorktest.dev`
   - This should be automatically set by Rork

4. **Test with a simple health check**
   ```bash
   curl https://dev-m7gyp7dzka89rw149zpa5.rorktest.dev/api/test-openai
   ```
   Should return:
   ```json
   {
     "status": "configured",
     "message": "OpenAI API key is configured",
     "keyPrefix": "sk-proj-"
   }
   ```

## Common Errors and Solutions

### Error: "Failed to fetch"
- **Cause**: Backend server is not running or not accessible
- **Solution**: Ensure the Rork development server is running

### Error: "OpenAI API key not configured on server"
- **Cause**: Environment variable not set or not accessible
- **Solution**: Set `OPENAI_API_KEY` in Rork project settings (server-side)

### Error: "Cannot connect to backend server"
- **Cause**: Network connectivity issue or incorrect base URL
- **Solution**: Check `EXPO_PUBLIC_RORK_API_BASE_URL` is correct

### Error: "Request timeout"
- **Cause**: OpenAI API is taking too long to respond
- **Solution**: This is normal for image generation, timeout is set to 120 seconds

## API Documentation Reference

OpenAI Image Generation API:
https://platform.openai.com/docs/guides/image-generation?image-generation-model=gpt-image-1&api=image

Supported parameters:
- `model`: 'gpt-image-1-mini' or 'gpt-image-1'
- `content_moderation`: 'low', 'medium', 'high' (default: 'low')
- `quality`: 'low', 'medium', 'high' (default: 'medium')
- `background`: 'transparent', 'opaque', 'auto'
- `output_format`: 'png', 'webp'
- `size`: '1024x1024', '1024x1792', '1792x1024'

## Next Steps

1. Set the `OPENAI_API_KEY` environment variable in Rork
2. Restart the development server
3. Run diagnostics to verify
4. Test image generation/editing

If you continue to have issues after following these steps, please share:
1. The diagnostic results from the Admin page
2. Any error messages from the console
3. The server logs if accessible
