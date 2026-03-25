-- Update the validation function to allow users to apply/reapply for KYC
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
  
  -- For non-admins, allow specific KYC status transitions
  IF NEW.kyc_status IS DISTINCT FROM OLD.kyc_status THEN
    -- Allow users to apply for KYC (NOT_APPLIED -> PENDING_KYC)
    IF OLD.kyc_status = 'NOT_APPLIED' AND NEW.kyc_status = 'PENDING_KYC' THEN
      RETURN NEW;
    END IF;
    
    -- Allow users to reapply after rejection (REJECTED -> PENDING_KYC)
    IF OLD.kyc_status = 'REJECTED' AND NEW.kyc_status = 'PENDING_KYC' THEN
      RETURN NEW;
    END IF;
    
    -- All other status changes require admin
    RAISE EXCEPTION 'Only admins can update KYC status to this value';
  END IF;
  
  -- For non-admins, prevent updates to rejection_reason
  IF NEW.rejection_reason IS DISTINCT FROM OLD.rejection_reason THEN
    -- Allow clearing rejection_reason when reapplying
    IF NEW.rejection_reason IS NULL AND OLD.kyc_status = 'REJECTED' AND NEW.kyc_status = 'PENDING_KYC' THEN
      RETURN NEW;
    END IF;
    
    RAISE EXCEPTION 'Only admins can update rejection reason';
  END IF;
  
  RETURN NEW;
END;
$$;