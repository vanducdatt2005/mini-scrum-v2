import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import MainLayout from '../components/MainLayout';
import { useSidebar } from '../context/SidebarContext';
import StandupHistory from '../components/StandupHistory';
import QuickDailyStandupForm from '../components/QuickDailyStandupForm';
import { 
    getSprintDailyStandups, 
    checkSprintTodayStandup, 
    getProjectStandups, 
    checkTodayStandup 
} from '../services/standupService';
import api from '../services/api';

export default function StandupPage() {
    const { projectId } = useParams();
    const [standups, setStandups] = useState([]);
    const [members, setMembers] = useState([]);
    const [project, setProject] = useState(null);
    const [sprints, setSprints] = useState([]);
    const [selectedSprint, setSelectedSprint] = useState(null);
    const [todayStandup, setTodayStandup] = useState(null);
    const [userRole, setUserRole] = useState('MEMBER');
    const [activeTab, setActiveTab] = useState('submit'); // 'submit' or 'history'
    const [alreadySubmitted, setAlreadySubmitted] = useState(false);
    const [loading, setLoading] = useState(true);
    const [filterMemberId, setFilterMemberId] = useState('ALL');
    const [filterDate, setFilterDate] = useState('');
    const { toggle } = useSidebar();

    useEffect(() => {
        loadData();
    }, [projectId]);

    const loadData = async () => {
        setLoading(true);
        try {
            const [projectRes, membersRes, roleRes, sprintsRes] = await Promise.all([
                api.get(`/project/${projectId}`),
                api.get(`/project/${projectId}/members`),
                api.get(`/project/${projectId}/role`),
                api.get(`/project/${projectId}/sprints`).catch(() => ({ data: [] }))
            ]);

            setProject(projectRes.data);
            setMembers(membersRes.data || []);
            setUserRole(roleRes.data?.role || 'MEMBER');

            const sprintList = sprintsRes.data || [];
            setSprints(sprintList);

            // Tìm Sprint đang ACTIVE, nếu không có lấy Sprint đầu tiên
            const activeSprint = sprintList.find(s => s.status === 'ACTIVE') || (sprintList.length > 0 ? sprintList[0] : null);
            setSelectedSprint(activeSprint);

            if (activeSprint) {
                // Tải dữ liệu Daily theo Sprint
                const [statusRes, dailyRes] = await Promise.all([
                    checkSprintTodayStandup(activeSprint.id).catch(() => ({ submitted: false, standup: null })),
                    getSprintDailyStandups(activeSprint.id).catch(() => ({ standups: [] }))
                ]);

                setAlreadySubmitted(Boolean(statusRes.submitted));
                setTodayStandup(statusRes.standup || null);
                setStandups(dailyRes.standups || []);

                if ((roleRes.data?.role === 'SM' || roleRes.data?.role === 'PO') && statusRes.submitted) {
                    setActiveTab('history');
                }
            } else {
                // Fallback theo Project cũ nếu dự án chưa tạo Sprint nào
                const [statusRes, projectStandupsRes] = await Promise.all([
                    checkTodayStandup(projectId).catch(() => ({ submitted: false })),
                    getProjectStandups(projectId).catch(() => [])
                ]);

                setAlreadySubmitted(Boolean(statusRes.submitted));
                setStandups(projectStandupsRes || []);
            }
        } catch (err) {
            console.error("Lỗi tải dữ liệu standup:", err);
        } finally {
            setLoading(false);
        }
    };

    // Khi người dùng chuyển đổi Sprint trong tab Lịch sử
    const handleSelectSprint = async (sprintId) => {
        const found = sprints.find(s => s.id === sprintId);
        setSelectedSprint(found);
        if (found) {
            try {
                const res = await getSprintDailyStandups(found.id);
                setStandups(res.standups || []);
            } catch (err) {
                console.error("Lỗi tải lịch sử sprint:", err);
            }
        }
    };

    // Callback khi gửi Daily thành công từ QuickDailyStandupForm
    const handleDailySubmittedSuccess = async (createdStandup) => {
        setTodayStandup(createdStandup);
        setAlreadySubmitted(true);

        // Cập nhật lại danh sách lịch sử
        if (selectedSprint) {
            try {
                const res = await getSprintDailyStandups(selectedSprint.id);
                setStandups(res.standups || []);
            } catch (err) {
                console.error("Lỗi cập nhật lịch sử sau khi submit:", err);
            }
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-surface">
                <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
            </div>
        );
    }

    const activeSprint = sprints.find(s => s.status === 'ACTIVE');

    return (
        <MainLayout projectId={projectId} activePage="Standup" header={
            <div className="flex items-center gap-2 md:gap-4 px-4 md:px-8 pt-4 md:pt-6 mb-4 md:mb-8">
                <button 
                  onClick={toggle}
                  className="p-2 -ml-2 text-on-surface-variant hover:bg-surface-container-high rounded-full transition-colors md:hidden"
                >
                  <span className="material-symbols-outlined">menu</span>
                </button>
                <div className="flex items-center gap-3">
                    <h1 className="text-xl md:text-2xl font-bold text-on-surface">Daily Stand-up</h1>
                    <span className="px-3 py-1 bg-primary/10 text-primary rounded-full text-[10px] font-black uppercase tracking-widest truncate max-w-[150px]">
                        {project?.name}
                    </span>
                    {activeSprint && (
                        <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25 rounded-full text-[10px] font-black uppercase tracking-widest">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            {activeSprint.name}
                        </span>
                    )}
                </div>
            </div>
        }>
            <div className="max-w-6xl mx-auto py-6 md:py-8 px-2 md:px-4">
                {/* Tab Switcher */}
                <div className="flex justify-center mb-6 md:mb-10 overflow-x-auto no-scrollbar">
                    <div className="bg-surface-container-low p-1 rounded-[20px] md:rounded-[24px] flex gap-1 shadow-inner border border-outline-variant/5 min-w-fit">
                        <button 
                            onClick={() => setActiveTab('submit')}
                            className={`flex items-center gap-2 px-4 md:px-8 py-2.5 md:py-3 rounded-[16px] md:rounded-[20px] font-bold text-xs md:text-sm transition-all duration-300 whitespace-nowrap ${activeTab === 'submit' ? 'bg-primary text-on-primary shadow-lg shadow-primary/20' : 'text-on-surface-variant hover:bg-surface-container-high'}`}
                        >
                            <span className="material-symbols-outlined text-lg">bolt</span>
                            Quick Daily Form
                        </button>
                        
                        <button 
                            onClick={() => setActiveTab('history')}
                            className={`flex items-center gap-2 px-4 md:px-8 py-2.5 md:py-3 rounded-[16px] md:rounded-[20px] font-bold text-xs md:text-sm transition-all duration-300 whitespace-nowrap ${activeTab === 'history' ? 'bg-primary text-on-primary shadow-lg shadow-primary/20' : 'text-on-surface-variant hover:bg-surface-container-high'}`}
                        >
                            <span className="material-symbols-outlined text-lg">history</span>
                            Lịch sử Stand-up
                            <span className={`ml-1 px-2 py-0.5 rounded-full text-[10px] ${activeTab === 'history' ? 'bg-on-primary/20 text-on-primary' : 'bg-surface-container-highest text-on-surface-variant'}`}>
                                {standups.length}
                            </span>
                        </button>
                    </div>
                </div>

                <div className="animate-in fade-in duration-500">
                    {activeTab === 'submit' ? (
                        <div className="max-w-2xl mx-auto">
                            {/* Component Quick Daily Standup Form (3 Fields) */}
                            <QuickDailyStandupForm 
                                sprintId={activeSprint?.id || selectedSprint?.id}
                                sprintName={activeSprint?.name || selectedSprint?.name || 'Sprint hiện tại'}
                                sprintStatus={activeSprint?.status || selectedSprint?.status || 'PLANNED'}
                                existingStandup={todayStandup}
                                onSuccess={handleDailySubmittedSuccess}
                            />
                        </div>
                    ) : (
                        <div className="max-w-4xl mx-auto">
                            <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 px-4 gap-6">
                                <div>
                                    <h2 className="text-2xl font-black text-on-surface tracking-tight">Dòng thời gian Stand-up</h2>
                                    <p className="text-sm text-on-surface-variant opacity-70 font-medium">Theo dõi tiến độ và giải quyết khó khăn của cả team trong Sprint</p>
                                </div>
                                
                                {/* Filters */}
                                <div className="flex flex-wrap items-center gap-3">
                                    {/* Sprint Selector Filter */}
                                    {sprints.length > 0 && (
                                        <div className="relative group">
                                            <select 
                                                value={selectedSprint?.id || ''}
                                                onChange={(e) => handleSelectSprint(e.target.value)}
                                                className="appearance-none bg-surface-container-high border border-outline-variant/10 rounded-xl pl-10 pr-8 py-2 text-xs font-bold text-on-surface-variant focus:ring-2 focus:ring-primary/20 outline-none transition-all cursor-pointer hover:bg-surface-container-highest"
                                            >
                                                {sprints.map(s => (
                                                    <option key={s.id} value={s.id}>
                                                        {s.name} {s.status === 'ACTIVE' ? '🟢 (ACTIVE)' : `(${s.status})`}
                                                    </option>
                                                ))}
                                            </select>
                                            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-sm text-on-surface-variant opacity-60">directions_run</span>
                                            <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-sm text-on-surface-variant opacity-60 pointer-events-none group-hover:translate-y-[-40%] transition-transform">expand_more</span>
                                        </div>
                                    )}

                                    {/* Member Filter */}
                                    <div className="relative group">
                                        <select 
                                            value={filterMemberId}
                                            onChange={(e) => setFilterMemberId(e.target.value)}
                                            className="appearance-none bg-surface-container-high border border-outline-variant/10 rounded-xl pl-10 pr-8 py-2 text-xs font-bold text-on-surface-variant focus:ring-2 focus:ring-primary/20 outline-none transition-all cursor-pointer hover:bg-surface-container-highest"
                                        >
                                            <option value="ALL">Tất cả thành viên</option>
                                            {members.map(m => (
                                                <option key={m.userId} value={m.userId}>{m.user?.fullName || m.user?.email || 'Thành viên'}</option>
                                            ))}
                                        </select>
                                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-sm text-on-surface-variant opacity-60">person</span>
                                        <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-sm text-on-surface-variant opacity-60 pointer-events-none group-hover:translate-y-[-40%] transition-transform">expand_more</span>
                                    </div>

                                    {/* Date Filter */}
                                    <div className="relative">
                                        <input 
                                            type="date"
                                            value={filterDate}
                                            onChange={(e) => setFilterDate(e.target.value)}
                                            className="bg-surface-container-high border border-outline-variant/10 rounded-xl pl-10 pr-4 py-2 text-xs font-bold text-on-surface-variant focus:ring-2 focus:ring-primary/20 outline-none transition-all cursor-pointer hover:bg-surface-container-highest appearance-none min-h-[36px]"
                                        />
                                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-sm text-on-surface-variant opacity-60">calendar_month</span>
                                        {filterDate && (
                                            <button 
                                                onClick={() => setFilterDate('')}
                                                className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded-full hover:bg-error/10 text-error transition-colors"
                                            >
                                                <span className="material-symbols-outlined text-[14px]">close</span>
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                            
                            <StandupHistory 
                                standups={standups.filter(log => {
                                    const matchMember = filterMemberId === 'ALL' || log.userId === filterMemberId;
                                    const rawDate = log.reportDate || log.date || log.createdAt || '';
                                    const matchDate = !filterDate || String(rawDate).startsWith(filterDate);
                                    return matchMember && matchDate;
                                })} 
                                members={members} 
                            />
                        </div>
                    )}
                </div>
            </div>
        </MainLayout>
    );
}
