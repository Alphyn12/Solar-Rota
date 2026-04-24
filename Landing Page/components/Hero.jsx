/* SolarRota Landing — Section components */

const { useState, useEffect, useRef } = React;

/* ─────────────── Iconography (Lucide-style, stroke-2) ─────────────── */
const Icon = ({ name, size = 18, stroke = 2 }) => {
  const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: stroke, strokeLinecap: "round", strokeLinejoin: "round" };
  const paths = {
    arrow: <><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></>,
    check: <path d="M20 6 9 17l-5-5"/>,
    sun: <><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></>,
    bolt: <path d="M13 2 3 14h9l-1 8 10-12h-9z"/>,
    shield: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></>,
    map: <><path d="M14.106 5.553a2 2 0 0 0 1.788 0l3.659-1.83A1 1 0 0 1 21 4.619v12.764a1 1 0 0 1-.553.894l-4.553 2.277a2 2 0 0 1-1.788 0l-4.212-2.106a2 2 0 0 0-1.788 0l-3.659 1.83A1 1 0 0 1 3 19.381V6.618a1 1 0 0 1 .553-.894L8.106 3.447a2 2 0 0 1 1.788 0z"/><path d="M15 5.764v15"/><path d="M9 3.236v15"/></>,
    layers: <><path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="M2 12a1 1 0 0 0 .58.91l8.59 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 .59-.92"/><path d="M2 17a1 1 0 0 0 .58.91l8.59 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 .59-.92"/></>,
    cpu: <><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M15 2v2"/><path d="M15 20v2"/><path d="M2 15h2"/><path d="M2 9h2"/><path d="M20 15h2"/><path d="M20 9h2"/><path d="M9 2v2"/><path d="M9 20v2"/></>,
    coins: <><circle cx="8" cy="8" r="6"/><path d="M18.09 10.37A6 6 0 1 1 10.34 18"/><path d="M7 6h1v4"/><path d="m16.71 13.88.7.71-2.82 2.82"/></>,
    chart: <><path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="M7 16V10"/><path d="M11 16V6"/><path d="M15 16v-4"/><path d="M19 16v-8"/></>,
    file: <><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5z"/><path d="M14 2v6h6"/></>,
    compass: <><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></>,
    target: <><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></>,
    clock: <><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></>,
    zap: <path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/>,
    drop: <path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/>,
    thermo: <path d="M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z"/>,
    van: <><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/></>,
    plug: <><path d="M12 22v-5"/><path d="M9 8V2"/><path d="M15 8V2"/><path d="M18 8v5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V8Z"/></>,
    lock: <><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></>,
    globe: <><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></>,
    panel: <><rect x="3" y="4" width="18" height="14" rx="1"/><path d="M9 4v14"/><path d="M15 4v14"/><path d="M3 11h18"/><path d="M8 22h8"/><path d="M12 18v4"/></>,
    play: <polygon points="6 3 20 12 6 21 6 3"/>,
  };
  return <svg {...common}>{paths[name]}</svg>;
};

/* ─────────────── NAV ─────────────── */
const Nav = () => (
  <header className="nav">
    <a href="#" className="nav-logo">
      <img src="assets/solarrota-logo.png" alt="SolarRota"/>
      <span className="word">SolarRota</span>
    </a>
    <nav className="nav-links">
      <a href="#product">Product</a>
      <a href="#scenarios">Scenarios</a>
      <a href="#how">How it works</a>
      <a href="#pricing">Pricing</a>
      <a href="#docs">Docs</a>
    </nav>
    <div className="nav-spacer"/>
    <span className="lang-pill">EN · TR · DE</span>
    <a href="#" className="btn btn-secondary">Sign in</a>
    <a href="#cta" className="btn btn-primary">
      Start free <Icon name="arrow" size={15}/>
    </a>
  </header>
);

