// Test script to call sync-cron-secret function
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://cgocsffxqyhojtyzniyz.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNnb2NzZmZ4cXlob2p0eXpuaXl6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTA0MjUwOSwiZXhwIjoyMDcwNjE4NTA5fQ.kjFpX_sbWQP7z5wZaKGtO7cgJ0_Zg4zu8qVf_SrQQAw"; // Service role key

const supabase = createClient(supabaseUrl, supabaseKey);

console.log('Calling sync-cron-secret function...');

const { data, error } = await supabase.functions.invoke('sync-cron-secret', {
  body: { action: 'sync' }
});

if (error) {
  console.error('Error calling sync-cron-secret:', error);
} else {
  console.log('Success:', data);
}