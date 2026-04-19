/* Topbar with logo, breadcrumb, project name, user */
const Topbar = ({ projectName = 'Rooftop · Valencia office', onNav }) => (
  <header style={{
    display:'flex',alignItems:'center',gap:24,padding:'14px 32px',
    borderBottom:'1px solid var(--border-subtle)',
    background:'rgba(15,23,42,0.65)',backdropFilter:'blur(20px)',
    position:'sticky',top:0,zIndex:50
  }}>
    <div style={{display:'flex',alignItems:'center',gap:10,cursor:'pointer'}} onClick={() => onNav && onNav('home')}>
      <img src="logo.png" alt="SolarRota" style={{height:36,width:'auto'}}/>
      <span style={{fontFamily:'var(--font-display)',fontWeight:800,fontSize:18,letterSpacing:'-0.03em'}}>SolarRota</span>
    </div>
    <nav style={{display:'flex',gap:4,marginLeft:16}}>
      {['Projects','Catalog','Tariffs','Reports'].map((item,i)=>(
        <button key={item} style={{
          padding:'8px 14px',borderRadius:10,
          fontFamily:'var(--font-display)',fontWeight:600,fontSize:13,
          color:i===0?'var(--text)':'var(--text-muted)',
          background:i===0?'rgba(255,255,255,0.04)':'transparent'
        }}>{item}</button>
      ))}
    </nav>
    <div style={{flex:1}}/>
    {projectName && (
      <div style={{display:'flex',alignItems:'center',gap:10}}>
        <span style={{fontSize:11,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'.08em',fontWeight:700}}>Active</span>
        <span style={{fontFamily:'var(--font-display)',fontWeight:700,fontSize:13}}>{projectName}</span>
        <span className="chip" style={{background:'rgba(234,179,8,.12)',color:'var(--warning)',borderColor:'rgba(234,179,8,.3)'}}>DRAFT</span>
      </div>
    )}
    <button style={{
      width:36,height:36,borderRadius:'50%',
      background:'linear-gradient(135deg,var(--primary),var(--accent))',
      color:'#0F172A',fontWeight:800,fontFamily:'var(--font-display)',fontSize:13
    }}>MR</button>
  </header>
);

window.Topbar = Topbar;
