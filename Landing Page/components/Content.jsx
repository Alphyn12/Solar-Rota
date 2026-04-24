/* SolarRota Landing — Confidence, Features, Stats, Pricing, FAQ, CTA, Footer */

const Confidence = () => (
  <section className="section" id="product">
    <div className="container">
      <div className="section-head">
        <div>
          <div className="eyebrow">Confidence model</div>
          <h2 className="gradient-text">Every number shipped with the evidence behind it.</h2>
        </div>
        <p>SolarRota is honest about uncertainty. Each project is tagged with a confidence tier — so clients, installers, and lenders all know what they're looking at.</p>
      </div>

      <div className="conf-row">
        <div className="conf-card">
          <span className="conf-tag" style={{background:'rgba(148,163,184,.12)',color:'#CBD5E1',border:'1px solid rgba(148,163,184,.25)'}}>
            <span className="conf-dot" style={{background:'#CBD5E1'}}/> ROUGH ESTIMATE
          </span>
          <h3 style={{fontFamily:'var(--font-display)',fontWeight:700,fontSize:17,letterSpacing:'-0.02em',marginTop:14,color:'var(--text)'}}>Pin-only · 30 seconds</h3>
          <p style={{fontSize:13,color:'var(--text-muted)',lineHeight:1.6,marginTop:8}}>PVGIS-based yield from address alone. Good for screening leads and sizing conversations at the kitchen table.</p>
        </div>
        <div className="conf-card" style={{background:'linear-gradient(135deg,rgba(245,158,11,.06),rgba(245,158,11,.01))',borderColor:'rgba(245,158,11,.3)'}}>
          <span className="conf-tag" style={{background:'rgba(245,158,11,.14)',color:'#FCD34D',border:'1px solid rgba(245,158,11,.4)'}}>
            <span className="conf-dot" style={{background:'#F59E0B'}}/> ENGINEERING ESTIMATE
          </span>
          <h3 style={{fontFamily:'var(--font-display)',fontWeight:700,fontSize:17,letterSpacing:'-0.02em',marginTop:14,color:'var(--text)'}}>Full seven steps · 40 min</h3>
          <p style={{fontSize:13,color:'var(--text-muted)',lineHeight:1.6,marginTop:8}}>Roof parameters, tariff snapshot, equipment catalog, hourly simulation. The default SolarRota project.</p>
        </div>
        <div className="conf-card" style={{background:'linear-gradient(135deg,rgba(16,185,129,.06),rgba(16,185,129,.01))',borderColor:'rgba(16,185,129,.3)'}}>
          <span className="conf-tag" style={{background:'rgba(16,185,129,.14)',color:'#6EE7B7',border:'1px solid rgba(16,185,129,.4)'}}>
            <span className="conf-dot" style={{background:'#10B981'}}/> QUOTE-READY
          </span>
          <h3 style={{fontFamily:'var(--font-display)',fontWeight:700,fontSize:17,letterSpacing:'-0.02em',marginTop:14,color:'var(--text)'}}>Bill-reconciled · Sourced</h3>
          <p style={{fontSize:13,color:'var(--text-muted)',lineHeight:1.6,marginTop:8}}>Parsed invoices match consumption to within ±3%, tariff snapshot under 30 days, horizon profile verified. Ready to sign.</p>
        </div>
      </div>
    </div>
  </section>
);

