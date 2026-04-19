/* Scenario cards — the entry point of any new calc */
const SCENARIOS = [
  {id:'ongrid',name:'On-Grid Rooftop',desc:'Net-metered residential & commercial. Imports + exports reconciled by tariff.',color:'#F59E0B',icon:'▦'},
  {id:'offgrid',name:'Off-Grid + Storage',desc:'Battery-first autonomy. Sized by daily load and days of autonomy.',color:'#8B5CF6',icon:'◈'},
  {id:'irrigation',name:'Solar Irrigation',desc:'Direct-drive pumping. Daily water demand drives PV sizing.',color:'#10B981',icon:'≋'},
  {id:'heatpump',name:'PV + Heat Pump',desc:'Bivalent heating. Optimises self-consumption against COP curve.',color:'#EC4899',icon:'◉'},
  {id:'mobile',name:'Mobile / Van / Boat',desc:'12-48V DC systems with portable inverters.',color:'#06B6D4',icon:'➤'},
  {id:'ev',name:'EV Charge',desc:'PV-coupled charging windows, smart dispatch to chargers.',color:'#3B82F6',icon:'⚡'},
];

const ScenarioCard = ({ scenario, selected, onClick }) => (
  <button onClick={onClick} style={{
    textAlign:'left',padding:20,borderRadius:'var(--radius)',
    background: selected
      ? `linear-gradient(135deg, ${scenario.color}18, ${scenario.color}04)`
      : 'rgba(255,255,255,0.03)',
    border: selected ? `1.5px solid ${scenario.color}` : '1px solid var(--border-subtle)',
    boxShadow: selected ? `0 0 24px ${scenario.color}30, 0 4px 16px rgba(0,0,0,.4)` : '0 2px 8px rgba(0,0,0,.2)',
    transition:'all .2s ease',cursor:'pointer',position:'relative',overflow:'hidden'
  }}>
    <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:14}}>
      <div style={{
        width:40,height:40,borderRadius:12,
        background:`linear-gradient(135deg, ${scenario.color}, ${scenario.color}aa)`,
        display:'flex',alignItems:'center',justifyContent:'center',
        fontFamily:'var(--font-display)',fontWeight:800,fontSize:20,color:'#0F172A',
        boxShadow:`0 0 16px ${scenario.color}40`
      }}>{scenario.icon}</div>
      <div style={{flex:1}}>
        <div style={{fontFamily:'var(--font-display)',fontWeight:700,fontSize:15,letterSpacing:'-0.01em'}}>{scenario.name}</div>
      </div>
      {selected && <div style={{color:scenario.color,fontSize:18,fontWeight:700}}>✓</div>}
    </div>
    <div style={{fontSize:12,color:'var(--text-muted)',lineHeight:1.55}}>{scenario.desc}</div>
  </button>
);

window.ScenarioCard = ScenarioCard;
window.SCENARIOS = SCENARIOS;
