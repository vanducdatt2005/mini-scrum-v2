import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import MainLayout from "../components/MainLayout";
import SprintProgress from "../components/SprintProgress";
import MyTasks from "../components/MyTasks";
import RecentActivity from "../components/RecentActivity";
import SprintStats from "../components/SprintStats";
import FAB from "../components/FAB";
import JoinProjectModal from "../components/JoinProjectModal";
import api, { getDashboardStats, getSprintsByProject } from "../services/api";

const getTimeRemaining = (endDate) => {
  if (!endDate) return "N/A";
  const end = new Date(endDate);
  const now = new Date();
  if (end < now) return "0 Days";
  const diff = end - now;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  if (days === 0) return `${hours}h`;
  return `${days} Days ${hours}h`;
};

export default function Dashboard() {
  const [projects, setProjects] = useState([]);
  const [stats, setStats] = useState(null);
  const [activeSprint, setActiveSprint] = useState(null);
  const [projectId, setProjectId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const navigate = useNavigate();

  const fetchProjects = (targetProjectId) => {
    setIsLoading(true);
    api.get("/project").then((res) => {
      setProjects(res.data);
      if (res.data && res.data.length > 0) {
        if (targetProjectId) {
          setProjectId(targetProjectId);
        } else if (!projectId || !res.data.some(p => p.id === projectId)) {
          setProjectId(res.data[0].id);
        }
      } else {
        setProjectId(null);
      }
      setIsLoading(false);
    }).catch(() => navigate("/login"));
  };

  useEffect(() => {
    fetchProjects();
  }, [navigate]);

  useEffect(() => {
    if (projectId) {
      setStats(null);
      setActiveSprint(null);
      
      Promise.all([
        getDashboardStats(projectId).catch(() => ({ data: null })),
        getSprintsByProject(projectId).catch(() => ({ data: [] }))
      ]).then(([statsRes, sprintsRes]) => {
        if (statsRes && statsRes.data) {
          setStats(statsRes.data);
        } else {
          setStats({ progressPercentage: 0, completedStories: 0, inProgressStories: 0, todoStories: 0, completedPoints: 0, totalPoints: 0 });
        }
        
        if (sprintsRes && sprintsRes.data) {
          const active = sprintsRes.data.find(s => s.status === 'ACTIVE');
          setActiveSprint(active || sprintsRes.data[0] || null);
        }
      });
    }
  }, [projectId]);

  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center bg-surface">
      <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
    </div>
  );

  const activeProject = projects.find(p => p.id === projectId);

  // Nếu không có dự án nào (ACCEPTED)
  if (projects.length === 0) {
    return (
      <MainLayout activePage="Dashboard">
        <div className="max-w-2xl mx-auto px-4 py-16 md:py-32 flex flex-col items-center text-center">
          <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center text-primary mb-6">
            <span className="material-symbols-outlined text-3xl">rocket_launch</span>
          </div>
          <h2 className="text-2xl md:text-3xl font-bold text-on-surface mb-3">
            Chào mừng đến với Mini Scrum
          </h2>
          <p className="text-on-surface-variant text-sm mb-8 max-w-md">
            Bạn chưa tham gia dự án nào. Hãy tạo dự án mới hoặc nhập mã mời để tham gia ngay!
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button 
              onClick={() => setShowJoinModal(true)}
              className="px-6 py-2.5 bg-primary text-on-primary rounded-xl font-bold text-sm hover:opacity-90 shadow-md shadow-primary/20 transition-all flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-[20px]">key</span>
              Tham gia bằng mã mời
            </button>
            <button 
              onClick={() => navigate("/create-project")}
              className="px-6 py-2.5 bg-surface-container text-on-surface hover:bg-surface-container-high rounded-xl font-bold text-sm transition-colors flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-[20px]">add</span>
              Tạo dự án mới
            </button>
            <button 
              onClick={() => navigate("/dashboard?showNotifications=true")}
              className="px-6 py-2.5 bg-surface-container/60 text-on-surface-variant rounded-xl font-semibold text-sm hover:bg-surface-container transition-colors flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-[20px]">notifications</span>
              Xem lời mời
            </button>
          </div>
        </div>

        <JoinProjectModal
          isOpen={showJoinModal}
          onClose={() => setShowJoinModal(false)}
          onSuccess={(data) => {
            fetchProjects(data.projectId);
          }}
        />
      </MainLayout>
    );
  }

  return (
    <MainLayout activePage="Dashboard" projectId={projectId}>
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
          <div>
            <h2 className="text-2xl font-bold text-on-surface mb-1">
              {activeProject?.name || "Dashboard"}
            </h2>
            <p className="text-on-surface-variant text-sm">
              {activeProject?.key || "MGMT"} {activeSprint ? `• ${activeSprint.name}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowJoinModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-surface-container-high hover:bg-primary/10 text-on-surface hover:text-primary rounded-xl font-bold transition-all text-sm border border-outline-variant/10 shadow-sm"
              title="Nhập mã mời để tham gia dự án khác"
            >
              <span className="material-symbols-outlined text-[20px] text-primary">key</span>
              <span>Tham gia bằng mã</span>
            </button>
            <button 
              onClick={() => navigate("/create-project")}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-on-primary rounded-xl font-bold hover:opacity-90 shadow-sm transition-all text-sm"
            >
              <span className="material-symbols-outlined text-[20px]">add</span>
              <span>Dự án mới</span>
            </button>
          </div>
        </div>

        {/* Project Selector (Simplified) */}
        <div className="mb-8 flex gap-2 overflow-x-auto pb-2 hide-scrollbar">
          {projects.map(p => (
            <button
              key={p.id}
              onClick={() => setProjectId(p.id)}
              className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                projectId === p.id 
                ? "bg-surface-container-highest text-on-surface" 
                : "text-on-surface-variant hover:bg-surface-container"
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>

        {stats ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 flex flex-col gap-6">
              <SprintProgress 
                sprintName={activeSprint ? activeSprint.name : "Sprint"}
                completed={stats.progressPercentage || 0} 
                done={stats.completedStories || 0} 
                left={(stats.todoStories || 0) + (stats.inProgressStories || 0)} 
              />
              <MyTasks projectId={projectId} />
            </div>
            <div className="flex flex-col gap-6">
              <SprintStats
                projectId={projectId}
                timeRemaining={activeSprint && activeSprint.status === 'ACTIVE' ? getTimeRemaining(activeSprint.endDate) : "N/A"}
                velocity={stats.completedPoints || 0}
                capacity={stats.totalPoints || 0}
              />
              <RecentActivity projectId={projectId} />
            </div>
          </div>
        ) : (
          <div className="py-20 flex flex-col items-center gap-4 text-on-surface-variant opacity-50">
             <div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
             <span className="text-sm font-medium">Đang tải thống kê dự án...</span>
          </div>
        )}
      </div>

      {/* Floating Action Button */}
      {projectId && (
        <FAB 
          onClick={() => navigate(`/projects/${projectId}/backlog`)} 
          title="Quản lý Backlog & Task"
          icon="inventory_2"
        />
      )}

      {/* Join Project Modal (US-059) */}
      <JoinProjectModal
        isOpen={showJoinModal}
        onClose={() => setShowJoinModal(false)}
        onSuccess={(data) => {
          fetchProjects(data.projectId);
        }}
      />
    </MainLayout>
  );
}