/* ─────────────── FEATURES ─────────────── */
const Features = () => {
  const feats = [
    { icon: 'bolt', t: 'Hourly simulation', d: '8,760 timesteps per project. Cell temperature, inverter efficiency curve, clipping, soiling, degradation — no monthly averages.' },
    { icon: 'shield', t: 'Bill reconciliation', d: 'Parse Iberdrola, Endesa, EDP, Enel invoices. Residual error shown; self-consumption is anchored in real meter data.' },
    { icon: 'globe', t: 'PVGIS v5.3 live', d: 'Irradiance and temperature series pulled per project. Horizon profile applied automatically — no spreadsheet gymnastics.' },
    { icon: 'coins', t: 'Financial honesty', d: 'CAPEX, OPEX, discount rate, tariff escalation. 25-year NPV, IRR, payback, and LCOE — all with assumption trails.' },
    { icon: 'file', t: 'Installer-ready report', d: 'One-click PDF with string layout, BoM, protection scheme, and evidence appendix. CE-branded and translated.' },
    { icon: 'lock', t: 'GDPR &amp; SOC 2', d: 'Projects stored in EU-West. Client data encrypted at rest. Shared links expire. Audit log per project.' },
  ];
  return (
    <section className="section">
      <div className="container">
        <div className="section-head">
          <div>
            <div className="eyebrow">What's inside</div>
            <h2 className="gradient-text">Built for installers who get audited.</h2>
          </div>
          <p>Not a flashy calculator. A disciplined engine that respects the physics, the finance, and the regulator.</p>
        </div>
        <div className="feat-grid">
          {feats.map(f => (
            <div key={f.t} className="feat-card">
              <div className="feat-icon"><Icon name={f.icon} size={20} stroke={2.2}/></div>
              <h3>{f.t}</h3>
              <p dangerouslySetInnerHTML={{__html:f.d}}/>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

/* ─────────────── STATS BAND ─────────────── */
const Stats = () => (
  <section className="section-tight">
    <div className="container">
      <div className="stats-band">
        {[
          { v: '2,400+', l: 'Installers on platform', c: 'var(--primary)' },
          { v: '38k', l: 'Projects calculated · 2025', c: 'var(--primary-highlight)' },
          { v: '±2.8%', l: 'Median yield vs meter truth', c: 'var(--accent)' },
          { v: '6.1 yr', l: 'Median payback · On-Grid ES', c: 'var(--success)' },
        ].map(s => (
          <div key={s.l} className="stat">
            <div className="stat-val" style={{color: s.c}}>{s.v}</div>
            <div className="stat-label">{s.l}</div>
          </div>
        ))}
      </div>
    </div>
  </section>
);

/* ─────────────── TESTIMONIAL ─────────────── */
const Testimonial = () => (
  <section className="section-tight">
    <div className="container">
      <div className="glass" style={{padding:'40px 44px',maxWidth:880,margin:'0 auto'}}>
        <div style={{display:'flex',alignItems:'flex-start',gap:24,flexWrap:'wrap'}}>
          <div style={{width:56,height:56,borderRadius:16,background:'linear-gradient(135deg, var(--primary), var(--accent))',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'var(--font-display)',fontWeight:800,color:'#0F172A',fontSize:20,flexShrink:0,boxShadow:'0 0 20px rgba(245,158,11,.3)'}}>MR</div>
          <div style={{flex:1,minWidth:280}}>
            <div className="eyebrow">Case · Ruiz Energía · Valencia</div>
            <p style={{fontFamily:'var(--font-display)',fontWeight:500,fontSize:20,letterSpacing:'-0.015em',lineHeight:1.5,marginTop:10,color:'var(--text)'}}>
              "We used to run PVGIS + Excel + a scan of the bill. SolarRota reconciles all three before the client finishes their coffee. Our close rate on commercial jumped from 22% to 41% in six months."
            </p>
            <div style={{marginTop:18,display:'flex',alignItems:'center',gap:12,flexWrap:'wrap'}}>
              <div style={{fontFamily:'var(--font-display)',fontWeight:700,fontSize:14}}>Mariano Ruiz</div>
              <span style={{color:'var(--text-muted)',fontSize:13}}>· Technical director, Ruiz Energía</span>
              <span className="chip" style={{background:'rgba(245,158,11,.12)',color:'#FCD34D',borderColor:'rgba(245,158,11,.3)'}}>140 projects / yr</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
);

/* ─────────────── PRICING ─────────────── */
const Pricing = () => (
  <section className="section" id="pricing">
    <div className="container">
      <div className="section-head">
        <div>
          <div className="eyebrow">Pricing</div>
          <h2 className="gradient-text">Priced per project closed, not per seat.</h2>
        </div>
        <p>Free forever for homeowners and tinkerers. Installers pay only when a project goes quote-ready. Enterprises get SSO, white-label reports, and a regional tariff pack.</p>
      </div>

      <div className="price-grid">
        <div className="price-card">
          <div className="price-name">Hobbyist</div>
          <div className="price-tag">€0<sub> / forever</sub></div>
          <div className="price-desc">For homeowners sizing their own system or students exploring PV physics.</div>
          <div className="price-hr"/>
          <ul className="price-feats">
            <li><span className="check"><Icon name="check" size={14} stroke={2.5}/></span> 2 active projects</li>
            <li><span className="check"><Icon name="check" size={14} stroke={2.5}/></span> All 6 scenarios</li>
            <li><span className="check"><Icon name="check" size={14} stroke={2.5}/></span> PVGIS hourly simulation</li>
            <li><span className="check"><Icon name="check" size={14} stroke={2.5}/></span> Basic PDF export</li>
            <li className="dim"><span className="check" style={{color:'var(--text-muted)'}}>—</span> No bill parsing</li>
            <li className="dim"><span className="check" style={{color:'var(--text-muted)'}}>—</span> No team workspace</li>
          </ul>
          <a href="#cta" className="btn btn-secondary price-cta" style={{justifyContent:'center'}}>Start free <Icon name="arrow" size={14}/></a>
        </div>

        <div className="price-card featured">
          <div className="featured-badge">MOST POPULAR</div>
          <div className="price-name">Installer</div>
          <div className="price-tag">€39<sub> / quote-ready project</sub></div>
          <div className="price-desc">For 1–10 person installers closing €10k+ projects weekly. Unlimited drafts.</div>
          <div className="price-hr"/>
          <ul className="price-feats">
            <li><span className="check"><Icon name="check" size={14} stroke={2.5}/></span> Unlimited draft projects</li>
            <li><span className="check"><Icon name="check" size={14} stroke={2.5}/></span> Bill parsing · ES · PT · IT · DE · TR</li>
            <li><span className="check"><Icon name="check" size={14} stroke={2.5}/></span> Live tariff &amp; catalog snapshots</li>
            <li><span className="check"><Icon name="check" size={14} stroke={2.5}/></span> CE-branded PDF · shareable link</li>
            <li><span className="check"><Icon name="check" size={14} stroke={2.5}/></span> Team workspace · up to 10 seats</li>
            <li><span className="check"><Icon name="check" size={14} stroke={2.5}/></span> Email &amp; chat support · 4h SLA</li>
          </ul>
          <a href="#cta" className="btn btn-primary price-cta" style={{justifyContent:'center'}}>Start 14-day trial <Icon name="arrow" size={14}/></a>
        </div>

        <div className="price-card">
          <div className="price-name">Enterprise</div>
          <div className="price-tag">Custom<sub> · volume</sub></div>
          <div className="price-desc">For EPCs, utilities, and aggregators running &gt;500 proposals per year.</div>
          <div className="price-hr"/>
          <ul className="price-feats">
            <li><span className="check"><Icon name="check" size={14} stroke={2.5}/></span> SSO · SCIM · role-based access</li>
            <li><span className="check"><Icon name="check" size={14} stroke={2.5}/></span> White-label report &amp; domain</li>
            <li><span className="check"><Icon name="check" size={14} stroke={2.5}/></span> Regional tariff pack · custom catalog</li>
            <li><span className="check"><Icon name="check" size={14} stroke={2.5}/></span> API access · CRM webhooks</li>
            <li><span className="check"><Icon name="check" size={14} stroke={2.5}/></span> On-prem deployment available</li>
            <li><span className="check"><Icon name="check" size={14} stroke={2.5}/></span> Dedicated solutions engineer</li>
          </ul>
          <a href="#cta" className="btn btn-secondary price-cta" style={{justifyContent:'center'}}>Talk to sales <Icon name="arrow" size={14}/></a>
        </div>
      </div>
    </div>
  </section>
);

/* ─────────────── FAQ ─────────────── */
const FAQ = () => {
  const [open, setOpen] = useState(0);
  const items = [
    { q: 'How accurate is a SolarRota estimate versus real meter data?',
      a: 'On the installer tier (bill-reconciled, Quote-Ready projects), our median absolute error against real meter truth is 2.8% over the first 12 months — measured across 1,200 on-grid systems in Spain, Portugal, and Turkey.' },
    { q: 'Do I need PVGIS, a tariff database, or a catalog to get started?',
      a: 'No. SolarRota ships with live PVGIS v5.3, tariff snapshots for 14 EU countries, and catalog feeds from LONGi, Trina, Jinko, Huawei, Fronius and Sungrow. You can add your own suppliers on the Installer tier.' },
    { q: 'What does "Quote-Ready" actually mean?',
      a: 'It is our highest confidence tier. To reach it, a project needs a verified horizon profile, a tariff snapshot under 30 days old, and client bills parsed and reconciled to within ±3% of modelled consumption. Anything else is flagged as Engineering Estimate or Rough.' },
    { q: 'Can I white-label the PDF report for my clients?',
      a: 'Yes — the Enterprise tier includes a custom domain, your logo on every page, and your disclaimer pack. On Installer, you can already swap the cover brand and footer text.' },
    { q: 'How is off-grid sizing handled?',
      a: 'Off-grid is a pre-feasibility flow. We give a disciplined battery sizing based on daily load and days of autonomy, but we explicitly mark it "site measurement required" — no Quote-Ready badge for off-grid without a field visit.' },
    { q: 'Do you support bifacial modules and tracker systems?',
      a: 'Bifacial — yes, with a rear-irradiance model and ground-albedo input. Single-axis trackers are in private beta for the Enterprise tier. Dual-axis is on the roadmap for Q3 2026.' },
  ];
  return (
    <section className="section" id="faq">
      <div className="container">
        <div className="section-head" style={{gridTemplateColumns:'1fr'}}>
          <div>
            <div className="eyebrow">Questions</div>
            <h2 className="gradient-text">The things installers ask us.</h2>
          </div>
        </div>
        <div className="faq-wrap">
          {items.map((it, i) => (
            <div key={i} className={`faq-item ${open === i ? 'open' : ''}`} onClick={() => setOpen(open === i ? -1 : i)}>
              <div className="faq-q">
                <span>{it.q}</span>
                <div className="faq-plus">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
                </div>
              </div>
              <div className="faq-a">{it.a}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

/* ─────────────── FINAL CTA ─────────────── */
const FinalCTA = () => (
  <section className="section" id="cta">
    <div className="container">
      <div className="cta-band">
        <div className="eyebrow" style={{color:'var(--primary-highlight)'}}>Ready?</div>
        <h2 style={{marginTop:10}} className="gradient-text">Your next quote, disciplined from click one.</h2>
        <p>Free forever for two projects. No credit card. Fourteen-day installer trial — bill parsing, shared links, PDF export — unlocked on sign-up.</p>
        <div className="cta-row-final">
          <a href="#" className="btn btn-primary btn-lg">Start your first estimate <Icon name="arrow" size={16}/></a>
          <a href="#" className="btn btn-secondary btn-lg">Book a 20-min demo</a>
        </div>
        <div style={{marginTop:24,display:'flex',justifyContent:'center',gap:18,flexWrap:'wrap',fontSize:12,color:'var(--text-muted)'}}>
          <span>✓ No credit card</span>
          <span>✓ EU-hosted · GDPR</span>
          <span>✓ Cancel anytime</span>
        </div>
      </div>
    </div>
  </section>
);

/* ─────────────── FOOTER ─────────────── */
const Footer = () => (
  <footer className="footer">
    <div className="container">
      <div className="foot-grid">
        <div className="foot-brand">
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <img src="assets/solarrota-logo.png" alt="SolarRota" style={{height:32}}/>
            <span style={{fontFamily:'var(--font-display)',fontWeight:800,fontSize:17,letterSpacing:'-0.03em'}}>SolarRota</span>
          </div>
          <p className="foot-desc">A disciplined solar calculation platform for installers who get audited. Built in Valencia &amp; Istanbul.</p>
          <div style={{marginTop:18,display:'flex',gap:8,alignItems:'center'}}>
            <span className="chip" style={{background:'rgba(16,185,129,.12)',color:'#6EE7B7',borderColor:'rgba(16,185,129,.3)'}}>
              <span style={{width:5,height:5,borderRadius:'50%',background:'#10B981'}}/> All systems operational
            </span>
          </div>
        </div>
        <div className="foot-col">
          <h4>Product</h4>
          <a href="#">Calculator</a>
          <a href="#">Scenarios</a>
          <a href="#">Reports</a>
          <a href="#">Catalog</a>
          <a href="#">Changelog</a>
        </div>
        <div className="foot-col">
          <h4>Resources</h4>
          <a href="#">Documentation</a>
          <a href="#">PVGIS methodology</a>
          <a href="#">Confidence model</a>
          <a href="#">API reference</a>
          <a href="#">Status</a>
        </div>
        <div className="foot-col">
          <h4>Company</h4>
          <a href="#">About</a>
          <a href="#">Customers</a>
          <a href="#">Careers</a>
          <a href="#">Contact</a>
          <a href="#">Press</a>
        </div>
        <div className="foot-col">
          <h4>Legal</h4>
          <a href="#">Privacy</a>
          <a href="#">Terms</a>
          <a href="#">GDPR · DPA</a>
          <a href="#">Security</a>
          <a href="#">Cookies</a>
        </div>
      </div>
      <div className="foot-bottom">
        <span>© 2026 SolarRota SL · Valencia · All rights reserved</span>
        <span>Made with care for the installers who read the spec.</span>
      </div>
    </div>
  </footer>
);

window.LConfidence = Confidence;
window.LFeatures = Features;
window.LStats = Stats;
window.LTestimonial = Testimonial;
window.LPricing = Pricing;
window.LFAQ = FAQ;
window.LFinalCTA = FinalCTA;
window.LFooter = Footer;
