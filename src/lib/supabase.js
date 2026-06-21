import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://bjjpcawqkwufttjabuol.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJqanBjYXdxa3d1ZnR0amFidW9sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEwNzM4MTEsImV4cCI6MjA5NjY0OTgxMX0.ez_wRAlqDQf5gFcYux0khRW3vs_e8JlY48skejL516A'

export const supabaseBranchManager = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { storageKey: 'scop-bm-session' },
})

export const supabaseOwner = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { storageKey: 'scop-owner-session' },
})

export const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { storageKey: 'scop-admin-session' },
})

// Ephemeral client for creating new accounts (e.g. manager signup) without
// touching the owner's or branch manager's active session.
export const supabaseTemp = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { storageKey: 'scop-temp-signup', persistSession: false },
})
