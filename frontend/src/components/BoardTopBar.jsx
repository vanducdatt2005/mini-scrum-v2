import { useState } from "react";
import { useSidebar } from "../context/SidebarContext";
import { useNavigate } from "react-router-dom";
import NotificationBell from "./NotificationBell";
import { useAuth } from "../context/AuthContext";
import { getAvatarUrl } from "../services/api";

export default function BoardTopBar({ timeRemaining = "4 days 12 hours remaining", projectId, onCompleteSprint, userRole, hasActiveSprint }) {
  const { toggle } = useSidebar();
  const navigate = useNavigate();
  const [showMenu, setShowMenu] = useState(false);

  const { user } = useAuth() || {};
  const currentUser = user || {};

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  return (
    <header className="flex justify-between items-center w-full px-4 md:px-8 h-16 sticky top-0 bg-[#f8f9fb]/80 backdrop-blur-xl z-30 border-b border-outline-variant/10">
      {/* Left: Menu + Timer */}
      <div className="flex items-center gap-3 md:gap-8 flex-1 min-w-0">
        <button 
          onClick={toggle}
          className="p-2 -ml-2 text-[#44474e] hover:bg-[#f1f3f8] rounded-full transition-colors md:hidden flex-shrink-0"
        >
          <span className="material-symbols-outlined">menu</span>
        </button>
        <div className="flex items-center gap-2 md:gap-4 bg-surface-container-low px-3 md:px-4 py-1.5 md:py-2 rounded-full truncate">
          <span className="material-symbols-outlined text-on-surface-variant text-sm md:text-base flex-shrink-0">timer</span>
          <span className="text-xs md:text-sm font-['Inter'] font-medium text-on-surface truncate max-w-[120px] md:max-w-none">{timeRemaining}</span>
        </div>
      </div>

      {/* Right: Actions + Avatar - Safe from scrollbar */}
      <div className="flex items-center gap-2 md:gap-4 flex-shrink-0 pr-2">
        {/* Nút Manage Team */}
        {projectId && (
          <button 
            onClick={() => navigate(`/projects/${projectId}/members`)}
            className="p-2.5 rounded-xl bg-primary text-on-primary hover:scale-[0.98] active:scale-95 shadow-md transition-all flex items-center justify-center flex-shrink-0"
            title="Quản lý thành viên"
          >
            <span className="material-symbols-outlined text-lg">group_add</span>
            <span className="hidden lg:inline ml-2 font-bold text-xs whitespace-nowrap">Quản lý Team</span>
          </button>
        )}

        {/* Notification Bell - Visible on all sizes */}
        <div className="flex-shrink-0">
          <NotificationBell />
        </div>

        {/* Complete Sprint Button - Hide text on small screens */}
        {hasActiveSprint && (userRole === 'PO' || userRole === 'SM') && (
          <button 
            onClick={onCompleteSprint}
            className="bg-gradient-to-br from-primary-container to-surface text-primary border border-primary/20 px-3 md:px-6 py-1.5 md:py-2 rounded-full font-['Manrope'] font-bold text-xs md:text-sm shadow-sm transition-all active:scale-95 hover:bg-primary/5 flex-shrink-0 whitespace-nowrap"
          >
            <span className="hidden md:inline">Complete</span>
            <span className="md:hidden">✓</span>
            <span className="hidden md:inline"> Sprint</span>
          </button>
        )}

        <div className="h-8 w-[1px] bg-outline-variant mx-1 md:mx-2 flex-shrink-0"></div>

        <div className="relative flex-shrink-0">
          <button 
            onClick={() => setShowMenu(!showMenu)}
            className="group flex items-center gap-2 p-1 pr-3 rounded-full border border-outline-variant/10 hover:bg-surface-container-high transition-all flex-shrink-0"
          >
            <div className="w-8 h-8 rounded-full overflow-hidden bg-primary flex items-center justify-center text-on-primary font-bold text-xs shadow-sm flex-shrink-0">
              {currentUser.avatar ? (
                <img 
                  src={getAvatarUrl(currentUser.avatar)} 
                  alt="Avatar" 
                  className="w-full h-full object-cover"
                />
              ) : (
                currentUser.fullName?.charAt(0).toUpperCase() || 'U'
              )}
            </div>
            <span className="hidden md:block text-xs font-bold text-on-surface opacity-80 whitespace-nowrap">
              {currentUser.fullName}
            </span>
            <span className="material-symbols-outlined text-sm text-on-surface-variant group-hover:rotate-180 transition-transform flex-shrink-0">expand_more</span>
          </button>

          {/* User Menu Dropdown */}
          {showMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)}></div>
              <div className="absolute right-0 mt-3 w-56 bg-white rounded-3xl shadow-2xl border border-outline-variant/10 py-3 z-50 animate-in fade-in slide-in-from-top-3 duration-200">
                <div className="px-6 py-4 border-b border-outline-variant/10 mb-2">
                  <div className="text-sm font-bold text-on-surface">{currentUser.fullName}</div>
                  <div className="text-[10px] font-medium text-on-surface-variant opacity-60">ID: {currentUser.id?.slice(-8)}</div>
                </div>
                
                <button 
                  onClick={() => navigate('/settings')}
                  className="w-full flex items-center gap-4 px-6 py-3 text-sm font-medium text-on-surface-variant hover:bg-primary/5 hover:text-primary transition-all text-left"
                >
                  <span className="material-symbols-outlined text-lg">settings</span>
                  <span>Cài đặt cá nhân</span>
                </button>

                <button 
                  onClick={handleLogout}
                  className="w-full flex items-center gap-4 px-6 py-3 text-sm font-bold text-error hover:bg-error/5 transition-all text-left mt-2"
                >
                  <span className="material-symbols-outlined text-lg">logout</span>
                  <span>Đăng xuất</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
