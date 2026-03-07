# Feature 8: Auth & Role-Based Access Control

## Overview

Authentication and authorization using Supabase Auth. Email/password login for POC. Role-based access control (RBAC) with 4 roles: Admin, Dispatcher, Operator, Viewer. Row Level Security (RLS) policies in Supabase enforce access at the database level. Middleware in Next.js enforces route-level access.

This is a foundational feature — all other features depend on it for access control and user identity.

## Assigned To: Agent 8 (Senior Security/Auth Engineer)

---

## User Stories

- **As a user**, I want to sign up and log in with email/password so I can access the system.
- **As an admin**, I want to assign roles to users so I can control who has access to what.
- **As a dispatcher**, I want access to operations and simulation but not admin settings.
- **As a viewer**, I want read-only access to dashboards and maps without the ability to modify data.

---

## Roles & Permissions

| Permission | Admin | Dispatcher | Operator | Viewer |
|---|---|---|---|---|
| View dashboards | Yes | Yes | Yes | Yes |
| View map | Yes | Yes | Yes | Yes |
| View insights | Yes | Yes | Yes | Yes |
| Manage fleet (CRUD) | Yes | No | No | No |
| Run simulations | Yes | Yes | No | No |
| Acknowledge alerts | Yes | Yes | Yes | No |
| Manage detection rules | Yes | No | No | No |
| Manage users/roles | Yes | No | No | No |
| Export reports | Yes | Yes | No | No |
| Start/stop simulator | Yes | Yes | No | No |
| Create incidents | Yes | Yes | Yes | No |

---

## Key Capabilities

- **Email/password sign up and login** — standard auth flow via Supabase Auth
- **Session management** — JWT tokens managed by Supabase, cookies via `@supabase/ssr`
- **Role storage** — role field in `profiles` table linked to `auth.users`
- **Row Level Security (RLS)** — database-level enforcement per table
- **Next.js middleware** — route-level protection, redirect unauthenticated users to `/login`
- **Role-based UI rendering** — conditionally show/hide features based on user role
- **User management** — admin page to view all users and change roles
- **Password reset flow** — Supabase built-in password reset via email
- **Protected API routes** — all API routes verify auth token and check role

---

## Supabase Tables

### `profiles`

| Column | Type | Constraints / Notes |
|---|---|---|
| `id` | `uuid` | PK, FK → `auth.users.id` |
| `email` | `text` | User's email address |
| `full_name` | `text` | Display name |
| `role` | `text` | `'admin'`, `'dispatcher'`, `'operator'`, `'viewer'` (default: `'viewer'`) |
| `avatar_url` | `text` | Nullable, URL to avatar image |
| `created_at` | `timestamptz` | Auto-set on creation |
| `updated_at` | `timestamptz` | Auto-set on update |

### SQL Migration

```sql
-- Create profiles table
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('admin', 'dispatcher', 'operator', 'viewer')),
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    'viewer'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Indexes
CREATE INDEX idx_profiles_role ON profiles(role);
CREATE INDEX idx_profiles_email ON profiles(email);

-- RLS Policies for profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
  ON profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Users can update their own profile (except role)"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id AND role = (SELECT role FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Admins can update any profile"
  ON profiles FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );
```

---

## RLS Policies for Other Tables

### `vehicles`

```sql
-- Everyone authenticated can read
CREATE POLICY "Authenticated users can view vehicles"
  ON vehicles FOR SELECT USING (auth.uid() IS NOT NULL);

-- Only admins can modify
CREATE POLICY "Admins can insert vehicles"
  ON vehicles FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can update vehicles"
  ON vehicles FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can delete vehicles"
  ON vehicles FOR DELETE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
```

### `telemetry_readings`

```sql
CREATE POLICY "Authenticated users can view telemetry"
  ON telemetry_readings FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admin and dispatcher can insert telemetry"
  ON telemetry_readings FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'dispatcher'))
  );
```

### `anomalies`

```sql
CREATE POLICY "Authenticated users can view anomalies"
  ON anomalies FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admin, dispatcher, operator can update anomalies"
  ON anomalies FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'dispatcher', 'operator'))
  );
```

### `detection_rules`

```sql
CREATE POLICY "Authenticated users can view detection rules"
  ON detection_rules FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Only admins can modify detection rules"
  ON detection_rules FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
```

### `scenarios`

```sql
CREATE POLICY "Authenticated users can view scenarios"
  ON scenarios FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admin and dispatcher can create scenarios"
  ON scenarios FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'dispatcher'))
  );
```

