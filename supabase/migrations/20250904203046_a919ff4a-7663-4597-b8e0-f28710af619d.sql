-- Clean up existing chris@pitstopgas.net user data
DO $$
DECLARE
    user_org_id uuid;
    user_record RECORD;
BEGIN
    -- Get user information if it exists
    SELECT * INTO user_record FROM users WHERE email = 'chris@pitstopgas.net';
    
    IF FOUND THEN
        user_org_id := user_record.org_id;
        RAISE NOTICE 'Found user chris@pitstopgas.net with org_id: %', user_org_id;
        
        -- Delete from subscribers table
        DELETE FROM subscribers WHERE email = 'chris@pitstopgas.net';
        RAISE NOTICE 'Deleted subscriber record for chris@pitstopgas.net';
        
        -- Delete from users table
        DELETE FROM users WHERE email = 'chris@pitstopgas.net';
        RAISE NOTICE 'Deleted user record for chris@pitstopgas.net';
        
        -- Delete organization if it exists and was created for this test user
        IF user_org_id IS NOT NULL THEN
            DELETE FROM organizations WHERE id = user_org_id AND domain = 'pitstopgas.net';
            RAISE NOTICE 'Deleted organization with domain pitstopgas.net';
        END IF;
    ELSE
        RAISE NOTICE 'No user found with email chris@pitstopgas.net';
    END IF;
    
    -- Also clean up any organization with pitstopgas.net domain (in case it exists without user)
    DELETE FROM organizations WHERE domain = 'pitstopgas.net';
    
    -- Clean up any subscriber records that might exist
    DELETE FROM subscribers WHERE email = 'chris@pitstopgas.net';
    
    RAISE NOTICE 'Cleanup complete for chris@pitstopgas.net';
END $$;