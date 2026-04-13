import { useNavigate, useLocation } from 'react-router-dom';
import { MessageSquare, Users, Code2 } from 'lucide-react';

const navItems = [
  { path: '/dashboard', label: 'Chat', icon: MessageSquare },
  { path: '/cowork', label: 'Cowork', icon: Users },
  { path: '/code', label: 'Code', icon: Code2 },
] as const;

const TopNavBar = () => {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  return (
    <div className="flex items-center justify-center gap-1 px-4 py-2 bg-[hsl(0,0%,10%)] border-b border-[hsl(0,0%,17%)]">
      {navItems.map(({ path, label, icon: Icon }) => {
        const active = pathname === path;
        return (
          <button
            key={path}
            onClick={() => navigate(path)}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              active
                ? 'bg-[hsl(0,0%,18%)] text-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-[hsl(0,0%,14%)]'
            }`}
          >
            <Icon size={15} />
            {label}
          </button>
        );
      })}
    </div>
  );
};

export default TopNavBar;
