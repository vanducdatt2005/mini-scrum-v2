import { useState, useEffect } from "react";
import { useSidebar } from "../context/SidebarContext";
import { useNavigate, useParams } from "react-router-dom";
import api, { getInvitations, respondToInvitation, getAvatarUrl } from "../services/api";
import NotificationBell from "./NotificationBell";
import useNotifications from '../hooks/useNotifications.jsx';
import ThemeToggle from "./ThemeToggle";
import { useAuth } from "../context/AuthContext";

export default function TopBar({ projectId: propProjectId }) {
  const { toggle } = useSidebar();
  const navigate = useNavigate();
  const [showMenu, setShowMenu] = useState(false);
  const [invitations, setInvitations] = useState([]);
  
  const { user } = useAuth() || {};
  const currentUser = user || {};
  
  const { projectId: routeProjectId } = useParams();
  const projectId = propProjectId || routeProjectId;
  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState({ stories: [], tasks: [] });
  const [showResults, setShowResults] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  const performSearch = async (query) => {
    if (!projectId) return;
    try {
      setIsSearching(true);
      const res = await api.get(`/project/${projectId}/search-tasks`, {
        params: { q: query || undefined }
      });
      setResults(res.data || { stories: [], tasks: [] });
    } catch (err) {
      console.error("Lỗi khi tìm kiếm:", err);
    } finally {
      setIsSearching(false);
    }
  };

  useEffect(() => {
    fetchData();
    const timer = setInterval(fetchData, 60000);
    return () => clearInterval(timer);
  }, [window.location.search]);

  const fetchData = async () => {
    try {
      const invRes = await getInvitations();
      setInvitations(invRes.data);
    } catch (err) {
      console.error("Lỗi lấy thông báo:", err);
    }
  };

  const handleRespond = async (id, action) => {
    try {
      await respondToInvitation(id, action);
      await fetchData();
      if (action === "ACCEPT") {
        window.location.href = "/dashboard";
      }
    } catch (err) {
      alert("Lỗi khi xử lý lời mời");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  return (
    <header className="flex justify-between items-center w-full px-3 md:px-8 h-14 md:h-16 sticky top-0 bg-surface/80 backdrop-blur-xl z-30 border-b border-outline-variant/10">
      {/* Search + Menu */}
      <div className="flex items-center gap-2 md:gap-6 w-full max-w-sm md:max-w-none">
        <button 
          onClick={toggle}
          className="p-1.5 md:p-2 -ml-1.5 md:-ml-2 text-on-surface-variant hover:bg-surface-container-high rounded-full transition-colors md:hidden flex-shrink-0"
        >
          <span className="material-symbols-outlined text-[20px] md:text-[24px]">menu</span>
        </button>

        <div className="relative flex-1 md:flex-none min-w-0">
          <span className="material-symbols-outlined absolute left-2.5 md:left-3 top-1/2 -translate-y-1/2 text-outline text-xs md:text-base flex-shrink-0">
            search
          </span>
          <input
            type="text"
            placeholder={projectId ? "Tìm kiếm task/story..." : "Chọn dự án để tìm kiếm..."}
            disabled={!projectId}
            value={searchQuery}
            onChange={(e) => {
              const val = e.target.value;
              setSearchQuery(val);
              performSearch(val);
            }}
            onFocus={() => {
              setShowResults(true);
              performSearch(searchQuery);
            }}
            className="pl-8 md:pl-9 pr-3 md:pr-4 py-1.5 md:py-2 bg-surface-container-low border-none rounded-full text-xs md:text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 w-full md:w-64 text-on-surface transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          />

          {showResults && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowResults(false)}></div>
              <div className="absolute left-0 mt-3 w-72 md:w-[22rem] bg-white rounded-2xl shadow-2xl border border-outline-variant/10 py-3 z-50 max-h-96 overflow-y-auto animate-in fade-in slide-in-from-top-3 duration-200">
                {isSearching && (
                  <div className="px-4 py-2 text-xs font-semibold text-on-surface-variant flex items-center gap-2">
                    <div className="w-3.5 h-3.5 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
                    Đang tìm kiếm...
                  </div>
                )}

                {/* Gợi ý gần đây (khi query trống) */}
                {!searchQuery && !isSearching && (
                  <div className="px-4 pb-2 text-[10px] font-black uppercase tracking-widest text-on-surface-variant/60 flex items-center gap-1.5 border-b border-outline-variant/5 mb-2">
                    <span className="material-symbols-outlined text-sm leading-none">history</span>
                    Gợi ý gần đây
                  </div>
                )}

                {/* Stories */}
                {results.stories?.length > 0 && (
                  <div className="mb-2">
                    <div className="px-4 py-1 text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-sm leading-none flex-shrink-0">star</span>
                      User Stories
                    </div>
                    {results.stories.map(s => (
                      <button
                        key={s.id}
                        onClick={() => {
                          setShowResults(false);
                          setSearchQuery("");
                          navigate(`/userstory/${s.id}`);
                        }}
                        className="w-full text-left px-4 py-2.5 hover:bg-primary/5 text-xs font-semibold text-on-surface flex items-center justify-between group transition-colors"
                      >
                        <span className="truncate flex-1 pr-2 group-hover:text-primary transition-colors">{s.title}</span>
                        <span className="text-[10px] text-outline font-mono uppercase shrink-0">#{s.id.slice(-5)}</span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Tasks */}
                {results.tasks?.length > 0 && (
                  <div className="mb-1">
                    <div className="px-4 py-1 text-[10px] font-black uppercase tracking-widest text-emerald-600 flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-sm leading-none flex-shrink-0">task</span>
                      Tasks
                    </div>
                    {results.tasks.map(t => (
                      <button
                        key={t.id}
                        onClick={() => {
                          setShowResults(false);
                          setSearchQuery("");
                          navigate(`/userstory/${t.storyId}`);
                        }}
                        className="w-full text-left px-4 py-2.5 hover:bg-emerald-500/5 text-xs font-semibold text-on-surface flex flex-col group transition-colors"
                      >
                        <div className="flex items-center justify-between w-full">
                          <span className="truncate flex-1 pr-2 group-hover:text-emerald-600 transition-colors">{t.title}</span>
                          <span className="text-[10px] text-outline font-mono uppercase shrink-0">#{t.id.slice(-5)}</span>
                        </div>
                        {t.userStory && (
                          <span className="text-[10px] text-on-surface-variant/50 truncate mt-0.5 font-medium pl-1 border-l border-outline-variant/20">
                            Story: {t.userStory.title}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}

                {/* Empty State */}
                {!isSearching && (!results.stories || results.stories.length === 0) && (!results.tasks || results.tasks.length === 0) && (
                  <div className="px-4 py-4 text-center text-xs font-semibold text-on-surface-variant/60 italic flex flex-col items-center gap-2">
                    <span className="material-symbols-outlined text-3xl opacity-20">search_off</span>
                    <span>{searchQuery ? "Không tìm thấy kết quả phù hợp" : "Chưa có task/story nào gần đây"}</span>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Right Actions - Safe from scrollbar */}
      <div className="flex items-center gap-2 md:gap-4 flex-shrink-0 pr-2">
        <div className="flex-shrink-0">
          <ThemeToggle />
        </div>
        
        <div className="flex-shrink-0">
          <NotificationBell invitations={invitations} onRespondInvite={handleRespond} />
        </div>

        <div className="h-6 md:h-8 w-[1px] bg-outline-variant mx-0.5 md:mx-1 flex-shrink-0"></div>

        <div className="relative flex-shrink-0">
          <button 
            onClick={() => setShowMenu(!showMenu)}
            className="group flex items-center gap-1 md:gap-2 p-1 pr-1.5 md:pr-3 rounded-full border border-outline-variant/10 hover:bg-surface-container-high transition-all flex-shrink-0"
          >
            <div className="w-7 h-7 md:w-8 md:h-8 rounded-full overflow-hidden bg-primary flex items-center justify-center text-on-primary font-bold text-[10px] md:text-xs shadow-sm flex-shrink-0">
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
            <span className="hidden md:block text-xs font-bold text-on-surface opacity-80 whitespace-nowrap">{currentUser.fullName}</span>
            <span className="material-symbols-outlined text-xs md:text-sm text-on-surface-variant group-hover:rotate-180 transition-transform flex-shrink-0">expand_more</span>
          </button>

          {/* User Menu Dropdown */}
          {showMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)}></div>
              <div className="absolute right-0 mt-3 w-56 bg-surface-container-lowest rounded-2xl md:rounded-3xl shadow-2xl border border-outline-variant/10 py-2 md:py-3 z-50 animate-in fade-in slide-in-from-top-3 duration-200">
                <div className="px-5 md:px-6 py-3 md:py-4 border-b border-outline-variant/10 mb-2">
                  <div className="text-sm font-bold text-on-surface">{currentUser.fullName}</div>
                  <div className="text-[10px] font-medium text-on-surface-variant opacity-60">ID: {currentUser.id?.slice(-8)}</div>
                </div>
                
                <button 
                  onClick={() => navigate('/settings')}
                  className="w-full flex items-center gap-3 md:gap-4 px-5 md:px-6 py-2.5 md:py-3 text-xs md:text-sm font-medium text-on-surface-variant hover:bg-primary/5 hover:text-primary transition-all text-left"
                >
                  <span className="material-symbols-outlined text-base md:text-lg">settings</span>
                  <span>Cài đặt cá nhân</span>
                </button>

                <button 
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 md:gap-4 px-5 md:px-6 py-2.5 md:py-3 text-xs md:text-sm font-bold text-error hover:bg-error/5 transition-all text-left mt-1 md:mt-2"
                >
                  <span className="material-symbols-outlined text-base md:text-lg">logout</span>
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