---

## UI Components

### LoginForm

- **Location**: `src/components/auth/LoginForm.tsx`
- **Description**: Email/password login form with validation.
- **Fields**: Email, Password
- **Actions**: "Sign In" button, "Forgot Password?" link, "Sign Up" link
- **Error handling**: Display Supabase auth errors inline

### SignUpForm

- **Location**: `src/components/auth/SignUpForm.tsx`
- **Description**: Registration form.
- **Fields**: Full Name, Email, Password, Confirm Password
- **Actions**: "Create Account" button, "Already have an account?" link
- **Default role**: `viewer` (assigned automatically via DB trigger)

### AuthProvider

- **Location**: `src/components/auth/AuthProvider.tsx`
- **Description**: React context providing auth state to the entire app.
- **Provides**: `user`, `profile` (with role), `isLoading`, `signIn()`, `signUp()`, `signOut()`
- **Implementation**: Uses `@supabase/ssr` `createBrowserClient`, listens to `onAuthStateChange`

### RoleGuard

- **Location**: `src/components/auth/RoleGuard.tsx`
- **Description**: Wrapper component that conditionally renders children based on user role.
- **Props**: `allowedRoles: string[]`, `fallback?: ReactNode`
- **Usage**:
  ```tsx
  <RoleGuard allowedRoles={['admin', 'dispatcher']}>
    <SimulationButton />
  </RoleGuard>
  ```

### UserMenu

- **Location**: `src/components/auth/UserMenu.tsx`
- **Description**: Avatar dropdown in the top navigation bar.
- **Items**: User name, role badge, "Profile" link, "Sign Out" button
- **Admin extra**: "User Management" link

### UserManagementTable

- **Location**: `src/components/auth/UserManagementTable.tsx`
- **Description**: Admin-only table listing all users with their roles.
- **Columns**: Name, Email, Role (editable dropdown), Created At
- **Actions**: Change role (dropdown), search/filter users

### ProtectedRoute

- **Location**: `src/components/auth/ProtectedRoute.tsx`
- **Description**: HOC or wrapper for route-level protection.
- **Behavior**: Redirects to `/login` if not authenticated. Shows "Access Denied" if role insufficient.

---

## Pages / Routes

| Route | Access | Description |
|---|---|---|
| `/login` | Public | Login page |
| `/signup` | Public | Registration page |
| `/profile` | Authenticated | User profile (edit name, avatar) |
| `/admin/users` | Admin only | User management |
| All other routes | Authenticated | Protected by middleware |

---

## API Endpoints

### `POST /api/auth/signup`

- **File**: `src/app/api/auth/signup/route.ts`
- **Auth**: Public
- **Body**: `{ email, password, full_name }`
- **Response**: `201 Created` with user data
- **Note**: Can also use Supabase client directly from the frontend

### `POST /api/auth/login`

- **File**: `src/app/api/auth/login/route.ts`
- **Auth**: Public
- **Body**: `{ email, password }`
- **Response**: `200 OK` with session token

### `POST /api/auth/logout`

- **File**: `src/app/api/auth/logout/route.ts`
- **Auth**: Authenticated
- **Response**: `200 OK`, clears session

### `GET /api/auth/me`

- **File**: `src/app/api/auth/me/route.ts`
- **Auth**: Authenticated
- **Response**: Current user profile including role

### `GET /api/users`

- **File**: `src/app/api/users/route.ts`
- **Auth**: Admin only
- **Response**: Array of all user profiles

### `PATCH /api/users/[id]/role`

- **File**: `src/app/api/users/[id]/role/route.ts`
- **Auth**: Admin only
- **Body**: `{ role: 'admin' | 'dispatcher' | 'operator' | 'viewer' }`
- **Response**: Updated profile

---

## Technical Implementation

### Supabase Client Setup

```typescript
// src/lib/supabase/server.ts
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
    }
  );
}
```

```typescript
// src/lib/supabase/client.ts
import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

### Next.js Middleware

```typescript
// src/middleware.ts
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const PUBLIC_ROUTES = ['/login', '/signup'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public routes
  if (PUBLIC_ROUTES.some(route => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // Create Supabase client
  let supabaseResponse = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            supabaseResponse.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  // Check auth
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('redirect', pathname);
    return NextResponse.redirect(url);
  }

  // Check admin-only routes
  if (pathname.startsWith('/admin')) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      const url = request.nextUrl.clone();
      url.pathname = '/dashboard';
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/auth).*)'],
};
```

### Role Check Utility

```typescript
// src/lib/auth/roles.ts

