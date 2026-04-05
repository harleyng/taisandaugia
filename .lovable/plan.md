

## Implementation Plan: "Quan tâm" & "Nhận thông tin" Feature

### Summary
Add two independent user actions (save/bookmark and follow/subscribe) for auction assets, with auth-gated interactions, optimistic UI, and a dedicated saved-assets page.

---

### 1. Database: New Table `user_asset_actions`

Create one table storing both action types per user+listing:

```sql
CREATE TABLE public.user_asset_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  listing_id uuid NOT NULL,
  is_saved boolean NOT NULL DEFAULT false,
  is_following boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, listing_id)
);

ALTER TABLE public.user_asset_actions ENABLE ROW LEVEL SECURITY;

-- Users can read their own actions
CREATE POLICY "Users can view own actions" ON public.user_asset_actions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Users can insert their own actions  
CREATE POLICY "Users can insert own actions" ON public.user_asset_actions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Users can update their own actions
CREATE POLICY "Users can update own actions" ON public.user_asset_actions
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Users can delete their own actions
CREATE POLICY "Users can delete own actions" ON public.user_asset_actions
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
```

---

### 2. Auth Context: Add Pending Action Support

**File: `src/contexts/AuthDialogContext.tsx`**

Extend the context to support a `pendingAction` callback. When the user clicks a protected action while logged out, the callback is stored. After successful auth, it executes automatically.

---

### 3. New Hook: `useAssetActions`

**File: `src/hooks/useAssetActions.tsx`**

A custom hook providing:
- `savedIds` / `followingIds` sets (bulk-fetched on mount for logged-in users)
- `toggleSave(listingId)` — upserts `is_saved`, shows toast
- `toggleFollow(listingId)` — upserts `is_following`, shows toast
- Optimistic state updates
- Auth check: if not logged in, stores pending action and opens auth dialog

---

### 4. Listing Page: Bookmark Icon on AuctionCard

**File: `src/components/AuctionCard.tsx`**

- Add a bookmark icon button (top-right of image or bottom of card) for the default grid variant
- Accept `isSaved` and `onToggleSave` props
- Show filled/outlined bookmark icon based on state
- `stopPropagation` on click to prevent navigation

**File: `src/pages/Listings.tsx`**

- Use `useAssetActions` hook
- Pass `isSaved` and `onToggleSave` to each `AuctionCard`

---

### 5. Detail Page: Both Actions

**File: `src/components/auction/AuctionQuickInfo.tsx`**

- Add two buttons below existing content: "Quan tâm" (bookmark icon) and "Nhận thông tin" (bell icon)
- Each shows active/inactive state with helper text
- Uses `useAssetActions` for toggle logic

---

### 6. Saved Assets Page

**File: `src/pages/portal/BrokerSavedAssets.tsx`** (new)

- Tab/filter bar: Tất cả | Chỉ Quan tâm | Đang nhận thông tin | Cả hai
- Lists assets using `AuctionCard` with badges showing saved/following status
- Toggle actions directly from this page
- Fetch from `user_asset_actions` joined with `listings`

**File: `src/components/portal/BrokerSidebar.tsx`** — Add menu item "Tài sản quan tâm" with Bookmark icon

**File: `src/App.tsx`** — Add route `/broker/saved-assets`

---

### 7. Auth Dialog: Execute Pending Action

**File: `src/components/auth/AuthDialog.tsx`**

- After successful login/signup, call `pendingAction` from context if present, then clear it

---

### Files Modified
| File | Change |
|---|---|
| `src/contexts/AuthDialogContext.tsx` | Add `pendingAction` support |
| `src/hooks/useAssetActions.tsx` | New hook |
| `src/components/AuctionCard.tsx` | Add bookmark icon + props |
| `src/pages/Listings.tsx` | Wire up `useAssetActions` |
| `src/components/auction/AuctionQuickInfo.tsx` | Add both action buttons |
| `src/pages/AuctionDetail.tsx` | Pass actions to QuickInfo |
| `src/pages/portal/BrokerSavedAssets.tsx` | New page |
| `src/components/portal/BrokerSidebar.tsx` | Add nav item |
| `src/App.tsx` | Add route |
| `src/components/auth/AuthDialog.tsx` | Execute pending action on auth success |
| Migration | New `user_asset_actions` table |

