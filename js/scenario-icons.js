// Senaryo kartları için animasyonlu inline SVG ikonları
// Inline SVG kullanılır çünkü <img> tag'i ile CSS animasyonları Safari/Firefox'ta çalışmaz

export const SCENARIO_ICONS = {
  'on-grid': `<svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" class="scenario-svg-icon">
    <style>
      .sg-sun{animation:sgSpin 12s linear infinite;transform-origin:40px 24px}
      .sg-pulse{animation:sgPulse 2s ease-in-out infinite alternate}
      .sg-flow{animation:sgFlow 2.5s ease-in-out infinite}
      @keyframes sgSpin{to{transform:rotate(360deg)}}
      @keyframes sgPulse{from{opacity:0.5}to{opacity:1}}
      @keyframes sgFlow{0%,100%{stroke-dashoffset:20}50%{stroke-dashoffset:0}}
    </style>
    <circle cx="40" cy="24" r="10" fill="#F59E0B" class="sg-pulse"/>
    <g class="sg-sun" stroke="#F59E0B" stroke-width="2" stroke-linecap="round">
      <line x1="40" y1="8" x2="40" y2="4"/>
      <line x1="40" y1="40" x2="40" y2="44"/>
      <line x1="24" y1="24" x2="20" y2="24"/>
      <line x1="56" y1="24" x2="60" y2="24"/>
      <line x1="28.7" y1="12.7" x2="25.9" y2="9.9"/>
      <line x1="51.3" y1="35.3" x2="54.1" y2="38.1"/>
      <line x1="51.3" y1="12.7" x2="54.1" y2="9.9"/>
      <line x1="28.7" y1="35.3" x2="25.9" y2="38.1"/>
    </g>
    <rect x="8" y="46" width="64" height="4" rx="2" fill="#475569"/>
    <line x1="40" y1="34" x2="40" y2="46" stroke="#F59E0B" stroke-width="2.5" stroke-dasharray="4 2" class="sg-flow" style="stroke-dasharray:4 2"/>
    <rect x="12" y="52" width="8" height="18" rx="1" fill="#334155" stroke="#475569" stroke-width="1"/>
    <rect x="14" y="60" width="4" height="2" fill="#F59E0B" class="sg-pulse"/>
    <rect x="36" y="52" width="8" height="18" rx="1" fill="#334155" stroke="#475569" stroke-width="1"/>
    <rect x="38" y="60" width="4" height="2" fill="#F59E0B" class="sg-pulse"/>
    <rect x="60" y="52" width="8" height="18" rx="1" fill="#334155" stroke="#475569" stroke-width="1"/>
    <rect x="62" y="60" width="4" height="2" fill="#F59E0B" class="sg-pulse"/>
    <line x1="20" y1="50" x2="20" y2="52" stroke="#475569" stroke-width="1.5"/>
    <line x1="44" y1="50" x2="44" y2="52" stroke="#475569" stroke-width="1.5"/>
    <line x1="64" y1="50" x2="64" y2="52" stroke="#475569" stroke-width="1.5"/>
  </svg>`,

  'off-grid': `<svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" class="scenario-svg-icon">
    <style>
      .bat-sun{animation:batSpin 14s linear infinite;transform-origin:28px 18px}
      .bat-fill{animation:batCharge 3s ease-in-out infinite}
      .bat-bolt{animation:batBolt 1.5s ease-in-out infinite alternate}
      @keyframes batSpin{to{transform:rotate(360deg)}}
      @keyframes batCharge{0%,100%{height:8px;y:46}50%{height:14px;y:40}}
      @keyframes batBolt{from{opacity:0.4}to{opacity:1}}
    </style>
    <circle cx="28" cy="18" r="8" fill="#8B5CF6" opacity="0.9"/>
    <g class="bat-sun" stroke="#8B5CF6" stroke-width="1.8" stroke-linecap="round">
      <line x1="28" y1="5" x2="28" y2="2"/>
      <line x1="28" y1="30" x2="28" y2="33"/>
      <line x1="15" y1="18" x2="12" y2="18"/>
      <line x1="41" y1="18" x2="44" y2="18"/>
      <line x1="19.8" y1="9.8" x2="17.7" y2="7.7"/>
      <line x1="36.2" y1="26.2" x2="38.3" y2="28.3"/>
      <line x1="36.2" y1="9.8" x2="38.3" y2="7.7"/>
      <line x1="19.8" y1="26.2" x2="17.7" y2="28.3"/>
    </g>
    <rect x="42" y="32" width="24" height="40" rx="4" fill="#1E293B" stroke="#8B5CF6" stroke-width="2"/>
    <rect x="50" y="28" width="8" height="6" rx="2" fill="#8B5CF6" opacity="0.7"/>
    <rect x="44" y="34" width="20" height="36" rx="3" fill="#0F172A"/>
    <rect id="bat-fill-rect" x="46" y="46" width="16" height="8" rx="2" fill="#8B5CF6" class="bat-fill" style="animation:batCharge 3s ease-in-out infinite"/>
    <rect x="46" y="58" width="16" height="8" rx="2" fill="rgba(139,92,246,0.3)"/>
    <path d="M52 42 L49 50 H53 L51 58" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="bat-bolt"/>
  </svg>`,

  'agricultural-irrigation': `<svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" class="scenario-svg-icon">
    <style>
      .agr-sun{animation:agrSpin 16s linear infinite;transform-origin:20px 16px}
      .agr-drop{animation:agrDrop 2s ease-in infinite}
      .agr-plant{animation:agrSway 3s ease-in-out infinite alternate}
      @keyframes agrSpin{to{transform:rotate(360deg)}}
      @keyframes agrDrop{0%{transform:translateY(0);opacity:1}80%{transform:translateY(12px);opacity:0}100%{transform:translateY(0);opacity:0}}
      @keyframes agrSway{from{transform:rotate(-5deg)}to{transform:rotate(5deg)}}
    </style>
    <circle cx="20" cy="16" r="7" fill="#10B981" opacity="0.9"/>
    <g class="agr-sun" stroke="#10B981" stroke-width="1.8" stroke-linecap="round">
      <line x1="20" y1="4" x2="20" y2="1.5"/>
      <line x1="20" y1="27" x2="20" y2="29.5"/>
      <line x1="8" y1="16" x2="5.5" y2="16"/>
      <line x1="32" y1="16" x2="34.5" y2="16"/>
      <line x1="11.5" y1="7.5" x2="9.7" y2="5.7"/>
      <line x1="28.5" y1="24.5" x2="30.3" y2="26.3"/>
      <line x1="28.5" y1="7.5" x2="30.3" y2="5.7"/>
      <line x1="11.5" y1="24.5" x2="9.7" y2="26.3"/>
    </g>
    <path d="M38 20 C38 28 42 30 46 36 C46 30 50 28 50 20 C48 18 44 17 38 20Z" fill="#10B981" opacity="0.4"/>
    <path d="M46 36 L46 56" stroke="#10B981" stroke-width="2.5" stroke-linecap="round" class="agr-plant"/>
    <path d="M38 30 C38 24 46 26 46 30" fill="none" stroke="#10B981" stroke-width="1.5"/>
    <path d="M46 40 C50 34 58 36 58 40" fill="none" stroke="#10B981" stroke-width="1.5"/>
    <rect x="8" y="58" width="64" height="6" rx="3" fill="#334155"/>
    <ellipse cx="40" cy="58" rx="8" ry="3" fill="#10B981" opacity="0.3"/>
    <g class="agr-drop">
      <circle cx="54" cy="44" r="2.5" fill="#06B6D4" opacity="0.9"/>
    </g>
    <g class="agr-drop" style="animation-delay:0.6s">
      <circle cx="62" cy="40" r="2" fill="#06B6D4" opacity="0.7"/>
    </g>
    <g class="agr-drop" style="animation-delay:1.2s">
      <circle cx="58" cy="36" r="2" fill="#06B6D4" opacity="0.8"/>
    </g>
  </svg>`,

  'heat-pump': `<svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" class="scenario-svg-icon">
    <style>
      .hp-sun{animation:hpSpin 12s linear infinite;transform-origin:20px 18px}
      .hp-therm{animation:hpTherm 2.5s ease-in-out infinite alternate}
      .hp-wave{animation:hpWave 2s ease-in-out infinite}
      @keyframes hpSpin{to{transform:rotate(360deg)}}
      @keyframes hpTherm{from{fill:rgba(236,72,153,0.4)}to{fill:rgba(236,72,153,1)}}
      @keyframes hpWave{0%,100%{opacity:0.3}50%{opacity:0.9}}
    </style>
    <circle cx="20" cy="18" r="7" fill="#EC4899" opacity="0.9"/>
    <g class="hp-sun" stroke="#EC4899" stroke-width="1.8" stroke-linecap="round">
      <line x1="20" y1="6" x2="20" y2="3.5"/>
      <line x1="20" y1="29" x2="20" y2="31.5"/>
      <line x1="8" y1="18" x2="5.5" y2="18"/>
      <line x1="32" y1="18" x2="34.5" y2="18"/>
      <line x1="11.5" y1="9.5" x2="9.7" y2="7.7"/>
      <line x1="28.5" y1="26.5" x2="30.3" y2="28.3"/>
      <line x1="28.5" y1="9.5" x2="30.3" y2="7.7"/>
      <line x1="11.5" y1="26.5" x2="9.7" y2="28.3"/>
    </g>
    <rect x="36" y="24" width="36" height="28" rx="5" fill="#1E293B" stroke="#EC4899" stroke-width="2"/>
    <rect x="39" y="27" width="30" height="22" rx="4" fill="#0F172A"/>
    <rect x="43" y="31" width="7" height="14" rx="3" fill="rgba(236,72,153,0.15)" stroke="#EC4899" stroke-width="1"/>
    <rect x="43" y="37" width="7" height="5" rx="2" fill="#EC4899" class="hp-therm"/>
    <path d="M55 34 Q58 38 55 42" stroke="#EC4899" stroke-width="1.5" fill="none" stroke-linecap="round" class="hp-wave"/>
    <path d="M59 32 Q63 38 59 44" stroke="#EC4899" stroke-width="1.5" fill="none" stroke-linecap="round" class="hp-wave" style="animation-delay:0.4s"/>
    <line x1="54" y1="52" x2="54" y2="62" stroke="#475569" stroke-width="2"/>
    <rect x="40" y="62" width="28" height="4" rx="2" fill="#334155"/>
  </svg>`,

  'flexible-mobile': `<svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" class="scenario-svg-icon">
    <style>
      .mob-sun{animation:mobSpin 14s linear infinite;transform-origin:16px 16px}
      .mob-move{animation:mobDrive 4s ease-in-out infinite}
      .mob-glow{animation:mobGlow 2s ease-in-out infinite alternate}
      @keyframes mobSpin{to{transform:rotate(360deg)}}
      @keyframes mobDrive{0%,100%{transform:translateX(0)}50%{transform:translateX(4px)}}
      @keyframes mobGlow{from{opacity:0.4}to{opacity:1}}
    </style>
    <circle cx="16" cy="16" r="6" fill="#06B6D4" opacity="0.9"/>
    <g class="mob-sun" stroke="#06B6D4" stroke-width="1.8" stroke-linecap="round">
      <line x1="16" y1="5" x2="16" y2="3"/>
      <line x1="16" y1="26" x2="16" y2="28"/>
      <line x1="5" y1="16" x2="3" y2="16"/>
      <line x1="27" y1="16" x2="29" y2="16"/>
      <line x1="8.8" y1="8.8" x2="7.4" y2="7.4"/>
      <line x1="23.2" y1="23.2" x2="24.6" y2="24.6"/>
      <line x1="23.2" y1="8.8" x2="24.6" y2="7.4"/>
      <line x1="8.8" y1="23.2" x2="7.4" y2="24.6"/>
    </g>
    <g class="mob-move">
      <rect x="26" y="40" width="40" height="20" rx="4" fill="#1E293B" stroke="#06B6D4" stroke-width="1.5"/>
      <rect x="30" y="35" width="20" height="8" rx="3" fill="#334155" stroke="#06B6D4" stroke-width="1"/>
      <rect x="31" y="36" width="18" height="6" rx="2" fill="#06B6D4" opacity="0.2"/>
      <line x1="34" y1="38" x2="34" y2="40" stroke="#06B6D4" stroke-width="0.8"/>
      <line x1="38" y1="38" x2="38" y2="40" stroke="#06B6D4" stroke-width="0.8"/>
      <line x1="42" y1="38" x2="42" y2="40" stroke="#06B6D4" stroke-width="0.8"/>
      <circle cx="35" cy="62" r="5" fill="#334155" stroke="#06B6D4" stroke-width="1.5"/>
      <circle cx="35" cy="62" r="2" fill="#06B6D4" class="mob-glow"/>
      <circle cx="57" cy="62" r="5" fill="#334155" stroke="#06B6D4" stroke-width="1.5"/>
      <circle cx="57" cy="62" r="2" fill="#06B6D4" class="mob-glow"/>
      <rect x="52" y="44" width="12" height="10" rx="2" fill="rgba(6,182,212,0.15)" stroke="#06B6D4" stroke-width="1"/>
    </g>
  </svg>`,

  'ev-charging': `<svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" class="scenario-svg-icon">
    <style>
      .ev-sun{animation:evSpin 12s linear infinite;transform-origin:16px 16px}
      .ev-bolt{animation:evBolt 1.2s ease-in-out infinite alternate}
      .ev-charge{animation:evCharge 2s ease-in-out infinite}
      @keyframes evSpin{to{transform:rotate(360deg)}}
      @keyframes evBolt{from{opacity:0.3;transform:scale(0.9)}to{opacity:1;transform:scale(1)}}
      @keyframes evCharge{0%,100%{opacity:0.3}50%{opacity:1}}
    </style>
    <circle cx="16" cy="16" r="6" fill="#3B82F6" opacity="0.9"/>
    <g class="ev-sun" stroke="#3B82F6" stroke-width="1.8" stroke-linecap="round">
      <line x1="16" y1="5" x2="16" y2="3"/>
      <line x1="16" y1="26" x2="16" y2="28"/>
      <line x1="5" y1="16" x2="3" y2="16"/>
      <line x1="27" y1="16" x2="29" y2="16"/>
      <line x1="8.8" y1="8.8" x2="7.4" y2="7.4"/>
      <line x1="23.2" y1="23.2" x2="24.6" y2="24.6"/>
      <line x1="23.2" y1="8.8" x2="24.6" y2="7.4"/>
      <line x1="8.8" y1="23.2" x2="7.4" y2="24.6"/>
    </g>
    <rect x="16" y="38" width="52" height="22" rx="5" fill="#1E293B" stroke="#3B82F6" stroke-width="1.5"/>
    <rect x="22" y="32" width="30" height="8" rx="4" fill="#334155" stroke="#3B82F6" stroke-width="1"/>
    <path d="M18 52 H66" stroke="#475569" stroke-width="1"/>
    <circle cx="26" cy="62" r="5" fill="#334155" stroke="#3B82F6" stroke-width="1.5"/>
    <circle cx="26" cy="62" r="2" fill="#3B82F6"/>
    <circle cx="58" cy="62" r="5" fill="#334155" stroke="#3B82F6" stroke-width="1.5"/>
    <circle cx="58" cy="62" r="2" fill="#3B82F6"/>
    <rect x="28" y="34" width="12" height="4" rx="2" fill="#3B82F6" opacity="0.4"/>
    <path d="M45 30 L42 38 H46 L44 46" stroke="#3B82F6" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="ev-bolt"/>
    <line x1="28" y1="26" x2="28" y2="32" stroke="#3B82F6" stroke-width="2" stroke-linecap="round" class="ev-charge"/>
    <circle cx="28" cy="25" r="2" fill="#3B82F6" class="ev-charge" style="animation-delay:0.3s"/>
    <line x1="25" y1="22" x2="28" y2="25" stroke="#3B82F6" stroke-width="1.5" stroke-linecap="round" class="ev-charge" style="animation-delay:0.6s"/>
    <line x1="31" y1="22" x2="28" y2="25" stroke="#3B82F6" stroke-width="1.5" stroke-linecap="round" class="ev-charge" style="animation-delay:0.9s"/>
  </svg>`,
};

// Senaryo renklerini de export edelim
export const SCENARIO_COLORS = {
  'on-grid':               '#F59E0B',
  'off-grid':              '#8B5CF6',
  'agricultural-irrigation':'#10B981',
  'heat-pump':             '#EC4899',
  'flexible-mobile':       '#06B6D4',
  'ev-charging':           '#3B82F6',
};
