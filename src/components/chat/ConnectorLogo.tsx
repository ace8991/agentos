interface ConnectorLogoProps {
  connectorId: string;
  name: string;
  badge: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClasses = {
  sm: 'h-8 w-8 rounded-xl',
  md: 'h-11 w-11 rounded-2xl',
  lg: 'h-14 w-14 rounded-2xl',
};

const ConnectorLogo = ({
  connectorId,
  name,
  badge,
  size = 'md',
  className = '',
}: ConnectorLogoProps) => {
  const containerClass = `${sizeClasses[size]} shrink-0 border border-white/10 bg-white/5 flex items-center justify-center overflow-hidden ${className}`.trim();

  return (
    <div className={containerClass} aria-label={`${name} logo`}>
      {renderLogo(connectorId, badge)}
    </div>
  );
};

const renderLogo = (connectorId: string, badge: string) => {
  switch (connectorId) {
    case 'github':
      return (
        <svg viewBox="0 0 64 64" className="h-[70%] w-[70%]" aria-hidden="true">
          <path
            fill="currentColor"
            d="M32 10C19.9 10 10 19.8 10 32c0 9.7 6.3 17.9 15 20.8 1.1.2 1.5-.5 1.5-1.1v-4.1c-6.1 1.3-7.4-2.6-7.4-2.6-1-2.5-2.4-3.1-2.4-3.1-2-.1.1-.1.1-.1 2.2.1 3.4 2.3 3.4 2.3 2 3.3 5.2 2.4 6.4 1.8.2-1.4.8-2.4 1.4-3-4.9-.6-10.1-2.4-10.1-10.9 0-2.4.9-4.4 2.3-5.9-.2-.6-1-2.8.2-5.9 0 0 1.9-.6 6.1 2.3 1.8-.5 3.7-.7 5.6-.8 1.9 0 3.9.3 5.6.8 4.3-2.9 6.1-2.3 6.1-2.3 1.2 3.1.4 5.3.2 5.9 1.5 1.6 2.3 3.5 2.3 5.9 0 8.5-5.2 10.3-10.2 10.9.8.7 1.5 2 1.5 4.1v6c0 .6.4 1.3 1.5 1.1C47.7 49.9 54 41.7 54 32 54 19.8 44.2 10 32 10Z"
          />
        </svg>
      );
    case 'canva':
      return (
        <div className="h-full w-full bg-[linear-gradient(135deg,#00c4cc,#7d2ae8)] flex items-center justify-center text-white font-serif text-2xl">
          C
        </div>
      );
    case 'slack':
      return (
        <svg viewBox="0 0 64 64" className="h-[70%] w-[70%]" aria-hidden="true">
          <rect x="10" y="26" width="12" height="28" rx="6" fill="#36C5F0" />
          <rect x="16" y="10" width="12" height="18" rx="6" fill="#36C5F0" />
          <rect x="26" y="10" width="28" height="12" rx="6" fill="#2EB67D" />
          <rect x="36" y="16" width="18" height="12" rx="6" fill="#2EB67D" />
          <rect x="42" y="26" width="12" height="28" rx="6" fill="#ECB22E" />
          <rect x="36" y="36" width="18" height="12" rx="6" fill="#ECB22E" />
          <rect x="10" y="42" width="28" height="12" rx="6" fill="#E01E5A" />
          <rect x="10" y="36" width="12" height="18" rx="6" fill="#E01E5A" />
        </svg>
      );
    case 'google-drive':
      return (
        <svg viewBox="0 0 64 64" className="h-[78%] w-[78%]" aria-hidden="true">
          <polygon points="24,10 36,10 52,38 40,38" fill="#0F9D58" />
          <polygon points="24,10 40,38 32,52 16,24" fill="#F4B400" />
          <polygon points="16,24 32,52 20,52 4,24" fill="#4285F4" />
        </svg>
      );
    case 'notion':
      return (
        <div className="h-[72%] w-[72%] rounded-md border-2 border-black bg-white text-black flex items-center justify-center font-serif text-xl font-bold">
          N
        </div>
      );
    case 'discord':
      return (
        <svg viewBox="0 0 64 64" className="h-[75%] w-[75%]" aria-hidden="true">
          <path
            fill="#5865F2"
            d="M48.8 18.7c-3.2-1.5-6.5-2.6-10-3.2-.4.7-.8 1.5-1.1 2.2-3.8-.5-7.5-.5-11.2 0-.3-.8-.7-1.5-1.1-2.2-3.5.6-6.8 1.7-10 3.2C9 27.8 7.2 36.6 8 45.3c4.3 3.2 8.5 5.1 12.7 6.3 1-1.3 1.9-2.7 2.6-4.2-1.4-.5-2.7-1.1-4-1.8.3-.2.7-.5 1-.7 7.7 3.6 16 3.6 23.6 0 .3.3.7.5 1 .7-1.3.7-2.6 1.3-4 1.8.8 1.5 1.6 2.9 2.6 4.2 4.2-1.2 8.4-3.1 12.7-6.3.9-10.1-1.5-18.8-7.4-26.6ZM26.5 40.1c-2.3 0-4.2-2.1-4.2-4.6s1.8-4.6 4.2-4.6c2.4 0 4.2 2.1 4.2 4.6 0 2.6-1.8 4.6-4.2 4.6Zm11 0c-2.3 0-4.2-2.1-4.2-4.6s1.8-4.6 4.2-4.6c2.4 0 4.2 2.1 4.2 4.6 0 2.6-1.8 4.6-4.2 4.6Z"
          />
        </svg>
      );
    case 'jira':
      return (
        <svg viewBox="0 0 64 64" className="h-[75%] w-[75%]" aria-hidden="true">
          <path fill="#2684FF" d="M31.8 10 18.2 23.7l8.3 8.3L40 18.5 31.8 10Z" />
          <path fill="#2684FF" d="M40 18.5 26.5 32l8.2 8.2 13.6-13.6L40 18.5Z" />
          <path fill="#0052CC" d="M26.5 32 13 45.5 21.2 54 34.7 40.2 26.5 32Z" />
        </svg>
      );
    case 'linear':
      return (
        <svg viewBox="0 0 64 64" className="h-[72%] w-[72%]" aria-hidden="true">
          <circle cx="32" cy="32" r="22" fill="#5E6AD2" />
          <path fill="white" d="M21 24h4v16h-4zM28 24h15v4H28zM28 30h12v4H28zM28 36h8v4h-8z" opacity=".92" />
        </svg>
      );
    case 'zapier':
      return (
        <svg viewBox="0 0 64 64" className="h-[72%] w-[72%]" aria-hidden="true">
          <path fill="#FF4F00" d="M28 8h8v18h18v8H36v18h-8V34H10v-8h18V8Z" />
        </svg>
      );
    default:
      return (
        <div className="text-foreground text-xs font-semibold tracking-wide">
          {badge}
        </div>
      );
  }
};

export default ConnectorLogo;
