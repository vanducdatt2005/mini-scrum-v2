import React, { useState } from 'react';

export default function StandupHistory({ standups, members }) {
    const [expandedDates, setExpandedDates] = useState({});

    // Group standups by date
    const groupedLogs = standups.reduce((acc, log) => {
        const dateObj = new Date(log.date);
        const dateKey = dateObj.toLocaleDateString('vi-VN', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        
        if (!acc[dateKey]) acc[dateKey] = [];
        acc[dateKey].push(log);
        return acc;
    }, {});

    const toggleDate = (date) => {
        setExpandedDates(prev => ({
            ...prev,
            [date]: !prev[date]
        }));
    };

    const formatDate = (dateStr) => {
        const date = new Date(dateStr);
        return date.toLocaleTimeString('vi-VN', {
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    if (standups.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 bg-surface-container-low/20 rounded-[40px] border-2 border-dashed border-outline-variant/20 italic text-on-surface-variant/40 group">
                <span className="material-symbols-outlined text-6xl mb-4 group-hover:scale-110 transition-transform duration-500">history_toggle_off</span>
                <p className="font-medium text-lg">Chưa có dữ liệu lịch sử stand-up.</p>
                <p className="text-sm">Hãy bắt đầu cập nhật tiến độ công việc hôm nay!</p>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {Object.entries(groupedLogs).map(([date, logs]) => {
                const totalMembers = members.length;
                const submittedCount = logs.length;
                const isExpanded = expandedDates[date] !== false; // Default expanded

                return (
                    <div key={date} className="bg-surface-container-lowest rounded-[32px] border border-outline-variant/10 shadow-sm overflow-hidden transition-all duration-300 hover:shadow-md">
                        {/* Date Header */}
                        <button 
                            onClick={() => toggleDate(date)}
                            className="w-full flex items-center justify-between p-4 md:p-6 bg-surface-container-low/40 hover:bg-surface-container-low transition-colors group"
                        >
                            <div className="flex items-center gap-3 md:gap-4">
                                <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl bg-primary/10 flex items-center justify-center text-primary group-hover:rotate-12 transition-transform duration-300">
                                    <span className="material-symbols-outlined font-bold text-lg md:text-2xl">calendar_today</span>
                                </div>
                                <div className="text-left">
                                    <h3 className="text-base md:text-lg font-black text-on-surface tracking-tight capitalize leading-tight">{date}</h3>
                                    <div className="flex items-center gap-2 mt-1">
                                        <div className="h-1.5 w-24 bg-outline-variant/20 rounded-full overflow-hidden">
                                            <div 
                                                className="h-full bg-primary transition-all duration-1000" 
                                                style={{ width: `${(submittedCount / totalMembers) * 100}%` }}
                                            />
                                        </div>
                                        <p className="text-[10px] font-black uppercase tracking-widest text-primary">
                                            {submittedCount}/{totalMembers} Hoàn thành
                                        </p>
                                    </div>
                                </div>
                            </div>
                            <span className={`material-symbols-outlined text-on-surface-variant transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>
                                expand_more
                            </span>
                        </button>

                        {/* Logs List */}
                        {isExpanded && (
                            <div className="p-6 pt-2 space-y-6">
                                {logs.map((log) => (
                                    <div key={log.id} className="relative pl-8 group/item">
                                        {/* Timeline Line */}
                                        <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-outline-variant/10 group-last/item:bottom-auto group-last/item:h-8" />
                                        <div className="absolute left-[7px] top-8 w-2.5 h-2.5 rounded-full bg-primary border-4 border-surface shadow-sm" />

                                        <div className="bg-surface-container-low/30 rounded-[20px] md:rounded-3xl p-4 md:p-6 border border-outline-variant/5 group-hover/item:border-primary/20 transition-all">
                                            <div className="flex items-center justify-between mb-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-primary-container flex items-center justify-center text-on-primary font-bold text-xs ring-4 ring-surface shrink-0">
                                                        {log.user.fullName?.[0] || log.user.email[0].toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-on-surface text-sm">{log.user.fullName || log.user.email}</p>
                                                        <p className="text-[10px] text-on-surface-variant font-medium opacity-60">Lúc {formatDate(log.date)}</p>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-4">
                                                <div className="space-y-1">
                                                    <p className="text-[9px] font-black text-primary uppercase tracking-widest mb-2 opacity-70">Yesterday</p>
                                                    <div className="bg-white/50 rounded-xl p-3 text-sm text-on-surface/80 leading-relaxed italic border border-outline-variant/5 min-h-[60px]">
                                                        {log.yesterday}
                                                    </div>
                                                </div>
                                                <div className="space-y-1">
                                                    <p className="text-[9px] font-black text-primary uppercase tracking-widest mb-2 opacity-70">Today</p>
                                                    <div className="bg-white/80 rounded-xl p-3 text-sm text-on-surface/90 font-medium leading-relaxed border border-primary/5 min-h-[60px]">
                                                        {log.today}
                                                    </div>
                                                </div>
                                                <div className="space-y-1">
                                                    <p className="text-[9px] font-black text-error uppercase tracking-widest mb-2 opacity-70">Blockers</p>
                                                    <div className={`rounded-xl p-3 text-sm leading-relaxed border min-h-[60px] ${log.blockers ? 'bg-error-container/10 text-error border-error/10 font-bold' : 'bg-success-container/5 text-success/40 border-success/5 italic text-xs'}`}>
                                                        {log.blockers || "Không có vật cản nào."}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}

                                {/* Missing Members Section */}
                                {members.filter(m => !logs.some(l => l.userId === m.userId)).length > 0 && (
                                    <div className="mt-8 pt-6 border-t border-outline-variant/10">
                                        <p className="text-[10px] font-black text-on-surface-variant/40 uppercase tracking-widest mb-4 flex items-center gap-2">
                                            <span className="material-symbols-outlined text-sm">notifications_active</span>
                                            Chưa ghi Stand-up ({members.filter(m => !logs.some(l => l.userId === m.userId)).length})
                                        </p>
                                        <div className="flex flex-wrap gap-2">
                                            {members.filter(m => !logs.some(l => l.userId === m.userId)).map(member => (
                                                <div key={member.userId} className="flex items-center gap-2 px-3 py-1.5 bg-surface-container rounded-full border border-outline-variant/5">
                                                    <div className="w-5 h-5 rounded-full bg-on-surface-variant/10 flex items-center justify-center text-[10px] font-bold text-on-surface-variant">
                                                        {member.user.fullName?.charAt(0) || 'U'}
                                                    </div>
                                                    <span className="text-xs text-on-surface-variant font-medium">{member.user.fullName}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
