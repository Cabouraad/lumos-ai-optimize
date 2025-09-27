-- Phase 1: Database Schema Cleanup
-- Ensure every user has an org_id (create personal orgs for any users without one)

-- First, let's check for users without org_id and create personal orgs for them
DO $$
DECLARE
    user_record RECORD;
    new_org_id uuid;
BEGIN
    -- Find users without org_id
    FOR user_record IN 
        SELECT u.id, u.email, au.email as auth_email
        FROM public.users u
        JOIN auth.users au ON au.id = u.id
        WHERE u.org_id IS NULL
    LOOP
        -- Create a personal organization for this user
        INSERT INTO public.organizations (
            id, 
            name, 
            domain, 
            plan_tier,
            created_at,
            updated_at
        ) VALUES (
            gen_random_uuid(),
            COALESCE(split_part(user_record.email, '@', 1), 'Personal') || ' Organization',
            split_part(user_record.email, '@', 2),
            'starter',
            now(),
            now()
        ) RETURNING id INTO new_org_id;
        
        -- Update user with new org_id
        UPDATE public.users 
        SET org_id = new_org_id 
        WHERE id = user_record.id;
        
        RAISE NOTICE 'Created personal org % for user %', new_org_id, user_record.email;
    END LOOP;
END $$;

-- Make org_id NOT NULL since every user should have an org now
ALTER TABLE public.users ALTER COLUMN org_id SET NOT NULL;