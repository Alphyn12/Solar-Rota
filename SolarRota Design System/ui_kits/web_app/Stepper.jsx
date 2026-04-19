/* Wizard Stepper — horizontal steps with progress bar */
const STEPS = [
  {n:1,label:'Scenario'},
  {n:2,label:'Location'},
  {n:3,label:'Load'},
  {n:4,label:'Equipment'},
  {n:5,label:'Financial'},
  {n:6,label:'Review'},
  {n:7,label:'Report'},
];

const Stepper = ({ current=4, onStep }) => (
  <div>
    <div style={{display:'flex',alignItems:'center',gap:0,marginBottom:12,flexWrap:'wrap'}}>
      {STEPS.map((s,i) => {
        const done = s.n < current, active = s.n === current;
        return (
          <React.Fragment key={s.n}>
            <button onClick={() => onStep && onStep(s.n)} style={{
              display:'flex',alignItems:'center',gap:10,padding:'8px 14px',borderRadius:12,
              background: active ? 'linear-gradient(135deg,rgba(245,158,11,.15),rgba(252,211,77,.05))' : 'transparent',
              border: active ? '1px solid rgba(245,158,11,.4)' : '1px solid transparent',
              transition:'all .2s'
            }}>
              <div style={{
                width:24,height:24,borderRadius:'50%',
                display:'flex',alignItems:'center',justifyContent:'center',
                fontFamily:'var(--font-display)',fontWeight:800,fontSize:11,
                background: done ? 'linear-gradient(135deg,#10B981,#059669)'
                         : active ? 'linear-gradient(135deg,var(--primary),var(--primary-highlight))'
                         : 'rgba(255,255,255,.06)',
                color: (done||active) ? '#0F172A' : 'var(--text-muted)',
                boxShadow: active ? '0 0 12px rgba(245,158,11,.5)' : 'none'
              }}>{done ? '✓' : s.n}</div>
              <span style={{
                fontFamily:'var(--font-display)',fontWeight: active?700:600,fontSize:12,
                color: active ? 'var(--text)' : done ? 'var(--text-muted)' : 'var(--text-muted)'
              }}>{s.label}</span>
            </button>
            {i < STEPS.length-1 && <div style={{flex:'0 0 12px',height:1,background:'var(--border-subtle)'}}/>}
          </React.Fragment>
        );
      })}
    </div>
    <div style={{display:'flex',alignItems:'center',gap:12}}>
      <div className="progress" style={{flex:1}}>
        <div className="progress-bar" style={{width: `${(current/STEPS.length)*100}%`}}/>
      </div>
      <span className="mono" style={{fontSize:11,color:'var(--text-muted)'}}>{current} / {STEPS.length} steps</span>
    </div>
  </div>
);

window.Stepper = Stepper;
window.STEPS = STEPS;
