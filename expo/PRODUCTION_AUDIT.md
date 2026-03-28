# Production Readiness Audit & Recommendations

**Date:** 2025-09-30  
**Target Scale:** 10,000 concurrent users  
**Platform:** React Native (Expo) with Backend

---

## Executive Summary

Your sticker creation app has a solid foundation but requires critical improvements before production deployment and App Store submission. Below are prioritized issues categorized by severity.

---

## 🔴 CRITICAL ISSUES (Must Fix Before Launch)

### 1. **In-Memory User Storage (Data Loss Risk)**
**Location:** `backend/trpc/routes/auth/store.ts`

**Problem:**
```typescript
const users: StoredUser[] = []; // In-memory array - data lost on restart
```

**Impact:**
- All user accounts lost when server restarts
- Cannot scale beyond single server instance
- No data persistence
- Violates user expectations for account permanence

**Solution:**
```typescript
// Use a real database:
// - PostgreSQL with Prisma ORM
// - MongoDB with Mongoose
// - Supabase (PostgreSQL + Auth)
// - Firebase Firestore

// Example with Prisma:
// 1. Install: bun add prisma @prisma/client
// 2. Initialize: bunx prisma init
// 3. Define schema in prisma/schema.prisma
// 4. Migrate: bunx prisma migrate dev
```

**Recommendation:** Use **Supabase** (free tier supports 10k+ users) or **PostgreSQL on Railway/Render**.

---

### 2. **Weak JWT Secret in Production**
**Location:** `backend/trpc/routes/auth/login.ts`, `signup.ts`

**Problem:**
```typescript
const secret = process.env.JWT_SECRET ?? "dev_secret_change_me";
```

**Impact:**
- Anyone can forge authentication tokens
- Complete security breach
- User accounts can be hijacked

**Solution:**
```bash
# Generate strong secret:
openssl rand -base64 64

# Set in environment:
export JWT_SECRET="your-generated-secret-here"
```

**Action Required:**
1. Generate cryptographically secure secret
2. Store in environment variables (never in code)
3. Fail startup if JWT_SECRET not set in production
4. Rotate secret periodically

---

### 3. **No Rate Limiting (DDoS Vulnerability)**
**Location:** Backend API endpoints

**Problem:**
- No protection against brute force attacks
- No request throttling
- Vulnerable to credential stuffing
- AI API abuse (expensive)

**Impact at 10k users:**
- Server overload from malicious actors
- High AI API costs from abuse
- Legitimate users locked out

**Solution:**
```typescript
// Install: bun add @hono/rate-limiter
import { rateLimiter } from '@hono/rate-limiter';

app.use('/api/trpc/auth.*', rateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per window
  message: 'Too many attempts, please try again later'
}));

app.use('/api/*', rateLimiter({
  windowMs: 60 * 1000,
  max: 100 // 100 requests per minute per IP
}));
```

---

### 4. **No Database for Stickers (Data Loss)**
**Location:** `contexts/UserContext.tsx`

**Problem:**
- Stickers only stored in AsyncStorage (local device)
- No cloud backup
- Lost when app uninstalled
- Cannot sync across devices

**Impact:**
- Users lose all work when switching devices
- No way to recover deleted stickers
- Poor user experience

**Solution:**
Create backend endpoints for sticker CRUD:
```typescript
// backend/trpc/routes/stickers/create.ts
export const createStickerProcedure = protectedProcedure
  .input(z.object({
    originalImage: z.string(),
    stickerImage: z.string(),
    title: z.string().optional()
  }))
  .mutation(async ({ input, ctx }) => {
    // Store in database with ctx.user.id
    return await db.sticker.create({
      data: {
        userId: ctx.user.id,
        ...input
      }
    });
  });
```

---

### 5. **Missing Error Boundaries**
**Location:** App-wide

**Problem:**
- No error boundaries in `_layout.tsx`
- App crashes completely on errors
- No error reporting

**Solution:**
```typescript
// components/ErrorBoundary.tsx
import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
    // Send to error tracking service (Sentry, Bugsnag)
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text>Something went wrong</Text>
          <TouchableOpacity onPress={() => this.setState({ hasError: false })}>
            <Text>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

// Wrap in _layout.tsx:
<ErrorBoundary>
  <RootLayoutNav />
</ErrorBoundary>
```

---

### 6. **No Input Validation on Backend**
**Location:** All tRPC procedures

**Problem:**
- Zod validation exists but incomplete
- No sanitization of user inputs
- SQL injection risk (when DB added)
- XSS vulnerabilities

