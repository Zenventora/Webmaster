# Competitor-informed feature matrix

Research checked on 2026-10-29. This is a public-feature comparison, not an exhaustive product teardown. Exact availability may vary by plan.

## Publicly documented strengths

| Product | Publicly documented capabilities | SiteRadar response |
|---|---|---|
| Ahrefs Site Audit | Technical site auditing and an Always-on Audit mode that continually crawls, prioritizes important URLs, identifies issues, and sends notifications. | First ship reliable scheduled runs and issue deltas; introduce priority-based recrawling only after usage, importance and queue metrics are grounded. |
| Sitebulb | Broad technical SEO hints, crawl visualizations, client-ready reports, JavaScript crawling, and team collaboration in the cloud offering. | Deliver useful rule explanations, a crawl map, page inspection, CSV/PDF exports and workspace collaboration in stages. |
| Semrush Site Audit | Severity-weighted technical/on-page checks, thematic reports and health scores, crawl scope options, JavaScript rendering, scheduled recrawls, and AI-crawler accessibility checks. | Build severity-first issue triage, categorized scorecards, explicit crawl scope, optional JS rendering and a bot-access report. Don't promise rankings from a health score. |
| DebugBear | Scheduled Lighthouse lab tests, CrUX field data, optional real-user monitoring, request waterfalls, uptime monitoring, trend/comparison views and regression alerts. | Keep lab, field and RUM metrics distinct; surface resource evidence, run history and threshold alerts. |

## Feature status vocabulary

- **MVP**: required for first usable release.
- **Phase 2**: after the crawl + issues workflow is stable.
- **Phase 3**: monitoring, integrations and agency features.
- **Later / gated**: requires additional infrastructure, explicit authorization or mature reliability.

## Functional coverage

| Domain | Feature / edge cases | Priority |
|---|---|---|
| URL discovery | URL and sitemap input; sitemap index; gzip sitemap; robots sitemap references; invalid XML; inaccessible sitemap; fallback internal crawl; canonical URL normalization; fragment removal; query parameter rules; duplicate URLs; sitemap-only pages; crawl-only pages | MVP |
| Crawl controls | Domain/subdomain/subfolder scope; include/exclude patterns; URL/depth/request limits; concurrency/rate cap; retry and timeout controls; cancellation; pause/resume; partial results; redirect cap; crawl budget | MVP |
| Crawl integrity | Correct user agent; robots.txt policy; 3xx chains/loops; redirect-to-other-origin; 4xx/5xx; soft 404 candidates; response content-type checks; noindex; canonical conflicts; content changed between runs | MVP |
| Page metadata | Title and length; missing/duplicate titles; meta description; H1 presence/duplicates; heading hierarchy candidates; language; canonical; robots meta and X-Robots-Tag; viewport; charset; status and indexability | MVP |
| Link analysis | Broken internal/external links; 3xx-linked targets; orphan candidates; inlinks/outlinks; crawl depth; redirect chains; nofollow; anchor text; malformed and JavaScript-only links; fragments/anchors; external host summaries | MVP core, external checks throttled |
| Indexation | robots disallow vs indexability; noindex; canonical target/status; sitemap/indexability mismatches; pagination; faceted URL explosion; duplicate URL variants | MVP/Phase 2 |
| Content | Exact/near-duplicate candidates; thin-content candidate; word count; missing language signals; empty pages; excessive repeated boilerplate; title-content mismatch | Phase 2; heuristics labeled as candidates |
| Structured data | JSON-LD parse errors; malformed Microdata/RDFa observations; supported schema types; missing key properties; duplicate schema blocks; page-vs-schema consistency | Phase 2 |
| Images/assets | Missing alt; empty alt distinctions; image 404; oversized image bytes/dimensions; missing width/height; format opportunities; lazy-loading signals; large JS/CSS; render-blocking assets | MVP basic, Phase 2 deeper |
| Performance | Lighthouse mobile/desktop; LCP, INP, CLS lab/field separation; TTFB; transfer bytes; request count; long tasks; render-blocking resources; waterfall; CPU/console errors; historic comparisons; performance budgets | MVP selected Lighthouse, Phase 2 deep |
| Field data | CrUX origin- and URL-level availability, collection date, percentiles and sample/coverage notes; unavailable or stale observations clearly shown | Phase 2 |
| RUM | Opt-in, privacy-conscious snippet; sampling; consent and data-retention controls; real-world metric distributions | Phase 3; never enable by default |
| Accessibility | Automated axe-like rules; alt/name/label checks; landmark and heading signals; contrast when computable; keyboard-focused automated checks; issue grouping | Phase 2; clearly state manual review needed |
| Safe security observations | HTTPS and redirect-to-HTTPS, mixed content, common response headers, cookie flags when observable, exposed directory/listing signals, obvious unsafe external resource patterns | Phase 2; non-intrusive only |
| AI crawler readiness | robots rules for documented bots; robots.txt accessibility; sitemap discoverability; indexability/canonical; structured data; content access observations | Phase 2; never guarantee AI citations or ranking |
| Issue management | Critical/error/warning/info/opportunity; score impact; evidence and affected URLs; fix guidance; new/recurring/resolved/ignored; notes and assignee; duplicates; confidence; suppression/false positive | MVP lifecycle foundation; collaboration Phase 3 |
| Monitoring | Scheduled audits; uptime/status checks; changed-page detection; critical issue alerts; queue retries; no duplicate alerts; run-history timeline; threshold alerts; notifications preferences | Phase 3 |
| Reports | CSV, PDF, scorecard, affected-URL evidence, executive and technical views, branded reports, expiring share links | CSV MVP, PDF Phase 3 |
| Integrations | Google Search Console / Analytics only with explicit authorized OAuth; PageSpeed Insights; webhooks; API keys and scopes; CI / GitHub issue workflow | Phase 3 |
| SaaS operation | Workspace/project roles, strict tenant boundaries, audit quotas, plan usage, data retention/deletion, logs, support diagnostics, backups, service health, rate limits | Foundation + Phase 3 |
| QA / reliability | Golden HTML fixtures; crawler unit/integration tests; adversarial sitemap and redirect tests; private-network SSRF tests; worker crash recovery; idempotency; load tests; migration testing | Required throughout |

