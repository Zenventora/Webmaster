alter table public.plan_catalog add column if not exists target_limits jsonb not null default '{}'::jsonb;
create table if not exists public.feature_catalog (
 feature_key text primary key, display_name text not null, category text not null,
 implementation_status text not null check (implementation_status in ('available','beta','coming_soon','retired')),
 description text not null default '', sort_order integer not null default 0, updated_at timestamptz not null default now()
);
alter table public.feature_catalog enable row level security;
drop policy if exists "Public can read feature catalog" on public.feature_catalog;
create policy "Public can read feature catalog" on public.feature_catalog for select to anon,authenticated using (implementation_status<>'retired');
grant select on public.feature_catalog to anon,authenticated;
revoke insert,update,delete on public.feature_catalog from anon,authenticated;
insert into public.feature_catalog(feature_key,display_name,category,implementation_status,description,sort_order) values
('technical_audit_mvp','Technical SEO crawl','Technical SEO','available','Bounded same-host crawl and currently implemented technical checks.',1),
('issue_explorer','Issue explorer and URL evidence','Technical SEO','available','Filter, inspect, resolve, ignore and reopen saved findings.',2),
('audit_history','Audit history and run comparison data','Reporting','available','Browse persisted audit runs and their summaries.',3),
('csv_audit_export','CSV exports','Reporting','available','Export saved audit history and loaded issue records as CSV.',4),
('robots_sitemap_validation','Robots.txt and sitemap discovery','Crawlability','available','Read robots.txt and discover same-host sitemap URLs.',5),
('redirects_and_http_status','HTTP status and redirect checks','Crawlability','available','Record response status and redirect chains for crawled pages.',6),
('duplicate_metadata','Duplicate metadata / content hints','On-page SEO','available','Detect duplicate titles, descriptions and repeated HTML fingerprints in the crawled set.',7),
('basic_link_checks','Basic internal link checks','Links','available','Check internal links where the target was included in the same bounded crawl.',8),
('site_health_score','Weighted site health score','Analytics','coming_soon','A transparent score based on defined severity weights and crawl coverage.',9),
('page_explorer','Page explorer with detailed fields','Technical SEO','coming_soon','Search and filter a larger set of per-page crawl fields.',10),
('link_explorer','Link explorer and link graph','Links','coming_soon','Inspect inlinks, outlinks, anchor text and link relationships.',11),
('audit_comparison','Audit-to-audit change comparison','Analytics','coming_soon','Show new, resolved and persistent issues across saved runs.',12),
('javascript_rendering','JavaScript-rendered crawling','Crawl engine','coming_soon','Render client-side applications in an isolated browser worker.',13),
('structured_data','Structured data validation','On-page SEO','coming_soon','Parse and validate JSON-LD, Microdata and RDFa with real diagnostics.',14),
('hreflang','International SEO and hreflang','International SEO','coming_soon','Validate hreflang references, reciprocity and language targeting.',15),
('pdf_reports','PDF and branded reports','Reporting','coming_soon','Generate downloadable and branded PDF reports from persisted audit data.',16),
('scheduled_audits','Scheduled recurring audits','Automation','coming_soon','Run daily/weekly/monthly audits with retries and scheduling controls.',17),
('uptime_monitoring','Uptime monitoring and outage alerts','Monitoring','coming_soon','Scheduled HTTP checks, outage detection, recovery events and alerting.',18),
('synthetic_performance','Synthetic performance / Lighthouse','Performance','coming_soon','Run reproducible lab tests with performance budgets and metric history.',19),
('crux_integration','Google CrUX field data','Performance','coming_soon','Show real field Core Web Vitals only when supported public or authorized data exists.',20),
('real_user_monitoring','Real-user monitoring','Performance','coming_soon','Collect consent-aware real-user performance metrics from an installed snippet.',21),
('accessibility_diagnostics','Accessibility diagnostics','Accessibility','coming_soon','Run automated accessibility checks and preserve rule/element evidence.',22),
('security_diagnostics','Security and response-header diagnostics','Security','coming_soon','Audit safe public configuration and response headers without claiming penetration testing.',23),
('ai_crawler_accessibility','AI/search crawler access checks','Crawlability','coming_soon','Check robots directives for declared search and AI crawler user agents.',24),
('internal_link_suggestions','Internal linking opportunities','Links','coming_soon','Recommend relevant internal links using page/topic evidence.',25),
('mobile_usability','Mobile usability checks','Mobile','coming_soon','Inspect viewport, mobile rendering and supported mobile usability rules.',26),
('crawl_graph','Crawl map and site visualizations','Visualization','coming_soon','Visualize crawl depth, internal link paths and orphan-page candidates.',27),
('shareable_reports','Shareable report links','Reporting','coming_soon','Create permission-controlled, revocable read-only report links.',28),
('integrations_gsc_ga','Google Search Console / Analytics integrations','Integrations','coming_soon','Import authorized search/traffic metrics with clear data provenance.',29),
('white_label','White-label / client portal','Agency','coming_soon','Brand reports and manage client-facing workspaces.',30),
('api_access','Public API and webhooks','Developer','coming_soon','Scoped API tokens, rate limits, audit logs and webhook delivery.',31),
('custom_dashboards','Custom dashboards and saved views','Analytics','coming_soon','Save workspace-specific metrics, filters and chart layouts.',32),
('performance_budgets','Performance budgets and regression alerts','Performance','coming_soon','Alert on real configured thresholds after lab/field data is available.',33)
on conflict(feature_key) do update set display_name=excluded.display_name,category=excluded.category,implementation_status=excluded.implementation_status,description=excluded.description,sort_order=excluded.sort_order,updated_at=now();
update public.plan_catalog set
 target_limits=case plan_key when 'free' then '{"sites":1,"audits_per_month":5,"pages_per_audit":15,"history_days":7,"team_seats":1}'::jsonb when 'standard' then '{"sites":5,"audits_per_month":50,"pages_per_audit":500,"history_days":90,"team_seats":3}'::jsonb else '{"sites":25,"audits_per_month":250,"pages_per_audit":5000,"history_days":365,"team_seats":10}'::jsonb end,
 features=case plan_key
  when 'free' then '{"technical_audit_mvp":true,"issue_explorer":true,"audit_history":true,"csv_audit_export":true,"robots_sitemap_validation":true,"redirects_and_http_status":true,"duplicate_metadata":true,"basic_link_checks":true,"site_health_score":false,"page_explorer":false,"link_explorer":false,"audit_comparison":false,"javascript_rendering":false,"structured_data":false,"hreflang":false,"pdf_reports":false,"scheduled_audits":false,"uptime_monitoring":false,"synthetic_performance":false,"crux_integration":false,"real_user_monitoring":false,"accessibility_diagnostics":false,"security_diagnostics":false,"ai_crawler_accessibility":false,"internal_link_suggestions":false,"mobile_usability":false,"crawl_graph":false,"shareable_reports":false,"integrations_gsc_ga":false,"white_label":false,"api_access":false,"custom_dashboards":false,"performance_budgets":false}'::jsonb
  when 'standard' then '{"technical_audit_mvp":true,"issue_explorer":true,"audit_history":true,"csv_audit_export":true,"robots_sitemap_validation":true,"redirects_and_http_status":true,"duplicate_metadata":true,"basic_link_checks":true,"site_health_score":true,"page_explorer":true,"link_explorer":true,"audit_comparison":true,"javascript_rendering":false,"structured_data":true,"hreflang":true,"pdf_reports":true,"scheduled_audits":true,"uptime_monitoring":true,"synthetic_performance":true,"crux_integration":true,"real_user_monitoring":false,"accessibility_diagnostics":true,"security_diagnostics":true,"ai_crawler_accessibility":true,"internal_link_suggestions":true,"mobile_usability":true,"crawl_graph":false,"shareable_reports":true,"integrations_gsc_ga":true,"white_label":false,"api_access":false,"custom_dashboards":false,"performance_budgets":true}'::jsonb
  else '{"technical_audit_mvp":true,"issue_explorer":true,"audit_history":true,"csv_audit_export":true,"robots_sitemap_validation":true,"redirects_and_http_status":true,"duplicate_metadata":true,"basic_link_checks":true,"site_health_score":true,"page_explorer":true,"link_explorer":true,"audit_comparison":true,"javascript_rendering":true,"structured_data":true,"hreflang":true,"pdf_reports":true,"scheduled_audits":true,"uptime_monitoring":true,"synthetic_performance":true,"crux_integration":true,"real_user_monitoring":true,"accessibility_diagnostics":true,"security_diagnostics":true,"ai_crawler_accessibility":true,"internal_link_suggestions":true,"mobile_usability":true,"crawl_graph":true,"shareable_reports":true,"integrations_gsc_ga":true,"white_label":true,"api_access":true,"custom_dashboards":true,"performance_budgets":true}'::jsonb
 end,updated_at=now();
