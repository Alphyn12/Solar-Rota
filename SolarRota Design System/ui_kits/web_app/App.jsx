/* App — the interactive SolarRota calculation wizard */
const { useState } = React;

/* ---------- Screens ---------- */

const HomeScreen = ({ onStartNew }) => {
  const projects = [
    {name:'Valencia office rooftop', kwp:24.8, status:'Active', scenario:'On-Grid', color:'#F59E0B', updated:'2h ago', yield:'36.2 MWh'},
    {name:'La Marina irrigation', kwp:12.0, status:'Draft', scenario:'Irrigation', color:'#06B6D4', updated:'yesterday', yield:'17.4 MWh'},
    {name:'Finca Benaguasil off-grid', kwp:9.6, status:'Review', scenario:'Off-Grid', color:'#94A3B8', updated:'3d ago', yield:'14.1 MWh'},
  ];
  return (
    <div style={{maxWidth:1200,margin:'0 auto',padding:'40px 32px'}}>
      <div style={{display:'flex',alignItems:'flex-end',justifyContent:'space-between',marginBottom:32}}>
        <div>
          <div className="eyebrow">Workspace · Ruiz Energía</div>
          <h1 className="gradient-text" style={{fontFamily:'var(--font-display)',fontWeight:800,fontSize:44,letterSpacing:'-0.04em',lineHeight:1.05,marginTop:8}}>
            Design your solar system<br/>with disciplined estimates.
          </h1>
          <p style={{fontSize:15,color:'var(--text-muted)',marginTop:12,maxWidth:520,lineHeight:1.55}}>
            Seven steps. Verified against PVGIS, tariff snapshots and client bills. Ready for the installer.
          </p>
        </div>
        <button className="btn btn-primary" onClick={onStartNew}>
          New calculation →
        </button>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:14,marginBottom:32}}>
        <KpiTile label="Projects this month" value="14" accent="var(--primary)" trend={{positive:true,label:'+3 vs last'}}/>
        <KpiTile label="Avg system size" value="11.2" unit="kWp" accent="var(--accent)"/>
        <KpiTile label="Avg payback" value="6.4" unit="yr" accent="var(--success)"/>
        <KpiTile label="Portfolio yield" value="284" unit="MWh" accent="var(--primary-highlight)"/>
      </div>

      <div style={{display:'flex',alignItems:'baseline',justifyContent:'space-between',marginBottom:14}}>
        <div>
          <div className="eyebrow">Recent</div>
          <h2 style={{fontFamily:'var(--font-display)',fontWeight:700,fontSize:22,letterSpacing:'-0.025em',marginTop:4}}>Projects</h2>
        </div>
        <div style={{display:'flex',gap:8}}>
          <span className="chip" style={{background:'rgba(255,255,255,0.04)',color:'var(--text-muted)',borderColor:'var(--border-subtle)'}}>All scenarios</span>
          <span className="chip" style={{background:'rgba(255,255,255,0.04)',color:'var(--text-muted)',borderColor:'var(--border-subtle)'}}>Any status</span>
        </div>
      </div>

      <div className="glass" style={{padding:0,overflow:'hidden'}}>
        {projects.map((p,i)=>(
          <div key={p.name} style={{
            display:'grid',gridTemplateColumns:'14px 2fr 1fr 1fr 1fr auto',gap:20,alignItems:'center',
            padding:'18px 24px',borderTop: i>0 ? '1px solid var(--border-subtle)' : 'none',
            transition:'background .15s ease',cursor:'pointer'
          }} onMouseOver={e => e.currentTarget.style.background='rgba(255,255,255,0.03)'}
             onMouseOut={e => e.currentTarget.style.background='transparent'}>
            <div style={{width:8,height:28,borderRadius:2,background:p.color,boxShadow:`0 0 8px ${p.color}60`}}/>
            <div>
              <div style={{fontFamily:'var(--font-display)',fontWeight:700,fontSize:15}}>{p.name}</div>
              <div style={{fontSize:11,color:'var(--text-muted)',marginTop:2}}>Updated {p.updated}</div>
            </div>
            <div>
              <div className="mono" style={{fontSize:10,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'.08em'}}>Scenario</div>
              <div style={{fontFamily:'var(--font-display)',fontWeight:600,fontSize:13,marginTop:2}}>{p.scenario}</div>
            </div>
            <div>
              <div className="mono" style={{fontSize:10,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'.08em'}}>Size</div>
              <div style={{fontFamily:'var(--font-display)',fontWeight:700,fontSize:14,marginTop:2}}>{p.kwp} <span style={{color:'var(--text-muted)',fontWeight:500,fontSize:11}}>kWp</span></div>
            </div>
            <div>
              <div className="mono" style={{fontSize:10,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'.08em'}}>Est. yield</div>
              <div style={{fontFamily:'var(--font-display)',fontWeight:700,fontSize:14,marginTop:2,color:'var(--primary-highlight)'}}>{p.yield}</div>
            </div>
            <span className="chip" style={{
              background: p.status==='Active' ? 'rgba(16,185,129,.12)' : p.status==='Draft' ? 'rgba(234,179,8,.12)' : 'rgba(148,163,184,.08)',
              color: p.status==='Active' ? '#6EE7B7' : p.status==='Draft' ? '#FDE68A' : '#CBD5E1',
              borderColor: p.status==='Active' ? 'rgba(16,185,129,.3)' : p.status==='Draft' ? 'rgba(234,179,8,.3)' : 'rgba(148,163,184,.2)'
            }}>{p.status.toUpperCase()}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const ScenarioScreen = ({ selected, onSelect, onNext, onStep }) => (
  <div style={{maxWidth:1200,margin:'0 auto',padding:'32px 32px'}}>
    <Stepper current={1} onStep={onStep}/>
    <div style={{marginTop:32,marginBottom:24}}>
      <div className="eyebrow">Step 01</div>
      <h1 style={{fontFamily:'var(--font-display)',fontWeight:800,fontSize:36,letterSpacing:'-0.04em',marginTop:6}} className="gradient-text">Choose a scenario</h1>
      <p style={{color:'var(--text-muted)',fontSize:14,marginTop:8,maxWidth:560,lineHeight:1.55}}>
        This decides the sizing heuristics, the report template, and which equipment the catalog filters to.
      </p>
    </div>
    <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:14}}>
      {SCENARIOS.map(s => (
        <ScenarioCard key={s.id} scenario={s} selected={selected===s.id} onClick={() => onSelect(s.id)}/>
      ))}
    </div>
    <div style={{marginTop:32,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
      <button className="btn btn-secondary">← Back to projects</button>
      <button className="btn btn-primary" onClick={onNext} disabled={!selected} style={!selected?{opacity:.4,cursor:'not-allowed'}:{}}>
        Continue to location →
      </button>
    </div>
  </div>
);

const EquipmentScreen = ({ onNext, onStep }) => {
  const panels = [
    {id:'lr7',maker:'LONGi',model:'LR7-72HTH 560W',wp:560,eff:22.2,price:98,stock:'in stock'},
    {id:'tsm',maker:'Trina Solar',model:'Vertex S+ 445W',wp:445,eff:22.5,price:82,stock:'in stock'},
    {id:'jkm',maker:'JinkoSolar',model:'Tiger Neo 620W',wp:620,eff:22.8,price:112,stock:'5 wk lead'},
  ];
  const [picked, setPicked] = useState('lr7');
  return (
    <div style={{maxWidth:1200,margin:'0 auto',padding:'32px 32px'}}>
      <Stepper current={4} onStep={onStep}/>
      <div style={{marginTop:32,marginBottom:20}}>
        <div className="eyebrow">Step 04</div>
        <h1 style={{fontFamily:'var(--font-display)',fontWeight:800,fontSize:36,letterSpacing:'-0.04em',marginTop:6}} className="gradient-text">Equipment selection</h1>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'2fr 1fr',gap:20}}>
        <div className="glass" style={{padding:22}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
            <div style={{fontFamily:'var(--font-display)',fontWeight:700,fontSize:17,letterSpacing:'-0.02em'}}>Modules</div>
            <div style={{display:'flex',gap:6}}>
              <span className="chip" style={{background:'rgba(245,158,11,.12)',color:'#F59E0B',borderColor:'rgba(245,158,11,.3)'}}>Mono PERC</span>
              <span className="chip" style={{background:'rgba(255,255,255,0.04)',color:'var(--text-muted)',borderColor:'var(--border-subtle)'}}>≥ 400 Wp</span>
            </div>
          </div>
          <div style={{display:'flex',flexDirection:'column',gap:10}}>
            {panels.map(p => {
              const active = picked === p.id;
              return (
                <button key={p.id} onClick={()=>setPicked(p.id)} style={{
                  display:'grid',gridTemplateColumns:'auto 1.5fr 1fr 1fr 1fr auto',gap:16,alignItems:'center',
                  padding:'14px 16px',borderRadius:12,textAlign:'left',
                  background: active ? 'linear-gradient(135deg,rgba(245,158,11,.1),rgba(245,158,11,.02))' : 'rgba(255,255,255,0.02)',
                  border: active ? '1px solid rgba(245,158,11,.5)' : '1px solid var(--border-subtle)',
                  boxShadow: active ? '0 0 16px rgba(245,158,11,.2)' : 'none',
                  transition:'all .15s'
                }}>
                  <div style={{width:18,height:18,borderRadius:'50%',border:`2px solid ${active?'var(--primary)':'var(--border)'}`,position:'relative'}}>
                    {active && <div style={{position:'absolute',inset:3,borderRadius:'50%',background:'var(--primary)',boxShadow:'0 0 8px rgba(245,158,11,.6)'}}/>}
                  </div>
                  <div>
                    <div style={{fontFamily:'var(--font-display)',fontWeight:700,fontSize:14}}>{p.model}</div>
                    <div style={{fontSize:11,color:'var(--text-muted)',marginTop:2}}>{p.maker}</div>
                  </div>
                  <div>
                    <div className="mono" style={{fontSize:10,color:'var(--text-muted)'}}>POWER</div>
                    <div style={{fontFamily:'var(--font-display)',fontWeight:700,fontSize:14,marginTop:2}}>{p.wp} <span style={{color:'var(--text-muted)',fontSize:11,fontWeight:500}}>Wp</span></div>
                  </div>
                  <div>
                    <div className="mono" style={{fontSize:10,color:'var(--text-muted)'}}>EFF</div>
                    <div style={{fontFamily:'var(--font-display)',fontWeight:700,fontSize:14,marginTop:2,color:'var(--accent)'}}>{p.eff}%</div>
                  </div>
                  <div>
                    <div className="mono" style={{fontSize:10,color:'var(--text-muted)'}}>UNIT</div>
                    <div style={{fontFamily:'var(--font-display)',fontWeight:700,fontSize:14,marginTop:2}}>€{p.price}</div>
                  </div>
                  <span className="chip" style={{background:'rgba(255,255,255,0.04)',color:'var(--text-muted)',borderColor:'var(--border-subtle)',fontSize:10}}>{p.stock}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="glass" style={{padding:22}}>
          <div className="eyebrow">Your array</div>
          <div style={{fontFamily:'var(--font-display)',fontWeight:800,fontSize:36,color:'var(--primary)',letterSpacing:'-0.04em',marginTop:6,lineHeight:1}}>8.4<span style={{fontSize:16,color:'var(--text-muted)',fontWeight:500}}> kWp</span></div>
          <div style={{fontSize:12,color:'var(--text-muted)',marginTop:4}}>15 × LR7-72HTH · 2 strings</div>

          <div style={{margin:'20px 0',height:1,background:'var(--border-subtle)'}}/>

          <div style={{display:'flex',flexDirection:'column',gap:10}}>
            {[
              ['Inverter','Huawei SUN2000-8KTL'],
              ['Mount','Trapezoidal rail, 15°'],
              ['Cable','6 mm² DC · 18 m run'],
              ['Protection','Type II SPD + DC breaker'],
            ].map(([k,v])=>(
              <div key={k} style={{display:'flex',justifyContent:'space-between',alignItems:'baseline'}}>
                <span style={{fontSize:12,color:'var(--text-muted)'}}>{k}</span>
                <span style={{fontFamily:'var(--font-display)',fontWeight:600,fontSize:13,textAlign:'right'}}>{v}</span>
              </div>
            ))}
          </div>

          <div style={{margin:'20px 0 14px',height:1,background:'var(--border-subtle)'}}/>

          <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline'}}>
            <span style={{fontSize:12,color:'var(--text-muted)'}}>BoM subtotal</span>
            <span style={{fontFamily:'var(--font-display)',fontWeight:800,fontSize:22,letterSpacing:'-0.02em',color:'var(--primary-highlight)'}}>€9,840</span>
          </div>
        </div>
      </div>

      <div style={{marginTop:32,display:'flex',justifyContent:'space-between'}}>
        <button className="btn btn-secondary" onClick={()=>onStep(3)}>← Load profile</button>
        <button className="btn btn-primary" onClick={onNext}>Continue to financial →</button>
      </div>
    </div>
  );
};

const ReportScreen = ({ onStep }) => {
  const monthly = [380,520,780,1020,1280,1420,1480,1380,1120,820,540,380];
  return (
    <div style={{maxWidth:1200,margin:'0 auto',padding:'32px 32px'}}>
      <Stepper current={7} onStep={onStep}/>

      <div style={{marginTop:32,display:'flex',alignItems:'flex-end',justifyContent:'space-between',marginBottom:20}}>
        <div>
          <div className="eyebrow">Report · Step 07</div>
          <h1 style={{fontFamily:'var(--font-display)',fontWeight:800,fontSize:36,letterSpacing:'-0.04em',marginTop:6}} className="gradient-text">Valencia office rooftop</h1>
          <div style={{fontSize:13,color:'var(--text-muted)',marginTop:6,display:'flex',gap:10}}>
            <span>8.4 kWp</span><span>·</span><span>On-Grid</span><span>·</span><span>39.48°N, 0.37°W</span>
          </div>
        </div>
        <div style={{display:'flex',gap:10}}>
          <button className="btn btn-secondary">Export PDF</button>
          <button className="btn btn-primary">Send to client</button>
        </div>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:14,marginBottom:20}}>
        <KpiTile large label="Annual yield" value="12.48" unit="MWh" accent="var(--primary)" trend={{positive:true,label:'+3.2% vs PVGIS'}}/>
        <KpiTile large label="Self-consumption" value="68" unit="%" accent="var(--primary-highlight)"/>
        <KpiTile large label="Payback" value="6.2" unit="yr" accent="var(--success)"/>
        <KpiTile large label="25-yr NPV" value="€41,2" unit="k" accent="var(--accent)"/>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'2fr 1fr',gap:14}}>
        <div className="glass" style={{padding:22}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
            <div>
              <div className="eyebrow">Monthly production</div>
              <div style={{fontFamily:'var(--font-display)',fontWeight:700,fontSize:17,letterSpacing:'-0.02em',marginTop:4}}>Hourly-modelled, kWh</div>
            </div>
            <div style={{display:'flex',gap:6}}>
              <span className="chip" style={{background:'rgba(245,158,11,.12)',color:'#F59E0B',borderColor:'rgba(245,158,11,.3)'}}>Production</span>
              <span className="chip" style={{background:'rgba(255,255,255,0.04)',color:'var(--text-muted)',borderColor:'var(--border-subtle)'}}>Consumption</span>
            </div>
          </div>
          <ProductionChart data={monthly}/>
        </div>

        <div className="glass" style={{padding:22,display:'flex',flexDirection:'column',gap:18}}>
          <div>
            <div className="eyebrow">System health</div>
            <div style={{fontFamily:'var(--font-display)',fontWeight:700,fontSize:17,letterSpacing:'-0.02em',marginTop:4}}>Ratings</div>
          </div>
          <div style={{display:'flex',justifyContent:'space-around'}}>
            <DonutRing value={98} label="Inverter eff." color="var(--accent)" size={96}/>
            <DonutRing value={87} label="Performance ratio" color="var(--primary)" size={96}/>
          </div>
          <div style={{paddingTop:14,borderTop:'1px solid var(--border-subtle)',display:'flex',flexDirection:'column',gap:6}}>
            <div style={{display:'flex',alignItems:'center',gap:8,fontSize:12,color:'#6EE7B7'}}>
              <span style={{width:6,height:6,borderRadius:'50%',background:'#10B981'}}/> PVGIS verified · 18 Apr 2026
            </div>
            <div style={{display:'flex',alignItems:'center',gap:8,fontSize:12,color:'#6EE7B7'}}>
              <span style={{width:6,height:6,borderRadius:'50%',background:'#10B981'}}/> 4 bills parsed & reconciled
            </div>
            <div style={{display:'flex',alignItems:'center',gap:8,fontSize:12,color:'#FDE68A'}}>
              <span style={{width:6,height:6,borderRadius:'50%',background:'#EAB308'}}/> Tariff snapshot 62 d old
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ---------- App shell ---------- */

const App = () => {
  const [view, setView] = useState(() => localStorage.getItem('sr-view') || 'home');
  const [scenario, setScenario] = useState('ongrid');

  const setV = (v) => { setView(v); localStorage.setItem('sr-view', v); };

  const projectName = view === 'home' ? null : 'Rooftop · Valencia office';

  return (
    <>
      <Topbar projectName={projectName} onNav={(n)=>setV(n==='home'?'home':view)}/>
      <div data-screen-label={
        view==='home' ? '01 Home' :
        view==='scenario' ? '02 Scenario' :
        view==='equipment' ? '04 Equipment' :
        view==='report' ? '07 Report' : view
      }>
        {view==='home' && <HomeScreen onStartNew={()=>setV('scenario')}/>}
        {view==='scenario' && <ScenarioScreen selected={scenario} onSelect={setScenario} onNext={()=>setV('equipment')} onStep={(n)=>{ if(n===4) setV('equipment'); else if(n===7) setV('report'); }}/>}
        {view==='equipment' && <EquipmentScreen onNext={()=>setV('report')} onStep={(n)=>{ if(n===1) setV('scenario'); else if(n===7) setV('report'); }}/>}
        {view==='report' && <ReportScreen onStep={(n)=>{ if(n===1) setV('scenario'); else if(n===4) setV('equipment'); }}/>}
      </div>

      {/* demo nav */}
      <div style={{position:'fixed',bottom:20,right:20,display:'flex',gap:6,padding:8,background:'rgba(15,23,42,.9)',backdropFilter:'blur(20px)',border:'1px solid var(--border-subtle)',borderRadius:14,zIndex:100}}>
        {[['home','Home'],['scenario','Scenario'],['equipment','Equipment'],['report','Report']].map(([k,l])=>(
          <button key={k} onClick={()=>setV(k)} style={{
            padding:'6px 12px',borderRadius:8,fontSize:11,fontWeight:700,fontFamily:'var(--font-display)',
            background: view===k?'linear-gradient(135deg,var(--primary),var(--primary-highlight))':'transparent',
            color: view===k?'#0F172A':'var(--text-muted)'
          }}>{l}</button>
        ))}
      </div>
    </>
  );
};

ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
