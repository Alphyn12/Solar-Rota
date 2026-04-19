/* KPI tile — shows big number with unit + trend */
const KpiTile = ({ label, value, unit, accent='var(--primary)', trend, sub, large }) => (
  <div className="glass" style={{padding: large ? 22 : 16, position:'relative', overflow:'hidden'}}>
    <div style={{position:'absolute',top:0,left:0,right:0,height:2,background:`linear-gradient(90deg, transparent, ${accent}, transparent)`, opacity:.6}}/>
    <div className="kpi-label">{label}</div>
    <div style={{display:'flex',alignItems:'baseline',gap:6,marginTop:8}}>
      <div className="kpi-value" style={{fontSize: large ? 44 : 30, color: accent}}>{value}</div>
      {unit && <span style={{fontSize: large ? 15 : 12, color:'var(--text-muted)', fontWeight:600}}>{unit}</span>}
    </div>
    {trend && <div style={{fontSize:11, color:trend.positive?'var(--success)':'var(--danger)', marginTop:6, fontWeight:600}}>
      {trend.positive ? '▲' : '▼'} {trend.label}
    </div>}
    {sub && <div style={{fontSize:11,color:'var(--text-muted)',marginTop:4}}>{sub}</div>}
  </div>
);

/* Donut ring for efficiency / coverage */
const DonutRing = ({ value, label, color='var(--primary)', size=120 }) => {
  const r = size/2 - 8, c = 2*Math.PI*r;
  const off = c * (1 - value/100);
  return (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:8}}>
      <div style={{position:'relative',width:size,height:size}}>
        <svg width={size} height={size} style={{transform:'rotate(-90deg)'}}>
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,.06)" strokeWidth="8"/>
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="8" strokeLinecap="round"
            strokeDasharray={c} strokeDashoffset={off} style={{filter:`drop-shadow(0 0 8px ${color}80)`, transition:'stroke-dashoffset .8s cubic-bezier(.4,0,.2,1)'}}/>
        </svg>
        <div style={{position:'absolute',inset:0,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center'}}>
          <div style={{fontFamily:'var(--font-display)',fontWeight:800,fontSize:22,color,letterSpacing:'-0.03em'}}>{value}<span style={{fontSize:12,color:'var(--text-muted)'}}>%</span></div>
        </div>
      </div>
      <div style={{fontSize:11,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'.08em',fontWeight:700}}>{label}</div>
    </div>
  );
};

/* Production sparkline — 12 months of simulated data */
const ProductionChart = ({ data, accent='var(--primary)' }) => {
  const max = Math.max(...data);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return (
    <div>
      <div style={{display:'flex',alignItems:'flex-end',gap:8,height:140}}>
        {data.map((v,i)=>(
          <div key={i} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:6}}>
            <div style={{width:'100%',background:`linear-gradient(180deg, ${accent}, ${accent}66)`,borderRadius:'4px 4px 2px 2px',height:`${(v/max)*100}%`,minHeight:4,boxShadow:`0 0 8px ${accent}40`, transition:'height .6s cubic-bezier(.4,0,.2,1)'}}/>
            <div style={{fontSize:10,color:'var(--text-muted)',fontFamily:'var(--font-display)',fontWeight:600}}>{months[i]}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

window.KpiTile = KpiTile;
window.DonutRing = DonutRing;
window.ProductionChart = ProductionChart;
