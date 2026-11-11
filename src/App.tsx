import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import {
  Activity, ArrowRight, BarChart3, Bell, CheckCircle2, ChevronDown, CircleHelp, CreditCard,
  Clock3, ExternalLink, FileCheck2, Gauge, Globe2, LayoutDashboard, LifeBuoy,
  Link2, LockKeyhole, LogOut, Mail, Network, Plus, ScanSearch, Settings2,
  ShieldCheck, Sparkles, Timer, TriangleAlert, Users, X
} from 'lucide-react';
import { establishRecoverySession, exchangeAuthCodeOnce, hasSupabaseConfig, recoverySession, supabase } from './lib/supabase';

type Notice = { kind: 'success' | 'error' | 'info'; text: string } | null;
type Site = { id: string; name: string; start_url: string; normalized_origin: string; created_at: string; sitemap_url?: string | null };

const appUrl = (import.meta.env.VITE_APP_URL || window.location.origin).replace(/\/$/, '');
type Edition = 'free' | 'standard' | 'ultimate';
type FeatureCatalogEntry = {feature_key:string;display_name:string;category:string;implementation_status:'available'|'beta'|'coming_soon'|'retired';description:string;sort_order:number};
const editionKeys: Edition[] = ['free', 'standard', 'ultimate'];
function parseEdition(value: string | null | undefined): Edition { return editionKeys.includes(value as Edition) ? value as Edition : 'free'; }
function slugify(value: string) { return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 61); }

async function getActiveWorkspaceMembership(userId: string) {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase
    .from('workspace_members')
    .select('workspace_id,role,joined_at')
    .eq('user_id', userId)
    .not('joined_at', 'is', null)
    .order('joined_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('No active workspace was found. Complete workspace setup first.');
  return data;
}

function safeNext(value: string | null) {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return '/app';
  return value;
}

function NoticeBar({ notice, dismiss }: { notice: Notice; dismiss: () => void }) {
  if (!notice) return null;
  const Icon = notice.kind === 'success' ? CheckCircle2 : notice.kind === 'error' ? TriangleAlert : CircleHelp;
  return <div className={'notice ' + notice.kind} role={notice.kind === 'error' ? 'alert' : 'status'}>
    <Icon size={17} /><span>{notice.text}</span><button className="icon-button" onClick={dismiss} aria-label="Dismiss message"><X size={15} /></button>
  </div>;
}

function Brand({ compact = false }: { compact?: boolean }) {
  return <Link to="/" className={'brand ' + (compact ? 'compact' : '')} aria-label="SiteRadar home">
    <span className="brand-mark"><Activity size={20} strokeWidth={2.7} /></span>
    <span className="brand-name">Site<span>Radar</span><small>WEBSITE INTELLIGENCE</small></span>
  </Link>;
}

function AuthLayout({ title, subtitle, children, footer }: { title: string; subtitle: string; children: React.ReactNode; footer: React.ReactNode }) {
  return <main className="auth-page">
    <div className="auth-top"><Brand /><span className="auth-secure"><ShieldCheck size={14} /> Secure workspace</span></div>
    <section className="auth-card">
      <div className="auth-eyebrow"><span className="live-dot" /> WEBSITE HEALTH, MADE CLEAR</div>
      <h1>{title}</h1><p className="auth-subtitle">{subtitle}</p>
      {children}
      <div className="auth-footer">{footer}</div>
    </section>
    <div className="auth-bottom"><span>© {new Date().getFullYear()} SiteRadar</span><span>Every Page. Every Issue. One Clear View.</span><Link to="/help">Help & support</Link></div>
  </main>;
}

function Field({ label, id, type = 'text', value, onChange, placeholder, autoComplete, hint, required = true }: {
  label: string; id: string; type?: string; value: string; onChange: (v: string) => void;
  placeholder?: string; autoComplete?: string; hint?: string; required?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  const actualType = type === 'password' && visible ? 'text' : type;
  return <div className="field">
    <label htmlFor={id}>{label}</label>
    <div className={'field-input-wrap ' + (type === 'password' ? 'has-toggle' : '')}>
      {type === 'email' ? <Mail size={16} className="field-icon" /> : type === 'password' ? <LockKeyhole size={16} className="field-icon" /> : null}
      <input id={id} type={actualType} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        autoComplete={autoComplete} required={required} minLength={type === 'password' ? 8 : undefined} />
      {type === 'password' && <button type="button" className="password-toggle" onClick={() => setVisible(v => !v)} aria-label={visible ? 'Hide password' : 'Show password'}>{visible ? 'Hide' : 'Show'}</button>}
    </div>
    {hint && <small className="field-hint">{hint}</small>}
  </div>;
}

function ConfigNotice() {
  return <div className="config-warning"><TriangleAlert size={17} /><span><b>Database configuration required</b><br />Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to your local environment. No authentication request has been sent.</span></div>;
}

function LoginPage() {
  useEffect(() => {
    const next = safeNext(new URLSearchParams(window.location.search).get('next'));
    void getZenVentoraAccount().then(account => account.signIn('siteradar', window.location.origin + next));
  }, []);
  return <div className="app-loading"><span className="spinner"/> Redirecting to ZenVentora Accounts…</div>;
}

function LegacyLoginPage() {
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false); const [notice, setNotice] = useState<Notice>(null);
  const navigate = useNavigate(); const location = useLocation();
  const next = safeNext(new URLSearchParams(location.search).get('next'));
  async function submit(e: FormEvent) {
    e.preventDefault(); if (!supabase) return setNotice({kind:'error', text:'Supabase is not configured yet.'});
    setBusy(true); setNotice(null);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw error;
      navigate(next, { replace: true });
    } catch (err) { setNotice({kind:'error', text: err instanceof Error ? err.message : 'Sign in failed. Check your details and try again.'}); }
    finally { setBusy(false); }
  }
  return <AuthLayout title="Welcome back" subtitle="Sign in to see your websites, audit history and the issues that need attention."
    footer={<>New to SiteRadar? <Link to="/login?mode=signup">Create an account <ArrowRight size={14} /></Link></>}>
    {!hasSupabaseConfig && <ConfigNotice />}
    <NoticeBar notice={notice} dismiss={() => setNotice(null)} />
    <form onSubmit={submit} className="auth-form">
      <Field label="Email address" id="login-email" type="email" value={email} onChange={setEmail} placeholder="you@company.com" autoComplete="email" />
      <div className="field-head"><span>Password</span><Link to="/forgot-password">Forgot password?</Link></div>
      <Field label="" id="login-password" type="password" value={password} onChange={setPassword} placeholder="Enter your password" autoComplete="current-password" />
      <button className="btn primary full" type="submit" disabled={busy || !hasSupabaseConfig}>{busy ? <><span className="spinner" /> Signing in…</> : <>Sign in <ArrowRight size={16} /></>}</button>
    </form>
    <div className="auth-divider"><span /> <small>BUILT FOR CLEARER DECISIONS</small> <span /></div>
    <div className="auth-trust"><ShieldCheck size={16} /><span>Your audit data stays in your private workspace.</span></div>
  </AuthLayout>;
}

function SignupPage() {
  useEffect(() => {
    void getZenVentoraAccount().then(account => account.signUp('siteradar', window.location.origin + '/setup'));
  }, []);
  return <div className="app-loading"><span className="spinner"/> Redirecting to ZenVentora Accounts…</div>;
}

function LegacySignupPage() {
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState(''); const [name, setName] = useState('');
  const [busy, setBusy] = useState(false); const [notice, setNotice] = useState<Notice>(null); const [done, setDone] = useState(false);
  const navigate = useNavigate(); const location = useLocation();
  const edition = parseEdition(new URLSearchParams(location.search).get('edition'));
  const requestedProduct = new URLSearchParams(location.search).get('product') || 'siteradar';
  const productAvailable = requestedProduct === 'siteradar';
  const callbackUrl = appUrl + '/auth/callback?next=/setup&edition=' + encodeURIComponent(edition);
  async function submit(e: FormEvent) {
    e.preventDefault(); if (!supabase) return setNotice({kind:'error',text:'Supabase is not configured yet.'});
    if (!productAvailable) return setNotice({kind:'error',text:'The '+requestedProduct+' sign-up flow is not connected yet. No account was created for another product.'});
    if (password.length < 8) return setNotice({kind:'error',text:'Use a password with at least 8 characters.'});
    if (password !== confirm) return setNotice({kind:'error',text:'Passwords do not match.'});
    setBusy(true); setNotice(null);
    try {
      const { data, error } = await supabase.auth.signUp({ email: email.trim(), password,
        options: { data: { name: name.trim(), requested_edition: edition, requested_product: 'siteradar' }, emailRedirectTo: callbackUrl } });
      if (error) throw error;
      if (data.session) navigate('/setup?edition=' + encodeURIComponent(edition), {replace:true});
      else setDone(true);
    } catch (err) { setNotice({kind:'error',text:err instanceof Error ? err.message : 'Could not create your account. Try again.'}); }
    finally { setBusy(false); }
  }
  async function resendConfirmation() {
    if (!supabase) return setNotice({kind:'error',text:'Supabase is not configured yet.'});
    if (!email.trim()) { setDone(false); return setNotice({kind:'info',text:'Enter your email address and submit the signup form again.'}); }
    setBusy(true); setNotice(null);
    try {
      const {error} = await supabase.auth.resend({type:'signup', email:email.trim(), options:{emailRedirectTo:callbackUrl}});
      if (error) throw error;
      setNotice({kind:'success',text:'If confirmation can be resent, a fresh link has been sent. Check your inbox and spam folder.'});
    } catch { setNotice({kind:'info',text:'If the account still needs confirmation, a fresh link may have been sent. Wait briefly before trying again.'}); }
    finally { setBusy(false); }
  }
  return <AuthLayout title={done ? 'Check your inbox' : 'Create your account'} subtitle={done ? 'We sent a confirmation link if your request was accepted. Open it to activate your SiteRadar workspace.' : 'Start discovering what is working on your website — and what needs fixing.'}
    footer={done ? <>Already confirmed? <Link to="/login">Sign in <ArrowRight size={14} /></Link></> : <>Already have an account? <Link to="/login">Sign in <ArrowRight size={14} /></Link></>}>
    {done ? <div className="success-panel"><span className="success-icon"><Mail size={24} /></span><h2>Verify your email</h2><p>Check your inbox and spam folder for the confirmation email. The link may expire; return here to request another one if needed.</p><button className="btn primary full" disabled={busy || !hasSupabaseConfig} onClick={resendConfirmation}>{busy ? <><span className="spinner"/> Sending…</> : <>Resend confirmation email <ArrowRight size={15}/></>}</button><button className="btn secondary full" onClick={() => {setDone(false);setNotice(null);}}>Return to sign up</button></div> : <>
      {!hasSupabaseConfig && <ConfigNotice />}<NoticeBar notice={notice} dismiss={() => setNotice(null)} />
      {!productAvailable&&<div className="notice error">The {requestedProduct} sign-up flow is not connected yet. No account will be created for another product from this page. <Link to="/products">View products</Link>.</div>}
      <form onSubmit={submit} className="auth-form">
        <Field label="Your name" id="signup-name" value={name} onChange={setName} placeholder="Name" autoComplete="name" />
        <Field label="Work email" id="signup-email" type="email" value={email} onChange={setEmail} placeholder="you@company.com" autoComplete="email" />
        <Field label="Password" id="signup-password" type="password" value={password} onChange={setPassword} placeholder="At least 8 characters" autoComplete="new-password" hint="Use a unique password with 8 or more characters." />
        <Field label="Confirm password" id="signup-confirm" type="password" value={confirm} onChange={setConfirm} placeholder="Enter password again" autoComplete="new-password" />
        <div className="selected-edition-note"><b>Selected edition: {edition[0].toUpperCase() + edition.slice(1)}</b><span>{edition === 'free' ? 'Permanent Free access. No payment details required.' : 'Includes a configurable trial. Payment is not collected during this setup flow.'}</span><Link to={'/pricing?edition=' + edition}>Change edition</Link></div>
        <button className="btn primary full" type="submit" disabled={busy || !hasSupabaseConfig || !productAvailable}>{busy ? <><span className="spinner" /> Creating account…</> : <>Create account <ArrowRight size={16} /></>}</button>
        <p className="legal-note">By creating an account, you agree to the product terms and privacy notice.</p>
      </form>
    </>}
  </AuthLayout>;
}

function SetupPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const editionFromUrl = parseEdition(new URLSearchParams(location.search).get('edition'));
  const [edition, setEdition] = useState<Edition>(editionFromUrl);
  const [plans, setPlans] = useState<Record<string, {display_name:string;trial_days:number;monthly_price_minor:number|null;annual_price_minor:number|null}>>({});
  const [workspaceName, setWorkspaceName] = useState('');
  const [workspaceSlug, setWorkspaceSlug] = useState('');
  const [slugEdited, setSlugEdited] = useState(false);
  const [siteName, setSiteName] = useState('');
  const [startUrl, setStartUrl] = useState('');
  const [sitemapUrl, setSitemapUrl] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  useEffect(() => {
    if (!supabase) return;
    void supabase.from('plan_catalog').select('plan_key,display_name,trial_days,monthly_price_minor,annual_price_minor').then(({data}) => {
      const map: Record<string, {display_name:string;trial_days:number;monthly_price_minor:number|null;annual_price_minor:number|null}> = {};
      for (const plan of data || []) map[plan.plan_key] = plan;
      setPlans(map);
    });
  }, []);
  function changeWorkspaceName(value: string) {
    setWorkspaceName(value);
    if (!slugEdited) setWorkspaceSlug(slugify(value));
    if (!siteName.trim() || siteName === workspaceName) setSiteName(value);
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!supabase) return setNotice({kind:'error',text:'Supabase is not configured yet.'});
    let parsed: URL;
    try { parsed = new URL(startUrl.trim()); if (!['http:','https:'].includes(parsed.protocol) || parsed.username || parsed.password) throw new Error(); }
    catch { return setNotice({kind:'error',text:'Enter a valid website URL beginning with https:// or http://.'}); }
    if (sitemapUrl.trim()) {
      try { const sitemap = new URL(sitemapUrl.trim()); if (!['http:','https:'].includes(sitemap.protocol)) throw new Error(); }
      catch { return setNotice({kind:'error',text:'Enter a valid sitemap URL or leave it empty.'}); }
    }
    if (workspaceSlug.trim().length < 2 || workspaceSlug.trim().length > 61) return setNotice({kind:'error',text:'Workspace slug must be 2–61 characters.'});
    setBusy(true); setNotice(null);
    try {
      const {data,error} = await supabase.rpc('create_siteradar_workspace_setup', {
        p_workspace_name: workspaceName.trim(),
        p_workspace_slug: workspaceSlug.trim().toLowerCase(),
        p_site_name: siteName.trim(),
        p_start_url: startUrl.trim(),
        p_sitemap_url: sitemapUrl.trim() || null,
        p_edition: edition,
        p_coupon_code: couponCode.trim() || null
      });
      if (error) throw error;
      if (!data?.setup_complete) throw new Error('Workspace setup could not be confirmed. Please retry.');
      navigate('/app?setup=complete', {replace:true});
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not complete account setup.';
      setNotice({kind:'error',text:message.includes('already used a Standard or Ultimate trial') ? 'This account has already used its trial. Choose Free to finish setup, or sign in to the existing workspace.' : message});
    } finally { setBusy(false); }
  }
  const selectedPlan = plans[edition];
  return <AuthLayout title="Set up your workspace" subtitle="Your account is ready. Add your organization and first website to start using SiteRadar."
    footer={<>Need help? <Link to="/help">Contact support <ArrowRight size={14}/></Link></>}>
    <NoticeBar notice={notice} dismiss={() => setNotice(null)}/>
    <form className="auth-form" onSubmit={submit}>
      <div className="setup-section-label">01 · ORGANIZATION</div>
      <Field label="Organization / workspace name" id="setup-workspace" value={workspaceName} onChange={changeWorkspaceName} placeholder="Your company name" autoComplete="organization"/>
      <Field label="Workspace URL slug" id="setup-slug" value={workspaceSlug} onChange={v=>{setSlugEdited(true);setWorkspaceSlug(slugify(v));}} placeholder="your-company"/>
      <small className="field-hint">Used as an internal workspace identifier. Lowercase letters, numbers and hyphens only.</small>
      <div className="setup-section-label">02 · FIRST WEBSITE</div>
      <Field label="Website display name" id="setup-site-name" value={siteName} onChange={setSiteName} placeholder="Main website" autoComplete="organization-title"/>
      <Field label="Website URL" id="setup-site-url" value={startUrl} onChange={setStartUrl} placeholder="https://example.com" autoComplete="url"/>
      <Field label="Sitemap URL (optional)" id="setup-sitemap-url" value={sitemapUrl} onChange={setSitemapUrl} placeholder="https://example.com/sitemap.xml" required={false}/>
      <div className="setup-section-label">03 · YOUR EDITION</div>
      <div className="edition-picker">
        {(['free','standard','ultimate'] as Edition[]).map(key=><button type="button" key={key} className={'edition-option '+(edition===key?'selected':'')} onClick={()=>{setEdition(key);if(key==='free')setCouponCode('');}}>
          <b>{key[0].toUpperCase()+key.slice(1)}</b><span>{key==='free'?'Permanent free':((plans[key]?.trial_days ?? 14)+'-day trial')}</span>
        </button>)}
      </div>
      <p className="legal-note">{edition==='free'?'Free access does not expire.':(selectedPlan?.trial_days ?? 14)+' days of '+edition+' access. No payment is collected during this setup. Prices will appear only after they are configured.'}</p>
      {edition!=='free'&&<Field label="Trial extension coupon (optional)" id="setup-coupon" value={couponCode} onChange={v=>setCouponCode(v.toUpperCase().replace(/\\s/g,''))} placeholder="Enter coupon code" required={false} hint="Trial-day coupons are applied on the server. Payment discounts wait until checkout is enabled."/>}
      <button className="btn primary full" type="submit" disabled={busy || !hasSupabaseConfig}>{busy?<><span className="spinner"/> Creating workspace…</>:<>Complete setup <ArrowRight size={16}/></>}</button>
    </form>
  </AuthLayout>;
}

