/* SolarRota Landing — Scenarios, HowItWorks, Features */

const SCENARIOS_L = [
  { id: 'ongrid', name: 'On-Grid Rooftop', color: '#F59E0B', icon: 'panel',
    desc: 'Bill savings, self-consumption, export revenue, ROI, and proposal readiness.',
    meta: 'Net-metered · Residential & commercial' },
  { id: 'offgrid', name: 'Off-Grid + Storage', color: '#8B5CF6', icon: 'layers',
    desc: 'Battery-first autonomy. Sized by daily load and days of autonomy.',
    meta: 'Pre-feasibility · Site measurement required' },
  { id: 'irrigation', name: 'Solar Irrigation', color: '#10B981', icon: 'drop',
    desc: 'Direct-drive pumping. Daily water demand drives the PV sizing.',
    meta: 'Agricultural · Variable-frequency drive' },
  { id: 'heatpump', name: 'PV + Heat Pump', color: '#EC4899', icon: 'thermo',
    desc: 'Bivalent heating. Optimises self-consumption against the COP curve.',
    meta: 'Residential · Dynamic tariff aware' },
  { id: 'mobile', name: 'Mobile · Van · Boat', color: '#06B6D4', icon: 'van',
    desc: '12–48V DC systems with portable inverters and MPPT charge controllers.',
    meta: 'DC microgrid · Lithium LFP' },
  { id: 'ev', name: 'EV Charge Coupling', color: '#3B82F6', icon: 'plug',
    desc: 'PV-coupled charging windows, smart dispatch to OCPP 2.0 chargers.',
    meta: 'Solar-only · Boost · Scheduled modes' },
];

