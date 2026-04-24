/* SolarRota Landing — Tweaks panel + Root App */

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "density": "spacious",
  "accent": "amber",
  "showOrbs": true,
  "heroVariant": "confidence"
}/*EDITMODE-END*/;

const Tweaks = ({ tweaks, setTweaks }) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handler = (e) => {
      if (!e.data || !e.data.type) return;
      if (e.data.type === '__activate_edit_mode') setVisible(true);
      if (e.data.type === '__deactivate_edit_mode') setVisible(false);
    };
    window.addEventListener('message', handler);
    window.parent.postMessage({ type: '__edit_mode_available' }, '*');
    return () => window.removeEventListener('message', handler);
  }, []);

  const update = (k, v) => {
    const next = { ...tweaks, [k]: v };
    setTweaks(next);
    window.parent.postMessage({ type: '__edit_mode_set_keys', edits: { [k]: v } }, '*');
  };

  if (!visible) return null;

  return (
    <div className="tweaks">
      <div className="tweaks-head">
        <div className="tweaks-title">Tweaks</div>
        <button onClick={() => setVisible(false)} style={{color:'var(--text-muted)',fontSize:14,padding:4}}>×</button>
      </div>
      <div className="tweaks-body">
        <div className="tweak-row">
          <div className="tweak-label">Density</div>
          <div className="tweak-opts">
            {['spacious','dense'].map(o => (
              <button key={o} className={`tweak-opt ${tweaks.density === o ? 'active' : ''}`} onClick={() => update('density', o)}>{o}</button>
            ))}
          </div>
        </div>
        <div className="tweak-row">
          <div className="tweak-label">Hero headline</div>
          <div className="tweak-opts">
            {[['confidence','confidence'],['disciplined','disciplined'],['quote','quote-ready']].map(([k,l]) => (
              <button key={k} className={`tweak-opt ${tweaks.heroVariant === k ? 'active' : ''}`} onClick={() => update('heroVariant', k)}>{l}</button>
            ))}
          </div>
        </div>
        <div className="tweak-row">
          <div className="tweak-label">Accent</div>
          <div className="tweak-opts">
            {[['amber','#F59E0B'],['cyan','#06B6D4'],['violet','#8B5CF6']].map(([k,c]) => (
              <button key={k} className={`tweak-opt ${tweaks.accent === k ? 'active' : ''}`} onClick={() => update('accent', k)} style={tweaks.accent === k ? {} : {borderColor: c, color: c}}>{k}</button>
            ))}
          </div>
        </div>
        <div className="tweak-toggle">
          <div className="tweak-label" style={{margin:0}}>Background orbs</div>
          <div className={`tweak-toggle-ctl ${tweaks.showOrbs ? 'on' : ''}`} onClick={() => update('showOrbs', !tweaks.showOrbs)}/>
        </div>
      </div>
    </div>
  );
};

/* ─────────────── APP ROOT ─────────────── */
const App = () => {
  const [tweaks, setTweaks] = useState(TWEAK_DEFAULTS);

  useEffect(() => {
    document.body.classList.toggle('dense', tweaks.density === 'dense');
    document.body.classList.toggle('no-orbs', !tweaks.showOrbs);
    const accentMap = { amber: '#F59E0B', cyan: '#06B6D4', violet: '#8B5CF6' };
    const highlightMap = { amber: '#FCD34D', cyan: '#67E8F9', violet: '#C4B5FD' };
    document.documentElement.style.setProperty('--primary', accentMap[tweaks.accent]);
    document.documentElement.style.setProperty('--primary-highlight', highlightMap[tweaks.accent]);
  }, [tweaks]);

  // Rewrite hero H1 by variant via dataset
  const heroTitle = {
    confidence: ['Design your solar system', 'with confidence.'],
    disciplined: ['Solar estimates,', 'disciplined from click one.'],
    quote: ['From pin-drop', 'to quote-ready in forty minutes.'],
  }[tweaks.heroVariant] || ['Design your solar system', 'with confidence.'];

  return (
    <>
      <div className="grain"/>
      <LNav/>
      <LHero titleLines={heroTitle}/>
      <LTrust/>
      <LScenarios/>
      <LHowItWorks/>
      <LConfidence/>
      <LFeatures/>
      <LStats/>
      <LTestimonial/>
      <LPricing/>
      <LFAQ/>
      <LFinalCTA/>
      <LFooter/>
      <Tweaks tweaks={tweaks} setTweaks={setTweaks}/>
    </>
  );
};

ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
