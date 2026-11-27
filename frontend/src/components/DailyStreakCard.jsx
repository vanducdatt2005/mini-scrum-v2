import React from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * DailyStreakCard - Hiển thị chuỗi ngày gửi Daily liên tiếp trong Sprint (Sprint Daily Streak)
 * Hỗ trợ 2 chế độ hiển thị:
 * - variant="card": Card đầy đủ dùng cho trang Profile / Settings / Dashboard
 * - variant="compact": Banner gọn dùng cho trang Daily Standup
 */
export default function DailyStreakCard({
    streak,
    loading = false,
    variant = 'card',
    showAction = true,
    className = ''
}) {
    const navigate = useNavigate();

    if (loading) {
        return (
            <div className={`rounded-3xl bg-surface-container-low border border-outline-variant/15 p-5 animate-pulse ${className}`}>
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-surface-container-highest" />
                    <div className="space-y-2 flex-1">
                        <div className="h-4 w-40 bg-surface-container-highest rounded" />
                        <div className="h-3 w-56 bg-surface-container-highest rounded" />
                    </div>
                </div>
            </div>
        );
    }

    if (!streak) return null;

    const current = streak.currentStreak || 0;
    const longest = streak.longestStreakInSprint || 0;
    const hasToday = Boolean(streak.hasSubmittedToday);
    const hasActiveSprint = Boolean(streak.sprintId);
    const disclaimer = streak.disclaimer || 'Chỉ để vui — không tính điểm';

    // Chế độ gọn trên trang StandupPage
    if (variant === 'compact') {
        return (
            <div
                className={`rounded-2xl px-4 py-3 border flex flex-wrap items-center justify-between gap-3 transition-all ${
                    current > 0
                        ? 'bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-rose-500/5 border-amber-500/30'
                        : 'bg-surface-container-low border-outline-variant/15'
                } ${className}`}
            >
                <div className="flex items-center gap-3">
                    <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl shadow-sm ${
                            current > 0
                                ? 'bg-gradient-to-br from-amber-500 to-orange-600 text-white'
                                : 'bg-surface-container-highest text-on-surface-variant'
                        }`}
                    >
                        {current > 0 ? '🔥' : '🌱'}
                    </div>
                    <div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-black text-on-surface">
                                Chuỗi Daily: {current} ngày liên tiếp
                            </span>
                            {hasToday ? (
                                <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold">
                                    ✓ Đã giữ chuỗi hôm nay
                                </span>
                            ) : current > 0 ? (
                                <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 text-[10px] font-bold">
                                    Gửi hôm nay để giữ chuỗi!
                                </span>
                            ) : null}
                        </div>
                        <p className="text-[11px] text-on-surface-variant/75 font-medium mt-0.5">
                            Kỷ lục Sprint: <strong className="text-on-surface">{longest} ngày</strong> • {disclaimer}
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    // Chế độ Card đầy đủ trên Profile (Settings) & Dashboard
    return (
        <div
            className={`rounded-3xl p-5 md:p-6 border shadow-sm relative overflow-hidden transition-all ${
                current > 0
                    ? 'bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-surface-container-lowest border-amber-500/30'
                    : 'bg-surface-container-lowest border-outline-variant/15'
            } ${className}`}
        >
            {/* Header: Icon + Title + Số ngày */}
            <div className="flex items-center gap-3.5">
                <div
                    className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shrink-0 shadow-md ${
                        current > 0
                            ? 'bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-orange-500/20'
                            : 'bg-surface-container-high text-on-surface-variant'
                    }`}
                >
                    {current > 0 ? '🔥' : '🌱'}
                </div>

                <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                        <h3 className="text-base font-black text-on-surface tracking-tight leading-snug">
                            Sprint Daily Streak
                        </h3>
                        {streak.sprintName && (
                            <span className="px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-black uppercase tracking-wider whitespace-nowrap shrink-0">
                                {streak.sprintName}
                            </span>
                        )}
                    </div>

                    <div className="flex items-baseline gap-1.5 mt-0.5">
                        <span className="text-2xl font-black text-orange-600 dark:text-amber-400 leading-none">
                            {current}
                        </span>
                        <span className="text-xs font-bold text-on-surface-variant whitespace-nowrap">
                            ngày liên tiếp
                        </span>
                    </div>
                </div>
            </div>

            {/* Status & Record */}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                {hasActiveSprint ? (
                    hasToday ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-xs font-bold border border-emerald-500/25 whitespace-nowrap">
                            <span className="material-symbols-outlined text-sm">check_circle</span>
                            Đã giữ chuỗi hôm nay
                        </span>
                    ) : current > 0 ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 text-amber-800 dark:text-amber-300 text-xs font-bold border border-amber-500/25 whitespace-nowrap">
                            <span className="material-symbols-outlined text-sm">schedule</span>
                            Gửi hôm nay để giữ chuỗi
                        </span>
                    ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-container-high text-on-surface-variant text-xs font-semibold whitespace-nowrap">
                            <span className="material-symbols-outlined text-sm">bolt</span>
                            Gửi Daily để bắt đầu chuỗi
                        </span>
                    )
                ) : (
                    <span className="text-xs text-on-surface-variant/70 italic">
                        Chưa có Sprint đang hoạt động
                    </span>
                )}

                <span className="inline-flex items-center gap-1 text-xs text-on-surface-variant font-medium whitespace-nowrap">
                    🏆 Kỷ lục: <strong className="text-on-surface">{longest} ngày</strong>
                </span>
            </div>

            {/* Footer: Disclaimer + Action */}
            <div className="mt-4 pt-3 border-t border-outline-variant/10 flex flex-wrap items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-on-surface-variant/70 italic">
                    <span className="material-symbols-outlined text-sm text-amber-500">mood</span>
                    {disclaimer}
                </span>

                {showAction && hasActiveSprint && streak.projectId && !hasToday && (
                    <button
                        type="button"
                        onClick={() => navigate(`/projects/${streak.projectId}/standup`)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-primary text-on-primary text-xs font-bold hover:opacity-90 transition-all cursor-pointer shadow-sm whitespace-nowrap"
                    >
                        <span className="material-symbols-outlined text-sm">edit_note</span>
                        Gửi Daily ngay
                    </button>
                )}
            </div>
        </div>
    );
}