## Scoring rules

- Show overall technical health plus separate category scores. Document every score formula and version it.
- Never mark a page passing when it was skipped, blocked, timed out, robots-disallowed, or not tested; report the state distinctly.
- Every issue must include rule ID/version, severity, evidence, location/page, detected_at, and recommendation.
- A heuristic like "thin content" is a review candidate, not a proven SEO penalty.
- Performance sources differ: label lab data, CrUX field data and optional RUM separately.
- Missing third-party data is "unavailable", not zero or a pass.
- Auto-generated fix advice is guidance, not an automated deployment. Avoid claiming guaranteed search rankings.
- Accessibility automation is not a full WCAG conformance audit; safe header checks are not a penetration test.

## Safe crawling threat model

A public URL is still untrusted input. Protect against SSRF, redirect abuse, DNS rebinding, localhost/private/link-local IPv4 and IPv6, cloud metadata, unbounded response bodies, compressed response bombs, huge sitemap index trees, path/query traps, infinite calendars, malicious HTML, JS execution, and resource exhaustion.

Enforce URL parsing, DNS/IP allow/deny validation at each hop, redirect limits, byte/time/URL/depth bounds, per-host throttling, job quotas, isolated browser workers, and cancellation. Do not send credentials, cookies, or internal headers to targets. Prefer GET/HEAD and no state-changing interactions. Respect robots policy and disclose crawler identity.

## Reference links

- Ahrefs Always-on audit: https://help.ahrefs.com/en/articles/10957674-how-always-on-audit-works
- Sitebulb: https://sitebulb.com/
- Sitebulb visualisations: https://support.sitebulb.com/en/articles/9887437-site-visualisations
- Semrush Site Audit: https://www.semrush.com/features/site-audit/
- Semrush Site Audit help: https://www.semrush.com/kb/31-site-audit
- DebugBear: https://www.debugbear.com/
- DebugBear getting started: https://www.debugbear.com/docs/website-monitoring-getting-started
- DebugBear website scan: https://www.debugbear.com/docs/website-scan