function ForgotPasswordPage() {
  const [email, setEmail] = useState(''); const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false); const [notice, setNotice] = useState<Notice>(null);
  async function submit(e: FormEvent) {
    e.preventDefault(); if (!supabase) return setNotice({kind:'error',text:'Supabase is not configured yet.'});
    setBusy(true); setNotice(null);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: appUrl + '/reset-password?type=recovery' });
      if (error) throw error;
      setDone(true);
    } catch (err) { setNotice({kind:'error',text:err instanceof Error ? err.message : 'Could not request a reset email. Please try again.'}); }
    finally { setBusy(false); }
  }
  return <AuthLayout title={done ? 'Check your inbox' : 'Reset your password'} subtitle={done ? 'If an account matches that email, a password reset link has been sent.' : 'Enter the email address on your account and we will send a secure reset link.'}
    footer={<>Remembered your password? <Link to="/login">Back to sign in <ArrowRight size={14} /></Link></>}>
    {!hasSupabaseConfig && <ConfigNotice />}<NoticeBar notice={notice} dismiss={() => setNotice(null)} />
    {done ? <div className="success-panel"><span className="success-icon"><Mail size={24} /></span><h2>Check your email</h2><p>Use the latest reset link. If it has expired, request a new one here.</p><button className="btn secondary full" onClick={() => setDone(false)}>Request another link</button></div> :
      <form onSubmit={submit} className="auth-form"><Field label="Email address" id="forgot-email" type="email" value={email} onChange={setEmail} placeholder="you@company.com" autoComplete="email" />
        <button className="btn primary full" type="submit" disabled={busy || !hasSupabaseConfig}>{busy ? <><span className="spinner" /> Sending…</> : <>Send reset link <ArrowRight size={16} /></>}</button>
      </form>}
  </AuthLayout>;
}

function ResetPasswordPage() {
  const [password, setPassword] = useState(''); const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false); const [notice, setNotice] = useState<Notice>(null); const [done, setDone] = useState(false);
  const [recoveryReady, setRecoveryReady] = useState(recoverySession.active);
  const [checkingRecovery, setCheckingRecovery] = useState(true);
  useEffect(() => {
    if (!supabase) { setCheckingRecovery(false); return; }
    if (recoverySession.active) { setRecoveryReady(true); setCheckingRecovery(false); }
    const {data:{subscription}} = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') { recoverySession.active = true; setRecoveryReady(true); setCheckingRecovery(false); }
      if (event === 'SIGNED_OUT') { recoverySession.active = false; setRecoveryReady(false); }
    });
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (params.get('type') === 'recovery' && code && !recoverySession.active) {
      setCheckingRecovery(true);
      void establishRecoverySession(code).then(result => {
        if (result.ok) { setRecoveryReady(true); setNotice(null); }
        else setNotice({kind:'error',text:'This password-reset link is invalid or expired. Request a new one.'});
        setCheckingRecovery(false);
      });
    } else {
      setCheckingRecovery(false);
    }
    return () => { subscription.unsubscribe(); };
  }, []);
  async function submit(e: FormEvent) {
    e.preventDefault(); if (!supabase) return setNotice({kind:'error',text:'Supabase is not configured yet.'});
    if (password.length < 8) return setNotice({kind:'error',text:'Use a password with at least 8 characters.'});
    if (password !== confirm) return setNotice({kind:'error',text:'Passwords do not match.'});
    setBusy(true); setNotice(null);
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      if (!recoveryReady || !recoverySession.active || !session) throw new Error('This reset link is expired or invalid. Request a new password reset link.');
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      recoverySession.active = false;
      await supabase.auth.signOut();
      setDone(true);
    } catch (err) { setNotice({kind:'error',text:err instanceof Error ? err.message : 'Could not update your password.'}); }
    finally { setBusy(false); }
  }
  return <AuthLayout title={done ? 'Password updated' : 'Choose a new password'} subtitle={done ? 'Your password has been updated. Continue to sign in.' : 'Use the secure link from your email and choose a new password for your account.'}
    footer={<>Ready to continue? <Link to="/login">Sign in <ArrowRight size={14} /></Link></>}>
    <NoticeBar notice={notice} dismiss={() => setNotice(null)} />
    {checkingRecovery && !recoveryReady && !done ? <div className="success-panel"><span className="spinner"/><h2>Checking secure link</h2><p>We are validating your password recovery session.</p></div> : !recoveryReady && !done ? <div className="success-panel"><span className="success-icon"><LockKeyhole size={24}/></span><h2>Recovery link required</h2><p>Open the latest password-reset link from your email. For your safety, a normal signed-in session cannot be used to reset a password here.</p><Link className="btn primary full" to="/forgot-password">Request a new reset link <ArrowRight size={16}/></Link></div> : done ? <div className="success-panel"><span className="success-icon"><CheckCircle2 size={24} /></span><h2>All set</h2><p>Your password is saved. Sign in again with your new password.</p><Link className="btn primary full" to="/login">Go to sign in <ArrowRight size={16}/></Link></div> :
      <form onSubmit={submit} className="auth-form">
        <Field label="New password" id="reset-password" type="password" value={password} onChange={setPassword} placeholder="At least 8 characters" autoComplete="new-password" />
        <Field label="Confirm new password" id="reset-confirm" type="password" value={confirm} onChange={setConfirm} placeholder="Enter password again" autoComplete="new-password" />
        <button className="btn primary full" type="submit" disabled={busy || !hasSupabaseConfig}>{busy ? <><span className="spinner" /> Updating…</> : <>Update password <ArrowRight size={16} /></>}</button>
      </form>}
  </AuthLayout>;
}

function AuthCallbackPage() {
  const navigate = useNavigate(); const location = useLocation();
  const [notice, setNotice] = useState<Notice>({kind:'info',text:'Checking your confirmation link…'});
  useEffect(() => {
    let active = true;
    async function complete() {
      if (!supabase) { setNotice({kind:'error',text:'Supabase is not configured.'}); return; }
      try {
        const params = new URLSearchParams(location.search);
        const linkError = params.get('error_description') || params.get('error');
        if (linkError) throw new Error(linkError.replace(/\+/g,' '));
        const code = params.get('code');
        let session = null;
        if (code) {
          const exchanged = await exchangeAuthCodeOnce(code);
          if (exchanged.error) throw new Error(exchanged.error);
          session = exchanged.session;
        } else {
          const {data,error} = await supabase.auth.getSession();
          if (error) throw error;
          session = data.session;
        }
        if (!session) throw new Error('The confirmation link is invalid or expired. Please request a new one.');
        if (active) {
          const next = safeNext(params.get('next'));
          const edition = parseEdition(params.get('edition') || session.user.user_metadata?.requested_edition);
          navigate(next === '/setup' ? '/setup?edition=' + encodeURIComponent(edition) : next, {replace:true});
        }
      } catch (err) { if (active) setNotice({kind:'error',text:err instanceof Error ? err.message : 'Could not confirm the link.'}); }
    }
    void complete();
    return () => {active=false;};
  }, [location.search, navigate]);
  return <AuthLayout title="Verifying your link" subtitle="We are securely checking your sign-in or confirmation link." footer={<>Need a new link? <Link to="/forgot-password">Try account recovery <ArrowRight size={14} /></Link></>}>
    <NoticeBar notice={notice} dismiss={() => setNotice(null)} />
    {notice?.kind === 'error' && <Link to="/login" className="btn secondary full">Continue to sign in</Link>}
  </AuthLayout>;
}

function ProtectedRoute({ children }: {children: React.ReactNode}) {
  const [state, setState] = useState<'loading'|'signed-in'|'signed-out'|'needs-setup'|'ready'|'error'>('loading');
  const [requestedEdition, setRequestedEdition] = useState<Edition>('free');
  const location = useLocation();
  useEffect(() => {
    let active = true;
    let unsubscribe = () => {};
    getZenVentoraAccount().then(account => {
      if (!active) return;
      const evaluate = async (session: Awaited<ReturnType<typeof account.getSession>>) => {
        if (!session?.user) { if (active) setState('signed-out'); return; }
        const metadataEdition = parseEdition(session.user.user_metadata?.requested_edition);
        if (active) setRequestedEdition(metadataEdition);
        try {
          if (!supabase) throw new Error('SiteRadar data client is not configured.');
          const { data, error } = await supabase.from('workspace_members').select('workspace_id').eq('user_id', session.user.id).not('joined_at', 'is', null).limit(1);
          if (error) throw error;
          if (active) setState(data && data.length ? 'ready' : 'needs-setup');
        } catch {
          if (active) setState('error');
        }
      };
      account.getSession().then(evaluate);
      unsubscribe = account.onSessionChange(session => { void evaluate(session); });
    }).catch(() => { if (active) setState('signed-out'); });
    return () => { active = false; unsubscribe(); };
  }, []);
  if (state === 'loading' || state === 'signed-in') return <div className="app-loading"><span className="spinner" /> Checking your workspace…</div>;
  if (state === 'error') return <div className="app-loading"><div className="success-panel"><h2>Could not load your workspace</h2><p>Check your connection and try again. Your session has not been deleted.</p><button className="btn primary" onClick={()=>window.location.reload()}>Retry <ArrowRight size={15}/></button></div></div>;
  if (state === 'signed-out') return <Navigate to={'/login?next=' + encodeURIComponent(location.pathname + location.search)} replace />;
  if (state === 'needs-setup' && location.pathname !== '/setup') return <Navigate to={'/setup?edition=' + encodeURIComponent(parseEdition(new URLSearchParams(location.search).get('edition') || requestedEdition))} replace />;
  if (state === 'ready' && location.pathname === '/setup') return <Navigate to="/app" replace />;
  return <>{children}</>;
}

const navGroups = [
  {label:'WORKSPACE', items:[
    {to:'/app', label:'Overview', icon:LayoutDashboard},
    {to:'/app/sites', label:'Websites', icon:Globe2},
    {to:'/app/audits', label:'Audits', icon:ScanSearch},
    {to:'/app/issues', label:'Issue explorer', icon:TriangleAlert}
  ]},
  {label:'DIAGNOSTICS', items:[
    {to:'/app/pages',label:'Pages & links',icon:Link2},
    {to:'/app/crawl-map',label:'Crawl map',icon:Network},
    {to:'/app/performance',label:'Performance',icon:Gauge},
    {to:'/app/accessibility',label:'Accessibility',icon:Sparkles},
    {to:'/app/security',label:'Security & AI readiness',icon:ShieldCheck},
    {to:'/app/monitoring',label:'Monitoring',icon:Activity}
  ]},
  {label:'MANAGE',items:[
    {to:'/app/reports',label:'Reports',icon:BarChart3},
    {to:'/app/notifications',label:'Notifications',icon:Bell},
    {to:'/app/products',label:'Products',icon:Network},
    {to:'/app/billing',label:'Plan & billing',icon:CreditCard},
    {to:'/app/settings',label:'Settings',icon:Settings2}
  ]}
];

function AppShell({ children }: {children: React.ReactNode}) {
  const location = useLocation(); const navigate = useNavigate();
  const [email, setEmail] = useState(''); const [collapsed, setCollapsed] = useState(false);
  const [workspaceName, setWorkspaceName] = useState('My workspace');
  const [planKey, setPlanKey] = useState<Edition>('free');
  const [subscriptionStatus, setSubscriptionStatus] = useState('free');
  const [trialEndsAt, setTrialEndsAt] = useState<string | null>(null);
  const [notificationCount, setNotificationCount] = useState(0);
  useEffect(() => {
    void getZenVentoraAccount().then(account => account.getSession()).then(async session => {
      if (!session?.user || !supabase) return;
      setEmail(session.user.email || '');
      await supabase.rpc('refresh_siteradar_subscription');
      const membership=await getActiveWorkspaceMembership(session.user.id);
      const {data:workspace,error:workspaceError}=await supabase!.from('workspaces').select('id,name,plan_key').eq('id',membership.workspace_id).maybeSingle();
      if(workspaceError)throw workspaceError;
      if (!workspace) return;
      setWorkspaceName(workspace.name || 'My workspace');
      setPlanKey(parseEdition(workspace.plan_key));
      const [{data:subscription},{count:pendingNotifications}]=await Promise.all([
        supabase!.from('workspace_subscriptions').select('plan_key,status,trial_ends_at').eq('workspace_id',workspace.id).maybeSingle(),
        supabase!.from('subscription_notifications').select('id',{count:'exact',head:true}).eq('workspace_id',workspace.id).in('status',['queued','failed'])
      ]);
      if (subscription) { setPlanKey(parseEdition(subscription.plan_key)); setSubscriptionStatus(subscription.status); setTrialEndsAt(subscription.trial_ends_at); }
      setNotificationCount(pendingNotifications??0);
    })().catch(()=>{});
  }, []);
  async function signout() { await (await getZenVentoraAccount()).signOut(); navigate('/login',{replace:true}); }
  const current = navGroups.flatMap(g=>g.items).find(item=>item.to===location.pathname);
  return <div className={'app-shell ' + (collapsed?'nav-collapsed':'')}>
    <header className="topbar">
      <div className="topbar-brand"><Brand compact /><button className="collapse-button" onClick={()=>setCollapsed(v=>!v)} aria-label="Toggle navigation"><ChevronDown size={15}/></button></div>
      <div className="topbar-context"><span className="live-dot"/><span>Website intelligence</span><span className="crumb">/</span><b>{current?.label || 'Workspace'}</b></div>
      <div className="topbar-actions"><button className="top-icon" title={'Notifications'+(notificationCount?' ('+notificationCount+' pending)':'')} aria-label={'Open notifications'+(notificationCount?', '+notificationCount+' pending':'')} onClick={()=>navigate('/app/notifications')}><Bell size={17}/>{notificationCount>0&&<i/>}</button><div className="avatar">{(email[0]||'U').toUpperCase()}</div><button className="user-email account-settings-button" title="Manage ZenVentora account" onClick={()=>void getZenVentoraAccount().then(account=>account.openAccount())}>{email || 'Signed in'}</button><button className="top-icon" title="Sign out" onClick={signout}><LogOut size={17}/></button></div>
    </header>
    <div className="app-body">
      <aside className="sidebar">
        <div className="workspace-switch"><div className="workspace-mark">SR</div><div className="workspace-copy"><b>{workspaceName}</b><small>{planKey[0].toUpperCase()+planKey.slice(1)} · {subscriptionStatus==='trialing'&&trialEndsAt ? Math.max(0,Math.ceil((new Date(trialEndsAt).getTime()-Date.now())/86400000))+' days left' : subscriptionStatus.replaceAll('_',' ')}</small></div></div>
        {navGroups.map(group=><div className="nav-group" key={group.label}><p>{group.label}</p>{group.items.map(item=>{const Icon=item.icon;const active=item.to===location.pathname;return <Link key={item.to} to={item.to} className={'nav-item '+(active?'active':'')}><Icon size={17}/><span>{item.label}</span></Link>})}</div>)}
        <div className="sidebar-bottom"><Link to="/help" className="help-card"><span className="help-icon"><LifeBuoy size={17}/></span><div><b>Need a hand?</b><small>Explore getting started</small></div><ArrowRight size={14}/></Link><p className="sidebar-quote">Every Page. Every Issue.<br/><b>One Clear View.</b></p><small className="version">SITERADAR · EARLY ACCESS</small></div>
      </aside>
      <main className="main-area"><div className="page-head"><div><div className="breadcrumbs">Workspace <span>/</span> {current?.label || 'Overview'}</div><h1>{current?.label || 'Website overview'}</h1><p>Understand your site health and turn findings into clear next steps.</p></div><div className="page-head-actions"><button className="btn secondary" onClick={()=>navigate('/app/sites')}><Globe2 size={15}/> View websites</button><button className="btn primary" onClick={()=>navigate('/app/sites/new')}><Plus size={16}/> Add website</button></div></div>{children}</main>
    </div>
  </div>;
}