const Scenarios = () => (
  <section className="section" id="scenarios">
    <div className="container">
      <div className="section-head">
        <div>
          <div className="eyebrow">Scenarios · Six flows, one workflow</div>
          <h2 className="gradient-text">The right math for every project you quote.</h2>
        </div>
        <p>Every scenario changes the sizing heuristics, the report template, and which equipment the catalog filters to — so your assumptions stay honest from click one.</p>
      </div>
      <div className="scen-grid">
        {SCENARIOS_L.map(s => (
          <button key={s.id} className="scen-card" style={{'--scen-color': s.color}}>
            <div className="scen-tile"><Icon name={s.icon} size={26} stroke={2}/></div>
            <h3>{s.name}</h3>
            <p>{s.desc}</p>
            <div className="scen-meta">
              <span style={{color: s.color}}>●</span>
              <span>{s.meta}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  </section>
);

/* ─────────────── HOW IT WORKS ─────────────── */
const STEPS_L = [
  { n: '01', t: 'Scenario', d: 'Pick On-Grid, Off-Grid, Irrigation, Heat Pump, Mobile, or EV. The report template and sizing heuristics adapt.', icon: 'target' },
  { n: '02', t: 'Location', d: 'Drop a pin or paste coordinates. We pull PVGIS irradiance, temperature series, and the site-specific horizon profile.', icon: 'map' },
  { n: '03', t: 'Roof / layout', d: 'Tilt, azimuth, obstructions, string grouping. Draw on the satellite view or fill the parametric form.', icon: 'compass' },
  { n: '04', t: 'Equipment', d: 'Pick panels, inverter, mount, cable, protection — live catalog with stock, lead time, and Wp · efficiency · unit price.', icon: 'cpu' },
  { n: '05', t: 'Finance', d: 'Tariff snapshot, consumption profile, CAPEX, OPEX, discount rate. We reconcile against parsed bills when available.', icon: 'coins' },
  { n: '06', t: 'Calculate', d: 'Hourly simulation, 8,760 steps, with degradation, soiling, clipping, and inverter efficiency curve. 6–9 seconds.', icon: 'chart' },
  { n: '07', t: 'Results', d: 'KPIs, monthly yield, self-consumption, payback, NPV, PR, inverter efficiency — exportable as a client-ready PDF.', icon: 'file' },
];

const HowItWorks = () => {
  const [active, setActive] = useState(0);
  const step = STEPS_L[active];
  return (
    <section className="section" id="how" style={{background:'linear-gradient(180deg, transparent 0%, rgba(255,255,255,.01) 50%, transparent 100%)'}}>
      <div className="container">
        <div className="section-head">
          <div>
            <div className="eyebrow">How it works</div>
            <h2 className="gradient-text">Seven steps. Zero guesswork.</h2>
          </div>
          <p>A disciplined flow that turns a pin on a map into a quote-ready document. Click any step to see what happens inside it.</p>
        </div>

        <div className="steps-wrap">
          <div className="steps-list">
            {STEPS_L.map((s, i) => (
              <div key={s.n} className={`step-item ${i === active ? 'active' : ''}`} onClick={() => setActive(i)}>
                <div className="step-num">{s.n}</div>
                <div>
                  <div className="step-title">{s.t}</div>
                  <div className="step-desc">{s.d}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="glass step-viz">
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:18}}>
              <div style={{display:'flex',alignItems:'center',gap:12}}>
                <div style={{width:44,height:44,borderRadius:12,background:'linear-gradient(135deg, var(--primary), var(--primary-highlight))',color:'#0F172A',display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'0 0 16px rgba(245,158,11,.4)'}}>
                  <Icon name={step.icon} size={22} stroke={2.2}/>
                </div>
                <div>
                  <div style={{fontSize:10,color:'var(--text-muted)',fontFamily:'var(--font-display)',fontWeight:700,letterSpacing:'.1em',textTransform:'uppercase'}}>Step {step.n}</div>
                  <div style={{fontFamily:'var(--font-display)',fontWeight:700,fontSize:20,letterSpacing:'-0.02em',marginTop:2}}>{step.t}</div>
                </div>
              </div>
              <div className="wiz-dots">
                {STEPS_L.map((_, i) => (
                  <div key={i} className={`wiz-dot ${i === active ? 'active' : i < active ? 'done' : ''}`}/>
                ))}
              </div>
            </div>

            <StepVisual active={active}/>
          </div>
        </div>
      </div>
    </section>
  );
};

const StepVisual = ({ active }) => {
  // Each step gets a distinctive visual "peek"
  if (active === 0) {
    return (
      <div>
        <div style={{fontSize:13,color:'var(--text-muted)',marginBottom:16,lineHeight:1.55}}>Selecting a scenario decides the calculation engine and the report you'll ship to the client.</div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
          {SCENARIOS_L.slice(0,4).map((s,i) => (
            <div key={s.id} style={{padding:14,borderRadius:12,background: i===0?`linear-gradient(135deg, ${s.color}18, ${s.color}03)`:'rgba(255,255,255,.02)',border:i===0?`1.5px solid ${s.color}`:'1px solid var(--border-subtle)',boxShadow: i===0? `0 0 20px ${s.color}25`:'none'}}>
              <div style={{color:s.color,marginBottom:8}}><Icon name={s.icon} size={22}/></div>
              <div style={{fontFamily:'var(--font-display)',fontWeight:700,fontSize:13,letterSpacing:'-0.01em'}}>{s.name}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (active === 1) {
    return (
      <div>
        <div style={{fontSize:13,color:'var(--text-muted)',marginBottom:14}}>Satellite drop-pin · PVGIS irradiance pulled live.</div>
        <div style={{position:'relative',height:260,borderRadius:12,overflow:'hidden',background:'#0A0F1E',border:'1px solid var(--border-subtle)'}}>
          <svg viewBox="0 0 400 260" style={{width:'100%',height:'100%',display:'block'}} preserveAspectRatio="none">
            <defs>
              <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(255,255,255,.06)" strokeWidth="1"/>
              </pattern>
              <radialGradient id="heat" cx="55%" cy="45%" r="50%">
                <stop offset="0%" stopColor="rgba(245,158,11,.35)"/>
                <stop offset="100%" stopColor="rgba(245,158,11,0)"/>
              </radialGradient>
            </defs>
            <rect width="400" height="260" fill="#0F172A"/>
            <rect width="400" height="260" fill="url(#grid)"/>
            <path d="M 30 200 Q 100 120 180 140 T 370 100" fill="none" stroke="rgba(6,182,212,.4)" strokeWidth="1.5" strokeDasharray="4 4"/>
            <rect width="400" height="260" fill="url(#heat)"/>
            <g transform="translate(220,116)">
              <circle r="24" fill="rgba(245,158,11,.15)"/>
              <circle r="14" fill="#F59E0B"/>
              <path d="M 0 -14 L 0 30" stroke="#F59E0B" strokeWidth="2"/>
              <circle r="4" fill="#0F172A"/>
            </g>
            <g fontFamily="Space Grotesk, sans-serif" fontWeight="600" fontSize="10" fill="#94A3B8">
              <text x="14" y="20">VALENCIA · ES</text>
              <text x="14" y="38" fill="#F59E0B">39.48°N · 0.37°W</text>
            </g>
          </svg>
          <div style={{position:'absolute',bottom:12,left:12,right:12,display:'flex',gap:8,flexWrap:'wrap'}}>
            <span className="chip" style={{background:'rgba(15,23,42,.85)',color:'var(--text)',borderColor:'var(--border-subtle)',backdropFilter:'blur(8px)'}}>GHI 1,764 kWh/m²/yr</span>
            <span className="chip" style={{background:'rgba(15,23,42,.85)',color:'var(--accent)',borderColor:'rgba(6,182,212,.3)',backdropFilter:'blur(8px)'}}>Horizon profile ✓</span>
          </div>
        </div>
      </div>
    );
  }
  if (active === 2) {
    return (
      <div>
        <div style={{fontSize:13,color:'var(--text-muted)',marginBottom:14}}>Parametric or drawn — tilt 30°, azimuth 8° W of south.</div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
          <div style={{padding:16,borderRadius:12,background:'rgba(255,255,255,.02)',border:'1px solid var(--border-subtle)'}}>
            <div style={{fontSize:10,color:'var(--text-muted)',fontWeight:700,letterSpacing:'.08em',textTransform:'uppercase',fontFamily:'var(--font-display)'}}>Tilt</div>
            <svg viewBox="0 0 120 100" style={{width:'100%',height:80,marginTop:8}}>
              <line x1="10" y1="85" x2="110" y2="85" stroke="#475569" strokeWidth="1.5"/>
              <line x1="20" y1="85" x2="90" y2="40" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round"/>
              <path d="M 20 85 A 30 30 0 0 1 50 85" fill="none" stroke="#06B6D4" strokeWidth="1.5" strokeDasharray="3 3"/>
              <text x="62" y="82" fontSize="11" fill="#06B6D4" fontFamily="Space Grotesk" fontWeight="700">30°</text>
            </svg>
          </div>
          <div style={{padding:16,borderRadius:12,background:'rgba(255,255,255,.02)',border:'1px solid var(--border-subtle)'}}>
            <div style={{fontSize:10,color:'var(--text-muted)',fontWeight:700,letterSpacing:'.08em',textTransform:'uppercase',fontFamily:'var(--font-display)'}}>Azimuth</div>
            <svg viewBox="0 0 120 100" style={{width:'100%',height:80,marginTop:8}}>
              <circle cx="60" cy="55" r="32" fill="none" stroke="#475569" strokeWidth="1.5"/>
              <circle cx="60" cy="55" r="32" fill="none" stroke="rgba(245,158,11,.2)" strokeWidth="1" strokeDasharray="2 4"/>
              <line x1="60" y1="55" x2="60" y2="23" stroke="#475569" strokeWidth="1"/>
              <line x1="60" y1="55" x2="52" y2="24" stroke="#F59E0B" strokeWidth="2.5" strokeLinecap="round"/>
              <circle cx="60" cy="55" r="3" fill="#F59E0B"/>
              <text x="57" y="16" fontSize="9" fill="#94A3B8" fontFamily="Space Grotesk" fontWeight="700">N</text>
              <text x="57" y="98" fontSize="9" fill="#94A3B8" fontFamily="Space Grotesk" fontWeight="700">S</text>
            </svg>
          </div>
        </div>
        <div style={{marginTop:12,padding:12,borderRadius:10,background:'rgba(245,158,11,.06)',border:'1px solid rgba(245,158,11,.2)',fontSize:12,color:'#FCD34D',display:'flex',gap:10,alignItems:'flex-start'}}>
          <span style={{marginTop:2}}>⚠</span>
          <span>Roof has a 2.4 m chimney at azimuth 72° — shading losses auto-applied (3.1% of annual yield).</span>
        </div>
      </div>
    );
  }
  if (active === 3) {
    const rows = [
      { m: 'LONGi LR7-72HTH', w: 560, e: '22.2%', p: '€98' },
      { m: 'Trina Vertex S+', w: 445, e: '22.5%', p: '€82' },
      { m: 'JinkoSolar Tiger Neo', w: 620, e: '22.8%', p: '€112' },
    ];
    return (
      <div style={{display:'flex',flexDirection:'column',gap:10}}>
        <div style={{fontSize:13,color:'var(--text-muted)',marginBottom:4}}>Live catalog · filtered to Mono PERC ≥ 400 Wp.</div>
        {rows.map((r,i) => (
          <div key={r.m} style={{display:'grid',gridTemplateColumns:'1fr auto auto auto',gap:14,alignItems:'center',padding:'12px 14px',borderRadius:10, background: i===0?'linear-gradient(135deg,rgba(245,158,11,.08),rgba(245,158,11,.01))':'rgba(255,255,255,.02)', border: i===0?'1px solid rgba(245,158,11,.45)':'1px solid var(--border-subtle)'}}>
            <div>
              <div style={{fontFamily:'var(--font-display)',fontWeight:700,fontSize:13}}>{r.m}</div>
              <div style={{fontSize:10,color:'var(--text-muted)',marginTop:2}}>Mono PERC · Bifacial</div>
            </div>
            <div style={{fontFamily:'var(--font-display)',fontWeight:700,fontSize:13}}>{r.w}<span style={{color:'var(--text-muted)',fontWeight:500,fontSize:11}}> Wp</span></div>
            <div style={{fontFamily:'var(--font-display)',fontWeight:700,fontSize:13,color:'var(--accent)'}}>{r.e}</div>
            <div style={{fontFamily:'var(--font-display)',fontWeight:700,fontSize:13}}>{r.p}</div>
          </div>
        ))}
        <div style={{padding:'10px 14px',borderRadius:10,background:'rgba(6,182,212,.06)',border:'1px solid rgba(6,182,212,.2)',fontSize:12,color:'#7DD3FC',marginTop:4,fontFamily:'var(--font-display)',fontWeight:600,display:'flex',justifyContent:'space-between'}}>
          <span>8.4 kWp array · 15 × LR7-72HTH · 2 strings</span>
          <span>BoM €9,840</span>
        </div>
      </div>
    );
  }
  if (active === 4) {
    return (
      <div style={{display:'flex',flexDirection:'column',gap:10}}>
        <div style={{fontSize:13,color:'var(--text-muted)',marginBottom:4}}>Tariff snapshot &amp; parsed bill evidence.</div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
          {[
            ['Import tariff', '€0.183', '/kWh'],
            ['Export tariff', '€0.068', '/kWh'],
            ['CAPEX', '€14,280', 'incl. VAT'],
            ['OPEX / yr', '€185', 'annual'],
          ].map(([l,v,u]) => (
            <div key={l} style={{padding:14,borderRadius:10,background:'rgba(255,255,255,.02)',border:'1px solid var(--border-subtle)'}}>
              <div style={{fontSize:10,color:'var(--text-muted)',fontWeight:700,letterSpacing:'.08em',textTransform:'uppercase',fontFamily:'var(--font-display)'}}>{l}</div>
              <div style={{fontFamily:'var(--font-display)',fontWeight:800,fontSize:22,letterSpacing:'-0.03em',marginTop:6}}>{v}</div>
              <div style={{fontSize:10,color:'var(--text-muted)',marginTop:2}}>{u}</div>
            </div>
          ))}
        </div>
        <div style={{padding:12,borderRadius:10,background:'rgba(16,185,129,.06)',border:'1px solid rgba(16,185,129,.22)',fontSize:12,color:'#6EE7B7',display:'flex',gap:8,alignItems:'center',fontFamily:'var(--font-display)',fontWeight:600}}>
          <span>✓</span> 4 Iberdrola bills parsed · consumption profile reconciled · residual 2.4%
        </div>
      </div>
    );
  }
  if (active === 5) {
    return (
      <div>
        <div style={{fontSize:13,color:'var(--text-muted)',marginBottom:14}}>8,760-step hourly simulation · degradation · soiling · inverter η curve.</div>
        <div style={{padding:18,borderRadius:12,background:'#0A0F1E',border:'1px solid var(--border-subtle)',fontFamily:'Space Grotesk, monospace',fontSize:11,lineHeight:1.8,color:'var(--text-muted)'}}>
          <div><span style={{color:'var(--accent)'}}>●</span> PVGIS hourly radiation loaded <span style={{color:'var(--success)'}}>✓</span></div>
          <div><span style={{color:'var(--accent)'}}>●</span> Cell temperature model (Sandia) <span style={{color:'var(--success)'}}>✓</span></div>
          <div><span style={{color:'var(--accent)'}}>●</span> DC losses · module mismatch 1.8% <span style={{color:'var(--success)'}}>✓</span></div>
          <div><span style={{color:'var(--accent)'}}>●</span> Inverter clipping · 8,760 steps <span style={{color:'var(--success)'}}>✓</span></div>
          <div><span style={{color:'var(--primary)'}}>●</span> <span style={{color:'var(--primary)'}}>Self-consumption dispatch...</span> <span style={{color:'var(--primary-highlight)'}}>68.4%</span></div>
          <div style={{color:'var(--text)',marginTop:8}}>→ Annual AC yield <span style={{color:'var(--primary)',fontWeight:700}}>12,487 kWh</span> · PR <span style={{color:'var(--primary)',fontWeight:700}}>87.2%</span></div>
        </div>
      </div>
    );
  }
  // 6 — Results
  return (
    <div>
      <div style={{fontSize:13,color:'var(--text-muted)',marginBottom:14}}>One-page client report · editable &amp; CE-branded.</div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
        <div style={{padding:14,borderRadius:10,background:'rgba(255,255,255,.02)',border:'1px solid var(--border-subtle)'}}>
          <div style={{fontSize:10,color:'var(--text-muted)',fontWeight:700,letterSpacing:'.08em',textTransform:'uppercase',fontFamily:'var(--font-display)'}}>Annual yield</div>
          <div style={{fontFamily:'var(--font-display)',fontWeight:800,fontSize:26,letterSpacing:'-0.04em',marginTop:6,color:'var(--primary)'}}>12.48<span style={{fontSize:12,color:'var(--text-muted)',fontWeight:500}}> MWh</span></div>
        </div>
        <div style={{padding:14,borderRadius:10,background:'rgba(255,255,255,.02)',border:'1px solid var(--border-subtle)'}}>
          <div style={{fontSize:10,color:'var(--text-muted)',fontWeight:700,letterSpacing:'.08em',textTransform:'uppercase',fontFamily:'var(--font-display)'}}>Payback</div>
          <div style={{fontFamily:'var(--font-display)',fontWeight:800,fontSize:26,letterSpacing:'-0.04em',marginTop:6,color:'var(--success)'}}>6.2<span style={{fontSize:12,color:'var(--text-muted)',fontWeight:500}}> yr</span></div>
        </div>
      </div>
      <div style={{marginTop:12,padding:'12px 14px',borderRadius:10,display:'flex',justifyContent:'space-between',alignItems:'center',background:'linear-gradient(135deg,rgba(245,158,11,.1),rgba(245,158,11,.02))',border:'1px solid rgba(245,158,11,.4)'}}>
        <div style={{fontSize:12,fontFamily:'var(--font-display)',fontWeight:700}}>SolarRota_Valencia_rooftop.pdf</div>
        <span className="chip" style={{background:'rgba(16,185,129,.16)',color:'#6EE7B7',borderColor:'rgba(16,185,129,.3)'}}>QUOTE-READY</span>
      </div>
    </div>
  );
};

window.LScenarios = Scenarios;
window.LHowItWorks = HowItWorks;
window.SCENARIOS_L = SCENARIOS_L;