export type Role = 'admin' | 'dispatcher' | 'operator' | 'viewer';

export const ROLE_HIERARCHY: Record<Role, number> = {
  admin: 4,
  dispatcher: 3,
  operator: 2,
  viewer: 1,
};

export function hasRole(userRole: Role, requiredRole: Role): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}

export function hasAnyRole(userRole: Role, allowedRoles: Role[]): boolean {
  return allowedRoles.includes(userRole);
}
```

### API Route Auth Helper

```typescript
// src/lib/auth/api-auth.ts
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import type { Role } from './roles';

export async function requireAuth(requiredRoles?: Role[]) {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (!profile) {
    return { error: NextResponse.json({ error: 'Profile not found' }, { status: 404 }) };
  }

  if (requiredRoles && !requiredRoles.includes(profile.role as Role)) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  return { user, profile, supabase };
}
```

---

## Environment Variables

```env
# .env.local
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key  # server-side only
```

---

## Seed Data

Create a seed script at `scripts/seed-users.ts`:

| Email | Password | Role | Full Name |
|---|---|---|---|
| `admin@emergency.poc` | `admin123` | `admin` | Admin User |
| `dispatcher@emergency.poc` | `dispatcher123` | `dispatcher` | Dispatcher User |
| `operator@emergency.poc` | `operator123` | `operator` | Operator User |
| `viewer@emergency.poc` | `viewer123` | `viewer` | Viewer User |

```typescript
// scripts/seed-users.ts
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // Need service role for admin operations
);

const users = [
  { email: 'admin@emergency.poc', password: 'admin123', role: 'admin', full_name: 'Admin User' },
  { email: 'dispatcher@emergency.poc', password: 'dispatcher123', role: 'dispatcher', full_name: 'Dispatcher User' },
  { email: 'operator@emergency.poc', password: 'operator123', role: 'operator', full_name: 'Operator User' },
  { email: 'viewer@emergency.poc', password: 'viewer123', role: 'viewer', full_name: 'Viewer User' },
];

async function seed() {
  for (const user of users) {
    const { data, error } = await supabase.auth.admin.createUser({
      email: user.email,
      password: user.password,
      email_confirm: true,
      user_metadata: { full_name: user.full_name },
    });

    if (error) {
      console.error(`Failed to create ${user.email}:`, error.message);
      continue;
    }

    // Update role (trigger creates profile with 'viewer' default)
    if (data.user && user.role !== 'viewer') {
      await supabase
        .from('profiles')
        .update({ role: user.role })
        .eq('id', data.user.id);
    }

    console.log(`Created ${user.email} with role ${user.role}`);
  }
}

seed();
```

---

## Acceptance Criteria

- [ ] Users can sign up with email/password and a profile is auto-created
- [ ] Users can log in and receive a valid session
- [ ] Roles are enforced at UI level (features hidden/shown based on role)
- [ ] Roles are enforced at API level (unauthorized requests return 401/403)
- [ ] RLS policies prevent unauthorized data access at the database level
- [ ] Admin can view all users and change their roles
- [ ] Protected routes redirect to `/login` when not authenticated
- [ ] Admin-only routes redirect non-admin users
- [ ] Middleware correctly protects all non-public routes
- [ ] Password reset flow works via Supabase email

---

## Dependencies

- **None** — this is a foundational feature. All other features depend on it.

---

## File Structure

```
src/
  app/
    login/
      page.tsx                          # Login page
    signup/
      page.tsx                          # Sign up page
    profile/
      page.tsx                          # User profile
    admin/
      users/
        page.tsx                        # User management (admin)
    api/
      auth/
        signup/
          route.ts                      # POST - create account
        login/
          route.ts                      # POST - login
        logout/
          route.ts                      # POST - logout
        me/
          route.ts                      # GET - current user
      users/
        route.ts                        # GET - list users (admin)
        [id]/
          role/
            route.ts                    # PATCH - update role (admin)
  components/
    auth/
      LoginForm.tsx
      SignUpForm.tsx
      AuthProvider.tsx
      RoleGuard.tsx
      UserMenu.tsx
      UserManagementTable.tsx
      ProtectedRoute.tsx
  lib/
    supabase/
      server.ts                         # Server-side Supabase client
      client.ts                         # Browser-side Supabase client
    auth/
      roles.ts                          # Role constants and helpers
      api-auth.ts                       # API route auth utility
  middleware.ts                         # Next.js middleware for route protection
scripts/
  seed-users.ts                         # Seed script for default users
```
