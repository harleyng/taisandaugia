-- CHỜ frontend bộ gói (20261004230000_owner_sub_packages) lên production rồi mới áp.
-- Frontend cũ còn đọc hai bảng này cho danh mục gói của chủ tài sản.
DROP TABLE IF EXISTS public.owner_subscription_plan_workspaces;
DROP TABLE IF EXISTS public.owner_subscription_term_options;
