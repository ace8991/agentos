const HexLogo = ({ size = 28 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
    <polygon points="16,2 28,9 28,23 16,30 4,23 4,9" fill="hsl(var(--primary))" />
    <circle cx="16" cy="16" r="5" fill="hsl(var(--background))" />
    <circle cx="16" cy="16" r="2.5" fill="hsl(var(--primary))" opacity="0.6" />
  </svg>
);

export default HexLogo;
