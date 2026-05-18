# Security and Access Control

## Overview

The Digital Twin platform implements a layered security architecture
covering authentication, authorization, API protection, and database access control.

---

# Authentication

Authentication is handled using Supabase Auth with JWT-based sessions.

Supported flows:

- Email/password login
- Session cookies
- Protected routes

---

# User Roles

The platform defines four main roles:

| Role | Permissions |
|------|------|
| admin | Full system access |
| dispatcher | Incident and fleet operations |
| operator | Vehicle monitoring |
| viewer | Read-only dashboard access |

---

# Route Protection

Next.js middleware protects application routes.

Public routes:

- /login
- /signup
- /auth/callback

Protected routes require valid authentication tokens.

Admin routes require role validation.

---

# Database Security

Supabase PostgreSQL uses Row-Level Security (RLS).

RLS policies restrict:

- vehicle access
- anomaly visibility
- event access
- administrative operations

---

# API Security

API routes validate:

- JWT authenticity
- authenticated session
- role permissions

---

# Security Headers

The application enforces security headers through Next.js configuration.

Implemented headers include:

- Strict-Transport-Security
- X-Frame-Options
- X-Content-Type-Options
- Referrer-Policy
- Permissions-Policy

---

# Service Access Control

| Service | Access Model |
|---|---|
| Vercel Frontend | Public HTTPS |
| Next.js API Routes | Authenticated |
| Supabase Database | RLS restricted |
| Supabase Realtime | JWT channel validation |
| FastAPI AI Service | Internal service communication |

---

# Secrets Management

Environment variables are managed securely through deployment providers.

Sensitive credentials include:

- Supabase service keys
- JWT secrets
- API URLs

Public variables are limited to NEXT_PUBLIC_* frontend configuration.

---

# Failure Isolation

The distributed architecture isolates failures between:

- frontend rendering
- realtime services
- AI optimization
- database operations

This prevents full system outages during partial failures.