/* ─────────────── HERO ─────────────── */
const Hero = ({ titleLines = ['Design your solar system', 'with confidence.'] }) => {
  const [step, setStep] = useState(4);
  useEffect(() => {
    const t = setInterval(() => setStep(s => (s % 7) + 1), 2400);
    return () => clearInterval(t);
  }, []);
  return (
    <section className="hero">
      <div className="container">
        <div className="hero-inner">
          <div>
            <div style={{display:'inline-flex',alignItems:'center',gap:8,padding:'6px 12px',borderRadius:999,background:'rgba(245,158,11,.08)',border:'1px solid rgba(245,158,11,.25)'}}>
              <span style={{width:6,height:6,borderRadius:'50%',background:'var(--primary)',boxShadow:'0 0 8px rgba(245,158,11,.8)'}}/>
              <span style={{fontSize:11,fontWeight:700,fontFamily:'var(--font-display)',letterSpacing:'.12em',color:'var(--primary)',textTransform:'uppercase'}}>Now · PVGIS v5.3 + 2026 tariffs</span>
            </div>
            <h1 className="hero-h1">
              <span className="gradient-text">{titleLines[0]}</span><br/>
              <span className="amber-text">{titleLines[1]}</span>
            </h1>
            <p className="hero-sub">
              A disciplined seven-step wizard — scenario, location, roof, equipment, finance, calculate, results.
              Every number reconciled against PVGIS, bills, and live tariffs. Ready for the installer in forty minutes.
            </p>
            <div className="hero-cta-row">
              <a href="#cta" className="btn btn-primary btn-lg">
                Start your first estimate <Icon name="arrow" size={16}/>
              </a>
              <a href="#product" className="btn btn-secondary btn-lg">
                <Icon name="play" size={12}/> Watch 90s demo
              </a>
            </div>
            <div className="hero-trust">
              <span><strong style={{color:'var(--text)'}}>No credit card.</strong> Free forever for two active projects.</span>
              <span className="sep"/>
              <span>Trusted by 2,400+ installers in EU &amp; MENA</span>
            </div>
          </div>

          {/* product peek */}
          <div className="peek">
            <div className="glass glass-inner">
              <div className="peek-header">
                <div>
                  <div className="peek-title">Valencia office rooftop</div>
                  <div className="peek-subtitle">On-Grid · 8.4 kWp · 39.48°N, 0.37°W</div>
                </div>
                <span className="chip" style={{background:'rgba(16,185,129,.12)',color:'#6EE7B7',borderColor:'rgba(16,185,129,.3)'}}>
                  <span style={{width:5,height:5,borderRadius:'50%',background:'#10B981'}}/> QUOTE-READY
                </span>
              </div>

              {/* wizard progress */}
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
                <div style={{fontSize:11,color:'var(--text-muted)',fontFamily:'var(--font-display)',fontWeight:700,letterSpacing:'.08em',textTransform:'uppercase'}}>Step {String(step).padStart(2,'0')} / 07</div>
                <div className="wiz-dots">
                  {[1,2,3,4,5,6,7].map(n => (
                    <div key={n} className={`wiz-dot ${n===step?'active':n<step?'done':''}`}/>
                  ))}
                </div>
              </div>

              <div className="kpi-grid">
                <div className="kpi-tile" style={{'--accent-color':'var(--primary)'}}>
                  <div className="kpi-label">Annual yield</div>
                  <div className="kpi-value">12.48<span className="kpi-unit">MWh</span></div>
                  <div className="kpi-trend">▲ +3.2% vs PVGIS</div>
                </div>
                <div className="kpi-tile" style={{'--accent-color':'var(--primary-highlight)'}}>
                  <div className="kpi-label">Self-consumption</div>
                  <div className="kpi-value" style={{color:'var(--primary-highlight)'}}>68<span className="kpi-unit">%</span></div>
                  <div className="kpi-trend">▲ Battery adds +14</div>
                </div>
                <div className="kpi-tile" style={{'--accent-color':'var(--success)'}}>
                  <div className="kpi-label">Payback</div>
                  <div className="kpi-value" style={{color:'var(--success)'}}>6.2<span className="kpi-unit">yr</span></div>
                </div>
                <div className="kpi-tile" style={{'--accent-color':'var(--accent)'}}>
                  <div className="kpi-label">25-yr NPV</div>
                  <div className="kpi-value" style={{color:'var(--accent)'}}>€41.2<span className="kpi-unit">k</span></div>
                </div>
              </div>

              {/* monthly production */}
              <div style={{marginTop:18,padding:'14px 14px 16px',background:'rgba(255,255,255,.02)',borderRadius:12,border:'1px solid var(--border-subtle)'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <span style={{fontSize:11,color:'var(--text-muted)',fontFamily:'var(--font-display)',fontWeight:700,letterSpacing:'.08em',textTransform:'uppercase'}}>Monthly kWh · hourly-modelled</span>
                  <span className="chip" style={{background:'rgba(245,158,11,.12)',color:'#F59E0B',borderColor:'rgba(245,158,11,.3)'}}>1,480 peak · Jul</span>
                </div>
                <div className="bar-chart">
                  {[380,520,780,1020,1280,1420,1480,1380,1120,820,540,380].map((v,i) => {
                    const max = 1480;
                    return (
                      <div key={i} className="bar-col">
                        <div className="bar-inner" style={{height:`${(v/max)*100}%`}}/>
                        <div className="bar-label">{['J','F','M','A','M','J','J','A','S','O','N','D'][i]}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* evidence footer */}
              <div style={{marginTop:16,paddingTop:14,borderTop:'1px solid var(--border-subtle)',display:'flex',flexDirection:'column',gap:6}}>
                <div style={{display:'flex',alignItems:'center',gap:8,fontSize:11,color:'#6EE7B7',fontFamily:'var(--font-display)',fontWeight:600}}>
                  <span style={{width:5,height:5,borderRadius:'50%',background:'#10B981'}}/> PVGIS verified · 18 Apr 2026
                </div>
                <div style={{display:'flex',alignItems:'center',gap:8,fontSize:11,color:'#6EE7B7',fontFamily:'var(--font-display)',fontWeight:600}}>
                  <span style={{width:5,height:5,borderRadius:'50%',background:'#10B981'}}/> 4 bills parsed &amp; reconciled
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

/* ─────────────── TRUST BAND ─────────────── */
const TrustBand = () => (
  <div className="trust-band">
    <div className="container">
      <div className="trust-row">
        <span style={{fontSize:11,color:'var(--text-muted)',fontFamily:'var(--font-display)',fontWeight:700,letterSpacing:'.14em',textTransform:'uppercase'}}>Sources &amp; integrations</span>
        <span className="logo-slot">PVGIS v5.3</span>
        <span className="logo-slot">OpenWeatherMap</span>
        <span className="logo-slot">Iberdrola · Endesa</span>
        <span className="logo-slot">LONGi · Trina · Jinko</span>
        <span className="logo-slot">Huawei · Fronius</span>
        <span className="logo-slot">OCPP 2.0.1</span>
      </div>
    </div>
  </div>
);

window.Icon = Icon;
window.LNav = Nav;
window.LHero = Hero;
window.LTrust = TrustBand;
