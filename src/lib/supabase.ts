import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const hasSupabaseConfig = Boolean(url && key);
export const supabase = hasSupabaseConfig
  ? createClient(url!, key!, {
      auth: {
        flowType: 'pkce',
        autoRefreshToken: true,
        persistSession: true,
        // Callback routes exchange PKCE codes explicitly to avoid a double exchange
        // and to distinguish password-recovery links from ordinary signed-in sessions.
        detectSessionInUrl: false,
      },
    })
  : null;

export const recoverySession = { active: false };
const recoveryMarkerKey = 'siteradar.recovery-session';
const codeExchanges = new Map<string, Promise<{session: import('@supabase/supabase-js').Session | null; error?:string}>>();

if (supabase) {
  supabase.auth.onAuthStateChange((event) => {
    if (event === 'PASSWORD_RECOVERY') recoverySession.active = true;
    if (event === 'SIGNED_OUT') { recoverySession.active = false; if (typeof window !== 'undefined') window.sessionStorage.removeItem(recoveryMarkerKey); }
  });
}

export async function exchangeAuthCodeOnce(code: string): Promise<{session: import('@supabase/supabase-js').Session | null; error?:string}> {
  if (!supabase) return {session:null,error:'Supabase is not configured.'};
  let pending = codeExchanges.get(code);
  if (!pending) {
    pending = supabase.auth.exchangeCodeForSession(code)
      .then(({data,error}) => ({session:data.session,error:error?.message}))
      .catch(() => ({session:null,error:'The link is invalid or expired.'}));
    codeExchanges.set(code,pending);
  }
  return await pending;
}

export async function restoreRecoverySession(): Promise<boolean> {
  if (!supabase || typeof window === 'undefined') return false;
  if (recoverySession.active) return true;
  const marker = window.sessionStorage.getItem(recoveryMarkerKey);
  if (!marker) return false;
  const {data,error} = await supabase.auth.getSession();
  if (!error && data.session && data.session.user.id === marker) { recoverySession.active = true; return true; }
  window.sessionStorage.removeItem(recoveryMarkerKey);
  return false;
}

export async function establishRecoverySession(code: string): Promise<{ok:boolean; error?:string}> {
  if (!supabase) return {ok:false,error:'Supabase is not configured.'};
  if (recoverySession.active) return {ok:true};
  const restored = await restoreRecoverySession();
  if (restored) return {ok:true};
  const result = await exchangeAuthCodeOnce(code);
  if (result.error || !result.session) return {ok:false,error:result.error || 'The recovery link is invalid or expired.'};
  recoverySession.active = true;
  if (typeof window !== 'undefined') window.sessionStorage.setItem(recoveryMarkerKey,result.session.user.id);
  return {ok:true};
}