function OverviewPage(){
  const navigate = useNavigate();
  const [busy,setBusy] = useState(true);
  const [notice,setNotice] = useState<Notice>(null);
  const [siteCount,setSiteCount] = useState(0);
  const [auditCount,setAuditCount] = useState(0);
  const [openCount,setOpenCount] = useState(0);
  const [runs,setRuns] = useState<(AuditRun & {site_id:string})[]>([]);
  const [sites,setSites] = useState<Record<string,string>>({});
  const [siteOptions,setSiteOptions] = useState<{id:string;name:string}[]>([]);
  const [selectedSiteId,setSelectedSiteId] = useState('all');
  const [dateRange,setDateRange] = useState('30');
  const [severityCounts,setSeverityCounts] = useState<Record<string,number>>({critical:0,error:0,warning:0,info:0,opportunity:0});
  useEffect(()=>{
    let active=true;
    async function load(){
      if(!supabase){setBusy(false);return;}
      try{
        const {data:userData,error:userError}=await supabase.auth.getUser();if(userError)throw userError;if(!userData.user)throw new Error('Sign in to load workspace analytics.');
        const membership=await getActiveWorkspaceMembership(userData.user.id);const workspaceId=membership.workspace_id;
        const [siteResult,auditCountResult,issueResult,runResult,siteListResult,criticalResult,errorResult,warningResult,infoResult,opportunityResult] = await Promise.all([
          supabase.from('sites').select('id',{count:'exact',head:true}).eq('workspace_id',workspaceId),
          supabase.from('audit_runs').select('id',{count:'exact',head:true}).eq('workspace_id',workspaceId),
          supabase.from('issues').select('id',{count:'exact',head:true}).eq('workspace_id',workspaceId).eq('status','open'),
          supabase.from('audit_runs').select('id,site_id,status,created_at,started_at,finished_at,summary').eq('workspace_id',workspaceId).order('created_at',{ascending:false}).limit(100),
          supabase.from('sites').select('id,name').eq('workspace_id',workspaceId).order('created_at',{ascending:false}),
          supabase.from('issues').select('id',{count:'exact',head:true}).eq('workspace_id',workspaceId).eq('status','open').eq('severity','critical'),
          supabase.from('issues').select('id',{count:'exact',head:true}).eq('workspace_id',workspaceId).eq('status','open').eq('severity','error'),
          supabase.from('issues').select('id',{count:'exact',head:true}).eq('workspace_id',workspaceId).eq('status','open').eq('severity','warning'),
          supabase.from('issues').select('id',{count:'exact',head:true}).eq('workspace_id',workspaceId).eq('status','open').eq('severity','info'),
          supabase.from('issues').select('id',{count:'exact',head:true}).eq('workspace_id',workspaceId).eq('status','open').eq('severity','opportunity')
        ]);
        if(siteResult.error) throw siteResult.error;
        if(auditCountResult.error) throw auditCountResult.error;
        if(issueResult.error) throw issueResult.error;
        if(runResult.error) throw runResult.error;
        if(siteListResult.error) throw siteListResult.error;
        for(const result of [criticalResult,errorResult,warningResult,infoResult,opportunityResult]) if(result.error) throw result.error;
        if(!active)return;
        setSiteCount(siteResult.count??0);setAuditCount(auditCountResult.count??0);setOpenCount(issueResult.count??0);
        const rows=(runResult.data||[]) as (AuditRun & {site_id:string})[];setRuns(rows);
        const names:Record<string,string>={};for(const site of siteListResult.data||[])names[site.id]=site.name;setSites(names);setSiteOptions((siteListResult.data||[]) as {id:string;name:string}[]);
        setSeverityCounts({critical:criticalResult.count??0,error:errorResult.count??0,warning:warningResult.count??0,info:infoResult.count??0,opportunity:opportunityResult.count??0});
      }catch(err){if(active)setNotice({kind:'error',text:err instanceof Error?err.message:'Could not load workspace analytics.'});}
      finally{if(active)setBusy(false);}
    }
    void load();return()=>{active=false;};
  },[]);
  const filteredRuns=runs.filter(run=>(selectedSiteId==='all'||run.site_id===selectedSiteId)&&(dateRange==='all'||new Date(run.created_at).getTime()>=Date.now()-Number(dateRange)*86400000));
  const chartRuns=[...filteredRuns.slice(0,12)].reverse();
  const maxPages=Math.max(1,...chartRuns.map(r=>Number(r.summary?.pages_checked||0)));
  const maxIssues=Math.max(1,...chartRuns.map(r=>Number(r.summary?.issues?.total||0)));
  const hasTrend=chartRuns.some(r=>Number(r.summary?.pages_checked||0)>0||Number(r.summary?.issues?.total||0)>0);
  const severityEntries=[{key:'critical',label:'Critical',color:'#e66c75',count:severityCounts.critical||0},{key:'error',label:'Error',color:'#f0a66c',count:severityCounts.error||0},{key:'warning',label:'Warning',color:'#efbd6c',count:severityCounts.warning||0},{key:'info',label:'Info',color:'#7895ff',count:severityCounts.info||0},{key:'opportunity',label:'Opportunity',color:'#67c9aa',count:severityCounts.opportunity||0}];
  const severityTotal=severityEntries.reduce((sum,item)=>sum+item.count,0);
  const circumference=2*Math.PI*39;
  const trendPoints=chartRuns.map((run,index)=>{const value=Number(run.summary?.issues?.total||0);const x=chartRuns.length<=1?300:30+index*540/(chartRuns.length-1);const y=150-(value/Math.max(1,...chartRuns.map(r=>Number(r.summary?.issues?.total||0))))*118;return x+','+y;}).join(' ');
  return <div className="dashboard-content">
    <NoticeBar notice={notice} dismiss={()=>setNotice(null)}/>
    <section className="welcome-banner"><div className="welcome-copy"><div className="badge-line"><Sparkles size={14}/> YOUR WEBSITE COMMAND CENTER</div><h2>Make every page work harder.</h2><p>Review real audit activity, find high-priority issues and understand what to fix next.</p><button className="btn primary" onClick={()=>navigate('/app/sites/new')}>Add a website <ArrowRight size={16}/></button></div><div className="welcome-visual"><div className="orb orb-one"/><div className="orb orb-two"/><div className="mini-window"><div className="mini-window-top"><i/><i/><i/><span>SiteRadar overview</span></div><div className="mini-score"><div className="score-ring"><span>{busy?'…':String(siteCount)}</span></div><div><b>Tracked websites</b><small>{busy?'Loading workspace':siteCount?'Live workspace data':'Add a site to begin'}</small><div className="mini-bars"><i/><i/><i/></div></div></div><div className="mini-metrics"><span><b>{busy?'—':auditCount}</b> audits</span><span><b>{busy?'—':openCount}</b> open issues</span><span><b>{busy?'—':runs.reduce((n,r)=>n+Number(r.summary?.pages_checked||0),0)}</b> recent pages</span></div></div></div></section>
    <div className="stats-grid">
      <Metric icon={Globe2} label="WEBSITES" value={busy?'—':String(siteCount)} detail={siteCount===1?'1 tracked website':siteCount?'Tracked in this workspace':'Add your first website'} tone="blue"/>
      <Metric icon={ScanSearch} label="AUDITS RUN" value={busy?'—':String(auditCount)} detail={auditCount?'Saved audit history':'No audit runs yet'} tone="purple"/>
      <Metric icon={TriangleAlert} label="OPEN ISSUES" value={busy?'—':String(openCount)} detail={openCount?'Across accessible websites':'No open issues recorded'} tone="amber"/>
      <Metric icon={Globe2} label="PAGES CHECKED" value={busy?'—':String(filteredRuns.reduce((n,r)=>n+Number(r.summary?.pages_checked||0),0))} detail="Across filtered recent runs" tone="green"/>
    </div>
    <div className="content-grid">
      <section className="panel">
        <div className="panel-heading dashboard-chart-heading"><div><h3>Audit activity</h3><p>Pages checked and findings from saved crawl runs.</p></div><div className="chart-filters"><label><span>Period</span><select value={dateRange} onChange={e=>setDateRange(e.target.value)}><option value="7">7 days</option><option value="30">30 days</option><option value="90">90 days</option><option value="all">All loaded</option></select></label><label><span>Website</span><select value={selectedSiteId} onChange={e=>setSelectedSiteId(e.target.value)}><option value="all">All websites</option>{siteOptions.map(site=><option key={site.id} value={site.id}>{site.name}</option>)}</select></label><span className="step-progress">{filteredRuns.length} runs</span></div></div>
        {busy?<div className="table-empty"><span className="spinner"/> Loading analytics…</div>:!hasTrend?<div className="empty-state"><div className="empty-icon"><BarChart3 size={22}/></div><b>No chart data yet</b><p>Run an audit first. Charts will use measured crawl results, never sample values.</p><button className="btn secondary" onClick={()=>navigate('/app/sites')}>View websites <ArrowRight size={15}/></button></div>:<div style={{padding:'12px 18px 18px'}}>
          <div style={{display:'flex',gap:18,flexWrap:'wrap',fontSize:11,color:'#9aa6ba',marginBottom:14}}><span><i style={{display:'inline-block',width:8,height:8,borderRadius:2,background:'#7895ff',marginRight:6}}/>Pages checked</span><span><i style={{display:'inline-block',width:8,height:8,borderRadius:2,background:'#efbd6c',marginRight:6}}/>Findings</span></div>
          <div style={{display:'grid',gridTemplateColumns:`repeat(${Math.max(1,chartRuns.length)},minmax(22px,1fr))`,alignItems:'end',gap:8,height:150,borderBottom:'1px solid #303849',paddingBottom:1}}>
            {chartRuns.map(run=><div key={run.id} title={new Date(run.created_at).toLocaleString()+': '+Number(run.summary?.pages_checked||0)+' pages, '+Number(run.summary?.issues?.total||0)+' findings'} style={{height:'100%',display:'flex',alignItems:'end',justifyContent:'center',gap:3}}>
              <div style={{width:'42%',height:`${Math.max(3,Number(run.summary?.pages_checked||0)/maxPages*100)}%`,background:'#7895ff',borderRadius:'4px 4px 0 0',minHeight:3}}/>
              <div style={{width:'42%',height:`${Math.max(3,Number(run.summary?.issues?.total||0)/maxIssues*100)}%`,background:'#efbd6c',borderRadius:'4px 4px 0 0',minHeight:3}}/>
            </div>)}
          </div>
          <div style={{display:'grid',gridTemplateColumns:`repeat(${Math.max(1,chartRuns.length)},minmax(22px,1fr))`,gap:8,marginTop:8}}>{chartRuns.map(run=><small key={run.id} style={{color:'#78869d',fontSize:9,textAlign:'center'}}>{new Date(run.created_at).toLocaleDateString(undefined,{month:'short',day:'numeric'})}</small>)}</div>
        </div>}
      </section>
      <section className="panel">
        <div className="panel-heading"><div><h3>Recent audits</h3><p>Actual saved crawl runs and their status.</p></div><button className="text-button" onClick={()=>navigate('/app/audits')}>View all <ArrowRight size={14}/></button></div>
        {busy?<div className="table-empty"><span className="spinner"/> Loading audit history…</div>:!runs.length?<div className="empty-state"><div className="empty-icon"><Clock3 size={22}/></div><b>No audits yet</b><p>Add a website, then run an audit to populate history and charts.</p><button className="btn secondary" onClick={()=>navigate('/app/sites/new')}>Add website <ArrowRight size={15}/></button></div>:<div className="audit-list">{runs.slice(0,5).map(run=><div className="audit-row" key={run.id}><div className="audit-run-icon"><ScanSearch size={17}/></div><div className="audit-run-main"><b>{sites[run.site_id]||'Website'} · {new Date(run.created_at).toLocaleString()}</b><small>{Number(run.summary?.pages_checked||0)} pages · {Number(run.summary?.issues?.total||0)} findings</small></div><span className={'audit-status '+run.status}>{run.status}</span></div>)}</div>}
      </section>
    </div>
    <div className="content-grid dashboard-charts">
      <section className="panel">
        <div className="panel-heading"><div><h3>Open issue severity</h3><p>Distribution from this workspace's saved issue records.</p></div><span className="step-progress">{severityTotal} open</span></div>
        {busy?<div className="table-empty"><span className="spinner"/> Loading issue distribution…</div>:severityTotal===0?<div className="empty-state"><div className="empty-icon"><BarChart3 size={22}/></div><b>No open issues</b><p>Run an audit to build a severity breakdown from real findings.</p></div>:<div className="donut-layout">
          <svg viewBox="0 0 120 120" role="img" aria-label={'Open issue severity distribution: '+severityTotal+' issues'} className="donut-chart">
            <circle cx="60" cy="60" r="39" fill="none" stroke="#263143" strokeWidth="15"/>
            {severityEntries.map((item,index)=>{const length=severityTotal?(item.count/severityTotal)*circumference:0;const offset=severityEntries.slice(0,index).reduce((sum,entry)=>sum+(severityTotal?(entry.count/severityTotal)*circumference:0),0);return item.count>0?<circle key={item.key} cx="60" cy="60" r="39" fill="none" stroke={item.color} strokeWidth="15" strokeDasharray={length+' '+(circumference-length)} strokeDashoffset={-offset} transform="rotate(-90 60 60)"/>:null;})}
            <text x="60" y="57" textAnchor="middle" className="donut-total">{severityTotal}</text><text x="60" y="70" textAnchor="middle" className="donut-caption">open issues</text>
          </svg>
          <div className="donut-legend">{severityEntries.map(item=><div key={item.key}><span className="donut-legend-name"><i style={{background:item.color}}/>{item.label}</span><b>{item.count}</b><small>{severityTotal?Math.round(item.count/severityTotal*100):0}%</small></div>)}</div>
        </div>}
      </section>
      <section className="panel">
        <div className="panel-heading"><div><h3>Finding trend</h3><p>Total findings recorded across the filtered saved audit runs.</p></div><span className="step-progress">Line chart</span></div>
        {!chartRuns.length||!hasTrend?<div className="empty-state"><div className="empty-icon"><Activity size={22}/></div><b>Trend data unavailable</b><p>Choose a wider period or run another audit. No placeholder values are shown.</p></div>:<div className="trend-chart-wrap">
          <svg viewBox="0 0 600 180" preserveAspectRatio="none" role="img" aria-label="Findings trend across saved audit runs" className="trend-chart">
            {[30,70,110,150].map(y=><line key={y} x1="24" x2="576" y1={y} y2={y} stroke="#293447" strokeDasharray="4 5"/> )}
            <polyline points={trendPoints} fill="none" stroke="#91a8ff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"/>
            {chartRuns.map((run,index)=>{const value=Number(run.summary?.issues?.total||0);const x=chartRuns.length<=1?300:30+index*540/(chartRuns.length-1);const y=150-(value/Math.max(1,...chartRuns.map(r=>Number(r.summary?.issues?.total||0))))*118;return <circle key={run.id} cx={x} cy={y} r="4" fill="#91a8ff"><title>{new Date(run.created_at).toLocaleDateString()+': '+value+' findings'}</title></circle>;})}
          </svg>
          <div className="trend-chart-labels"><span>{chartRuns[0]?new Date(chartRuns[0].created_at).toLocaleDateString():''}</span><span>{chartRuns[chartRuns.length-1]?new Date(chartRuns[chartRuns.length-1].created_at).toLocaleDateString():''}</span></div>
        </div>}
      </section>
    </div>
    <section className="insight-strip"><span className="insight-symbol"><ShieldCheck size={18}/></span><div><b>Evidence first, always</b><p>Only saved crawl results appear in analytics. Performance metrics remain unavailable until a real performance test is implemented.</p></div><span className="insight-tag">REAL DATA</span></section>
  </div>;
}

function Metric({icon: Icon,label,value,detail,tone}:{icon:typeof Activity;label:string;value:string;detail:string;tone:string}) {
  return <div className="metric-card"><div className={'metric-icon '+tone}><Icon size={18}/></div><span>{label}</span><strong>{value}</strong><small>{detail}</small></div>;
}

