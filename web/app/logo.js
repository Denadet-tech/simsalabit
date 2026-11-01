export default function Logo({ size = 36, word = true, dark = false }) {
  const ink = dark ? '#FFF7EC' : '#2B2340';
  const accent = dark ? '#FFB23F' : '#E8501F';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: size * 0.22 }}>
      <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
        <rect x="6" y="6" width="84" height="74" rx="24" fill={ink} />
        <path d="M24 76 L18 96 L44 78 Z" fill={ink} />
        <path d="M48 20 C50.5 37 54 41 71 43.5 C54 46 50.5 50 48 67 C45.5 50 42 46 25 43.5 C42 41 45.5 37 48 20 Z" fill="#FFB23F" />
        <rect x="68" y="17" width="9" height="9" rx="1.5" fill="#E8501F" />
        <rect x="78" y="9" width="6" height="6" rx="1" fill="#E8501F" />
        <rect x="21" y="60" width="6" height="6" rx="1" fill="#FFB23F" />
      </svg>
      {word && (
        <span style={{ fontWeight: 800, fontSize: size * 0.72, color: ink, letterSpacing: '-0.5px', lineHeight: 1 }}>
          simsala<span style={{ color: accent }}>bit</span>
        </span>
      )}
    </span>
  );
}
