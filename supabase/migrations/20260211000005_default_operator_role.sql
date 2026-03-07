-- Change default role for new users from 'viewer' to 'operator'
-- so they can use the Command Center (ack/resolve alerts, etc.)
-- Admins can still demote users to 'viewer' if needed.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    'operator'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Also update the column default to match
ALTER TABLE profiles ALTER COLUMN role SET DEFAULT 'operator';
