import React, { useState, useEffect } from 'react';
import { getDailyDigest } from '../services/standupService';

/**
 * DailyDigestBoard - "Bản tin hôm nay" (Daily Digest / Team Standup Board)
 * Giúp toàn bộ thành viên và Scrum Master xem tất cả báo cáo Daily trong ngày trên 1 trang duy nhất:
 * - Date Picker chọn ngày xem (mặc định hôm nay, hỗ trợ tiến/lùi ngày)
 * - Thanh thống kê tóm tắt: Đã gửi X/Y thành viên, Đang kẹt Z người, Chỉ số tâm trạng nhóm
 * - Nút gạt / Filter "Chỉ đang kẹt" (AC2) kèm Positive Empty State
 * - Lưới thẻ Card Grid 2-3 cột bao quát cả nhóm trên 1 trang (AC1)
 * - Hiển thị Tên, Avatar, Mood, 3 câu trả lời, Badge Đang kẹt & Blocker Note
 */
export default function DailyDigestBoard({
    projectId,
    sprintId,
    sprintName = '',
    userRole = 'MEMBER',
    members = [],
    className = ''
}) {
    // Ngày mặc định: Hôm nay (YYYY-MM-DD theo giờ địa phương)
    const getTodayStr = () => {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const [selectedDate, setSelectedDate] = useState(getTodayStr());
    const [onlyBlocked, setOnlyBlocked] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);
    const [digestData, setDigestData] = useState({
        summary: { totalMembers: 0, submittedCount: 0, blockedCount: 0 },
        items: []
    });

    useEffect(() => {
        if (sprintId && projectId) {
            fetchDigest();
        }
    }, [projectId, sprintId, selectedDate, onlyBlocked]);

    const fetchDigest = async () => {
        setLoading(true);
        try {
            const data = await getDailyDigest(projectId, sprintId, selectedDate, onlyBlocked);
            setDigestData(data || { summary: { totalMembers: 0, submittedCount: 0, blockedCount: 0 }, items: [] });
        } catch (err) {
            console.error('Lỗi tải Daily Digest:', err);
        } finally {
            setLoading(false);
        }
    };

    // Điều hướng ngày: Lùi 1 ngày / Tiến 1 ngày / Về hôm nay
    const handleShiftDate = (days) => {
        const current = new Date(`${selectedDate}T00:00:00`);
        current.setDate(current.getDate() + days);
        const y = current.getFullYear();
        const m = String(current.getMonth() + 1).padStart(2, '0');
        const d = String(current.getDate()).padStart(2, '0');
        setSelectedDate(`${y}-${m}-${d}`);
    };

    const isToday = selectedDate === getTodayStr();

    const formatDateHeading = (dateStr) => {
        const d = new Date(`${dateStr}T00:00:00`);
        return d.toLocaleDateString('vi-VN', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
    };

    const formatSubmitTime = (dateStr) => {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    };

    // Map cảm xúc ra biểu tượng và nhãn
    const MOOD_MAP = {
        HAPPY: {
            emoji: '😄',
            label: 'Vui vẻ',
            desc: 'Năng suất cao',
            badgeBg: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/25'
        },
        NORMAL: {
            emoji: '😐',
            label: 'Bình thường',
            desc: 'Ổn định',
            badgeBg: 'bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/25'
        },
        TIRED: {
            emoji: '😫',
            label: 'Mệt mỏi',
            desc: 'Cần nghỉ ngơi',
            badgeBg: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/25'
        },
        STRESSED: {
            emoji: '🤯',
            label: 'Quá tải',
            desc: 'Cần hỗ trợ',
            badgeBg: 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/25'
        }
    };

    const summary = digestData.summary || { totalMembers: 0, submittedCount: 0, blockedCount: 0 };
    const items = digestData.items || [];

    // Tìm những thành viên chưa gửi bài hôm nay
    const submittedUserIds = new Set(items.map(i => i.userId));
    const unsubmittedMembers = members.filter(m => !submittedUserIds.has(m.userId));

    // Thống kê tâm trạng
    const moodCounts = items.reduce((acc, it) => {
        const m = it.mood || 'NORMAL';
        acc[m] = (acc[m] || 0) + 1;
        return acc;
    }, {});

    // Lọc theo từ khóa tìm kiếm (tên thành viên hoặc nội dung)
    const filteredItems = items.filter(it => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        const name = (it.user?.fullName || '').toLowerCase();
        const y = (it.yesterdayWork || '').toLowerCase();
        const t = (it.todayPlan || '').toLowerCase();
        const b = (it.blockers || '').toLowerCase();
        const bn = (it.blockerNote || '').toLowerCase();
        return name.includes(q) || y.includes(q) || t.includes(q) || b.includes(q) || bn.includes(q);
    });

    return (
        <div className={`space-y-6 ${className}`}>
            {/* ======================================================== */}
            {/* THANH CÔNG CỤ ĐIỀU KHIỂN & CHỌN NGÀY                    */}
            {/* ======================================================== */}
            <div className="bg-surface-container rounded-3xl p-5 md:p-6 border border-outline-variant/15 shadow-sm space-y-4">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* Tiêu đề & Sprint */}
                    <div>
                        <div className="flex items-center gap-2.5">
                            <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-bold">
                                <span className="material-symbols-outlined text-2xl">newspaper</span>
                            </div>
                            <div>
                                <h2 className="text-xl md:text-2xl font-black text-on-surface tracking-tight flex items-center gap-2">
                                    Bản tin hôm nay
                                    {sprintName && (
                                        <span className="text-xs px-2.5 py-0.5 rounded-full bg-primary/10 text-primary font-bold uppercase tracking-wider">
                                            {sprintName}
                                        </span>
                                    )}
                                </h2>
                                <p className="text-xs text-on-surface-variant font-medium capitalize mt-0.5">
                                    {formatDateHeading(selectedDate)}
                                    {isToday && (
                                        <span className="ml-2 px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-bold text-[10px]">
                                            • Hôm nay
                                        </span>
                                    )}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Bộ điều hướng ngày (Date Picker & Navigation) */}
                    <div className="flex items-center gap-2 flex-wrap">
                        <div className="flex items-center bg-surface-container-high rounded-2xl p-1 border border-outline-variant/10 shadow-inner">
                            <button
                                type="button"
                                onClick={() => handleShiftDate(-1)}
                                title="Ngày hôm trước"
                                className="w-9 h-9 rounded-xl flex items-center justify-center text-on-surface-variant hover:bg-surface-container-highest transition-colors cursor-pointer"
                            >
                                <span className="material-symbols-outlined text-lg">chevron_left</span>
                            </button>

                            <input
                                type="date"
                                value={selectedDate}
                                onChange={(e) => setSelectedDate(e.target.value)}
                                className="bg-transparent border-none text-xs md:text-sm font-bold text-on-surface px-2 outline-none cursor-pointer"
                            />

                            <button
                                type="button"
                                onClick={() => handleShiftDate(1)}
                                title="Ngày tiếp theo"
                                className="w-9 h-9 rounded-xl flex items-center justify-center text-on-surface-variant hover:bg-surface-container-highest transition-colors cursor-pointer"
                            >
                                <span className="material-symbols-outlined text-lg">chevron_right</span>
                            </button>
                        </div>

                        {!isToday && (
                            <button
                                type="button"
                                onClick={() => setSelectedDate(getTodayStr())}
                                className="px-3.5 py-2 rounded-xl bg-surface-container-high hover:bg-surface-container-highest text-primary font-bold text-xs transition-all border border-outline-variant/10 cursor-pointer"
                            >
                                Hôm nay
                            </button>
                        )}

                        <button
                            type="button"
                            onClick={fetchDigest}
                            disabled={loading}
                            title="Làm mới dữ liệu"
                            className="w-10 h-10 rounded-2xl bg-surface-container-high hover:bg-surface-container-highest text-on-surface-variant flex items-center justify-center transition-all border border-outline-variant/10 cursor-pointer disabled:opacity-50"
                        >
                            <span className={`material-symbols-outlined text-lg ${loading ? 'animate-spin' : ''}`}>
                                refresh
                            </span>
                        </button>
                    </div>
                </div>

                {/* ======================================================== */}
                {/* DÒNG THỐNG KÊ NHANH (SUMMARY STATS & MOOD BREAKDOWN)    */}
                {/* ======================================================== */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-outline-variant/10">
                    {/* 1. Sĩ số đã nộp */}
                    <div className="p-3.5 rounded-2xl bg-surface-container-lowest border border-outline-variant/10 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                            <span className="material-symbols-outlined text-xl">group</span>
                        </div>
                        <div className="min-w-0">
                            <p className="text-[10px] font-black uppercase tracking-wider text-on-surface-variant opacity-70 truncate">
                                Đã gửi Daily
                            </p>
                            <p className="text-base font-black text-on-surface truncate">
                                {summary.submittedCount} / {summary.totalMembers || members.length || 0}
                                <span className="ml-1 text-xs font-normal text-on-surface-variant">
                                    ({summary.totalMembers > 0 ? Math.round((summary.submittedCount / summary.totalMembers) * 100) : 0}%)
                                </span>
                            </p>
                        </div>
                    </div>

                    {/* 2. Cảnh báo Đang kẹt */}
                    <div className={`p-3.5 rounded-2xl border flex items-center gap-3 transition-colors ${
                        summary.blockedCount > 0 
                            ? 'bg-red-500/10 border-red-500/30' 
                            : 'bg-emerald-500/10 border-emerald-500/25'
                    }`}>
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                            summary.blockedCount > 0 ? 'bg-red-600 text-white animate-pulse' : 'bg-emerald-600 text-white'
                        }`}>
                            <span className="material-symbols-outlined text-xl">
                                {summary.blockedCount > 0 ? 'report' : 'verified'}
                            </span>
                        </div>
                        <div className="min-w-0">
                            <p className={`text-[10px] font-black uppercase tracking-wider truncate ${
                                summary.blockedCount > 0 ? 'text-red-700 dark:text-red-300' : 'text-emerald-700 dark:text-emerald-300'
                            }`}>
                                Đang kẹt
                            </p>
                            <p className={`text-base font-black truncate ${
                                summary.blockedCount > 0 ? 'text-red-900 dark:text-red-100' : 'text-emerald-900 dark:text-emerald-100'
                            }`}>
                                {summary.blockedCount > 0 ? `${summary.blockedCount} người kẹt` : 'Không có ai kẹt'}
                            </p>
                        </div>
                    </div>

                    {/* 3. Chỉ số năng lượng / Tâm trạng */}
                    <div className="p-3.5 rounded-2xl bg-surface-container-lowest border border-outline-variant/10 flex items-center gap-3 col-span-2 sm:col-span-2">
                        <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
                            <span className="material-symbols-outlined text-xl">sentiment_satisfied</span>
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="text-[10px] font-black uppercase tracking-wider text-on-surface-variant opacity-70 mb-1">
                                Cảm xúc nhóm
                            </p>
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-bold text-on-surface flex items-center gap-1">
                                    😄 {moodCounts.HAPPY || 0}
                                </span>
                                <span className="text-xs font-bold text-on-surface flex items-center gap-1">
                                    😐 {moodCounts.NORMAL || 0}
                                </span>
                                <span className="text-xs font-bold text-on-surface flex items-center gap-1">
                                    😫 {moodCounts.TIRED || 0}
                                </span>
                                <span className="text-xs font-bold text-on-surface flex items-center gap-1">
                                    🤯 {moodCounts.STRESSED || 0}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ======================================================== */}
                {/* THANH BỘ LỌC NHANH: CHỈ ĐANG KẸT (AC2) & TÌM KIẾM        */}
                {/* ======================================================== */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                    <div className="flex items-center gap-2">
                        {/* Nút lọc "Chỉ đang kẹt" (AC2) */}
                        <button
                            type="button"
                            onClick={() => setOnlyBlocked(!onlyBlocked)}
                            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all border cursor-pointer ${
                                onlyBlocked
                                    ? 'bg-red-600 text-white border-red-600 shadow-md shadow-red-500/25 ring-2 ring-red-400/30'
                                    : 'bg-surface-container-high border-outline-variant/15 text-on-surface-variant hover:bg-surface-container-highest'
                            }`}
                        >
                            <span className="material-symbols-outlined text-base">
                                {onlyBlocked ? 'crisis_alert' : 'filter_alt'}
                            </span>
                            <span>Chỉ xem người đang kẹt</span>
                            {summary.blockedCount > 0 && (
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                                    onlyBlocked ? 'bg-white text-red-600' : 'bg-red-600 text-white'
                                }`}>
                                    {summary.blockedCount}
                                </span>
                            )}
                        </button>

                        {onlyBlocked && (
                            <button
                                type="button"
                                onClick={() => setOnlyBlocked(false)}
                                className="text-xs text-on-surface-variant hover:text-on-surface font-semibold underline underline-offset-4 cursor-pointer"
                            >
                                Hiển thị tất cả
                            </button>
                        )}
                    </div>

                    {/* Ô tìm kiếm nhanh theo thành viên hoặc công việc */}
                    <div className="relative max-w-xs w-full">
                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-sm text-on-surface-variant/60">
                            search
                        </span>
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Tìm theo tên, task..."
                            className="w-full bg-surface-container-high border border-outline-variant/15 rounded-xl pl-9 pr-8 py-2 text-xs font-medium text-on-surface outline-none focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-on-surface-variant/40"
                        />
                        {searchQuery && (
                            <button
                                type="button"
                                onClick={() => setSearchQuery('')}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant/60 hover:text-on-surface"
                            >
                                <span className="material-symbols-outlined text-sm">close</span>
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* ======================================================== */}
            {/* DANH SÁCH THẺ DAILY DẠNG SINGLE-PAGE GRID (AC1)          */}
            {/* ======================================================== */}
            {loading ? (
                <div className="py-20 flex flex-col items-center justify-center text-on-surface-variant/50">
                    <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin mb-3" />
                    <p className="text-sm font-medium">Đang tải bản tin tổng hợp...</p>
                </div>
            ) : onlyBlocked && filteredItems.length === 0 ? (
                /* ======================================================== */
                /* POSITIVE EMPTY STATE KHI BẬT ONLY BLOCKED (AC2)          */
                /* ======================================================== */
                <div className="bg-emerald-500/5 border-2 border-dashed border-emerald-500/20 rounded-[32px] p-12 text-center max-w-xl mx-auto my-6 animate-in fade-in duration-500">
                    <div className="w-20 h-20 rounded-3xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center mx-auto mb-4 shadow-inner">
                        <span className="material-symbols-outlined text-5xl">celebration</span>
                    </div>
                    <h3 className="text-xl font-black text-emerald-950 dark:text-emerald-200 mb-2">
                        Tuyệt vời! Không có ai đang kẹt
                    </h3>
                    <p className="text-sm text-emerald-900/70 dark:text-emerald-300/70 leading-relaxed">
                        Tất cả các thành viên trong Sprint đều đang tiến hành công việc thuận lợi và không gặp bất kỳ trở ngại nào trong ngày này.
                    </p>
                    <button
                        type="button"
                        onClick={() => setOnlyBlocked(false)}
                        className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
                    >
                        <span className="material-symbols-outlined text-sm">view_agenda</span>
                        Xem toàn bộ báo cáo Daily
                    </button>
                </div>
            ) : filteredItems.length === 0 ? (
                /* EMPTY STATE KHI CHƯA CÓ AI NỘP */
                <div className="bg-surface-container-low/40 border-2 border-dashed border-outline-variant/20 rounded-[32px] p-12 text-center max-w-xl mx-auto my-6 text-on-surface-variant">
                    <div className="w-16 h-16 rounded-2xl bg-surface-container-highest flex items-center justify-center mx-auto mb-3 text-on-surface-variant/50">
                        <span className="material-symbols-outlined text-3xl">event_busy</span>
                    </div>
                    <h3 className="text-lg font-bold text-on-surface mb-1">
                        Chưa có báo cáo Daily nào cho ngày này
                    </h3>
                    <p className="text-xs text-on-surface-variant/70">
                        Các thành viên trong nhóm chưa gửi Stand-up cho ngày {formatDateHeading(selectedDate)}.
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 animate-in fade-in duration-500">
                    {filteredItems.map((item) => {
                        const moodInfo = MOOD_MAP[item.mood] || MOOD_MAP.NORMAL;
                        const isBlocked = Boolean(item.blocked);
                        const isResolved = item.blockerStatus === 'CLOSED';

                        return (
                            <div
                                key={item.id}
                                className={`rounded-[28px] p-5 md:p-6 transition-all duration-300 flex flex-col justify-between shadow-sm hover:shadow-md border relative overflow-hidden ${
                                    isBlocked
                                        ? isResolved
                                            ? 'bg-emerald-500/5 border-emerald-500/25 hover:border-emerald-500/40'
                                            : 'bg-red-500/5 border-2 border-red-500/40 hover:border-red-500/60 shadow-red-500/5'
                                        : 'bg-surface-container-lowest border-outline-variant/15 hover:border-primary/20'
                                }`}
                            >
                                {/* Header Card: User Info & Mood & Blocked Badge */}
                                <div>
                                    <div className="flex items-start justify-between gap-3 mb-4">
                                        <div className="flex items-center gap-3 min-w-0">
                                            {/* Avatar */}
                                            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-primary to-primary-container flex items-center justify-center text-on-primary font-black text-sm ring-4 ring-surface shrink-0 shadow-sm">
                                                {item.user?.avatar ? (
                                                    <img src={item.user.avatar} alt="" className="w-full h-full rounded-2xl object-cover" />
                                                ) : (
                                                    item.user?.fullName?.[0]?.toUpperCase() || 'U'
                                                )}
                                            </div>
                                            <div className="min-w-0">
                                                <h4 className="text-sm md:text-base font-black text-on-surface truncate leading-tight">
                                                    {item.user?.fullName || 'Thành viên'}
                                                </h4>
                                                <p className="text-[11px] text-on-surface-variant/70 font-medium truncate mt-0.5">
                                                    Nộp lúc {formatSubmitTime(item.createdAt)}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Mood Icon Badge */}
                                        <div
                                            className={`px-2.5 py-1 rounded-xl text-xs font-bold border flex items-center gap-1.5 shrink-0 ${moodInfo.badgeBg}`}
                                            title={`Tâm trạng: ${moodInfo.label} (${moodInfo.desc})`}
                                        >
                                            <span className="text-base leading-none">{moodInfo.emoji}</span>
                                            <span className="text-[11px] font-black">{moodInfo.label}</span>
                                        </div>
                                    </div>

                                    {/* BADGE CẢNH BÁO ĐANG KẸT / ĐÃ GỠ (AC1) */}
                                    {isBlocked && (
                                        <div className="mb-4">
                                            {isResolved ? (
                                                <div className="p-3 bg-emerald-500/10 border border-emerald-500/25 rounded-2xl">
                                                    <div className="flex items-center justify-between gap-2 flex-wrap text-emerald-800 dark:text-emerald-300">
                                                        <span className="text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
                                                            <span className="material-symbols-outlined text-xs">task_alt</span>
                                                            ĐÃ GỠ BLOCKER
                                                        </span>
                                                        {item.resolver && (
                                                            <span className="text-[10px] opacity-80">
                                                                Bởi {item.resolver.fullName || 'Scrum Master'}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-xs font-bold text-emerald-950 dark:text-emerald-100 mt-1 leading-snug">
                                                        {item.blockerNote}
                                                    </p>
                                                </div>
                                            ) : (
                                                <div className="p-3.5 bg-red-500/10 border border-red-500/30 rounded-2xl">
                                                    <div className="flex items-center gap-1.5 text-red-700 dark:text-red-400 text-[10px] font-black uppercase tracking-wider mb-1">
                                                        <span className="material-symbols-outlined text-xs text-red-600 animate-pulse">emergency</span>
                                                        <span>🚨 ĐANG KẸT (CẦN HỖ TRỢ):</span>
                                                    </div>
                                                    <p className="text-xs font-black text-red-950 dark:text-red-100 leading-relaxed">
                                                        {item.blockerNote || '(Chưa ghi chi tiết lý do)'}
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* ==================================================== */}
                                    {/* 3 CÂU TRẢ LỜI DAILY (AC1)                           */}
                                    {/* ==================================================== */}
                                    <div className="space-y-3.5 text-xs">
                                        {/* 1. Hôm qua */}
                                        <div className="space-y-1">
                                            <p className="text-[10px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                                                <span className="material-symbols-outlined text-xs">history</span>
                                                Hôm qua đã làm gì
                                            </p>
                                            <div className="bg-surface-container-low/50 rounded-xl p-3 text-on-surface/90 leading-relaxed font-medium border border-outline-variant/10 min-h-[48px]">
                                                {item.yesterdayWork || '(Không có nội dung)'}
                                            </div>
                                        </div>

                                        {/* 2. Hôm nay */}
                                        <div className="space-y-1">
                                            <p className="text-[10px] font-black uppercase tracking-wider text-primary flex items-center gap-1">
                                                <span className="material-symbols-outlined text-xs">today</span>
                                                Hôm nay sẽ làm gì
                                            </p>
                                            <div className="bg-surface-container-low/50 rounded-xl p-3 text-on-surface/90 leading-relaxed font-semibold border border-primary/10 min-h-[48px]">
                                                {item.todayPlan || '(Không có nội dung)'}
                                            </div>
                                        </div>

                                        {/* 3. Vướng mắc */}
                                        <div className="space-y-1">
                                            <p className={`text-[10px] font-black uppercase tracking-wider flex items-center gap-1 ${
                                                item.blockers && !item.blockers.toLowerCase().includes('không')
                                                    ? 'text-error'
                                                    : 'text-on-surface-variant/70'
                                            }`}>
                                                <span className="material-symbols-outlined text-xs">block</span>
                                                Vướng mắc gặp phải
                                            </p>
                                            <div className={`rounded-xl p-3 leading-relaxed border min-h-[42px] ${
                                                item.blockers && !item.blockers.toLowerCase().includes('không')
                                                    ? 'bg-error-container/10 text-error border-error/15 font-bold'
                                                    : 'bg-surface-container-low/30 text-on-surface-variant/70 border-outline-variant/10 italic text-[11px]'
                                            }`}>
                                                {item.blockers || 'Không có vướng mắc nào.'}
                                            </div>
                                        </div>

                                        {/* Bonus UX: Câu hỏi phụ vui nhộn (Fun Icebreaker Prompt) */}
                                        {item.funPromptAnswer && (
                                            <div className="mt-2 p-3 rounded-2xl bg-violet-500/8 border border-dashed border-violet-400/35 text-xs">
                                                <p className="text-[10px] font-bold text-violet-700 dark:text-violet-300 flex items-center gap-1 mb-1">
                                                    <span>✨</span>
                                                    <span>{item.funPromptQuestion || 'Góc vui vẻ hôm nay'}</span>
                                                </p>
                                                <p className="text-on-surface/90 italic font-medium leading-relaxed">
                                                    “{item.funPromptAnswer}”
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Footer Card: Relative date */}
                                <div className="mt-4 pt-3 border-t border-outline-variant/10 flex items-center justify-between text-[10px] text-on-surface-variant/60 font-semibold">
                                    <span>Bản ghi Daily Standup</span>
                                    <span>{item.reportDate}</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* ======================================================== */}
            {/* THÀNH VIÊN CHƯA NỘP (DÀNH CHO SM ĐIỂM DANH)              */}
            {/* ======================================================== */}
            {unsubmittedMembers.length > 0 && (
                <div className="bg-surface-container-low/40 rounded-3xl p-5 md:p-6 border border-outline-variant/10 mt-8">
                    <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-amber-500 text-lg">notifications_active</span>
                            <h4 className="text-xs font-black uppercase tracking-wider text-on-surface-variant">
                                Chưa gửi Stand-up ({unsubmittedMembers.length} thành viên)
                            </h4>
                        </div>
                        <p className="text-[11px] text-on-surface-variant/60">
                            Scrum Master có thể nhắc nhở trong buổi họp
                        </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        {unsubmittedMembers.map(m => (
                            <div
                                key={m.userId}
                                className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-surface-container border border-outline-variant/15 shadow-sm"
                            >
                                <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold">
                                    {m.user?.fullName?.[0]?.toUpperCase() || 'U'}
                                </div>
                                <span className="text-xs font-bold text-on-surface">
                                    {m.user?.fullName || m.user?.email || 'Thành viên'}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
