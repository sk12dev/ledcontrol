import { useState, useEffect } from "react";

type ViewMode = "control" | "devices" | "cues" | "cue-builder" | "cue-lists" | "cue-list-builder";

interface SidebarProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  onExpandedChange?: (expanded: boolean) => void;
}

interface MenuItem {
  id: ViewMode;
  label: string;
  icon: string;
}

const menuItems: MenuItem[] = [
  { id: "control", label: "Single Device Control", icon: "⚡" },
  { id: "devices", label: "Multi-Device Manager", icon: "📱" },
  { id: "cues", label: "Cues", icon: "🎬" },
  { id: "cue-lists", label: "Cue Lists", icon: "📋" },
];

export function Sidebar({ viewMode, onViewModeChange, onExpandedChange }: SidebarProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    onExpandedChange?.(isExpanded);
  }, [isExpanded, onExpandedChange]);

  const toggleSidebar = () => {
    setIsExpanded(!isExpanded);
  };

  return (
    <>
      {/* Backdrop overlay for mobile when expanded */}
      {isExpanded && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={toggleSidebar}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed left-0 top-0 h-full bg-gray-800 border-r border-gray-700 z-50
          transition-all duration-300 ease-in-out
          ${isExpanded ? "w-64" : "w-16"}
        `}
      >
        {/* Toggle Button */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-gray-700">
          {isExpanded && (
            <h2 className="text-lg font-bold text-white">Menu</h2>
          )}
          <button
            onClick={toggleSidebar}
            className="p-2 rounded hover:bg-gray-700 text-gray-300 hover:text-white transition-colors"
            aria-label={isExpanded ? "Collapse sidebar" : "Expand sidebar"}
          >
            {isExpanded ? (
              <span className="text-xl">←</span>
            ) : (
              <span className="text-xl">☰</span>
            )}
          </button>
        </div>

        {/* Menu Items */}
        <nav className="mt-4">
          <ul className="space-y-1 px-2">
            {menuItems.map((item) => {
              const isActive = viewMode === item.id;
              return (
                <li key={item.id}>
                  <button
                    onClick={() => {
                      onViewModeChange(item.id);
                      // Auto-collapse on mobile after selection
                      if (window.innerWidth < 768) {
                        setIsExpanded(false);
                      }
                    }}
                    className={`
                      w-full flex items-center gap-3 px-3 py-3 rounded-lg
                      transition-colors duration-200
                      ${
                        isActive
                          ? "bg-blue-600 text-white"
                          : "text-gray-300 hover:bg-gray-700 hover:text-white"
                      }
                    `}
                    title={!isExpanded ? item.label : undefined}
                  >
                    <span className="text-2xl flex-shrink-0">{item.icon}</span>
                    {isExpanded && (
                      <span className="font-medium whitespace-nowrap">
                        {item.label}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
      </aside>
    </>
  );
}