**Solution:**
```typescript
// Enhance validation:
const SignupInput = z.object({
  email: z.string().email().max(255),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(128)
    .regex(/[A-Z]/, 'Must contain uppercase')
    .regex(/[a-z]/, 'Must contain lowercase')
    .regex(/[0-9]/, 'Must contain number'),
  name: z.string().max(100).optional()
});

// Sanitize inputs:
import DOMPurify from 'isomorphic-dompurify';
const sanitizedName = DOMPurify.sanitize(input.name);
```

---

## 🟡 HIGH PRIORITY (Fix Before Scaling)

### 7. **No Monitoring/Observability**

**Missing:**
- Error tracking (Sentry, Bugsnag)
- Performance monitoring (New Relic, Datadog)
- User analytics (Mixpanel, Amplitude)
- Server health checks
- API response time tracking

**Solution:**
```bash
# Install Sentry
bun add @sentry/react-native @sentry/node

# Initialize in _layout.tsx and backend/hono.ts
import * as Sentry from '@sentry/react-native';

Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 1.0,
});
```

---

### 8. **Image Storage Not Scalable**

**Problem:**
- Base64 images stored in database (huge)
- No CDN for image delivery
- Slow load times at scale
- High bandwidth costs

**Solution:**
```typescript
// Use cloud storage:
// - AWS S3 + CloudFront
// - Cloudinary (image optimization included)
// - Supabase Storage
// - Vercel Blob

// Example with Supabase Storage:
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(url, key);

async function uploadSticker(base64: string, userId: string) {
  const buffer = Buffer.from(base64, 'base64');
  const fileName = `${userId}/${Date.now()}.png`;
  
  const { data, error } = await supabase.storage
    .from('stickers')
    .upload(fileName, buffer, {
      contentType: 'image/png',
      cacheControl: '3600'
    });
    
  return data?.path; // Store path in DB, not base64
}
```

---

### 9. **No Caching Strategy**

**Problem:**
- Every request hits backend
- No Redis/Memcached
- Repeated AI processing
- High latency

**Solution:**
```typescript
// Install Redis:
// bun add ioredis

import Redis from 'ioredis';
const redis = new Redis(process.env.REDIS_URL);

// Cache user data:
const cachedUser = await redis.get(`user:${userId}`);
if (cachedUser) return JSON.parse(cachedUser);

// Cache with TTL:
await redis.setex(`user:${userId}`, 3600, JSON.stringify(user));

// Cache AI results:
const cacheKey = `sticker:${imageHash}`;
const cached = await redis.get(cacheKey);
if (cached) return cached;
```

---

### 10. **No API Versioning**

**Problem:**
- Breaking changes will break old app versions
- No migration path
- Users forced to update immediately

**Solution:**
```typescript
// backend/hono.ts
app.use('/api/v1/trpc/*', trpcServer({ ... }));
app.use('/api/v2/trpc/*', trpcServerV2({ ... }));

// Support multiple versions simultaneously
```

---

### 11. **Missing Security Headers**

**Problem:**
- No CORS configuration for production
- Missing security headers
- Vulnerable to common attacks

**Solution:**
```typescript
// backend/hono.ts
import { secureHeaders } from 'hono/secure-headers';

app.use('*', secureHeaders({
  contentSecurityPolicy: {
    defaultSrc: ["'self'"],
    imgSrc: ["'self'", 'data:', 'https:'],
  },
  xFrameOptions: 'DENY',
  xContentTypeOptions: 'nosniff',
  referrerPolicy: 'strict-origin-when-cross-origin',
}));

// CORS for production:
app.use('*', cors({
  origin: [
    'https://yourdomain.com',
    'exp://your-expo-app'
  ],
  credentials: true,
}));
```

---

## 🟢 MEDIUM PRIORITY (Improve UX/Performance)

### 12. **Optimize React Query Configuration**

**Current:**
```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
    },
  },
});
```

**Improved:**
```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error: any) => {
        // Don't retry on 4xx errors
        if (error?.status >= 400 && error?.status < 500) return false;
        return failureCount < 3;
      },
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      networkMode: 'offlineFirst', // Better offline support
    },
    mutations: {
      retry: 1,
      networkMode: 'offlineFirst',
    },
  },
});
```

---

### 13. **Add Offline Support**

**Solution:**
```typescript
// Install: bun add @tanstack/react-query-persist-client
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import AsyncStorage from '@react-native-async-storage/async-storage';

const persister = createAsyncStoragePersister({
  storage: AsyncStorage,
});

// Wrap app:
<PersistQueryClientProvider
  client={queryClient}
  persistOptions={{ persister }}
>
  {/* app */}
</PersistQueryClientProvider>
```

---

### 14. **Implement Proper Loading States**