function WebsitesPage() {
  const [sites, setSites] = useState<Site[]>([]);
  const [busy, setBusy] = useState(true);
  const [notice, setNotice] = useState<Notice>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [bulkBusy, setBulkBusy] = useState(false);
  const [workspaceName, setWorkspaceName] = useState('your workspace');
  const navigate = useNavigate();

  async function loadSites() {
    if (!supabase) { setBusy(false); return; }
    setBusy(true);
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!userData.user) throw new Error('Your session expired. Sign in again.');
      const membership = await getActiveWorkspaceMembership(userData.user.id);
      const [{ data: workspace, error: workspaceError }, { data, error }] = await Promise.all([
        supabase.from('workspaces').select('id,name').eq('id', membership.workspace_id).maybeSingle(),
        supabase.from('sites').select('id,name,start_url,normalized_origin,created_at,sitemap_url')
          .eq('workspace_id', membership.workspace_id).order('created_at', { ascending: false })
      ]);
      if (workspaceError) throw workspaceError;
      if (error) throw error;
      setWorkspaceName(workspace?.name || 'your workspace');
      setSites((data || []) as Site[]);
    } catch (err) {
      setNotice({ kind: 'error', text: err instanceof Error ? err.message : 'Could not load websites.' });
    } finally { setBusy(false); }
  }

  useEffect(() => { void loadSites(); }, []);

  function normalizePublicUrl(raw: string, label: string) {
    let parsed: URL;
    try { parsed = new URL(raw.trim().includes('://') ? raw.trim() : 'https://' + raw.trim()); }
    catch { throw new Error(label + ' must be a valid URL.'); }
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) {
      throw new Error(label + ' must use HTTP or HTTPS and must not include credentials.');
    }
    const hostname = parsed.hostname.toLowerCase();
    if (!hostname || hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local')) {
      throw new Error(label + ' must use a public hostname.');
    }
    return { url: parsed.href.replace(/\/$/, ''), origin: parsed.origin };
  }

  async function importWebsites(e: FormEvent) {
    e.preventDefault();
    if (!supabase) return setNotice({ kind: 'error', text: 'Supabase is not configured.' });
    const lines = bulkText.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    if (!lines.length) return setNotice({ kind: 'error', text: 'Add at least one website row.' });
    if (lines.length > 25) return setNotice({ kind: 'error', text: 'Import up to 25 websites per batch.' });
    setBulkBusy(true);
    setNotice(null);
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!userData.user) throw new Error('Your session expired. Sign in again.');
      const membership = await getActiveWorkspaceMembership(userData.user.id);
      if (membership.role === 'viewer') throw new Error('Viewer access cannot add websites. Ask a workspace admin.');

      const rows = lines.map((line, index) => {
        const parts = line.split('|').map(value => value.trim());
        if (parts.length < 2 || !parts[0] || !parts[1]) {
          throw new Error('Line ' + (index + 1) + ': use Website name | Website URL | Sitemap URL (optional).');
        }
        const website = normalizePublicUrl(parts[1], 'Website URL on line ' + (index + 1));
        const sitemap = parts[2] ? normalizePublicUrl(parts[2], 'Sitemap URL on line ' + (index + 1)) : null;
        if (sitemap && new URL(sitemap.url).hostname.toLowerCase() !== new URL(website.url).hostname.toLowerCase()) {
          throw new Error('Line ' + (index + 1) + ': sitemap must use the same hostname as the website in the current safe crawl scope.');
        }
        return {
          workspace_id: membership.workspace_id,
          name: parts[0].slice(0, 160),
          start_url: website.url,
          normalized_origin: website.origin,
          sitemap_url: sitemap?.url || null,
          created_by: userData.user.id
        };
      });
      const seen = new Set<string>();
      for (const row of rows) {
        if (seen.has(row.normalized_origin)) throw new Error('The import contains the same website more than once: ' + row.normalized_origin);
        seen.add(row.normalized_origin);
      }
      const { data: existing, error: existingError } = await supabase.from('sites')
        .select('normalized_origin').eq('workspace_id', membership.workspace_id);
      if (existingError) throw existingError;
      const existingOrigins = new Set((existing || []).map(row => row.normalized_origin));
      const newRows = rows.filter(row => !existingOrigins.has(row.normalized_origin));
      const skipped = rows.length - newRows.length;
      if (!newRows.length) throw new Error('All websites in this batch already exist in ' + workspaceName + '.');

      // Single insert keeps the import atomic; workspace RLS and server-side edition quotas still apply.
      const { data: inserted, error: insertError } = await supabase.from('sites')
        .insert(newRows).select('id,name,start_url,normalized_origin,created_at,sitemap_url');
      if (insertError) throw insertError;
      setSites(current => [...((inserted || []) as Site[]), ...current]);
      setBulkText('');
      setBulkOpen(false);
      setNotice({ kind: 'success', text: (inserted || []).length + ' website(s) added to ' + workspaceName + (skipped ? '; ' + skipped + ' existing website(s) skipped.' : '.') });
    } catch (err) {
      setNotice({ kind: 'error', text: err instanceof Error ? err.message : 'Could not import these websites.' });
    } finally { setBulkBusy(false); }
  }

  return <div className="page-content">
    <div className="list-toolbar">
      <div><b>Your websites</b><p>Manage all properties in <strong>{workspaceName}</strong>. Each website keeps its own sitemap, audits and issues.</p></div>
      <div className="page-head-actions">
        <button className="btn secondary" onClick={() => setBulkOpen(value => !value)}><Plus size={15}/> {bulkOpen ? 'Close bulk import' : 'Bulk add websites'}</button>
        <button className="btn primary" onClick={() => navigate('/app/sites/new')}><Plus size={15}/> Add website</button>
      </div>
    </div>
    <NoticeBar notice={notice} dismiss={() => setNotice(null)}/>
    {bulkOpen && <section className="panel" style={{ marginBottom: 18 }}>
      <div className="panel-heading"><div><h3>Import website portfolio</h3><p>Paste your 5–6 demo properties and their sitemap URLs. One line per website.</p></div><span className="panel-badge">BULK IMPORT</span></div>
      <form className="product-form" onSubmit={importWebsites}>
        <label className="field"><span>Website name | Website URL | Sitemap URL</span>
          <textarea className="filter-input" rows={7} value={bulkText} onChange={event => setBulkText(event.target.value)}
            placeholder={'Main website | https://example.com | https://example.com/sitemap_index.xml\nStore website | https://store.example.com | https://store.example.com/sitemap.xml'} />
        </label>
        <small className="field-hint">Sitemap is optional. Up to 25 rows per batch. Imported websites are added to this existing workspace, not separate workspaces.</small>
        <div className="form-actions"><button type="button" className="btn secondary" onClick={() => setBulkText('')}>Clear</button><button className="btn primary" type="submit" disabled={bulkBusy || !bulkText.trim()}>{bulkBusy ? <><span className="spinner"/> Importing…</> : <>Import websites <ArrowRight size={15}/></>}</button></div>
      </form>
    </section>}
    {!hasSupabaseConfig && <ConfigNotice/>}
    <section className="panel sites-panel">
      <div className="table-heading"><span>WEBSITE</span><span>SITEMAP</span><span>ADDED</span><span/></div>
      {busy ? <div className="table-empty"><span className="spinner"/> Loading websites…</div>
        : !sites.length ? <div className="empty-state"><div className="empty-icon"><Globe2 size={22}/></div><b>No websites added</b><p>Add your first website, or bulk-import the demo portfolio with sitemap URLs.</p><button className="btn primary" onClick={() => setBulkOpen(true)}><Plus size={15}/> Bulk add websites</button></div>
        : sites.map(site => <div className="site-row" key={site.id}><span className="site-cell"><span className="site-favicon"><Globe2 size={17}/></span><span><b>{site.name}</b><small>{site.start_url}</small></span></span><span className="site-date">{site.sitemap_url ? 'Configured' : 'Auto-discovery'}</span><span className="site-date">{new Date(site.created_at).toLocaleDateString()}</span><button className="icon-button" title="Open website" onClick={() => navigate('/app/sites/' + site.id)}><ArrowRight size={15}/></button></div>)}
    </section>
  </div>;
}

function AddSitePage() {
  const [url,setUrl]=useState('');const [name,setName]=useState('');const [sitemap,setSitemap]=useState('');
  const [workspaceName,setWorkspaceName]=useState('your workspace');
  const [busy,setBusy]=useState(false);const[notice,setNotice]=useState<Notice>(null);const navigate=useNavigate();

  useEffect(()=>{
    let active=true;
    async function loadWorkspace(){
      if(!supabase)return;
      try{
        const {data:userData,error:userError}=await supabase.auth.getUser();
        if(userError)throw userError;
        if(!userData.user)throw new Error('Sign in to add a website.');
        const membership=await getActiveWorkspaceMembership(userData.user.id);
        const {data,error}=await supabase.from('workspaces').select('id,name').eq('id',membership.workspace_id).maybeSingle();
        if(error)throw error;
        if(active)setWorkspaceName(data?.name||'your workspace');
      }catch(err){if(active)setNotice({kind:'error',text:err instanceof Error?err.message:'Could not load your workspace.'});}
    }
    void loadWorkspace();
    return()=>{active=false;};
  },[]);

  function normalize(raw:string,label:string){
    let parsed:URL;try{parsed=new URL(raw.trim().includes('://')?raw.trim():'https://'+raw.trim());}catch{throw new Error('Enter a valid '+label+' URL.');}
    if(!['http:','https:'].includes(parsed.protocol)||parsed.username||parsed.password)throw new Error(label+' must use HTTP or HTTPS and must not include credentials.');
    if(!parsed.hostname||parsed.hostname==='localhost'||parsed.hostname.endsWith('.localhost')||parsed.hostname.endsWith('.local'))throw new Error(label+' must use a public hostname.');
    return {url:parsed.href.replace(/\/$/,''),origin:parsed.origin};
  }

  async function submit(e:FormEvent){
    e.preventDefault();if(!supabase)return setNotice({kind:'error',text:'Supabase is not configured.'});
    setBusy(true);setNotice(null);
    try{
      const parsed=normalize(url,'website');
      const sitemapUrl=sitemap.trim()?normalize(sitemap,'sitemap').url:null;
      if(sitemapUrl&&new URL(sitemapUrl).hostname.toLowerCase()!==new URL(parsed.url).hostname.toLowerCase())throw new Error('Sitemap must use the same hostname as this website in the current safe crawl scope.');
      const {data:userData,error:userError}=await supabase.auth.getUser();if(userError)throw userError;if(!userData.user)throw new Error('Your session expired. Sign in again.');
      const membership=await getActiveWorkspaceMembership(userData.user.id);
      if(membership.role==='viewer')throw new Error('Viewer access cannot add websites. Ask a workspace admin.');
      const {data:existing,error:existingError}=await supabase.from('sites').select('id').eq('workspace_id',membership.workspace_id).eq('normalized_origin',parsed.origin).limit(1).maybeSingle();
      if(existingError)throw existingError;
      if(existing)throw new Error('This website is already registered in '+workspaceName+'.');
      const {data:site,error:siteError}=await supabase.from('sites').insert({
        workspace_id:membership.workspace_id,name:(name.trim()||parsed.origin).slice(0,160),start_url:parsed.url,normalized_origin:parsed.origin,
        sitemap_url:sitemapUrl,created_by:userData.user.id
      }).select('id').single();
      if(siteError)throw siteError;
      navigate('/app/sites/'+site.id,{replace:true});
    }catch(err){setNotice({kind:'error',text:err instanceof Error?err.message:'Could not create website.'});}
    finally{setBusy(false);}
  }

  return <div className="page-content">
    <button className="back-link" onClick={()=>navigate('/app/sites')}><ArrowRight size={14}/> Back to websites</button>
    <div className="form-layout">
      <section className="panel add-site-panel">
        <div className="panel-heading"><div><h3>Add a website</h3><p>Add another website under the same workspace.</p></div><span className="panel-badge">NEW WEBSITE</span></div>
        <NoticeBar notice={notice} dismiss={()=>setNotice(null)}/>{!hasSupabaseConfig&&<ConfigNotice/>}
        <form className="product-form" onSubmit={submit}>
          <div className="form-note"><Globe2 size={17}/><span><b>Workspace: {workspaceName}</b><small>This adds a site to the current workspace; it does not create a new workspace.</small></span></div>
          <Field label="Website URL" id="site-url" value={url} onChange={setUrl} placeholder="https://example.com" autoComplete="url"/>
          <Field label="Website name (optional)" id="site-name" value={name} onChange={setName} placeholder="Company website" required={false}/>
          <Field label="Sitemap URL (optional)" id="site-sitemap" value={sitemap} onChange={setSitemap} placeholder="https://example.com/sitemap.xml" required={false} hint="Sitemap indexes are supported. SiteRadar checks the same-host URLs safely."/>
          <div className="form-note"><ShieldCheck size={17}/><span><b>Bounded safe crawl</b><small>The worker rechecks public DNS, same-host redirects and robots.txt. Page count is limited by your edition and the 90-second run budget; oversized websites are marked partial.</small></span></div>
          <div className="form-actions"><button type="button" className="btn secondary" onClick={()=>navigate('/app/sites')}>Cancel</button><button className="btn primary" type="submit" disabled={busy||!hasSupabaseConfig}>{busy?<><span className="spinner"/> Adding…</>:<>Add website <ArrowRight size={15}/></>}</button></div>
        </form>
      </section>
      <aside className="panel guidance-panel"><span className="guidance-icon"><ScanSearch size={20}/></span><h3>What happens next?</h3>
        <div className="guidance-step"><i>1</i><div><b>Save this website</b><p>The website and sitemap are stored in the current workspace.</p></div></div>
        <div className="guidance-step"><i>2</i><div><b>Run an audit</b><p>Nested sitemap indexes and same-host links are discovered within the run limits.</p></div></div>
        <div className="guidance-step"><i>3</i><div><b>Review evidence</b><p>See saved page, issue, performance timing and passive header observations.</p></div></div>
      </aside>
    </div>
  </div>;
}

type IssueRecord={id:string;site_id:string;rule_id:string;category:string;severity:'critical'|'error'|'warning'|'info'|'opportunity';title:string;description:string;recommendation:string;status:'open'|'ignored'|'resolved';metadata:Record<string,unknown>;first_seen_at:string;last_seen_at:string};
type PageRecord={id:string;normalized_url:string;status_code:number|null;indexability_status:string;fetch_state:string;meta_snapshot:Record<string,unknown>;crawl_depth:number|null;inlinks_count:number;outlinks_count:number;fetched_at:string|null};
type SiteOption={id:string;name:string;start_url:string};

function IssuesPage(){
  const[issues,setIssues]=useState<IssueRecord[]>([]);const[siteNames,setSiteNames]=useState<Record<string,string>>({});
  const[busy,setBusy]=useState(true);const[notice,setNotice]=useState<Notice>(null);const[query,setQuery]=useState('');
  const[statusFilter,setStatusFilter]=useState('open');const[severityFilter,setSeverityFilter]=useState('all');const[updating,setUpdating]=useState<string|null>(null);
  async function refresh(){
    if(!supabase){setBusy(false);return;}
    try{
      const {data:userData,error:userError}=await supabase.auth.getUser();if(userError)throw userError;if(!userData.user)throw new Error('Sign in to load issues.');
      const membership=await getActiveWorkspaceMembership(userData.user.id);
      const {data,error}=await supabase.from('issues').select('id,site_id,rule_id,category,severity,title,description,recommendation,status,metadata,first_seen_at,last_seen_at').eq('workspace_id',membership.workspace_id).order('last_seen_at',{ascending:false}).limit(250);
      if(error)throw error;
      const rows=(data||[]) as IssueRecord[];setIssues(rows);
      const ids=[...new Set(rows.map(x=>x.site_id))];
      if(ids.length){const {data:sites}=await supabase.from('sites').select('id,name').in('id',ids);const names:Record<string,string>={};for(const site of sites||[])names[site.id]=site.name;setSiteNames(names);}
    }catch(err){setNotice({kind:'error',text:err instanceof Error?err.message:'Could not load audit findings.'});}
    finally{setBusy(false);}
  }
  useEffect(()=>{void refresh();},[]);
  async function changeStatus(issue:IssueRecord,status:IssueRecord['status']){
    if(!supabase)return;setUpdating(issue.id);setNotice(null);
    try{const {error}=await supabase.from('issues').update({status,updated_at:new Date().toISOString()}).eq('id',issue.id);if(error)throw error;setIssues(old=>old.map(x=>x.id===issue.id?{...x,status}:x));setNotice({kind:'success',text:status==='resolved'?'Issue marked resolved.':status==='ignored'?'Issue ignored.':'Issue reopened.'});}
    catch(err){setNotice({kind:'error',text:err instanceof Error?err.message:'Could not update this issue.'});}
    finally{setUpdating(null);}
  }
  const filtered=issues.filter(x=>{
    const hay=[x.title,x.description,x.rule_id,x.category,String(x.metadata?.url||''),siteNames[x.site_id]||''].join(' ').toLowerCase();
    return (statusFilter==='all'||x.status===statusFilter)&&(severityFilter==='all'||x.severity===severityFilter)&&hay.includes(query.toLowerCase().trim());
  });
  const counts={open:issues.filter(x=>x.status==='open').length,resolved:issues.filter(x=>x.status==='resolved').length,ignored:issues.filter(x=>x.status==='ignored').length};
  return <div className="page-content">
    <div className="list-toolbar"><div><b>Issue explorer</b><p>Findings from actual crawl runs, with evidence and recommended next steps.</p></div><button className="btn secondary" onClick={()=>void refresh()}><Activity size={14}/> Refresh</button></div>
    <NoticeBar notice={notice} dismiss={()=>setNotice(null)}/>
    <div className="filter-row"><input className="filter-input" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search rule, URL, website or issue…"/><select className="filter-select" value={severityFilter} onChange={e=>setSeverityFilter(e.target.value)}><option value="all">All severities</option><option value="critical">Critical</option><option value="error">Error</option><option value="warning">Warning</option><option value="info">Info</option><option value="opportunity">Opportunity</option></select></div>
    <div className="filter-tabs">{[['open','Open',counts.open],['resolved','Resolved',counts.resolved],['ignored','Ignored',counts.ignored],['all','All',issues.length]].map(([value,label,count])=><button key={String(value)} className={statusFilter===value?'active':''} onClick={()=>setStatusFilter(String(value))}>{label}<span>{count}</span></button>)}</div>
    <section className="panel">
      {busy?<div className="table-empty"><span className="spinner"/> Loading issues…</div>:!filtered.length?<div className="empty-state"><div className="empty-icon"><TriangleAlert size={22}/></div><b>{issues.length?'No matching issues':'No findings yet'}</b><p>{issues.length?'Try another filter or search term.':'Add a website and run an audit. Confirmed findings will appear here with their evidence.'}</p><Link className="btn primary" to="/app/sites">View websites <ArrowRight size={15}/></Link></div>:<div className="issue-list">{filtered.map(issue=><article className="issue-card" key={issue.id}><div className="issue-card-top"><span className={'severity-pill '+issue.severity}>{issue.severity}</span><span className="issue-category">{issue.category.replace(/-/g,' ')}</span><span className={'audit-status '+issue.status}>{issue.status}</span></div><h3>{issue.title}</h3><p>{issue.description}</p><div className="issue-url"><Globe2 size={13}/><span>{siteNames[issue.site_id]||'Website'} · {String(issue.metadata?.url||'URL unavailable')}</span></div><div className="issue-recommendation"><b>Recommended fix</b><p>{issue.recommendation}</p></div><div className="issue-card-bottom"><span>Rule: <code>{issue.rule_id}</code> · Last seen {new Date(issue.last_seen_at).toLocaleString()}</span><div>{issue.status!=='resolved'&&<button className="btn secondary" disabled={updating===issue.id} onClick={()=>void changeStatus(issue,'resolved')}>Resolve</button>}{issue.status!=='ignored'&&<button className="btn secondary" disabled={updating===issue.id} onClick={()=>void changeStatus(issue,'ignored')}>Ignore</button>}{issue.status!=='open'&&<button className="btn primary" disabled={updating===issue.id} onClick={()=>void changeStatus(issue,'open')}>Reopen</button>}</div></div></article>)}</div>}
    </section>
  </div>;
}

