-- Add email column to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email text;

-- Update existing profiles with emails from auth.users
UPDATE public.profiles 
SET email = au.email
FROM auth.users au
WHERE profiles.user_id = au.id
AND profiles.email IS NULL;

-- Update the handle_new_user function to include email
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Create profile with email
  INSERT INTO public.profiles (user_id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.email
  );
  
  -- Assign visitor role by default (auto-approved)
  INSERT INTO public.user_roles (user_id, role, is_approved)
  VALUES (NEW.id, 'visitor', true);
  
  RETURN NEW;
END;
$function$;