**Problem:**
- Generic loading indicators
- No skeleton screens
- Poor perceived performance

**Solution:**
```typescript
// components/StickerSkeleton.tsx
export const StickerSkeleton = () => (
  <View style={styles.skeleton}>
    <View style={styles.skeletonImage} />
    <View style={styles.skeletonText} />
  </View>
);

// Use in lists:
{isLoading ? (
  <StickerSkeleton />
) : (
  <StickerGallery stickers={stickers} />
)}
```

---

### 15. **Add Pagination for Stickers**

**Problem:**
- Loading all stickers at once
- Memory issues with 100+ stickers
- Slow initial load

**Solution:**
```typescript
// backend/trpc/routes/stickers/list.ts
export const listStickersProcedure = protectedProcedure
  .input(z.object({
    cursor: z.string().optional(),
    limit: z.number().min(1).max(100).default(20)
  }))
  .query(async ({ input, ctx }) => {
    const stickers = await db.sticker.findMany({
      where: { userId: ctx.user.id },
      take: input.limit + 1,
      cursor: input.cursor ? { id: input.cursor } : undefined,
      orderBy: { createdAt: 'desc' }
    });
    
    let nextCursor: string | undefined;
    if (stickers.length > input.limit) {
      const nextItem = stickers.pop();
      nextCursor = nextItem!.id;
    }
    
    return { stickers, nextCursor };
  });

// Frontend with infinite scroll:
const { data, fetchNextPage, hasNextPage } = trpc.stickers.list.useInfiniteQuery(
  { limit: 20 },
  {
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  }
);
```

---

## 📱 APP STORE PREPARATION

### 16. **Update app.json for Production**

**Required Changes:**
```json
{
  "expo": {
    "name": "MemoryMade - Custom Stickers",
    "slug": "memorymade-stickers",
    "version": "1.0.0",
    "privacy": "public",
    "description": "Turn your photos into custom kiss-cut stickers",
    "githubUrl": "https://github.com/yourusername/memorymade",
    
    "ios": {
      "bundleIdentifier": "com.memorymade.stickers",
      "buildNumber": "1",
      "supportsTablet": true,
      "config": {
        "usesNonExemptEncryption": false
      },
      "infoPlist": {
        "NSPhotoLibraryUsageDescription": "We need access to your photos to create custom stickers from your memories.",
        "NSCameraUsageDescription": "Take photos to instantly turn them into stickers.",
        "NSPhotoLibraryAddUsageDescription": "Save your custom stickers to your photo library."
      }
    },
    
    "android": {
      "package": "com.memorymade.stickers",
      "versionCode": 1,
      "adaptiveIcon": {
        "foregroundImage": "./assets/images/adaptive-icon.png",
        "backgroundColor": "#ffffff"
      },
      "permissions": [
        "CAMERA",
        "READ_MEDIA_IMAGES",
        "WRITE_EXTERNAL_STORAGE",
        "INTERNET"
      ]
    },
    
    "extra": {
      "eas": {
        "projectId": "your-eas-project-id"
      }
    }
  }
}
```

---

### 17. **Create Privacy Policy & Terms**

**Required for App Store:**
- Privacy Policy URL
- Terms of Service URL
- Data collection disclosure
- Third-party services disclosure

**Template:**
```markdown
# Privacy Policy

## Data We Collect
- Email address (for account creation)
- Photos you upload (stored securely)
- Order information (for fulfillment)

## Third-Party Services
- Printful (order fulfillment)
- Stripe (payment processing)
- AI image processing (Gemini API)

## Data Retention
- Account data: Until account deletion
- Photos: Until you delete them
- Orders: 7 years (legal requirement)

## Your Rights
- Access your data
- Delete your account
- Export your data
```

---

### 18. **Add App Store Assets**

**Required:**
- App icon (1024x1024)
- Screenshots (multiple sizes)
- App preview video (optional but recommended)
- App description
- Keywords
- Support URL
- Marketing URL

---

## 🔧 INFRASTRUCTURE RECOMMENDATIONS

### 19. **Deployment Architecture**

**Recommended Stack:**
```
Frontend (Mobile App):
- Expo EAS Build & Submit
- OTA Updates via Expo Updates

Backend:
- Railway.app or Render.com (Node.js hosting)
- PostgreSQL database (included)
- Redis (Railway addon)

Storage:
- Supabase Storage or Cloudinary

Monitoring:
- Sentry (errors)
- Mixpanel (analytics)

CI/CD:
- GitHub Actions
```

**Estimated Costs (10k users):**
- Railway Pro: $20/month
- Supabase Pro: $25/month
- Sentry: $26/month
- Cloudinary: $89/month
- **Total: ~$160/month**

