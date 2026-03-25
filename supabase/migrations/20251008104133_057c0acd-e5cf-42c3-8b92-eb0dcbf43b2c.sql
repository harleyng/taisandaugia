-- Create KYC status enum
CREATE TYPE public.kyc_status AS ENUM ('NOT_APPLIED', 'PENDING_KYC', 'APPROVED', 'REJECTED');

-- Add agent-specific fields to profiles table
ALTER TABLE public.profiles
ADD COLUMN is_agent BOOLEAN DEFAULT false,
ADD COLUMN kyc_status kyc_status NOT NULL DEFAULT 'NOT_APPLIED',
ADD COLUMN agent_info JSONB,
ADD COLUMN rejection_reason TEXT;

-- Create validation function to prevent non-admins from updating KYC fields
CREATE OR REPLACE FUNCTION public.validate_profile_kyc_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Allow admins to update anything
  IF public.has_role(auth.uid(), 'ADMIN') THEN
    RETURN NEW;
  END IF;
  
  -- For non-admins, prevent updates to kyc_status and rejection_reason
  IF NEW.kyc_status IS DISTINCT FROM OLD.kyc_status THEN
    RAISE EXCEPTION 'Only admins can update KYC status';
  END IF;
  
  IF NEW.rejection_reason IS DISTINCT FROM OLD.rejection_reason THEN
    RAISE EXCEPTION 'Only admins can update rejection reason';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger to validate profile updates
CREATE TRIGGER validate_profile_kyc_update_trigger
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.validate_profile_kyc_update();