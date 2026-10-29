import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import MainLayout from '../components/MainLayout';
import { useSidebar } from '../context/SidebarContext';
import StandupHistory from '../components/StandupHistory';
import { submitStandup, getProjectStandups, checkTodayStandup } from '../services/standupService';
import api from '../services/api';

export default function StandupPage() {
    const { projectId } = useParams();
    const [standups, setStandups] = useState([]);
    const [members, setMembers] = useState([]);
    const [project, setProject] = useState(null);
    const [userRole, setUserRole] = useState('MEMBER');
    const [activeTab, setActiveTab] = useState('submit'); // 'submit' or 'history'
    const [alreadySubmitted, setAlreadySubmitted] = useState(false);
    const [formData, setFormData] = useState({
        yesterday: '',
        today: '',
        blockers: ''
    });
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [filterMemberId, setFilterMemberId] = useState('ALL');
    const [filterDate, setFilterDate] = useState('');
    const { toggle } = useSidebar();

    useEffect(() => {
        loadData();
    }, [projectId]);

    const loadData = async () => {
        setLoading(true);
        try {
            const [standupsRes, statusRes, projectRes, membersRes, roleRes] = await Promise.all([
                getProjectStandups(projectId),
                checkTodayStandup(projectId),
                api.get(`/project/${projectId}`),
                api.get(`/project/${projectId}/members`),
                api.get(`/project/${projectId}/role`)
            ]);
            setStandups(standupsRes);
            setAlreadySubmitted(statusRes.submitted);
            setProject(projectRes.data);
            setMembers(membersRes.data);
            setUserRole(roleRes.data.role);
            
            // Nếu là SM hoặc PO, có thể mặc định xem history hoặc dễ dàng chuyển qua
            if ((roleRes.data.role === 'SM' || roleRes.data.role === 'PO') && statusRes.submitted) {
                setActiveTab('history');
            }
        } catch (err) {
            console.error("Lỗi tải dữ liệu standup:", err);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            await submitStandup(projectId, formData);
            setAlreadySubmitted(true);
            const updatedStandups = await getProjectStandups(projectId);
            setStandups(updatedStandups);
            setFormData({ yesterday: '', today: '', blockers: '' });
            setActiveTab('history'); // Tự động chuyển qua xem history sau khi gửi
        } catch (err) {
            alert(err.response?.data?.error || "Lỗi khi lưu Stand-up");
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-surface">
                <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <MainLayout projectId={projectId} activePage="Standup" header={
            <div className="flex items-center gap-2 md:gap-4 px-4 md:px-8 pt-4 md:pt-6 mb-4 md:mb-8">
                <button 
                  onClick={toggle}
                  className="p-2 -ml-2 text-on-surface-variant hover:bg-surface-container-high rounded-full transition-colors md:hidden"
                >
                  <span className="material-symbols-outlined">menu</span>
                </button>
                <h1 className="text-xl md:text-2xl font-bold text-on-surface">Daily Stand-up</h1>
                <span className="px-3 py-1 bg-primary/10 text-primary rounded-full text-[10px] font-black uppercase tracking-widest truncate max-w-[150px]">
                    {project?.name}
                </span>
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
                            <span className="material-symbols-outlined text-lg">edit_note</span>
                            Ghi Stand-up
                        </button>
                        
                        {(userRole === 'PO' || userRole === 'SM') && (
                            <button 
                                onClick={() => setActiveTab('history')}
                                className={`flex items-center gap-2 px-4 md:px-8 py-2.5 md:py-3 rounded-[16px] md:rounded-[20px] font-bold text-xs md:text-sm transition-all duration-300 whitespace-nowrap ${activeTab === 'history' ? 'bg-primary text-on-primary shadow-lg shadow-primary/20' : 'text-on-surface-variant hover:bg-surface-container-high'}`}
                            >
                                <span className="material-symbols-outlined text-lg">history</span>
                                Lịch sử
                                <span className={`ml-1 px-2 py-0.5 rounded-full text-[10px] ${activeTab === 'history' ? 'bg-on-primary/20 text-on-primary' : 'bg-surface-container-highest text-on-surface-variant'}`}>
                                    {standups.length}
                                </span>
                            </button>
                        )}
                    </div>
                </div>

                <div className="animate-in fade-in duration-500">
                    {activeTab === 'submit' ? (
                        <div className="max-w-2xl mx-auto">
                            <div className="bg-surface-container rounded-[24px] md:rounded-[40px] p-6 md:p-10 shadow-xl shadow-surface-variant/5 border border-outline-variant/10 relative overflow-hidden">
                                {/* Decorative elements */}
                                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 blur-3xl" />
                                <div className="absolute bottom-0 left-0 w-32 h-32 bg-tertiary/5 rounded-full -ml-16 -mb-16 blur-3xl" />

                                <h2 className="text-xl md:text-2xl font-black mb-6 md:mb-8 flex items-center gap-3 text-on-surface tracking-tight">
                                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                                        <span className="material-symbols-outlined">edit_square</span>
                                    </div>
                                    Stand-up Hôm nay
                                </h2>

                                {alreadySubmitted ? (
                                    <div className="bg-emerald-50 border border-emerald-100 rounded-[32px] p-10 text-center animate-in zoom-in duration-500">
                                        <div className="w-20 h-20 bg-emerald-500 rounded-full flex items-center justify-center text-white mx-auto mb-6 shadow-lg shadow-emerald-200">
                                            <span className="material-symbols-outlined text-4xl">check_circle</span>
                                        </div>
                                        <h3 className="text-xl font-black text-emerald-900 mb-2">Tuyệt vời!</h3>
                                        <p className="text-emerald-800/70 font-medium">Bạn đã hoàn thành Stand-up ngày hôm nay.</p>
                                        <button 
                                            onClick={() => setActiveTab('history')}
                                            className="mt-8 px-8 py-3 bg-emerald-100 text-emerald-900 rounded-2xl font-bold hover:bg-emerald-200 transition-all flex items-center gap-2 mx-auto"
                                        >
                                            Xem tiến độ của Team
                                            <span className="material-symbols-outlined">arrow_forward</span>
                                        </button>
                                    </div>
                                ) : (
                                    <form onSubmit={handleSubmit} className="space-y-6 md:space-y-8 relative">
                                        <div className="grid grid-cols-1 gap-6 md:gap-8">
                                            <div>
                                                <label className="block text-[10px] md:text-xs font-black text-on-surface-variant/60 uppercase tracking-[0.2em] mb-3 ml-1">
                                                    Hôm qua bạn đã làm gì? <span className="text-error font-bold">*</span>
                                                </label>
                                                <textarea
                                                    required
                                                    value={formData.yesterday}
                                                    onChange={(e) => setFormData({...formData, yesterday: e.target.value})}
                                                    className="w-full bg-surface-container-low border border-outline-variant/20 rounded-2xl md:rounded-3xl p-4 md:p-6 text-sm font-medium focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all min-h-[100px] md:min-h-[120px] shadow-sm placeholder:text-on-surface-variant/30"
                                                    placeholder="Nhiệm vụ đã hoàn thành..."
                                                />
                                            </div>

                                            <div>
                                                <label className="block text-xs font-black text-on-surface-variant/60 uppercase tracking-[0.2em] mb-3 ml-1">
                                                    Hôm nay bạn sẽ làm gì? <span className="text-error font-bold">*</span>
                                                </label>
                                                <textarea
                                                    required
                                                    value={formData.today}
                                                    onChange={(e) => setFormData({...formData, today: e.target.value})}
                                                    className="w-full bg-surface-container-low border border-outline-variant/20 rounded-3xl p-6 text-sm font-medium focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all min-h-[120px] shadow-sm placeholder:text-on-surface-variant/30"
                                                    placeholder="Kế hoạch làm việc trong ngày..."
                                                />
                                            </div>

                                            <div>
                                                <label className="block text-xs font-black text-on-surface-variant/60 uppercase tracking-[0.2em] mb-3 ml-1">
                                                    Bạn có gặp khó khăn gì không?
                                                </label>
                                                <textarea
                                                    value={formData.blockers}
                                                    onChange={(e) => setFormData({...formData, blockers: e.target.value})}
                                                    className="w-full bg-surface-container-low border border-outline-variant/20 rounded-3xl p-6 text-sm font-medium focus:ring-4 focus:ring-error/10 focus:border-error transition-all min-h-[100px] shadow-sm placeholder:text-on-surface-variant/30"
                                                    placeholder="Vấn đề đang cản trở tiến độ của bạn (nếu có)..."
                                                />
                                            </div>
                                        </div>

                                        <button
                                            type="submit"
                                            disabled={submitting}
                                            className="w-full bg-primary text-on-primary font-black py-5 rounded-3xl hover:shadow-2xl hover:shadow-primary/30 transition-all flex items-center justify-center gap-3 disabled:opacity-50 group active:scale-[0.98]"
                                        >
                                            {submitting ? (
                                                <div className="w-6 h-6 border-3 border-on-primary/20 border-t-on-primary rounded-full animate-spin"></div>
                                            ) : (
                                                <>
                                                    <span className="material-symbols-outlined group-hover:translate-x-1 transition-transform">send</span>
                                                    GỬI DAILY LOG
                                                </>
                                            )}
                                        </button>
                                    </form>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="max-w-4xl mx-auto">
                            <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 px-4 gap-6">
                                <div>
                                    <h2 className="text-2xl font-black text-on-surface tracking-tight">Dòng thời gian Stand-up</h2>
                                    <p className="text-sm text-on-surface-variant opacity-70 font-medium">Theo dõi tiến độ và giải quyết khó khăn của cả team</p>
                                </div>
                                
                                {/* Filters */}
                                <div className="flex flex-wrap items-center gap-3">
                                    <div className="relative group">
                                        <select 
                                            value={filterMemberId}
                                            onChange={(e) => setFilterMemberId(e.target.value)}
                                            className="appearance-none bg-surface-container-high border border-outline-variant/10 rounded-xl pl-10 pr-8 py-2 text-xs font-bold text-on-surface-variant focus:ring-2 focus:ring-primary/20 outline-none transition-all cursor-pointer hover:bg-surface-container-highest"
                                        >
                                            <option value="ALL">Tất cả thành viên</option>
                                            {members.map(m => (
                                                <option key={m.userId} value={m.userId}>{m.user.fullName || m.user.email}</option>
                                            ))}
                                        </select>
                                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-sm text-on-surface-variant opacity-60">person</span>
                                        <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-sm text-on-surface-variant opacity-60 pointer-events-none group-hover:translate-y-[-40%] transition-transform">expand_more</span>
                                    </div>

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
                                    const matchDate = !filterDate || log.date.startsWith(filterDate);
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
