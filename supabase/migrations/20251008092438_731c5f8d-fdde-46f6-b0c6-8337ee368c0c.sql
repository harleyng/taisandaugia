-- Create app_role enum
CREATE TYPE public.app_role AS ENUM ('USER', 'ADMIN');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create user_roles table (separate from profiles for security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Add user_id to listings table
ALTER TABLE public.listings 
ADD COLUMN user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Create index for better performance
CREATE INDEX idx_listings_user_id ON public.listings(user_id);
CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);

-- Trigger to auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'name'
  );
  
  -- Assign default USER role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'USER');
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- RLS Policies for profiles
CREATE POLICY "Users can view all profiles"
  ON public.profiles
  FOR SELECT
  USING (true);

CREATE POLICY "Users can update their own profile"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id);

-- RLS Policies for user_roles
CREATE POLICY "Users can view their own roles"
  ON public.user_roles
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all roles"
  ON public.user_roles
  FOR ALL
  USING (public.has_role(auth.uid(), 'ADMIN'));

-- Update listings RLS policies
DROP POLICY IF EXISTS "Listings are viewable by everyone" ON public.listings;

CREATE POLICY "Everyone can view listings"
  ON public.listings
  FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can create listings"
  ON public.listings
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own listings"
  ON public.listings
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can update any listing"
  ON public.listings
  FOR UPDATE
  USING (public.has_role(auth.uid(), 'ADMIN'));

CREATE POLICY "Users can delete their own listings"
  ON public.listings
  FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can delete any listing"
  ON public.listings
  FOR DELETE
  USING (public.has_role(auth.uid(), 'ADMIN'));

-- Add trigger for profiles updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();