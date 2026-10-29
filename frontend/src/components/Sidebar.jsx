import { useNavigate } from "react-router-dom";

export default function Sidebar({ activePage = "Dashboard", isOpen, onClose, projectId }) {
  const navigate = useNavigate();
  const navItems = [
    { icon: "dashboard", label: "Dashboard", href: "/dashboard" },
    { icon: "list_alt", label: "Backlog", href: projectId ? `/projects/${projectId}/backlog` : "/backlog" },
    { icon: "view_kanban", label: "Board", href: projectId ? `/projects/${projectId}/board` : "/board" },
    { icon: "edit_calendar", label: "Standup", href: projectId ? `/projects/${projectId}/standup` : "#" },
    { icon: "assessment", label: "Reports", href: projectId ? `/projects/${projectId}/reports` : "#" },
  ];

  const bottomItems = [
    { icon: "group", label: "Team", href: projectId ? `/projects/${projectId}/members` : "#" },
    { icon: "settings", label: "Settings", href: projectId ? `/projects/${projectId}/edit` : "#" },
  ];

  return (
    <>
      {/* Backdrop for mobile */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 md:hidden transition-opacity"
          onClick={onClose}
        />
      )}

      <aside className={`flex flex-col fixed h-full py-4 md:py-6 bg-surface-container-low w-[240px] md:w-64 left-0 top-0 z-50 transition-transform duration-300 ease-in-out border-r border-outline-variant/10 ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        {/* Logo & Close */}
        <div className="px-4 md:px-6 mb-6 md:mb-10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl bg-gradient-to-br from-primary to-primary-container flex items-center justify-center text-on-primary">
              <span className="material-symbols-outlined text-lg md:text-base">rocket_launch</span>
            </div>
            <div>
              <h1 className="font-['Manrope'] font-extrabold text-on-surface leading-tight text-sm md:text-base">Mini Scrum</h1>
              <p className="font-['Inter'] text-[9px] md:text-[10px] font-medium text-on-surface-variant opacity-70">Active Sprint 1</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 text-on-surface-variant hover:bg-surface-container-high rounded-full md:hidden"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-0.5 md:space-y-1 pr-2 md:pr-4">
        {navItems.map(({ icon, label, href }) =>
            label === activePage ? (
              <button
                key={label}
                onClick={() => {
                  if (href !== "#") navigate(href);
                  if (window.innerWidth < 768) onClose();
                }}
                className="w-full flex items-center gap-2 md:gap-3 px-4 md:px-6 py-2.5 md:py-3 bg-primary/10 text-primary rounded-r-full shadow-sm font-['Inter'] text-xs md:text-sm font-bold transition-all text-left"
              >
                <span className="material-symbols-outlined filled text-[20px] md:text-[24px]">{icon}</span>
                <span>{label}</span>
              </button>
            ) : (
              <button
                key={label}
                onClick={() => {
                  if (href !== "#") navigate(href);
                  if (window.innerWidth < 768) onClose();
                }}
                className="w-full flex items-center gap-2 md:gap-3 px-4 md:px-6 py-2.5 md:py-3 text-on-surface-variant hover:pl-5 md:hover:pl-8 hover:text-primary font-['Inter'] text-xs md:text-sm font-medium transition-all text-left"
              >
                <span className="material-symbols-outlined text-[20px] md:text-[24px]">{icon}</span>
                <span>{label}</span>
              </button>
            )
          )}
        </nav>

        {/* Bottom section */}
        <div className="mt-auto px-3 md:px-4 pr-6 md:pr-8">
          <div className="space-y-0.5 md:space-y-1">
            {bottomItems.map(({ icon, label, href }) => (
              <button
                key={label}
                onClick={() => {
                  if (href !== "#") navigate(href);
                  if (window.innerWidth < 768) onClose();
                }}
                className="w-full flex items-center gap-2 md:gap-3 px-4 md:px-6 py-2 text-on-surface-variant hover:text-primary font-['Inter'] text-xs md:text-sm font-medium transition-all text-left"
              >
                <span className="material-symbols-outlined text-[20px] md:text-[24px]">{icon}</span>
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>
      </aside>
    </>
  );
}
