import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://cgocsffxqyhojtyzniyz.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNnb2NzZmZ4cXlob2p0eXpuaXl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwNDI1MDksImV4cCI6MjA3MDYxODUwOX0.Rn2lVaTcuu0TEn7S20a_56mkEBkG3_a7CT16CpEfirk'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

console.log('🔍 Testing database connection...')

// Test basic connection
supabase
  .from('organizations')
  .select('count')
  .then(result => {
    if (result.error) {
      console.error('❌ Database connection failed:', result.error)
    } else {
      console.log('✅ Database connection successful')
      console.log('📊 Organizations count:', result.data)
    }
  })

// Test auth state
supabase.auth.onAuthStateChange((event, session) => {
  console.log('🔐 Auth state changed:', event)
  if (session) {
    console.log('✅ User authenticated:', session.user.email)
  } else {
    console.log('❌ No active session')
  }
})

export default supabase