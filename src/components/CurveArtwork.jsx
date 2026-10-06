// Abstract illustration of a launch journey; it does not represent market data.
export default function CurveArtwork() {
  return (
    <div className="curve-art" aria-hidden="true">
      <div className="art-caption"><span>THE LAUNCH SEQUENCE</span><span>↗</span></div>
      <svg viewBox="0 0 460 270" fill="none">
        <defs><pattern id="orbit-grid" width="24" height="24" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".75" fill="#40443a" /></pattern></defs>
        <rect width="460" height="270" fill="url(#orbit-grid)" />
        <ellipse cx="230" cy="132" rx="181" ry="58" transform="rotate(-29 230 132)" stroke="#444a38" />
        <ellipse cx="230" cy="132" rx="145" ry="78" transform="rotate(25 230 132)" stroke="#31372b" />
        <ellipse cx="230" cy="132" rx="116" ry="100" transform="rotate(-29 230 132)" stroke="#31372b" strokeDasharray="3 8" />
        <path d="M74 222C136 224 119 173 174 170S244 165 278 121S329 70 385 41" stroke="#c5f467" strokeWidth="3" />
        <path d="m370 42 16-2-4 15" stroke="#c5f467" strokeWidth="3" />
        <circle cx="174" cy="170" r="7" fill="#0d100b" stroke="#c5f467" strokeWidth="2" />
        <circle cx="278" cy="121" r="7" fill="#c5f467" />
        <path d="m230 82 36 21v42l-36 21-36-21v-42z" fill="#181f11" stroke="#c5f467" />
        <path d="m230 95 23 13-23 14-23-14 23-13Zm-23 25 23 14 23-14m-23 14v19" stroke="#c5f467" strokeWidth="2" />
        <path d="M103 59v14m-7-7h14M353 194v18m-9-9h18" stroke="#788364" />
        <circle cx="103" cy="177" r="3" fill="#778661" /><circle cx="321" cy="67" r="3" fill="#778661" />
      </svg>
      <div className="art-steps"><span><i /> BONDING CURVE</span><span className="art-step-line" /><span>UNISWAP V4 <b>↗</b></span></div>
    </div>
  );
}
