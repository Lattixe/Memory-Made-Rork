# Backend Connection Troubleshooting

## Error: "Cannot connect to backend server"

If you're seeing errors like:
- `[trpc] ❌ Fetch error: TypeError: Failed to fetch`
- `Cannot connect to backend server`
- `GPT Image 1 Mini API error: Cannot connect to backend server`

This means the backend server is not running or not accessible.

## Solution

### 1. Make sure you're running the development server correctly

The backend server needs to be started with the Rork CLI. Run:

```bash
bun start
```

Or if you're using npm:

```bash
npm start
```

**Important:** Do NOT use `expo start` or `npx expo start`. You must use `bun start` or `npm start` which runs the Rork development server that includes the backend.

### 2. Check your environment variables

Make sure `EXPO_PUBLIC_RORK_API_BASE_URL` is set correctly. This should be automatically configured by the Rork CLI when you run `bun start`.

You can verify this in your console logs - look for:
```
[trpc] Using EXPO_PUBLIC_RORK_API_BASE_URL: https://...
```

### 3. Verify the backend is running

Once the server is started, you should see backend logs like:
```
[backend] Request: GET /api/
[backend] Response status: 200
```

### 4. Test the backend connection

The app includes a diagnostics tool. Navigate to the Admin Settings page (gear icon) to see backend connection status.

## Why This Happens

The OpenAI API key (`OPENAI_API_KEY`) is stored server-side for security. The app makes requests to your backend, which then calls the OpenAI API. If the backend isn't running, these requests fail.

## Architecture

```
Mobile App → tRPC Client → Backend Server → OpenAI API
                ↑
         (needs to be running)
```

The backend server:
- Keeps your API keys secure (server-side only)
- Handles OpenAI API calls
- Manages authentication
- Processes image generation requests

## Still Having Issues?

1. Restart the development server completely
2. Clear your terminal and run `bun start` again
3. Check that port 8081 (or your configured port) is not blocked
4. Verify your network connection is stable
5. Check the console for any error messages during server startup