---

### 20. **Environment Variables Setup**

**Create `.env.production`:**
```bash
# Database
DATABASE_URL=postgresql://user:pass@host:5432/db

# Auth
JWT_SECRET=your-super-secret-key-here

# Redis
REDIS_URL=redis://host:6379

# Storage
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_KEY=your-key

# Monitoring
SENTRY_DSN=https://xxx@sentry.io/xxx

# APIs
PRINTFUL_API_KEY=your-key
STRIPE_SECRET_KEY=sk_live_xxx

# App
NODE_ENV=production
EXPO_PUBLIC_API_URL=https://api.yourdomain.com
```

---

## 🧪 TESTING REQUIREMENTS

### 21. **Add Tests**

**Critical Tests Needed:**
```typescript
// __tests__/auth.test.ts
describe('Authentication', () => {
  it('should create user account', async () => {
    const result = await trpcClient.auth.signup.mutate({
      email: 'test@example.com',
      password: 'Test123!',
      name: 'Test User'
    });
    expect(result.token).toBeDefined();
  });
  
  it('should reject weak passwords', async () => {
    await expect(
      trpcClient.auth.signup.mutate({
        email: 'test@example.com',
        password: '123',
      })
    ).rejects.toThrow();
  });
});

// __tests__/stickers.test.ts
describe('Sticker Creation', () => {
  it('should process image and create sticker', async () => {
    // Test sticker generation
  });
  
  it('should handle large images', async () => {
    // Test with 10MB image
  });
});
```

**Install:**
```bash
bun add -d @testing-library/react-native jest
```

---

## 📊 PERFORMANCE BENCHMARKS

### Target Metrics for 10k Users:

| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| API Response Time (p95) | <200ms | Unknown | ❌ Not measured |
| Image Upload Time | <3s | ~5-10s | ⚠️ Needs optimization |
| App Launch Time | <2s | Unknown | ❌ Not measured |
| Crash-Free Rate | >99.5% | Unknown | ❌ No tracking |
| Database Query Time | <50ms | N/A | ❌ No database |
| Memory Usage | <150MB | Unknown | ❌ Not profiled |

---

## 🚀 LAUNCH CHECKLIST

### Pre-Launch (Must Complete):
- [ ] Implement database for users and stickers
- [ ] Set strong JWT secret in production
- [ ] Add rate limiting to all endpoints
- [ ] Implement error boundaries
- [ ] Set up error tracking (Sentry)
- [ ] Add input validation and sanitization
- [ ] Create privacy policy and terms
- [ ] Set up cloud storage for images
- [ ] Configure production CORS
- [ ] Add security headers
- [ ] Test on real devices (iOS + Android)
- [ ] Load test with 100 concurrent users
- [ ] Set up monitoring dashboards
- [ ] Create backup strategy
- [ ] Document API for future maintenance

### Post-Launch (First Week):
- [ ] Monitor error rates
- [ ] Track API response times
- [ ] Review user feedback
- [ ] Fix critical bugs immediately
- [ ] Scale infrastructure if needed
- [ ] Set up alerts for downtime
- [ ] Implement feature flags for rollbacks

---

## 💰 COST OPTIMIZATION

### For 10k Users:

**Current Architecture Issues:**
- AI API calls: $0.10-0.50 per sticker = $1000-5000/month if all users create 1 sticker
- No caching = repeated processing
- Base64 storage = high bandwidth costs

**Optimizations:**
1. Cache AI results (Redis): Save 80% of AI costs
2. Use CDN for images: Reduce bandwidth by 70%
3. Implement image compression: Reduce storage by 60%
4. Batch processing: Reduce API calls by 40%

**Projected Savings:** $3000-4000/month

---

## 📞 SUPPORT & MAINTENANCE

### Required:
1. **Support Email:** support@yourdomain.com
2. **Status Page:** status.yourdomain.com
3. **Documentation:** docs.yourdomain.com
4. **Incident Response Plan**
5. **On-Call Rotation** (if team)

---

## CONCLUSION

Your app has strong potential but needs critical infrastructure work before production. **Estimated time to production-ready: 2-3 weeks** with focused effort on:

1. Database implementation (3-4 days)
2. Security hardening (2-3 days)
3. Cloud storage setup (1-2 days)
4. Monitoring & error tracking (1-2 days)
5. Testing & QA (3-4 days)
6. App Store preparation (2-3 days)

**Priority Order:**
1. Database + Auth security (Week 1)
2. Image storage + Caching (Week 1-2)
3. Monitoring + Error tracking (Week 2)
4. Testing + App Store prep (Week 2-3)

Would you like me to implement any of these fixes now?
