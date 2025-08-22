-- Manually set up the admin user that signed up via Google OAuth
DO $$
DECLARE
    admin_user_id uuid := 'c756701f-6c51-4a06-922d-a21e27c49c83';
    admin_email text := 'amirdt22@gmail.com';
    org_id_var uuid;
BEGIN
    -- Create organization for the admin user
    INSERT INTO organizations (
        name,
        domain,
        plan_tier,
        subscription_tier,
        business_description
    ) VALUES (
        'Admin Organization',
        'admin.llumos.app',
        'pro',
        'pro',
        'Admin organization with full access'
    ) RETURNING id INTO org_id_var;
    
    -- Create the admin user record
    INSERT INTO users (
        id,
        email,
        role,
        org_id
    ) VALUES (
        admin_user_id,
        admin_email,
        'owner',
        org_id_var
    );
    
    -- Update the subscriber record to Pro status
    UPDATE subscribers 
    SET 
        user_id = admin_user_id,
        subscription_tier = 'pro',
        subscribed = true,
        payment_collected = true,
        trial_started_at = now(),
        trial_expires_at = now() + interval '1 year',
        subscription_end = now() + interval '1 year',
        updated_at = now()
    WHERE email = admin_email;
    
    RAISE NOTICE 'Admin user % manually set up with Pro subscription', admin_email;
END $$;