function AuditsPage(){
  const[sites,setSites]=useState<Record<string,string>>({});const[runs,setRuns]=useState<AuditRun[]>([]);const[busy,setBusy]=useState(true);const[notice,setNotice]=useState<Notice>(null);
  useEffect(()=>{let active=true;async function load(){if(!supabase){setBusy(false);return;}try{
    const {data:userData,error:userError}=await supabase.auth.getUser();if(userError)throw userError;if(!userData.user)throw new Error('Sign in to load audit history.');
    const membership=await getActiveWorkspaceMembership(userData.user.id);
    const {data,error}=await supabase.from('audit_runs').select('id,site_id,status,created_at,started_at,finished_at,summary').eq('workspace_id',membership.workspace_id).order('created_at',{ascending:false}).limit(100);if(error)throw error;
    if(!active)return;const rows=(data||[]) as AuditRun[];setRuns(rows);
    const ids=[...new Set(rows.map(x=>(x as any).site_id as string))];if(ids.length){const {data:siteRows}=await supabase.from('sites').select('id,name').in('id',ids);if(!active)return;const names:Record<string,string>={};for(const site of siteRows||[])names[site.id]=site.name;setSites(names);}
  }catch(err){if(active)setNotice({kind:'error',text:err instanceof Error?err.message:'Could not load audit history.'});}finally{if(active)setBusy(false);}}void load();return()=>{active=false;};},[]);
  return <div className="page-content"><div className="list-toolbar"><div><b>Audit history</b><p>Run status, pages checked, issue counts and fetch limitations.</p></div><Link className="btn primary" to="/app/sites"><Globe2 size={14}/> Websites</Link></div><NoticeBar notice={notice} dismiss={()=>setNotice(null)}/><section className="panel"><div className="panel-heading"><div><h3>Recent audit runs</h3><p>Partial runs are clearly labelled when the page budget is reached or fetches fail.</p></div></div>{busy?<div className="table-empty"><span className="spinner"/> Loading audits…</div>:!runs.length?<div className="empty-state"><div className="empty-icon"><ScanSearch size={22}/></div><b>No audit runs yet</b><p>Open a website project and run your first audit.</p><Link className="btn primary" to="/app/sites">Open websites</Link></div>:<div className="audit-list">{runs.map(run=>{const sum=run.summary||{};const iss=sum.issues||{};const siteId=(run as any).site_id as string;return <div className="audit-row" key={run.id}><div className="audit-run-icon"><ScanSearch size={17}/></div><div className="audit-run-main"><b>{sites[siteId]||'Website'} · {new Date(run.created_at).toLocaleString()}</b><small>{sum.pages_checked??0} pages checked · {iss.total??0} findings · {sum.fetch?.failed??0} fetch failures</small></div><span className={'audit-status '+run.status}>{run.status}</span><Link className="icon-button" to={'/app/sites/'+siteId} aria-label="Open website audit"><ArrowRight size={15}/></Link></div>})}</div>}</section></div>;
}

