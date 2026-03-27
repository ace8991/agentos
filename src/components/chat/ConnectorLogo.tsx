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
    case 'gmail':
      return (
        <svg viewBox="0 0 64 64" className="h-[76%] w-[76%]" aria-hidden="true">
          <path fill="#EA4335" d="M12 20.8 32 35l20-14.2V48a4 4 0 0 1-4 4H16a4 4 0 0 1-4-4V20.8Z" />
          <path fill="#34A853" d="M52 20.8V48a4 4 0 0 1-4 4H40V29.3l12-8.5Z" />
          <path fill="#FBBC04" d="M12 20.8 24 29.3V52H16a4 4 0 0 1-4-4V20.8Z" />
          <path fill="#4285F4" d="M12 16a4 4 0 0 1 4-4h1.2L32 22.8 46.8 12H48a4 4 0 0 1 4 4v4.8L32 35 12 20.8V16Z" />
        </svg>
      );
    case 'google-calendar':
      return (
        <svg viewBox="0 0 64 64" className="h-[76%] w-[76%]" aria-hidden="true">
          <rect x="10" y="12" width="44" height="42" rx="8" fill="white" />
          <path fill="#4285F4" d="M18 12h28a8 8 0 0 1 8 8v8H10v-8a8 8 0 0 1 8-8Z" />
          <rect x="20" y="34" width="24" height="14" rx="3" fill="#4285F4" />
          <text x="32" y="45" textAnchor="middle" fontSize="16" fontWeight="700" fill="white">31</text>
        </svg>
      );
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
    case 'figma':
      return (
        <svg viewBox="0 0 64 64" className="h-[76%] w-[76%]" aria-hidden="true">
          <rect x="20" y="8" width="12" height="16" rx="6" fill="#F24E1E" />
          <rect x="32" y="8" width="12" height="16" rx="6" fill="#FF7262" />
          <rect x="20" y="24" width="12" height="16" rx="6" fill="#A259FF" />
          <circle cx="38" cy="32" r="6" fill="#1ABCFE" />
          <rect x="20" y="40" width="12" height="16" rx="6" fill="#0ACF83" />
        </svg>
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
    case 'hubspot':
      return (
        <svg viewBox="0 0 64 64" className="h-[74%] w-[74%]" aria-hidden="true">
          <circle cx="32" cy="32" r="20" fill="#FF7A59" />
          <circle cx="32" cy="32" r="7" fill="white" />
          <circle cx="49" cy="18" r="5" fill="#FF7A59" />
          <rect x="46" y="23" width="4" height="15" rx="2" fill="#FF7A59" />
          <rect x="18" y="30" width="11" height="4" rx="2" fill="#FF7A59" />
        </svg>
      );
    case 'notion':
      return (
        <div className="h-[72%] w-[72%] rounded-md border-2 border-black bg-white text-black flex items-center justify-center font-serif text-xl font-bold">
          N
        </div>
      );
    case 'box':
      return (
        <div className="h-full w-full bg-[#0C64F5] flex items-center justify-center text-white text-lg font-bold">
          box
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
    case 'telegram':
      return (
        <svg viewBox="0 0 64 64" className="h-[72%] w-[72%]" aria-hidden="true">
          <circle cx="32" cy="32" r="24" fill="#27A7E7" />
          <path fill="white" d="M46.4 19.1 18.8 29.7c-1.9.7-1.8 1.8-.3 2.3l7.1 2.2 2.8 8.8c.4 1.1.2 1.6 1.4 1.6.9 0 1.3-.4 1.8-.9l4.3-4.2 8.9 6.6c1.6.9 2.8.4 3.2-1.5l4.7-22.2c.6-2.3-.9-3.3-2.3-2.3Z" />
        </svg>
      );
    case 'whatsapp':
      return (
        <svg viewBox="0 0 64 64" className="h-[72%] w-[72%]" aria-hidden="true">
          <circle cx="32" cy="32" r="24" fill="#25D366" />
          <path fill="white" d="M24.3 48.5 26 42c-2.3-3.2-3.4-6.4-3.4-10 0-10.5 8.4-18.9 18.8-18.9 5.1 0 9.7 2 13.3 5.5a18.6 18.6 0 0 1-13.3 31.8c-3.3 0-6.3-.8-9.5-2.3l-7.6.4Zm9-24.4c-.5-1.2-1.1-1.2-1.6-1.2h-1.4c-.4 0-1 .2-1.5.8-.5.5-2 1.9-2 4.6 0 2.8 2 5.4 2.4 5.8.3.4 4 6.4 10 8.6 4.9 1.8 5.9 1.5 7 1.4 1-.1 3.2-1.3 3.7-2.6.5-1.3.5-2.3.4-2.6-.2-.3-.6-.4-1.2-.7l-4.1-2c-.6-.3-1-.4-1.4.3-.4.5-1.6 2-2 2.4-.4.4-.7.4-1.4.1-.6-.3-2.6-1-4.9-3.3-1.8-1.7-2.9-3.7-3.2-4.3-.3-.5 0-.8.2-1.1l1-1.2c.3-.4.4-.7.7-1.2.2-.4 0-.9-.1-1.2l-1.8-4.3Z" />
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
    case 'asana':
      return (
        <svg viewBox="0 0 64 64" className="h-[74%] w-[74%]" aria-hidden="true">
          <circle cx="24" cy="40" r="8" fill="#F06A6A" />
          <circle cx="40" cy="40" r="8" fill="#F06A6A" opacity=".82" />
          <circle cx="32" cy="22" r="8" fill="#8B5CF6" />
        </svg>
      );
    case 'linear':
      return (
        <svg viewBox="0 0 64 64" className="h-[72%] w-[72%]" aria-hidden="true">
          <circle cx="32" cy="32" r="22" fill="#5E6AD2" />
          <path fill="white" d="M21 24h4v16h-4zM28 24h15v4H28zM28 30h12v4H28zM28 36h8v4h-8z" opacity=".92" />
        </svg>
      );
    case 'supabase':
      return (
        <svg viewBox="0 0 64 64" className="h-[74%] w-[74%]" aria-hidden="true">
          <path fill="#3ECF8E" d="M38 10c2.1-2.7 6.4-1.2 6.4 2.2V48c0 1.6-1.3 2.9-2.9 2.9-1 0-2-.5-2.5-1.3L25.8 31.4c-.8-1-.8-2.5 0-3.5L38 10Z" />
          <path fill="#2FB97F" d="M26 18.4c2.1-2.7 6.4-1.2 6.4 2.2V56L19 37.6c-.8-1-.8-2.5 0-3.5L26 18.4Z" />
        </svg>
      );
    case 'vercel':
      return (
        <svg viewBox="0 0 64 64" className="h-[70%] w-[70%]" aria-hidden="true">
          <path fill="currentColor" d="M32 14 50 46H14l18-32Z" />
        </svg>
      );
    case 'stripe':
      return (
        <div className="h-full w-full bg-[#635BFF] flex items-center justify-center text-white text-xl font-bold">
          S
        </div>
      );
    case 'airtable':
      return (
        <svg viewBox="0 0 64 64" className="h-[76%] w-[76%]" aria-hidden="true">
          <path fill="#FCB400" d="M12 20 30.5 10.8a4 4 0 0 1 3.1 0L52 20 33.7 29.1a4 4 0 0 1-3.4 0L12 20Z" />
          <path fill="#18BFFF" d="M52 24v16.7a4 4 0 0 1-2.2 3.6L34.7 52V33.6L52 24Z" />
          <path fill="#F82B60" d="M29.3 34.1V52l-15.1-7.7A4 4 0 0 1 12 40.7V24l17.3 10.1Z" />
        </svg>
      );
    case 'zapier':
      return (
        <svg viewBox="0 0 64 64" className="h-[72%] w-[72%]" aria-hidden="true">
          <path fill="#FF4F00" d="M28 8h8v18h18v8H36v18h-8V34H10v-8h18V8Z" />
        </svg>
      );
    case 'n8n':
      return (
        <div className="h-full w-full bg-[linear-gradient(135deg,#ff6d5a,#ea4b71)] flex items-center justify-center text-white text-lg font-bold">
          n8n
        </div>
      );
    case 'wordpress-com':
      return (
        <svg viewBox="0 0 64 64" className="h-[74%] w-[74%]" aria-hidden="true">
          <circle cx="32" cy="32" r="24" fill="#21759B" />
          <text x="32" y="40" textAnchor="middle" fontSize="26" fontFamily="Georgia, serif" fill="white">W</text>
        </svg>
      );
    case 'tavily':
      return (
        <div className="h-full w-full bg-[linear-gradient(135deg,#0ea5e9,#1d4ed8)] flex items-center justify-center text-white text-lg font-bold">
          T
        </div>
      );
    case 'filesystem':
      return (
        <svg viewBox="0 0 64 64" className="h-[72%] w-[72%]" aria-hidden="true">
          <path fill="#E5E7EB" d="M10 18a4 4 0 0 1 4-4h12l4 4h20a4 4 0 0 1 4 4v24a4 4 0 0 1-4 4H14a4 4 0 0 1-4-4V18Z" />
          <path fill="#94A3B8" d="M10 24h44v6H10z" />
        </svg>
      );
    case 'windows-mcp':
      return (
        <svg viewBox="0 0 64 64" className="h-[70%] w-[70%]" aria-hidden="true">
          <path fill="#3B82F6" d="M10 12 30 9v21H10V12Zm24-3 20-3v24H34V9ZM10 34h20v21L10 52V34Zm24 0h20v24l-20-3V34Z" />
        </svg>
      );
    case 'apify':
      return (
        <div className="h-full w-full bg-black flex items-center justify-center text-white text-xl font-bold">
          A
        </div>
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
