---
name: new-page
description: Scaffold a new taisandaugia route + page component + nav wiring — a page under src/pages, a <Route> in App.tsx (correct layout group, lazy vs eager), and a nav entry if it lives in a portal. Vietnamese UI strings. Use PROACTIVELY before creating any new page-level screen/route. Trigger phrases "new page", "add a page/screen/view", "create a route", "new section", "wire the nav".
---

# /new-page — scaffold a route + page + nav

taisandaugia is a **multi-surface app**: public marketplace, buyer profile, two sidebar portals (**owner** `/chu-tai-san`, **company** `/portal`) and an **admin** portal. One page = one file. Match the neighbour route group — never invent a new layout.

## 1. Create the page component
`src/pages/<Name>.tsx` (flat) or `src/pages/<group>/<Name>.tsx` for grouped areas (`admin/`, `portal/`, `portal/nang-luc/`). Default-export a component. Read auth from `useAuth()` (`userId`) — **never** add a fresh `getSession`/`onAuthStateChange` (AuthProvider is the single source, see `decisions-log.md`). Read server data through a React Query hook (see **`/add-query`**), not raw fetches in the component. All UI strings are **Vietnamese**.

## 2. Add the `<Route>` in `src/App.tsx`
Do **NOT** touch the provider nesting — the order is load-bearing: `QueryClientProvider → AuthProvider → TooltipProvider → AuthDialogProvider → Toaster/Sonner/AuthDialog → BrowserRouter → PaywallProvider`. Routes only go inside `<Routes>` (under `<Suspense>`). Pick the group:
- **Public** → top-level `<Route path="/…" element={<X />} />`.
- **Protected (buyer)** → nest under `<Route element={<ProtectedRoute />}>`.
- **Owner portal** → add a child under `/chu-tai-san` inside `<OwnerPortalLayout />`; **Company portal** → child under `/portal` inside `<PortalLayout />`; both use an index redirect: `<Route index element={<Navigate to="/chu-tai-san/dashboard" replace />} />`.
- **Admin** → child under `<AdminRoute />` + `<AdminLayout />`.

## 3. Lazy vs eager import
Only the critical path is eager (`Index`, `Auth`, `Listings`, `ListingDetail`, `AuctionDetail`, `NotFound`). **Everything else is lazy**: `const XPage = lazy(() => import("./pages/XPage"));`. A missing lazy wrapper bloats the initial bundle.

## 4. Wire the nav
- **Owner portal** → append a `NavSection` to `OWNER_NAV_SECTIONS` in `src/components/owner-portal/owner-nav-config.ts` (`{ label: 'Tên tiếng Việt', icon: <LucideIcon>, href: '/chu-tai-san/…' }`).
- **Company portal / admin** → add the item to that portal's sidebar/nav component. Public pages usually need no nav entry (linked from within pages).
- Nav labels are inline **Vietnamese**.

## 5. Navigation = `useNavigate()`, NEVER `asChild` Button + Link
`<Button asChild><Link>` renders nothing with no error (`common-pitfalls.md`, CLAUDE.md). Use `const navigate = useNavigate(); … onClick={() => navigate('/chu-tai-san/tai-san')}`.

## 6. Keep it small + verify
Pages stay **< 300 lines** — extract sections into `src/components/<module>/`. Colors map to the HSL tokens only (`bg-primary`, `text-muted-foreground`, `rounded-2xl` cards). Phase 4: `npm run lint && npm run build` green. If it introduces a new pattern, close with **`/log-decision`**.