function PagesPage(){
  const[sites,setSites]=useState<SiteOption[]>([]);const[siteId,setSiteId]=useState('');const[pages,setPages]=useState<PageRecord[]>([]);const[run,setRun]=useState<AuditRun|null>(null);const[busy,setBusy]=useState(true);const[notice,setNotice]=useState<Notice>(null);const[query,setQuery]=useState('');
  useEffect(()=>{let active=true;async function load(){if(!supabase){setBusy(false);return;}try{const {data:userData,error:userError}=await supabase.auth.getUser();if(userError)throw userError;if(!userData.user)throw new Error('Sign in to load pages.');const membership=await getActiveWorkspaceMembership(userData.user.id);const {data,error}=await supabase.from('sites').select('id,name,start_url').eq('workspace_id',membership.workspace_id).order('created_at',{ascending:false});if(error)throw error;if(!active)return;const rows=(data||[]) as SiteOption[];setSites(rows);if(rows.length)setSiteId(rows[0].id);}catch(err){if(active)setNotice({kind:'error',text:err instanceof Error?err.message:'Could not load websites.'});}finally{if(active)setBusy(false);}}void load();return()=>{active=false;};},[]);
  useEffect(()=>{let active=true;async function loadPages(){if(!supabase||!siteId){setPages([]);setRun(null);return;}setBusy(true);try{const {data:runData,error:runError}=await supabase.from('audit_runs').select('id,site_id,status,created_at,started_at,finished_at,summary').eq('site_id',siteId).order('created_at',{ascending:false}).limit(1).maybeSingle();if(runError)throw runError;if(!runData){if(active){setRun(null);setPages([]);}return;}if(!active)return;setRun(runData as AuditRun);const {data,error}=await supabase.from('pages').select('id,normalized_url,status_code,indexability_status,fetch_state,meta_snapshot,crawl_depth,inlinks_count,outlinks_count,fetched_at').eq('audit_run_id',runData.id).order('crawl_depth',{ascending:true}).limit(500);if(error)throw error;if(active)setPages((data||[]) as PageRecord[]);}catch(err){if(active)setNotice({kind:'error',text:err instanceof Error?err.message:'Could not load crawled pages.'});}finally{if(active)setBusy(false);}}void loadPages();return()=>{active=false;};},[siteId]);
  const filtered=pages.filter(p=>(p.normalized_url+' '+String(p.meta_snapshot?.title||'')+' '+String(p.status_code||'')).toLowerCase().includes(query.toLowerCase().trim()));
  function exportPages(){
    const rows=[['Page URL','HTTP status','Indexability','Fetch state','Crawl depth','Inlinks','Outlinks','Response ms','Title','Meta description','Canonical','Fetched at'],
      ...filtered.map(p=>[p.normalized_url,String(p.status_code??''),p.indexability_status,p.fetch_state,String(p.crawl_depth??''),String(p.inlinks_count),String(p.outlinks_count),String(p.meta_snapshot?.response_time_ms||''),String(p.meta_snapshot?.title||''),String(p.meta_snapshot?.description||''),String(p.meta_snapshot?.canonical||''),String(p.fetched_at||'')])];
    const escape=(value:string)=>{let v=value??'';if(/^[\\s]*[=+@-]/.test(v))v="'"+v;return /[",\\n\\r]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v;};
    const csv=rows.map(row=>row.map(escape).join(',')).join('\\r\\n');
    const blob=new Blob(['\\ufeff',csv],{type:'text/csv;charset=utf-8;'});
    const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='siteradar-page-inventory.csv';document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
  }
  return <div className="page-content"><div className="list-toolbar"><div><b>Pages & links</b><p>Page inventory from the most recent audit run for a selected website.</p></div><button className="btn secondary" onClick={exportPages} disabled={!filtered.length}>Export visible pages <ArrowRight size={14}/></button></div><NoticeBar notice={notice} dismiss={()=>setNotice(null)}/><div className="filter-row"><select className="filter-select site-filter" value={siteId} onChange={e=>setSiteId(e.target.value)}><option value="">Select website</option>{sites.map(site=><option key={site.id} value={site.id}>{site.name}</option>)}</select><input className="filter-input" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search URL, title or status…"/></div><section className="panel"><div className="panel-heading"><div><h3>{run?'Pages from '+new Date(run.created_at).toLocaleString():'Page inventory'}</h3><p>{pages.length} recorded pages · no JavaScript rendering in this MVP</p></div>{run&&<span className={'audit-status '+run.status}>{run.status}</span>}</div>{busy?<div className="table-empty"><span className="spinner"/> Loading pages…</div>:!filtered.length?<div className="empty-state"><div className="empty-icon"><Link2 size={22}/></div><b>{pages.length?'No matching pages':'No crawl pages yet'}</b><p>{pages.length?'Try another search.':'Run an audit for this website to populate the page inventory.'}</p></div>:<div className="page-table"><div className="page-table-head"><span>PAGE URL</span><span>HTTP</span><span>INDEXABILITY</span><span>DEPTH</span></div>{filtered.map(p=><div className="page-table-row" key={p.id}><div><b>{String(p.meta_snapshot?.title||'Untitled page')}</b><small>{p.normalized_url}</small></div><span className={'http-code '+(p.status_code&&p.status_code>=400?'bad':p.status_code&&p.status_code<400?'good':'unknown')}>{p.status_code??'—'}</span><span>{p.indexability_status}</span><span>{p.crawl_depth??'—'}</span></div>)}</div>}</section></div>;
}

function ProductsPage() {
  type Product={product_key:string;display_name:string;description:string;app_url:string|null;is_available:boolean;sort_order:number};
  const [products,setProducts]=useState<Product[]>([]);
  const [entitlements,setEntitlements]=useState<Record<string,{edition_key:string;status:string}>>({});
  const [busy,setBusy]=useState(true);
  const [error,setError]=useState('');
  const navigate=useNavigate();
  const location=useLocation();
  useEffect(()=>{
    if(!supabase){setError('Product directory is unavailable until the database is configured.');setBusy(false);return;}
    void (async()=>{
      const {data:productData,error:productError}=await supabase!.from('product_catalog').select('product_key,display_name,description,app_url,is_available,sort_order').order('sort_order');
      if(productError)throw productError;
      setProducts((productData||[]) as Product[]);
      const {data:userData,error:userError}=await supabase!.auth.getUser();if(userError)throw userError;if(!userData.user)throw new Error('Sign in to view product access.');
      const membership=await getActiveWorkspaceMembership(userData.user.id);
      const {data:workspace,error:workspaceError}=await supabase!.from('workspaces').select('id').eq('id',membership.workspace_id).maybeSingle();if(workspaceError)throw workspaceError;
      if(workspace){
        const {data:entitlementData,error:entitlementError}=await supabase!.from('workspace_product_entitlements').select('product_key,edition_key,status').eq('workspace_id',workspace.id);
        if(entitlementError)throw entitlementError;
        const map:Record<string,{edition_key:string;status:string}>={};
        for(const row of entitlementData||[])map[row.product_key]={edition_key:row.edition_key,status:row.status};
        setEntitlements(map);
      }
    })().catch(err=>setError(err instanceof Error?err.message:'Could not load product directory.')).finally(()=>setBusy(false));
  },[]);
  const inApp=location.pathname.startsWith('/app/');
  return <div className={inApp?'dashboard-content':'products-public'}>
    {!inApp&&<header className="landing-nav"><Brand/><nav><Link to="/">Overview</Link><Link to="/pricing">Plans</Link><Link to="/login">Sign in</Link></nav></header>}
    {!inApp&&<section className="pricing-hero"><div className="badge-line"><span className="live-dot"/> PRODUCT ECOSYSTEM</div><h1>One account. Multiple products.</h1><p>Product availability and access are controlled by the account and entitlement service, not by a URL parameter alone.</p></section>}
    {error&&<div className="notice error">{error}</div>}
    {busy?<div className="pricing-loading"><span className="spinner"/> Loading products…</div>:<div className="product-directory-grid">{products.map(product=>{
      const entitlement=entitlements[product.product_key];
      const isCurrent=product.product_key==='siteradar';
      const available=product.is_available&&(isCurrent||Boolean(product.app_url));
      return <section className={'panel product-directory-card '+(available?'product-available':'product-pending')} key={product.product_key}>
        <div className="product-directory-icon"><Network size={21}/></div>
        <div className="product-directory-top"><h3>{product.display_name}</h3><span className={'audit-status '+(available?'active':'queued')}>{available?'Available':'Integration pending'}</span></div>
        <p>{product.description}</p>
        {entitlement&&<div className="product-entitlement"><span>Your edition</span><b>{entitlement.edition_key[0].toUpperCase()+entitlement.edition_key.slice(1)} · {entitlement.status.replaceAll('_',' ')}</b></div>}
        {available?<button className="btn primary full" onClick={()=>{if(isCurrent)navigate(inApp?'/app':'/pricing');else if(product.app_url)window.location.assign(product.app_url);}}>{isCurrent?(inApp?'Open SiteRadar':'View SiteRadar plans'):'Open '+product.display_name} <ArrowRight size={15}/></button>:<button className="btn secondary full" disabled title="Product URL and shared-auth integration are not configured yet">Not connected yet</button>}
      </section>;
    })}</div>}
    {!inApp&&<div className="pricing-note"><b>Shared-login status:</b> SiteRadar account onboarding and product entitlements are prepared. E1 and Inventory cannot be opened through the same login until their repositories, deployed URLs and shared Auth configuration are connected.</div>}
  </div>;
}

function NotificationsPage() {
  type NoticeRecord={id:string;notification_type:string;channel:string;scheduled_for:string;status:string;recipient_email:string|null;payload:Record<string,unknown>;attempts:number;last_error:string|null;sent_at:string|null;created_at:string};
  const [items,setItems]=useState<NoticeRecord[]>([]);
  const [busy,setBusy]=useState(true);
  const [notice,setNotice]=useState<Notice>(null);
  async function load(){
    if(!supabase){setBusy(false);return;}
    setBusy(true);setNotice(null);
    try{
      const {data:userData,error:userError}=await supabase.auth.getUser();if(userError)throw userError;if(!userData.user)throw new Error('Sign in to view notifications.');
      const membership=await getActiveWorkspaceMembership(userData.user.id);
      const {data,error}=await supabase.from('subscription_notifications').select('id,notification_type,channel,scheduled_for,status,recipient_email,payload,attempts,last_error,sent_at,created_at').eq('workspace_id',membership.workspace_id).order('created_at',{ascending:false}).limit(100);
      if(error)throw error;
      setItems((data||[]) as NoticeRecord[]);
    }catch(err){setNotice({kind:'error',text:err instanceof Error?err.message:'Could not load notifications.'});}
    finally{setBusy(false);}
  }
  useEffect(()=>{void load();},[]);
  const labels:Record<string,string>={trial_started:'Trial started',trial_ending_3_days:'Trial ending in about 3 days',trial_ending_1_day:'Trial ending within a day',trial_expired:'Trial expired',subscription_activated:'Subscription activated',payment_past_due:'Payment needs attention',subscription_canceled:'Subscription canceled'};
  return <div className="dashboard-content">
    <NoticeBar notice={notice} dismiss={()=>setNotice(null)}/>
    <section className="panel">
      <div className="panel-heading"><div><h3>Subscription notifications</h3><p>Lifecycle notices for this workspace. Delivery status is shown separately from queued status.</p></div><button className="btn secondary" onClick={()=>void load()} disabled={busy}>{busy?<><span className="spinner"/> Refreshing…</>:<>Refresh <Activity size={14}/></>}</button></div>
      {busy?<div className="table-empty"><span className="spinner"/> Loading notifications…</div>:!items.length?<div className="empty-state"><div className="empty-icon"><Bell size={22}/></div><b>No notifications yet</b><p>Trial reminders, expiry notices and subscription events will appear here when queued.</p></div>:<div className="notification-list">{items.map(item=><article className="notification-row" key={item.id}>
        <span className="notification-icon"><Bell size={16}/></span>
        <div className="notification-main"><b>{labels[item.notification_type]||item.notification_type.replaceAll('_',' ')}</b><p>{typeof item.payload?.plan_key==='string'?(String(item.payload.plan_key).charAt(0).toUpperCase()+String(item.payload.plan_key).slice(1)+' edition · '):''}{item.recipient_email?'To '+item.recipient_email:'Email recipient is resolved by the delivery worker'}</p><small>Created {new Date(item.created_at).toLocaleString()} · {item.channel}</small>{item.last_error&&<small className="notification-error">Delivery note: {item.last_error}</small>}</div>
        <div className="notification-meta"><span className={'audit-status '+item.status}>{item.status}</span><small>{item.sent_at?'Sent '+new Date(item.sent_at).toLocaleString():item.status==='queued'?'Awaiting delivery':item.status==='failed'?'Attempts: '+item.attempts:'Scheduled '+new Date(item.scheduled_for).toLocaleString()}</small></div>
      </article>)}</div>}
    </section>
  </div>;
}

function BillingPage() {
  type Plan = {plan_key:Edition;display_name:string;description:string;currency:string;monthly_price_minor:number|null;annual_price_minor:number|null;trial_days:number;limits:Record<string,number>;features:Record<string,boolean>};
  type Subscription = {workspace_id:string;plan_key:Edition;status:string;trial_started_at:string|null;trial_ends_at:string|null;current_period_end:string|null;cancel_at_period_end:boolean;activation_source:string};
  const [plans,setPlans] = useState<Plan[]>([]);
  const [featureCatalog,setFeatureCatalog] = useState<FeatureCatalogEntry[]>([]);
  const [subscription,setSubscription] = useState<Subscription|null>(null);
  const [workspaceId,setWorkspaceId] = useState('');
  const [workspaceName,setWorkspaceName] = useState('');
  const [usage,setUsage] = useState({sites:0,auditsThisMonth:0});
  const [busy,setBusy] = useState(true);
  const [workingPlan,setWorkingPlan] = useState<Edition|null>(null);
  const [notice,setNotice] = useState<Notice>(null);
  const [coupon,setCoupon] = useState('');
  const [couponPlan,setCouponPlan] = useState<Edition>('standard');
  const [couponNotice,setCouponNotice] = useState<Notice>(null);
  async function load() {
    if(!supabase){setBusy(false);return;}
    setBusy(true);
    try {
      const {data:userData,error:userError}=await supabase.auth.getUser();if(userError)throw userError;if(!userData.user)throw new Error('Sign in to manage billing.');
      const membership=await getActiveWorkspaceMembership(userData.user.id);
      const {data:workspace,error:workspaceError}=await supabase.from('workspaces').select('id,name').eq('id',membership.workspace_id).maybeSingle();
      if(workspaceError)throw workspaceError;
      if(!workspace){setNotice({kind:'info',text:'Complete workspace setup before managing an edition.'});return;}
      const {error:refreshError}=await supabase.rpc('refresh_siteradar_subscription');if(refreshError)throw refreshError;
      setWorkspaceId(workspace.id);setWorkspaceName(workspace.name);
      const monthStart=new Date();monthStart.setUTCDate(1);monthStart.setUTCHours(0,0,0,0);
      const [planResult,featureResult,subResult,siteUsageResult,auditUsageResult]=await Promise.all([
        supabase.from('plan_catalog').select('plan_key,display_name,description,currency,monthly_price_minor,annual_price_minor,trial_days,limits,features').order('sort_order'),
        supabase.from('feature_catalog').select('feature_key,display_name,category,implementation_status,description,sort_order').order('sort_order'),
        supabase.from('workspace_subscriptions').select('workspace_id,plan_key,status,trial_started_at,trial_ends_at,current_period_end,cancel_at_period_end,activation_source').eq('workspace_id',workspace.id).maybeSingle(),
        supabase.from('sites').select('id',{count:'exact',head:true}).eq('workspace_id',workspace.id),
        supabase.from('audit_runs').select('id',{count:'exact',head:true}).eq('workspace_id',workspace.id).gte('created_at',monthStart.toISOString())
      ]);
      if(planResult.error)throw planResult.error;if(featureResult.error)throw featureResult.error;if(subResult.error)throw subResult.error;if(siteUsageResult.error)throw siteUsageResult.error;if(auditUsageResult.error)throw auditUsageResult.error;
      setPlans((planResult.data||[]) as Plan[]);setFeatureCatalog((featureResult.data||[]) as FeatureCatalogEntry[]);setSubscription((subResult.data||null) as Subscription|null);
      setUsage({sites:siteUsageResult.count??0,auditsThisMonth:auditUsageResult.count??0});
    } catch(err) {setNotice({kind:'error',text:err instanceof Error?err.message:'Could not load plan information.'});}
    finally {setBusy(false);}
  }
  useEffect(()=>{void load();},[]);
  async function validateCoupon(e:FormEvent) {
    e.preventDefault();
    if(!supabase||!workspaceId)return setCouponNotice({kind:'error',text:'Sign in and complete workspace setup before validating a coupon.'});
    if(!coupon.trim())return setCouponNotice({kind:'error',text:'Enter a coupon code first.'});
    setCouponNotice({kind:'info',text:'Checking coupon…'});
    try {
      const {data,error}=await supabase.rpc('validate_siteradar_coupon',{p_workspace_id:workspaceId,p_code:coupon.trim(),p_plan_key:couponPlan});
      if(error)throw error;
      setCouponNotice({kind:data?.applies_to_trial?'success':'info',text:data?.message||'Coupon validated.'});
    } catch(err) {setCouponNotice({kind:'error',text:err instanceof Error?err.message:'Could not validate this coupon.'});}
  }
  async function startTrial(plan:Edition) {
    if(!supabase||!workspaceId)return;
    if(coupon.trim()&&couponPlan!==plan)return setNotice({kind:'error',text:'This coupon is selected for '+couponPlan+'. Select that edition or change the coupon edition before starting a trial.'});
    setWorkingPlan(plan);setNotice(null);
    try {
      const {error}=await supabase.rpc('start_siteradar_edition_trial',{p_workspace_id:workspaceId,p_plan_key:plan,p_coupon_code:coupon.trim()||null});
      if(error)throw error;
      setNotice({kind:'success',text:plan[0].toUpperCase()+plan.slice(1)+' trial activated. No payment was collected.'});
      setCouponNotice(null);setCoupon('');
      await load();
    } catch(err) {
      const message=err instanceof Error?err.message:'Could not activate the trial.';
      setNotice({kind:'error',text:message.includes('already used')?'This account has already used its trial. The current edition remains unchanged.':message});
    } finally {setWorkingPlan(null);}
  }
  const currentPlan=subscription?.plan_key||'free';
  const currentPlanRecord=plans.find(plan=>plan.plan_key===currentPlan);
  const siteLimit=currentPlanRecord?.limits.sites||1;
  const auditLimit=currentPlanRecord?.limits.audits_per_month||5;
  const trialUsed=Boolean(subscription?.trial_started_at);
  const daysLeft=subscription?.trial_ends_at?Math.max(0,Math.ceil((new Date(subscription.trial_ends_at).getTime()-Date.now())/86400000)):null;
  const trialProgress=subscription?.trial_started_at&&subscription?.trial_ends_at?Math.max(0,Math.min(100,((Date.now()-new Date(subscription.trial_started_at).getTime())/(new Date(subscription.trial_ends_at).getTime()-new Date(subscription.trial_started_at).getTime()))*100)):0;
  return <div className="dashboard-content">
    <NoticeBar notice={notice} dismiss={()=>setNotice(null)}/>
    <section className="panel billing-current">
      <div className="panel-heading"><div><h3>Current edition</h3><p>{workspaceName||'Your workspace'} · subscription and access status</p></div><span className={'audit-status '+(subscription?.status||'free')}>{(subscription?.status||'free').replaceAll('_',' ')}</span></div>
      <div className="billing-current-main"><div><span className="billing-edition-name">{currentPlan[0].toUpperCase()+currentPlan.slice(1)}</span><p>{subscription?.status==='trialing'&&daysLeft!==null?daysLeft+' day(s) remaining in your trial.':subscription?.status==='active'?'Your subscription is active.':currentPlan==='free'?'Permanent Free edition. No payment details are required.':'Subscription status: '+(subscription?.status||'free')}</p></div>
        {subscription?.trial_ends_at&&<div className="billing-expiry"><small>TRIAL ENDS</small><b>{new Date(subscription.trial_ends_at).toLocaleDateString()}</b></div>}
      </div>
      {subscription?.status==='trialing'&&<div className="billing-trial-track"><span style={{width:trialProgress+'%'}}/></div>}
      <div className="billing-usage-grid"><div className="billing-usage-item"><div><span>Websites</span><b>{usage.sites} / {siteLimit}</b></div><div className="billing-usage-track"><span style={{width:Math.min(100,usage.sites/siteLimit*100)+'%'}}/></div></div><div className="billing-usage-item"><div><span>Audit runs this month</span><b>{usage.auditsThisMonth} / {auditLimit}</b></div><div className="billing-usage-track"><span style={{width:Math.min(100,usage.auditsThisMonth/auditLimit*100)+'%'}}/></div></div></div>
      <p className="legal-note">Payment checkout is not connected yet. Trial access is real and time-limited; this screen will never claim that a payment succeeded when no provider confirmation exists.</p>
    </section>
    <div className="billing-plan-grid">
      {plans.map(plan=>{
        const selected=currentPlan===plan.plan_key;
        const featureEntries=featureCatalog;
        return <section key={plan.plan_key} className={'panel billing-plan '+(selected?'is-current':'')}>
          <div className="billing-plan-top"><div><span className="billing-plan-kicker">{plan.plan_key==='ultimate'?'ADVANCED WORKSPACES':plan.plan_key==='standard'?'GROWING TEAMS':'GET STARTED'}</span><h3>{plan.display_name}</h3></div>{selected&&<span className="step-progress">Current</span>}</div>
          <p>{plan.description}</p>
          <div className="billing-price">{plan.monthly_price_minor===null?'Price not configured':new Intl.NumberFormat('en-IN',{style:'currency',currency:plan.currency,maximumFractionDigits:2}).format(plan.monthly_price_minor/100)}<small>{plan.monthly_price_minor===null?'Set by product owner':'/ month'}</small></div>
          {plan.trial_days>0&&<p className="billing-trial-copy">{plan.trial_days}-day trial · no payment collected in the current setup flow</p>}
          <div className="billing-limits"><span><b>{plan.limits.sites}</b> websites</span><span><b>{plan.limits.audits_per_month}</b> audits / month</span><span><b>{plan.limits.pages_per_audit}</b> pages / audit (current crawl cap)</span><span><b>{plan.limits.team_seats}</b> team seats (target)</span></div>
          <div className="billing-feature-list">{featureEntries.filter(feature=>feature.implementation_status==='available').map(feature=>{const entitled=Boolean(plan.features?.[feature.feature_key]);return <div key={feature.feature_key} className="billing-feature" title={feature.description}><CheckCircle2 size={14}/><span>{feature.display_name}</span><small>{entitled?'Included':'Not in plan'}</small></div>})}</div>
          <details className="billing-more-features"><summary>View all {featureEntries.length} capabilities</summary><div className="billing-feature-list">{featureEntries.filter(feature=>feature.implementation_status!=='available').map(feature=>{const entitled=Boolean(plan.features?.[feature.feature_key]);const state=feature.implementation_status==='beta'?(entitled?'Beta':'Not in plan'):(entitled?'Coming soon':'Not in plan');return <div key={feature.feature_key} className="billing-feature" title={feature.description}><CheckCircle2 size={14}/><span>{feature.display_name}</span><small>{state}</small></div>})}</div></details>
          {selected?<button className="btn secondary full" disabled>Current edition</button>:plan.plan_key==='free'?<button className="btn secondary full" disabled>Free edition</button>:<button className="btn primary full" onClick={()=>void startTrial(plan.plan_key)} disabled={busy||!!workingPlan||trialUsed||subscription?.status==='trialing'||subscription?.status==='active'||subscription?.status==='past_due'||subscription?.status==='cancel_at_period_end'}>{workingPlan===plan.plan_key?<><span className="spinner"/> Activating…</>:trialUsed?'Trial already used':'Start '+plan.trial_days+'-day trial'}</button>}
          {plan.plan_key!=='free'&&<small className="billing-coming-note">Paid checkout and final pricing will be enabled after provider setup.</small>}
        </section>;
      })}
    </div>
    <section className="panel billing-coupon">
      <div className="panel-heading"><div><h3>Coupon codes</h3><p>Validate a coupon here. Trial-day coupons apply when you start a trial; percentage and fixed discounts wait until a payment provider is connected.</p></div></div>
      <form className="coupon-form" onSubmit={validateCoupon}>
        <label className="coupon-plan-label"><span>Apply to edition</span><select value={couponPlan} onChange={e=>setCouponPlan(parseEdition(e.target.value))}><option value="standard">Standard</option><option value="ultimate">Ultimate</option></select></label>
        <input value={coupon} onChange={e=>setCoupon(e.target.value.toUpperCase().replace(/\s/g,''))} placeholder="Enter coupon code" aria-label="Coupon code" maxLength={64}/>
        <button className="btn secondary" type="submit" disabled={!coupon.trim()||busy}>Validate coupon</button>
      </form>
      <NoticeBar notice={couponNotice} dismiss={()=>setCouponNotice(null)}/>
    </section>
  </div>;
}

function ReportsPage(){
  const [runs,setRuns]=useState<(AuditRun & {site_id:string})[]>([]);
  const [issues,setIssues]=useState<IssueRecord[]>([]);
  const [pages,setPages]=useState<{id:string;site_id:string;normalized_url:string;requested_url:string;status_code:number|null;indexability_status:string;fetch_state:string;crawl_depth:number|null;fetched_at:string|null;meta_snapshot:Record<string,unknown>}[]>([]);
  const [siteNames,setSiteNames]=useState<Record<string,string>>({});
  const [busy,setBusy]=useState(true);
  const [notice,setNotice]=useState<Notice>(null);
  useEffect(()=>{
    let active=true;
    async function load(){
      if(!supabase){setBusy(false);return;}
      try{
        const {data:userData,error:userError}=await supabase.auth.getUser();if(userError)throw userError;if(!userData.user)throw new Error('Sign in to load reports.');
        const membership=await getActiveWorkspaceMembership(userData.user.id);const workspaceId=membership.workspace_id;
        const [runsResult,issuesResult,sitesResult,pagesResult]=await Promise.all([
          supabase.from('audit_runs').select('id,site_id,status,created_at,started_at,finished_at,summary').eq('workspace_id',workspaceId).order('created_at',{ascending:false}).limit(500),
          supabase.from('issues').select('id,site_id,rule_id,category,severity,title,description,recommendation,status,metadata,first_seen_at,last_seen_at').eq('workspace_id',workspaceId).order('last_seen_at',{ascending:false}).limit(5000),
          supabase.from('sites').select('id,name').eq('workspace_id',workspaceId),
          supabase.from('pages').select('id,site_id,normalized_url,requested_url,status_code,indexability_status,fetch_state,crawl_depth,fetched_at,meta_snapshot').eq('workspace_id',workspaceId).order('fetched_at',{ascending:false}).limit(10000)
        ]);
        if(runsResult.error)throw runsResult.error;if(issuesResult.error)throw issuesResult.error;if(sitesResult.error)throw sitesResult.error;if(pagesResult.error)throw pagesResult.error;
        if(!active)return;
        setRuns((runsResult.data||[]) as (AuditRun & {site_id:string})[]);setIssues((issuesResult.data||[]) as IssueRecord[]);setPages((pagesResult.data||[]) as typeof pages);
        const names:Record<string,string>={};for(const site of sitesResult.data||[])names[site.id]=site.name;setSiteNames(names);
      }catch(err){if(active)setNotice({kind:'error',text:err instanceof Error?err.message:'Could not load report data.'});}
      finally{if(active)setBusy(false);}
    }
    void load();return()=>{active=false;};
  },[]);
  function downloadCsv(filename:string,rows:string[][]){
    const escape=(value:string)=>{let v=value??'';if(/^[\s]*[=+@-]/.test(v))v="'"+v;return /[",\n\r]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v;};
    const csv=rows.map(row=>row.map(escape).join(',')).join('\r\n');
    const blob=new Blob(['\ufeff',csv],{type:'text/csv;charset=utf-8;'});
    const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
  }
  function exportRuns(){downloadCsv('vadx-audit-history.csv',[
    ['Audit ID','Website','Created at','Status','Pages checked','Total findings','Critical','Errors','Warnings','Fetch failures'],
    ...runs.map(run=>{const s=run.summary||{};const i=s.issues||{};return [run.id,siteNames[run.site_id]||run.site_id,run.created_at,run.status,String(s.pages_checked??''),String(i.total??''),String(i.critical??''),String(i.error??''),String(i.warning??''),String(s.fetch?.failed??'')];})
  ]);}
  function exportIssues(){downloadCsv('vadx-issues.csv',[
    ['Issue ID','Website','Rule ID','Category','Severity','Title','Status','URL','Description','Recommendation','First seen','Last seen'],
    ...issues.map(i=>[i.id,siteNames[i.site_id]||i.site_id,i.rule_id,i.category,i.severity,i.title,i.status,String(i.metadata?.url||''),i.description,i.recommendation,i.first_seen_at,i.last_seen_at])
  ]);}
  function exportPages(){downloadCsv('vadx-page-inventory.csv',[
    ['Website','Page URL','HTTP status','Fetch state','Indexability','Crawl depth','Page title','Meta description','Fetched at'],
    ...pages.map(p=>[siteNames[p.site_id]||p.site_id,p.normalized_url,String(p.status_code??''),p.fetch_state,p.indexability_status,String(p.crawl_depth??''),String(p.meta_snapshot?.title||''),String(p.meta_snapshot?.description||''),String(p.fetched_at||'')])
  ]);}
  const critical=issues.filter(i=>i.severity==='critical'&&i.status==='open').length;
  const resolved=issues.filter(i=>i.status==='resolved').length;
  return <div className="page-content">
    <NoticeBar notice={notice} dismiss={()=>setNotice(null)}/>
    <div className="list-toolbar"><div><b>Reports & exports</b><p>Download CSV reports from persisted audit and issue data. No sample metrics are included.</p></div><span className="panel-badge">CSV EXPORT</span></div>
    <div className="stats-grid">
      <Metric icon={ScanSearch} label="AUDIT RUNS" value={busy?'—':String(runs.length)} detail="Up to 500 latest runs" tone="blue"/>
      <Metric icon={TriangleAlert} label="OPEN ISSUES" value={busy?'—':String(issues.filter(i=>i.status==='open').length)} detail="Loaded issue records" tone="amber"/>
      <Metric icon={ShieldCheck} label="CRITICAL OPEN" value={busy?'—':String(critical)} detail="Prioritize these first" tone="purple"/>
      <Metric icon={CheckCircle2} label="RESOLVED" value={busy?'—':String(resolved)} detail="Recorded resolved issues" tone="green"/>
    </div>
    <section className="panel">
      <div className="panel-heading"><div><h3>Export center</h3><p>Choose the report that matches the question you need to answer.</p></div></div>
      {busy?<div className="table-empty"><span className="spinner"/> Preparing report data…</div>:<div className="getting-started">
        <div className="start-step"><span className="step-icon"><BarChart3 size={18}/></span><div><b>Audit history report</b><p>{runs.length} audit runs · status, page counts, issue counts and fetch failures.</p></div><button className="btn primary" disabled={!runs.length} onClick={exportRuns}>Download CSV <ArrowRight size={15}/></button></div>
        <div className="start-step"><span className="step-icon"><FileCheck2 size={18}/></span><div><b>Issue register</b><p>{issues.length} loaded findings · severity, state, evidence URL and recommended fix.</p></div><button className="btn primary" disabled={!issues.length} onClick={exportIssues}>Download CSV <ArrowRight size={15}/></button></div>
        <div className="start-step"><span className="step-icon"><Globe2 size={18}/></span><div><b>Page inventory</b><p>{pages.length} latest crawled pages · HTTP state, indexability, crawl depth and page metadata. Limited to the latest 10,000 loaded rows.</p></div><button className="btn primary" disabled={!pages.length} onClick={exportPages}>Download CSV <ArrowRight size={15}/></button></div>
      </div>}
    </section>
    <div className="muted-box">Current scope: Audit history, issue register and page inventory CSV exports use saved records. PDF generation, branded executive reports, share links, scheduled delivery and full history beyond the fetch limits are not implemented yet.</div>
  </div>;
}

function CrawlMapPage(){
  const [sites,setSites]=useState<SiteOption[]>([]);
  const [siteId,setSiteId]=useState("");
  const [run,setRun]=useState<AuditRun|null>(null);
  const [pages,setPages]=useState<PageRecord[]>([]);
  const [links,setLinks]=useState<{id:string;source_page_id:string;target_url:string;target_page_id:string|null;link_type:string;http_status:number|null;anchor_text:string|null}[]>([]);
  const [busy,setBusy]=useState(true);
  const [notice,setNotice]=useState<Notice>(null);
  useEffect(()=>{let active=true;async function load(){if(!supabase){setBusy(false);return;}try{
    const {data,error}=await supabase.from('sites').select('id,name,start_url').order('created_at',{ascending:false});
    if(error)throw error;if(!active)return;const rows=(data||[]) as SiteOption[];setSites(rows);if(rows.length)setSiteId(rows[0].id);
  }catch(err){if(active)setNotice({kind:'error',text:err instanceof Error?err.message:'Could not load websites.'});}finally{if(active)setBusy(false);}}void load();return()=>{active=false;};},[]);
  useEffect(()=>{let active=true;async function load(){if(!supabase||!siteId)return;setBusy(true);setNotice(null);try{
    const {data:latest,error:runError}=await supabase.from('audit_runs').select('id,site_id,status,created_at,started_at,finished_at,summary').eq('site_id',siteId).order('created_at',{ascending:false}).limit(1).maybeSingle();
    if(runError)throw runError;if(!active)return;if(!latest){setRun(null);setPages([]);setLinks([]);return;}
    setRun(latest as AuditRun);
    const [pageResult,linkResult]=await Promise.all([
      supabase.from('pages').select('id,normalized_url,status_code,indexability_status,fetch_state,meta_snapshot,crawl_depth,inlinks_count,outlinks_count,fetched_at').eq('audit_run_id',latest.id).order('crawl_depth',{ascending:true}).limit(500),
      supabase.from('page_links').select('id,source_page_id,target_url,target_page_id,link_type,http_status,anchor_text').eq('audit_run_id',latest.id).limit(5000)
    ]);
    if(pageResult.error)throw pageResult.error;if(linkResult.error)throw linkResult.error;if(!active)return;
    setPages((pageResult.data||[]) as PageRecord[]);setLinks((linkResult.data||[]) as typeof links);
  }catch(err){if(active)setNotice({kind:'error',text:err instanceof Error?err.message:'Could not load crawl graph data.'});}finally{if(active)setBusy(false);}}void load();return()=>{active=false;};},[siteId]);
  const depths=pages.reduce<Record<string,number>>((acc,page)=>{const key=String(page.crawl_depth??'unknown');acc[key]=(acc[key]||0)+1;return acc;},{});
  return <div className="page-content">
    <NoticeBar notice={notice} dismiss={()=>setNotice(null)}/>
    <div className="list-toolbar"><div><b>Crawl map</b><p>Page discovery and internal-link structure from the latest saved audit for each website.</p></div><select className="filter-select site-filter" value={siteId} onChange={e=>setSiteId(e.target.value)}><option value="">Select website</option>{sites.map(site=><option key={site.id} value={site.id}>{site.name}</option>)}</select></div>
    <div className="stats-grid">
      <Metric icon={Globe2} label="PAGES DISCOVERED" value={busy?'—':String(run?.summary?.pages_discovered??pages.length)} detail="Latest saved crawl" tone="blue"/>
      <Metric icon={Link2} label="LINK EDGES" value={busy?'—':String(links.length)} detail="Recorded page links" tone="purple"/>
      <Metric icon={Network} label="CRAWL DEPTHS" value={busy?'—':String(Object.keys(depths).length)} detail="Observed page levels" tone="green"/>
      <Metric icon={TriangleAlert} label="UNMAPPED LINKS" value={busy?'—':String(links.filter(link=>!link.target_page_id&&link.link_type==='internal').length)} detail="Targets not fetched in this run" tone="amber"/>
    </div>
    <section className="panel">
      <div className="panel-heading"><div><h3>Discovery by depth</h3><p>{run?'Latest audit · '+new Date(run.created_at).toLocaleString():'No audit history for this website'}</p></div>{run&&<span className={'audit-status '+run.status}>{run.status}</span>}</div>
      {busy?<div className="table-empty"><span className="spinner"/> Loading crawl map…</div>:!pages.length?<div className="empty-state"><b>No crawl graph yet</b><p>Add a website and run an audit. Saved pages and links will appear here.</p><Link className="btn primary" to="/app/sites">Open websites <ArrowRight size={15}/></Link></div>:<>
        <div className="stats-grid">{Object.entries(depths).sort((x,y)=>Number(x[0])-Number(y[0])).map(([depth,count])=><Metric key={depth} icon={Network} label={'DEPTH '+depth} value={String(count)} detail="Fetched or recorded pages" tone="blue"/>)}</div>
        <div className="page-table"><div className="page-table-head"><span>DISCOVERED PAGE</span><span>HTTP</span><span>IN / OUT LINKS</span><span>DEPTH</span></div>
          {pages.map(page=><div className="page-table-row" key={page.id}><div><b>{String(page.meta_snapshot?.title||'Untitled page')}</b><small>{page.normalized_url}</small></div><span className={'http-code '+(page.status_code&&page.status_code>=400?'bad':page.status_code&&page.status_code<400?'good':'unknown')}>{page.status_code??'—'}</span><span>{page.inlinks_count} / {page.outlinks_count}</span><span>{page.crawl_depth??'—'}</span></div>)}
        </div>
        <div className="muted-box">This graph represents pages and links captured within the selected audit's bounded same-host crawl scope. Links outside the page budget are shown as unmapped, not as broken.</div>
      </>}
    </section>
  </div>;
}

function PerformancePage(){
  type PerformancePageRow={id:string;site_id:string;normalized_url:string;status_code:number|null;fetch_state:string;meta_snapshot:Record<string,unknown>;fetched_at:string|null};
  const [rows,setRows]=useState<PerformancePageRow[]>([]);
  const [siteNames,setSiteNames]=useState<Record<string,string>>({});
  const [busy,setBusy]=useState(true);
  const [notice,setNotice]=useState<Notice>(null);
  useEffect(()=>{let active=true;async function load(){if(!supabase){setBusy(false);return;}try{
    const [pageResult,siteResult]=await Promise.all([
      supabase.from('pages').select('id,site_id,normalized_url,status_code,fetch_state,meta_snapshot,fetched_at').order('fetched_at',{ascending:false}).limit(500),
      supabase.from('sites').select('id,name')
    ]);
    if(pageResult.error)throw pageResult.error;if(siteResult.error)throw siteResult.error;if(!active)return;
    setRows((pageResult.data||[]) as PerformancePageRow[]);const names:Record<string,string>={};for(const site of siteResult.data||[])names[site.id]=site.name;setSiteNames(names);
  }catch(err){if(active)setNotice({kind:'error',text:err instanceof Error?err.message:'Could not load response timing data.'});}finally{if(active)setBusy(false);}}void load();return()=>{active=false;};},[]);
  const measured=rows.map(row=>({...row,ms:Number(row.meta_snapshot?.response_time_ms||0),bytes:Number(row.meta_snapshot?.html_bytes||0)})).filter(row=>row.ms>0);
  const times=measured.map(row=>row.ms).sort((x,y)=>x-y);
  const average=times.length?Math.round(times.reduce((sum,n)=>sum+n,0)/times.length):null;
  const p75=times.length?times[Math.min(times.length-1,Math.ceil(times.length*.75)-1)]:null;
  const slowest=measured.reduce((max,row)=>Math.max(max,row.ms),0);
  return <div className="page-content">
    <NoticeBar notice={notice} dismiss={()=>setNotice(null)}/>
    <div className="list-toolbar"><div><b>Performance observations</b><p>Measured HTTP response time and transferred HTML size from saved crawler requests.</p></div><span className="panel-badge">CRAWLER TIMINGS</span></div>
    <div className="stats-grid">
      <Metric icon={Timer} label="AVERAGE RESPONSE" value={busy?'—':average===null?'—':average+' ms'} detail="Across latest 500 page rows" tone="blue"/>
      <Metric icon={Activity} label="75TH PERCENTILE" value={busy?'—':p75===null?'—':p75+' ms'} detail="Crawler request timing" tone="purple"/>
      <Metric icon={Clock3} label="SLOWEST RESPONSE" value={busy?'—':times.length?slowest+' ms':'—'} detail="Latest loaded pages" tone="amber"/>
      <Metric icon={Globe2} label="MEASURED PAGES" value={busy?'—':String(measured.length)} detail="Pages with timing data" tone="green"/>
    </div>
    <section className="panel">
      <div className="panel-heading"><div><h3>Recent page responses</h3><p>Per-page response-time and HTML byte observations.</p></div></div>
      {busy?<div className="table-empty"><span className="spinner"/> Loading performance observations…</div>:!measured.length?<div className="empty-state"><b>No measured page responses yet</b><p>Run an audit after the SiteRadar crawl update is deployed. Timing data is recorded with each fetched page.</p></div>:<div className="page-table"><div className="page-table-head"><span>WEBSITE / URL</span><span>RESPONSE</span><span>HTML BYTES</span><span>HTTP</span></div>
        {measured.slice(0,250).map(row=><div className="page-table-row" key={row.id}><div><b>{siteNames[row.site_id]||'Website'}</b><small>{row.normalized_url}</small></div><span>{row.ms.toLocaleString()} ms</span><span>{row.bytes.toLocaleString()}</span><span className={'http-code '+(row.status_code&&row.status_code>=400?'bad':row.status_code&&row.status_code<400?'good':'unknown')}>{row.status_code??'—'}</span></div>)}
      </div>}
    </section>
    <div className="muted-box">These are direct crawler request timings, not Lighthouse lab runs, CrUX field data, Core Web Vitals or real-user monitoring. Those integrations remain separate release work.</div>
  </div>;
}

function AccessibilityPage(){
  const [issues,setIssues]=useState<IssueRecord[]>([]);
  const [siteNames,setSiteNames]=useState<Record<string,string>>({});
  const [busy,setBusy]=useState(true);
  const [notice,setNotice]=useState<Notice>(null);
  useEffect(()=>{let active=true;async function load(){if(!supabase){setBusy(false);return;}try{
    const {data,error}=await supabase.from('issues').select('id,site_id,rule_id,category,severity,title,description,recommendation,status,metadata,first_seen_at,last_seen_at').eq('category','accessibility').order('last_seen_at',{ascending:false}).limit(500);
    if(error)throw error;if(!active)return;const records=(data||[]) as IssueRecord[];setIssues(records);
    const ids=[...new Set(records.map(item=>item.site_id))];if(ids.length){const {data:sites}=await supabase.from('sites').select('id,name').in('id',ids);const names:Record<string,string>={};for(const site of sites||[])names[site.id]=site.name;setSiteNames(names);}
  }catch(err){if(active)setNotice({kind:'error',text:err instanceof Error?err.message:'Could not load accessibility findings.'});}finally{if(active)setBusy(false);}}void load();return()=>{active=false;};},[]);
  const open=issues.filter(issue=>issue.status==='open').length;
  return <div className="page-content"><NoticeBar notice={notice} dismiss={()=>setNotice(null)}/>
    <div className="list-toolbar"><div><b>Accessibility observations</b><p>Evidence-backed HTML checks recorded during website audits.</p></div><span className="panel-badge">AUTOMATED HTML SIGNALS</span></div>
    <div className="stats-grid">
      <Metric icon={Sparkles} label="FINDINGS" value={busy?'—':String(issues.length)} detail="Saved accessibility issues" tone="blue"/>
      <Metric icon={TriangleAlert} label="OPEN" value={busy?'—':String(open)} detail="Needs review" tone="amber"/>
      <Metric icon={CheckCircle2} label="RESOLVED" value={busy?'—':String(issues.filter(issue=>issue.status==='resolved').length)} detail="Marked resolved" tone="green"/>
      <Metric icon={Globe2} label="WEBSITES" value={busy?'—':String(new Set(issues.map(issue=>issue.site_id)).size)} detail="With recorded findings" tone="purple"/>
    </div>
    <section className="panel"><div className="panel-heading"><div><h3>Accessibility issue register</h3><p>Current rules include missing image alt attributes and missing document language.</p></div></div>
      {busy?<div className="table-empty"><span className="spinner"/> Loading findings…</div>:!issues.length?<div className="empty-state"><b>No accessibility findings recorded</b><p>Run audits on websites to populate this list. No automated result is treated as a full WCAG compliance assessment.</p></div>:<div className="issue-list">{issues.map(issue=><article className="issue-card" key={issue.id}><div className="issue-card-top"><span className={'severity-pill '+issue.severity}>{issue.severity}</span><span className="issue-category">{siteNames[issue.site_id]||'Website'}</span><span className={'audit-status '+issue.status}>{issue.status}</span></div><h3>{issue.title}</h3><p>{issue.description}</p><div className="issue-recommendation"><b>Recommended review</b><p>{issue.recommendation}</p></div><div className="issue-card-bottom"><span>Rule: <code>{issue.rule_id}</code> · {issue.metadata?.url?String(issue.metadata.url):'URL unavailable'}</span><Link className="text-button" to="/app/issues">Open issue explorer <ArrowRight size={14}/></Link></div></article>)}</div>}
    </section>
    <div className="muted-box">This page displays only the accessibility heuristics currently implemented by the crawler. It is not a WCAG audit and does not replace keyboard, screen-reader or human accessibility testing.</div>
  </div>;
}

function SecurityPage(){
  type SecurityPageRow={id:string;site_id:string;normalized_url:string;status_code:number|null;crawl_depth:number|null;fetched_at:string|null;meta_snapshot:Record<string,unknown>};
  const [rows,setRows]=useState<SecurityPageRow[]>([]);
  const [siteNames,setSiteNames]=useState<Record<string,string>>({});
  const [busy,setBusy]=useState(true);
  const [notice,setNotice]=useState<Notice>(null);
  useEffect(()=>{let active=true;async function load(){if(!supabase){setBusy(false);return;}try{
    const [pageResult,siteResult]=await Promise.all([
      supabase.from('pages').select('id,site_id,normalized_url,status_code,crawl_depth,fetched_at,meta_snapshot').order('fetched_at',{ascending:false}).limit(500),
      supabase.from('sites').select('id,name')
    ]);
    if(pageResult.error)throw pageResult.error;if(siteResult.error)throw siteResult.error;if(!active)return;
    setRows((pageResult.data||[]) as SecurityPageRow[]);const names:Record<string,string>={};for(const site of siteResult.data||[])names[site.id]=site.name;setSiteNames(names);
  }catch(err){if(active)setNotice({kind:'error',text:err instanceof Error?err.message:'Could not load security observations.'});}finally{if(active)setBusy(false);}}void load();return()=>{active=false;};},[]);
  const checks=[
    {key:'strict_transport_security',label:'HSTS'},
    {key:'content_security_policy',label:'Content Security Policy'},
    {key:'x_content_type_options',label:'X-Content-Type-Options'},
    {key:'referrer_policy',label:'Referrer-Policy'},
    {key:'permissions_policy',label:'Permissions-Policy'},
    {key:'x_frame_options',label:'X-Frame-Options'}
  ];
  const roots=rows.filter(row=>row.crawl_depth===0);
  const latestBySite=new Map<string,SecurityPageRow>();for(const row of roots){if(!latestBySite.has(row.site_id))latestBySite.set(row.site_id,row);}
  const latest=[...latestBySite.values()];
  const missing=latest.reduce((sum,row)=>sum+checks.filter(check=>!String((row.meta_snapshot?.security_headers as Record<string,unknown>|undefined)?.[check.key]||'')).length,0);
  return <div className="page-content"><NoticeBar notice={notice} dismiss={()=>setNotice(null)}/>
    <div className="list-toolbar"><div><b>Security header observations</b><p>Read-only checks of headers returned by each website's latest crawled homepage.</p></div><span className="panel-badge">OBSERVATIONAL CHECKS</span></div>
    <div className="stats-grid">
      <Metric icon={ShieldCheck} label="HOMEPAGES CHECKED" value={busy?'—':String(latest.length)} detail="Latest loaded homepage per site" tone="blue"/>
      <Metric icon={TriangleAlert} label="HEADER GAPS" value={busy?'—':String(missing)} detail="Missing observations across checks" tone="amber"/>
      <Metric icon={Globe2} label="SITES WITH DATA" value={busy?'—':String(latest.length)} detail="Saved homepage response" tone="green"/>
      <Metric icon={LockKeyhole} label="SECURITY TESTS" value={String(checks.length)} detail="Response headers only" tone="purple"/>
    </div>
    <section className="panel"><div className="panel-heading"><div><h3>Homepage security headers</h3><p>Absence of a header is a review signal, not proof of an exploitable vulnerability.</p></div></div>
      {busy?<div className="table-empty"><span className="spinner"/> Loading security headers…</div>:!latest.length?<div className="empty-state"><b>No homepage response data yet</b><p>Run a SiteRadar audit after the updated crawler is deployed.</p></div>:<div className="page-table"><div className="page-table-head"><span>WEBSITE</span><span>HEADER</span><span>OBSERVED VALUE</span><span>STATUS</span></div>
        {latest.flatMap(row=>checks.map(check=>{const val=String((row.meta_snapshot?.security_headers as Record<string,unknown>|undefined)?.[check.key]||'');return <div className="page-table-row" key={row.id+check.key}><div><b>{siteNames[row.site_id]||'Website'}</b><small>{row.normalized_url}</small></div><span>{check.label}</span><span>{val||'Not detected'}</span><span className={'audit-status '+(val?'completed':'partial')}>{val?'Observed':'Review'}</span></div>;}))}
      </div>}
    </section>
    <div className="muted-box">These are non-intrusive HTTP response-header checks only. No penetration test, vulnerability exploit attempt, malware scan or complete security certification is performed. AI-crawler robots.txt access analysis remains a separate follow-up.</div>
  </div>;
}

function GenericPage({title,description,icon:Icon}:{title:string;description:string;icon:typeof Activity}) {
  return <div className="page-content"><section className="panel placeholder-panel"><div className="placeholder-icon"><Icon size={25}/></div><span className="panel-badge">PLANNED MODULE</span><h2>{title}</h2><p>{description}</p><div className="muted-box">The navigation and page shell are ready. This module will be activated when its backend functionality and validation tests are implemented.</div></section></div>;
}

type AuditRun = {id:string;status:string;created_at:string;started_at:string|null;finished_at:string|null;summary:Record<string,any>|null};

function SiteDetailPage(){
  const location=useLocation();const id=location.pathname.split('/').pop();
  const[site,setSite]=useState<Site|null>(null);const[busy,setBusy]=useState(true);
  const[runBusy,setRunBusy]=useState(false);const[notice,setNotice]=useState<Notice>(null);
  const[audits,setAudits]=useState<AuditRun[]>([]);const[openIssues,setOpenIssues]=useState<number|null>(null);
  const navigate=useNavigate();
  useEffect(()=>{let active=true;async function init(){if(!supabase||!id){setBusy(false);return;}try{
    const {data,error}=await supabase.from('sites').select('id,name,start_url,normalized_origin,sitemap_url,created_at').eq('id',id).maybeSingle();
    if(error)throw error;if(!active)return;setSite(data as Site|null);
    if(!data){setAudits([]);return;}
    const [runsResult,issuesResult]=await Promise.all([
      supabase.from('audit_runs').select('id,status,created_at,started_at,finished_at,summary').eq('site_id',id).order('created_at',{ascending:false}).limit(10),
      supabase.from('issues').select('id',{count:'exact',head:true}).eq('site_id',id).eq('status','open')
    ]);
    if(runsResult.error)throw runsResult.error;if(!active)return;
    setAudits((runsResult.data||[]) as AuditRun[]);if(!issuesResult.error)setOpenIssues(issuesResult.count??0);
  }catch(err){if(active)setNotice({kind:'error',text:err instanceof Error?err.message:'Could not load website audit history.'});}
  finally{if(active)setBusy(false);}}void init();return()=>{active=false;};},[id]);
  async function runAudit(){
    if(!supabase||!id)return;
    setRunBusy(true);setNotice(null);
    try{
      const {data,error}=await supabase.functions.invoke('run-site-audit',{body:{site_id:id,max_pages:50}});
      if(error)throw error;
      if(!data?.ok)throw new Error(data?.error||'The audit could not be completed.');
      const [runsResult,issuesResult]=await Promise.all([
        supabase.from('audit_runs').select('id,status,created_at,started_at,finished_at,summary').eq('site_id',id).order('created_at',{ascending:false}).limit(10),
        supabase.from('issues').select('id',{count:'exact',head:true}).eq('site_id',id).eq('status','open')
      ]);
      if(!runsResult.error)setAudits((runsResult.data||[]) as AuditRun[]);
      if(!issuesResult.error)setOpenIssues(issuesResult.count??0);
      const pages=Number(data.summary?.pages_checked||0);const issueTotal=Number(data.summary?.issues?.total||0);
      const emailMessage=data.email_status==='sent'?' Audit-completed email sent.':data.email_status==='not_configured'?' Email delivery still needs the server secrets and sender setup.':data.email_status==='failed'?' Audit completed, but the notification email failed.':'';
      setNotice({kind:'success',text:`Audit ${data.status}. Checked ${pages} pages and recorded ${issueTotal} findings.${emailMessage}`});
    }catch(err){setNotice({kind:'error',text:err instanceof Error?err.message:'Audit failed. Check the Edge Function logs and try again.'});}
    finally{setRunBusy(false);}
  }
  const latest=audits[0];const summary=latest?.summary||{};const issueSummary=summary.issues||{};
  return <div className="page-content">
    <button className="back-link" onClick={()=>navigate('/app/sites')}><ArrowRight size={14}/> Back to websites</button>
    <NoticeBar notice={notice} dismiss={()=>setNotice(null)}/>
    {busy?<div className="panel table-empty"><span className="spinner"/> Loading project…</div>:!site?<div className="panel empty-state"><b>Website not found</b><p>This website may have been removed or you may not have access.</p><Link className="btn secondary" to="/app/sites">Back to websites</Link></div>:<>
      <section className="site-detail-hero"><div className="site-detail-icon"><Globe2 size={23}/></div><div><span className="panel-badge">WEBSITE PROJECT</span><h2>{site.name}</h2><a href={site.start_url} target="_blank" rel="noreferrer">{site.start_url} <ExternalLink size={13}/></a>{site.sitemap_url&&<small className="field-hint">Sitemap: <a href={site.sitemap_url} target="_blank" rel="noreferrer">{site.sitemap_url} <ExternalLink size={11}/></a></small>}</div><button className="btn primary" onClick={runAudit} disabled={runBusy||!hasSupabaseConfig}>{runBusy?<><span className="spinner"/> Auditing…</>:<><ScanSearch size={15}/> Run audit</>}</button></section>
      <div className="stats-grid">
        <Metric icon={ScanSearch} label="AUDITS" value={String(audits.length)} detail={audits.length?'Recent runs':'No audit yet'} tone="blue"/>
        <Metric icon={TriangleAlert} label="OPEN ISSUES" value={openIssues===null?'—':String(openIssues)} detail={latest?'Across this website':'Awaiting audit'} tone="amber"/>
        <Metric icon={Globe2} label="PAGES CHECKED" value={latest?String(summary.pages_checked??0):'—'} detail={latest?'Latest run':'Not measured'} tone="green"/>
        <Metric icon={Clock3} label="LAST AUDIT" value={latest?new Date(latest.created_at).toLocaleDateString():'—'} detail={latest?.status||'Not run'} tone="purple"/>
      </div>
      <section className="panel"><div className="panel-heading"><div><h3>Audit history</h3><p>Real crawl results are shown here. A partial run means some pages could not be checked or the crawl limit was reached.</p></div><span className="panel-badge">MVP · UP TO 50 PAGES / RUN</span></div>
        {!audits.length?<div className="empty-state"><div className="empty-icon"><ScanSearch size={22}/></div><b>Ready for your first crawl</b><p>Run an audit to discover same-host pages, HTTP errors, missing titles/descriptions/H1 headings and canonical hints.</p><button className="btn primary" onClick={runAudit} disabled={runBusy||!hasSupabaseConfig}>{runBusy?<><span className="spinner"/> Auditing…</>:<>Run first audit <ArrowRight size={15}/></>}</button></div>:
        <div className="audit-list">{audits.map(a=>{
          const sum=a.summary||{};const iss=sum.issues||{};const status=a.status||'unknown';
          return <div className="audit-row" key={a.id}><div className="audit-run-icon"><ScanSearch size={17}/></div><div className="audit-run-main"><b>{new Date(a.created_at).toLocaleString()}</b><small>{sum.pages_checked??0} pages · {iss.total??0} findings · {sum.fetch?.failed??0} fetch failures</small></div><span className={'audit-status '+status}>{status}</span><div className="audit-run-metrics"><span><i className="issue-dot d0"/>{iss.critical??0} critical</span><span><i className="issue-dot d1"/>{(iss.error??0)+(iss.warning??0)} issues</span></div></div>;
        })}</div>}
      </section>
      {latest&&<section className="panel"><div className="panel-heading"><div><h3>Latest run summary</h3><p>Rule-based findings from fetched HTML; no JavaScript rendering or lab performance test in this MVP.</p></div><span className={'audit-status '+latest.status}>{latest.status}</span></div>
        <div className="stats-grid summary-stats">
          <Metric icon={TriangleAlert} label="CRITICAL" value={String(issueSummary.critical??0)} detail="Confirmed rule matches" tone="amber"/>
          <Metric icon={TriangleAlert} label="ERRORS" value={String(issueSummary.error??0)} detail="Review and fix" tone="purple"/>
          <Metric icon={CircleHelp} label="WARNINGS" value={String(issueSummary.warning??0)} detail="Potential issues" tone="blue"/>
          <Metric icon={ShieldCheck} label="ROBOTS BLOCKED" value={String(summary.fetch?.robots_blocked??0)} detail="Not counted as passes" tone="green"/>
        </div>
        <div className="muted-box">Scope and limitations: same hostname only; maximum 50 pages per run (also bounded by the workspace edition and a 90-second safety budget); JavaScript-rendered content, external-link status checks, Lighthouse/Core Web Vitals, accessibility scanner and complete robots wildcard semantics are not included yet. “Missing” metadata is based on fetched HTML, not a guarantee of search ranking impact.</div>
      </section>}
    </>}
  </div>;
}

function HelpPage(){return <AuthLayout title="Help & support" subtitle="SiteRadar is being built in stages. You can return to the product at any time." footer={<>Already have an account? <Link to="/login">Sign in <ArrowRight size={14}/></Link></>}><p className="help-copy">For product questions, use your team's approved support contact. Keep secrets and account tokens out of support messages.</p><Link className="btn secondary full" to="/">Back to home</Link></AuthLayout>}

function SignupRedirect(){
  const location=useLocation();
  const params=new URLSearchParams(location.search);
  params.set("mode","signup");
  return <Navigate to={"/login?"+params.toString()} replace/>;
}

function AccountsRedirect({ view }: { view: "signin" | "signup" | "forgot" }) {
  useEffect(() => {
    const next = safeNext(new URLSearchParams(window.location.search).get("next"));
    void getZenVentoraAccount().then(account => {
      const returnTo = window.location.origin + (view === "signup" ? "/setup" : next);
      window.location.replace(account.authUrl(view, {
        product: "siteradar",
        returnTo
      }));
    });
  }, [view]);
  return <div className="app-loading"><span className="spinner"/> Redirecting to ZenVentora Accounts…</div>;
}

function SignupRedirect(){
  return <AccountsRedirect view="signup"/>;
}

function AuthEntryPage(){
  const mode=new URLSearchParams(window.location.search).get("mode");
  return <AccountsRedirect view={mode==="signup" ? "signup" : "signin"}/>;
}

export default function App(){
  return <Routes>
    <Route path="/" element={<Navigate to="/login" replace/>}/>
    <Route path="/pricing" element={<Navigate to="/login" replace/>}/>
    <Route path="/products" element={<Navigate to="/login" replace/>}/>
    <Route path="/login" element={<AuthEntryPage/>}/>
    <Route path="/signup" element={<SignupRedirect/>}/>
    <Route path="/setup" element={<ProtectedRoute><SetupPage/></ProtectedRoute>}/>
    <Route path="/forgot-password" element={<AccountsRedirect view="forgot"/>}/>
    <Route path="/reset-password" element={<AccountsRedirect view="forgot"/>}/>
    <Route path="/auth/callback" element={<AuthCallbackPage/>}/>
    <Route path="/help" element={<HelpPage/>}/>
    <Route path="/app" element={<ProtectedRoute><AppShell><OverviewPage/></AppShell></ProtectedRoute>}/>
    <Route path="/app/sites" element={<ProtectedRoute><AppShell><WebsitesPage/></AppShell></ProtectedRoute>}/>
    <Route path="/app/sites/new" element={<ProtectedRoute><AppShell><AddSitePage/></AppShell></ProtectedRoute>}/>
    <Route path="/app/sites/:siteId" element={<ProtectedRoute><AppShell><SiteDetailPage/></AppShell></ProtectedRoute>}/>
    <Route path="/app/audits" element={<ProtectedRoute><AppShell><AuditsPage/></AppShell></ProtectedRoute>}/>
    <Route path="/app/issues" element={<ProtectedRoute><AppShell><IssuesPage/></AppShell></ProtectedRoute>}/>
    <Route path="/app/pages" element={<ProtectedRoute><AppShell><PagesPage/></AppShell></ProtectedRoute>}/>
    <Route path="/app/crawl-map" element={<ProtectedRoute><AppShell><CrawlMapPage/></AppShell></ProtectedRoute>}/>
    <Route path="/app/performance" element={<ProtectedRoute><AppShell><PerformancePage/></AppShell></ProtectedRoute>}/>
    <Route path="/app/accessibility" element={<ProtectedRoute><AppShell><AccessibilityPage/></AppShell></ProtectedRoute>}/>
    <Route path="/app/security" element={<ProtectedRoute><AppShell><SecurityPage/></AppShell></ProtectedRoute>}/>
    <Route path="/app/monitoring" element={<ProtectedRoute><AppShell><GenericPage title="Monitoring" description="Scheduled audit runs, uptime state transitions and alert preferences are planned for a later milestone." icon={Activity}/></AppShell></ProtectedRoute>}/>
    <Route path="/app/reports" element={<ProtectedRoute><AppShell><ReportsPage/></AppShell></ProtectedRoute>}/>
    <Route path="/app/notifications" element={<ProtectedRoute><AppShell><NotificationsPage/></AppShell></ProtectedRoute>}/>
    <Route path="/app/products" element={<ProtectedRoute><AppShell><ProductsPage/></AppShell></ProtectedRoute>}/>
    <Route path="/app/billing" element={<ProtectedRoute><AppShell><BillingPage/></AppShell></ProtectedRoute>}/>
    <Route path="/app/settings" element={<ProtectedRoute><AppShell><GenericPage title="Settings" description="Workspace membership, notification preferences, usage visibility and profile settings." icon={Users}/></AppShell></ProtectedRoute>}/>
    <Route path="*" element={<Navigate to="/" replace/>}/>
  </Routes>;
}
