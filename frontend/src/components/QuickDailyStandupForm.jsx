import React, { useState, useEffect, useRef } from 'react';
import { 
    submitSprintDailyStandup, 
    updateSprintDailyStandup, 
    checkSprintTodayStandup 
} from '../services/standupService';

/**
 * QuickDailyStandupForm
 * Tối ưu thao tác điền báo cáo Daily dưới 2 phút & Chỉnh sửa Daily trong cùng ngày:
 * - 3 trường: yesterday_work, today_plan, blockers
 * - Auto-focus ô đầu tiên
 * - Quick chip "Không có vướng mắc" (1 chạm)
 * - Phím tắt Ctrl + Enter / Cmd + Enter gửi nhanh
 * - Validation viền đỏ chi tiết từng ô
 * - Trạng thái "Đã gửi — Sửa" với Badge thời gian & nhãn "Đã chỉnh sửa lúc HH:mm"
 * - Nút "Chỉnh sửa" mở khóa edit cùng ngày, "Cập nhật Daily"
 * - Toast thông báo cập nhật thành công không cần F5
 * - Tự động reset form trống khi sang ngày mới
 */
export default function QuickDailyStandupForm({
    sprintId,
    sprintName = '',
    sprintStatus = 'ACTIVE',
    existingStandup = null,
    onSuccess,
    className = ''
}) {
    // Form fields
    const [yesterdayWork, setYesterdayWork] = useState('');
    const [todayPlan, setTodayPlan] = useState('');
    const [blockers, setBlockers] = useState('');

    // Form states
    const [errors, setErrors] = useState({});
    const [submitting, setSubmitting] = useState(false);
    const [apiError, setApiError] = useState(null);
    const [submittedStandup, setSubmittedStandup] = useState(existingStandup);
    const [isEditing, setIsEditing] = useState(false);
    const [loadingToday, setLoadingToday] = useState(false);
    const [toast, setToast] = useState(null); // { type: 'success' | 'error', message }

    // Ref for auto-focusing the first textarea
    const yesterdayInputRef = useRef(null);

    // Auto-hide toast notification sau 3.5s
    useEffect(() => {
        if (toast) {
            const timer = setTimeout(() => setToast(null), 3500);
            return () => clearTimeout(timer);
        }
    }, [toast]);

    // Tải trạng thái hôm nay khi sprintId thay đổi (AC1 & AC2)
    useEffect(() => {
        if (!sprintId) return;

        let isMounted = true;
        setLoadingToday(true);

        checkSprintTodayStandup(sprintId)
            .then(res => {
                if (!isMounted) return;
                const record = res.standup || res.data || null;
                if (record) {
                    // Đã có Daily hôm nay (AC1)
                    setSubmittedStandup(record);
                    setYesterdayWork(record.yesterdayWork || record.yesterday || '');
                    setTodayPlan(record.todayPlan || record.today || '');
                    setBlockers(record.blockers || '');
                    setIsEditing(false);
                } else {
                    // Chưa gửi hôm nay hoặc đã sang ngày mới (AC2)
                    setSubmittedStandup(null);
                    setYesterdayWork('');
                    setTodayPlan('');
                    setBlockers('');
                    setIsEditing(true);
                }
            })
            .catch(err => {
                console.warn('Lỗi kiểm tra Daily hôm nay:', err);
                if (existingStandup) {
                    setSubmittedStandup(existingStandup);
                    setYesterdayWork(existingStandup.yesterdayWork || existingStandup.yesterday || '');
                    setTodayPlan(existingStandup.todayPlan || existingStandup.today || '');
                    setBlockers(existingStandup.blockers || '');
                }
            })
            .finally(() => {
                if (isMounted) setLoadingToday(false);
            });

        return () => {
            isMounted = false;
        };
    }, [sprintId]);

    // Sync nếu prop existingStandup thay đổi từ bên ngoài
    useEffect(() => {
        if (existingStandup) {
            setSubmittedStandup(existingStandup);
            setYesterdayWork(existingStandup.yesterdayWork || existingStandup.yesterday || '');
            setTodayPlan(existingStandup.todayPlan || existingStandup.today || '');
            setBlockers(existingStandup.blockers || '');
        }
    }, [existingStandup]);

    // Auto-focus vào ô đầu tiên khi mở form nhập liệu
    useEffect(() => {
        if ((!submittedStandup || isEditing) && sprintStatus === 'ACTIVE' && yesterdayInputRef.current) {
            const timer = setTimeout(() => {
                yesterdayInputRef.current?.focus();
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [submittedStandup, isEditing, sprintStatus]);

    // Client-side Validation (AC2)
    const validate = () => {
        const newErrors = {};
        if (!yesterdayWork.trim()) {
            newErrors.yesterday_work = 'Vui lòng nhập công việc đã hoàn thành hôm qua';
        }
        if (!todayPlan.trim()) {
            newErrors.today_plan = 'Vui lòng nhập kế hoạch công việc hôm nay';
        }
        if (!blockers.trim()) {
            newErrors.blockers = "Vui lòng nhập khó khăn/vướng mắc hoặc bấm 'Không có vướng mắc'";
        }
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    // Quick Chip handler: 1 chạm điền "Không có"
    const handleQuickChipNoBlocker = () => {
        setBlockers('Không có');
        if (errors.blockers) {
            setErrors(prev => {
                const next = { ...prev };
                delete next.blockers;
                return next;
            });
        }
    };

    // Mở chế độ chỉnh sửa Daily trong cùng ngày
    const handleStartEdit = () => {
        if (submittedStandup) {
            setYesterdayWork(submittedStandup.yesterdayWork || submittedStandup.yesterday || '');
            setTodayPlan(submittedStandup.todayPlan || submittedStandup.today || '');
            setBlockers(submittedStandup.blockers || '');
        }
        setErrors({});
        setApiError(null);
        setIsEditing(true);
    };

    // Hủy bỏ chỉnh sửa, khôi phục lại dữ liệu ban đầu
    const handleCancelEdit = () => {
        if (submittedStandup) {
            setYesterdayWork(submittedStandup.yesterdayWork || submittedStandup.yesterday || '');
            setTodayPlan(submittedStandup.todayPlan || submittedStandup.today || '');
            setBlockers(submittedStandup.blockers || '');
        }
        setErrors({});
        setApiError(null);
        setIsEditing(false);
    };

    // Submit handler: Tạo mới hoặc Cập nhật trong ngày
    const handleSubmit = async (e) => {
        if (e) e.preventDefault();
        setApiError(null);

        // Validation
        if (!validate()) {
            return;
        }

        if (!sprintId) {
            setApiError('Không tìm thấy thông tin Sprint đang hoạt động.');
            return;
        }

        if (sprintStatus !== 'ACTIVE') {
            setApiError('Chỉ có thể gửi hoặc chỉnh sửa báo cáo Daily cho Sprint đang ở trạng thái ACTIVE.');
            return;
        }

        setSubmitting(true);
        try {
            const payload = {
                yesterday_work: yesterdayWork.trim(),
                today_plan: todayPlan.trim(),
                blockers: blockers.trim()
            };

            let result;
            if (submittedStandup && isEditing) {
                // CHẾ ĐỘ CẬP NHẬT TRONG CÙNG NGÀY (AC1)
                result = await updateSprintDailyStandup(sprintId, submittedStandup.id || 'today', payload);
                setSubmittedStandup(result);
                setIsEditing(false);
                setToast({
                    type: 'success',
                    message: 'Đã cập nhật báo cáo Daily hôm nay thành công!'
                });
            } else {
                // CHẾ ĐỘ TẠO MỚI LẦN ĐẦU
                result = await submitSprintDailyStandup(sprintId, payload);
                setSubmittedStandup(result);
                setIsEditing(false);
                setToast({
                    type: 'success',
                    message: 'Gửi báo cáo Daily hôm nay thành công!'
                });
            }

            setErrors({});

            if (onSuccess) {
                onSuccess(result);
            }
        } catch (err) {
            console.error('Lỗi khi gửi/sửa Daily Standup:', err);
            const status = err.response?.status;
            const resData = err.response?.data;

            if (status === 409) {
                setApiError(resData?.error || 'Bạn đã gửi báo cáo Daily cho ngày hôm nay rồi.');
                if (resData?.standup) {
                    setSubmittedStandup(resData.standup);
                    setIsEditing(false);
                }
            } else if (status === 403) {
                setApiError(resData?.error || 'Chỉ được phép chỉnh sửa báo cáo Daily trong cùng ngày.');
            } else if (status === 400 && resData?.details) {
                setErrors(resData.details);
                setApiError(resData?.error || 'Dữ liệu không hợp lệ. Vui lòng kiểm tra lại các trường.');
            } else {
                setApiError(resData?.error || 'Có lỗi xảy ra khi lưu báo cáo Daily. Vui lòng thử lại.');
            }
        } finally {
            setSubmitting(false);
        }
    };

    // Phím tắt Ctrl + Enter (hoặc Cmd + Enter) để submit nhanh
    const handleKeyDown = (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            handleSubmit();
        }
    };

    // Format thời gian hiển thị
    const formatTime = (dateInput) => {
        if (!dateInput) return '';
        const d = new Date(dateInput);
        if (isNaN(d.getTime())) return '';
        return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) + 
               ' ngày ' + d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
    };

    // Format giờ chỉnh sửa HH:mm
    const formatHourMinute = (dateInput) => {
        if (!dateInput) return '';
        const d = new Date(dateInput);
        if (isNaN(d.getTime())) return '';
        return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    };

    // Kiểm tra bản ghi đã từng được chỉnh sửa chưa (updated_at > created_at)
    const checkIsEdited = (created, updated) => {
        if (!created || !updated) return false;
        const cTime = new Date(created).getTime();
        const uTime = new Date(updated).getTime();
        return uTime - cTime > 1000; // chênh lệch trên 1 giây
    };

    // ========================================================
    // LOADING STATE
    // ========================================================
    if (loadingToday && !submittedStandup) {
        return (
            <div className={`bg-surface-container rounded-[28px] md:rounded-[36px] p-10 border border-outline-variant/15 flex flex-col items-center justify-center min-h-[300px] ${className}`}>
                <div className="w-10 h-10 border-3 border-primary/20 border-t-primary rounded-full animate-spin mb-4" />
                <p className="text-xs font-bold text-on-surface-variant/70 uppercase tracking-wider">
                    Đang kiểm tra trạng thái Daily hôm nay...
                </p>
            </div>
        );
    }

    // ========================================================
    // KIỂM TRA SPRINT ACTIVE
    // ========================================================
    if (sprintStatus && sprintStatus !== 'ACTIVE') {
        return (
            <div className={`bg-amber-500/10 border border-amber-500/20 rounded-[28px] p-6 md:p-8 text-center ${className}`}>
                <div className="w-14 h-14 bg-amber-500/20 text-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <span className="material-symbols-outlined text-3xl">pause_circle</span>
                </div>
                <h3 className="text-lg font-bold text-amber-900 dark:text-amber-300 mb-1">
                    Sprint hiện không ở trạng thái ACTIVE
                </h3>
                <p className="text-xs md:text-sm text-amber-800/80 dark:text-amber-300/80 max-w-md mx-auto">
                    Báo cáo Daily Standup chỉ mở khi Sprint đang diễn ra (ACTIVE). Vui lòng kích hoạt Sprint để bắt đầu báo cáo.
                </p>
            </div>
        );
    }

    // ========================================================
    // TRƯỜNG HỢP: ĐÃ GỬI BÁO CÁO HÔM NAY (READ-ONLY VIEW & SỬA)
    // ========================================================
    if (submittedStandup && !isEditing) {
        const displayYesterday = submittedStandup.yesterdayWork || submittedStandup.yesterday || '';
        const displayToday = submittedStandup.todayPlan || submittedStandup.today || '';
        const displayBlockers = submittedStandup.blockers || '';
        const hasBlockers = displayBlockers && !displayBlockers.toLowerCase().includes('không');
        const hasEdited = checkIsEdited(submittedStandup.createdAt, submittedStandup.updatedAt);

        return (
            <div className={`bg-surface-container rounded-[28px] md:rounded-[36px] p-6 md:p-8 border border-outline-variant/15 shadow-lg relative overflow-hidden ${className}`}>
                {/* Toast Notification */}
                {toast && (
                    <div className="fixed top-6 right-6 z-[200] flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl bg-emerald-600 text-white animate-in slide-in-from-top-3 duration-300">
                        <span className="material-symbols-outlined text-xl">check_circle</span>
                        <span className="text-sm font-bold">{toast.message}</span>
                        <button onClick={() => setToast(null)} className="ml-2 opacity-70 hover:opacity-100 transition-opacity">
                            <span className="material-symbols-outlined text-lg">close</span>
                        </button>
                    </div>
                )}

                {/* Decorative background glow */}
                <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

                {/* Banner Thông báo trạng thái Đã gửi hôm nay */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 md:p-5 bg-emerald-500/10 border border-emerald-500/25 rounded-2xl md:rounded-3xl mb-6">
                    <div className="flex items-center gap-3 md:gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-emerald-500/20">
                            <span className="material-symbols-outlined text-2xl font-bold">check_circle</span>
                        </div>
                        <div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="text-base md:text-lg font-black text-emerald-950 dark:text-emerald-300">
                                    Đã gửi hôm nay
                                </h3>
                                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-800 dark:text-emerald-200 text-[10px] font-black uppercase tracking-wider">
                                    Same-Day Verified
                                </span>
                            </div>
                            <p className="text-xs text-emerald-900/70 dark:text-emerald-300/70 font-medium mt-0.5">
                                Gửi lúc {formatTime(submittedStandup.createdAt || submittedStandup.date || submittedStandup.reportDate)}
                                {hasEdited && (
                                    <span className="ml-2 inline-flex items-center gap-1 font-bold text-emerald-700 dark:text-emerald-300">
                                        • (Đã chỉnh sửa lúc {formatHourMinute(submittedStandup.updatedAt)})
                                    </span>
                                )}
                            </p>
                        </div>
                    </div>

                    {/* NÚT CHỈNH SỬA (Mở khóa sửa cùng ngày) */}
                    <button
                        type="button"
                        onClick={handleStartEdit}
                        className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-surface-container-lowest hover:bg-white text-primary border border-primary/25 rounded-xl font-bold text-xs shadow-sm hover:shadow transition-all active:scale-95 shrink-0 cursor-pointer"
                    >
                        <span className="material-symbols-outlined text-base">edit</span>
                        <span>Chỉnh sửa</span>
                    </button>
                </div>

                {/* Nội dung báo cáo đã gửi (Read-only) */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between pb-2 border-b border-outline-variant/10 text-xs text-on-surface-variant font-medium">
                        <span className="flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-sm">schedule</span>
                            Cập nhật gần nhất: {formatTime(submittedStandup.updatedAt || submittedStandup.createdAt)}
                        </span>
                        {hasEdited && (
                            <span className="px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-wider">
                                Đã sửa trong ngày
                            </span>
                        )}
                    </div>

                    {/* 1. Yesterday Work */}
                    <div className="bg-surface-container-low/70 rounded-2xl p-4 md:p-5 border border-outline-variant/10">
                        <div className="flex items-center gap-2 mb-2 text-primary font-bold text-xs uppercase tracking-wider">
                            <span className="material-symbols-outlined text-base">task_alt</span>
                            1. Hôm qua đã hoàn thành:
                        </div>
                        <p className="text-sm text-on-surface whitespace-pre-wrap leading-relaxed pl-6">
                            {displayYesterday || '(Không có nội dung)'}
                        </p>
                    </div>

                    {/* 2. Today Plan */}
                    <div className="bg-surface-container-low/70 rounded-2xl p-4 md:p-5 border border-outline-variant/10">
                        <div className="flex items-center gap-2 mb-2 text-primary font-bold text-xs uppercase tracking-wider">
                            <span className="material-symbols-outlined text-base">flag</span>
                            2. Hôm nay sẽ làm:
                        </div>
                        <p className="text-sm text-on-surface whitespace-pre-wrap leading-relaxed pl-6">
                            {displayToday || '(Không có nội dung)'}
                        </p>
                    </div>

                    {/* 3. Blockers */}
                    <div className={`rounded-2xl p-4 md:p-5 border ${
                        hasBlockers 
                            ? 'bg-error-container/20 border-error/25 text-error-dark' 
                            : 'bg-surface-container-low/70 border-outline-variant/10'
                    }`}>
                        <div className={`flex items-center gap-2 mb-2 font-bold text-xs uppercase tracking-wider ${
                            hasBlockers ? 'text-error' : 'text-on-surface-variant'
                        }`}>
                            <span className="material-symbols-outlined text-base">
                                {hasBlockers ? 'warning' : 'verified'}
                            </span>
                            3. Khó khăn / Vướng mắc:
                        </div>
                        <p className={`text-sm whitespace-pre-wrap leading-relaxed pl-6 ${
                            hasBlockers ? 'text-on-surface font-semibold' : 'text-on-surface-variant/80 italic'
                        }`}>
                            {displayBlockers || 'Không có vướng mắc nào.'}
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    // ========================================================
    // FORM NHẬP LIỆU / CHỈNH SỬA CHÍNH (3 FIELDS)
    // ========================================================
    return (
        <div className={`bg-surface-container rounded-[28px] md:rounded-[36px] p-6 md:p-8 border border-outline-variant/15 shadow-xl shadow-surface-variant/5 relative overflow-hidden ${className}`}>
            {/* Toast Notification */}
            {toast && (
                <div className="fixed top-6 right-6 z-[200] flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl bg-emerald-600 text-white animate-in slide-in-from-top-3 duration-300">
                    <span className="material-symbols-outlined text-xl">check_circle</span>
                    <span className="text-sm font-bold">{toast.message}</span>
                    <button onClick={() => setToast(null)} className="ml-2 opacity-70 hover:opacity-100 transition-opacity">
                        <span className="material-symbols-outlined text-lg">close</span>
                    </button>
                </div>
            )}

            {/* Header Form */}
            <div className="flex items-center justify-between gap-3 mb-6">
                <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        isEditing && submittedStandup ? 'bg-amber-500/10 text-amber-600' : 'bg-primary/10 text-primary'
                    }`}>
                        <span className="material-symbols-outlined text-xl">
                            {isEditing && submittedStandup ? 'edit_note' : 'bolt'}
                        </span>
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-lg md:text-xl font-black text-on-surface tracking-tight">
                                {submittedStandup && isEditing ? 'Chỉnh sửa Daily hôm nay' : 'Gửi Daily Standup nhanh'}
                            </h2>
                            {submittedStandup && isEditing && (
                                <span className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-300 text-[10px] font-bold uppercase tracking-wider">
                                    Chế độ sửa
                                </span>
                            )}
                        </div>
                        <p className="text-xs text-on-surface-variant/70 font-medium">
                            {submittedStandup && isEditing 
                                ? 'Chỉ được phép chỉnh sửa báo cáo trong cùng ngày' 
                                : '3 câu hỏi ngắn gọn • Thao tác hoàn thành dưới 2 phút'}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {submittedStandup && isEditing && (
                        <button
                            type="button"
                            onClick={handleCancelEdit}
                            className="px-3 py-1 text-xs font-bold text-on-surface-variant hover:bg-surface-container-high rounded-lg transition-colors cursor-pointer"
                        >
                            Hủy bỏ
                        </button>
                    )}
                    {sprintName && (
                        <span className="px-3 py-1 bg-primary/10 text-primary rounded-full text-[11px] font-black uppercase tracking-wider shrink-0">
                            {sprintName}
                        </span>
                    )}
                </div>
            </div>

            {/* API Error Alert */}
            {apiError && (
                <div className="mb-5 p-4 bg-error-container/30 border border-error/30 rounded-2xl flex items-start gap-3 animate-in fade-in duration-200">
                    <span className="material-symbols-outlined text-error text-xl shrink-0 mt-0.5">error</span>
                    <div className="text-xs md:text-sm text-error font-medium">
                        {apiError}
                    </div>
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
                {/* TRƯỜNG 1: Hôm qua đã hoàn thành việc gì? */}
                <div>
                    <label 
                        htmlFor="yesterday_work"
                        className="block text-xs font-black text-on-surface-variant uppercase tracking-wider mb-2 ml-1"
                    >
                        1. Hôm qua bạn đã hoàn thành việc gì? <span className="text-error font-bold">*</span>
                    </label>
                    <textarea
                        ref={yesterdayInputRef}
                        id="yesterday_work"
                        rows={3}
                        value={yesterdayWork}
                        onChange={(e) => {
                            setYesterdayWork(e.target.value);
                            if (errors.yesterday_work) {
                                setErrors(prev => ({ ...prev, yesterday_work: null }));
                            }
                        }}
                        onKeyDown={handleKeyDown}
                        placeholder="Ví dụ: Đã hoàn thành API phân quyền và viết tài liệu REST endpoints..."
                        className={`w-full bg-surface-container-lowest border rounded-2xl p-4 text-sm font-medium transition-all outline-none resize-none placeholder:text-on-surface-variant/40 placeholder:font-normal ${
                            errors.yesterday_work
                                ? 'border-error ring-2 ring-error/20 bg-error-container/5'
                                : 'border-outline-variant/25 focus:border-primary focus:ring-4 focus:ring-primary/10'
                        }`}
                    />
                    {errors.yesterday_work && (
                        <p className="mt-1.5 ml-1 text-xs text-error font-semibold flex items-center gap-1 animate-in fade-in">
                            <span className="material-symbols-outlined text-sm">info</span>
                            {errors.yesterday_work}
                        </p>
                    )}
                </div>

                {/* TRƯỜNG 2: Hôm nay bạn dự định làm gì? */}
                <div>
                    <label 
                        htmlFor="today_plan"
                        className="block text-xs font-black text-on-surface-variant uppercase tracking-wider mb-2 ml-1"
                    >
                        2. Hôm nay bạn dự định làm gì? <span className="text-error font-bold">*</span>
                    </label>
                    <textarea
                        id="today_plan"
                        rows={3}
                        value={todayPlan}
                        onChange={(e) => {
                            setTodayPlan(e.target.value);
                            if (errors.today_plan) {
                                setErrors(prev => ({ ...prev, today_plan: null }));
                            }
                        }}
                        onKeyDown={handleKeyDown}
                        placeholder="Ví dụ: Tích hợp Quick Daily Form vào giao diện Sprint Board và viết Unit Test..."
                        className={`w-full bg-surface-container-lowest border rounded-2xl p-4 text-sm font-medium transition-all outline-none resize-none placeholder:text-on-surface-variant/40 placeholder:font-normal ${
                            errors.today_plan
                                ? 'border-error ring-2 ring-error/20 bg-error-container/5'
                                : 'border-outline-variant/25 focus:border-primary focus:ring-4 focus:ring-primary/10'
                        }`}
                    />
                    {errors.today_plan && (
                        <p className="mt-1.5 ml-1 text-xs text-error font-semibold flex items-center gap-1 animate-in fade-in">
                            <span className="material-symbols-outlined text-sm">info</span>
                            {errors.today_plan}
                        </p>
                    )}
                </div>

                {/* TRƯỜNG 3: Khó khăn / Vướng mắc (Blockers) + Quick Chip */}
                <div>
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2 ml-1">
                        <label 
                            htmlFor="blockers"
                            className="text-xs font-black text-on-surface-variant uppercase tracking-wider"
                        >
                            3. Bạn có gặp khó khăn/vướng mắc nào không? <span className="text-error font-bold">*</span>
                        </label>

                        {/* Nút Quick Chip 1 chạm điền "Không có" */}
                        <button
                            type="button"
                            onClick={handleQuickChipNoBlocker}
                            className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 rounded-full text-xs font-bold transition-colors border border-emerald-500/25 active:scale-95 cursor-pointer"
                            title="Nhấn để tự động điền 'Không có'"
                        >
                            <span className="material-symbols-outlined text-sm text-emerald-600">check</span>
                            <span>Không có vướng mắc</span>
                        </button>
                    </div>

                    <textarea
                        id="blockers"
                        rows={2}
                        value={blockers}
                        onChange={(e) => {
                            setBlockers(e.target.value);
                            if (errors.blockers) {
                                setErrors(prev => ({ ...prev, blockers: null }));
                            }
                        }}
                        onKeyDown={handleKeyDown}
                        placeholder="Mô tả khó khăn cần hỗ trợ, hoặc bấm nút 'Không có vướng mắc' phía trên..."
                        className={`w-full bg-surface-container-lowest border rounded-2xl p-4 text-sm font-medium transition-all outline-none resize-none placeholder:text-on-surface-variant/40 placeholder:font-normal ${
                            errors.blockers
                                ? 'border-error ring-2 ring-error/20 bg-error-container/5'
                                : 'border-outline-variant/25 focus:border-primary focus:ring-4 focus:ring-primary/10'
                        }`}
                    />
                    {errors.blockers && (
                        <p className="mt-1.5 ml-1 text-xs text-error font-semibold flex items-center gap-1 animate-in fade-in">
                            <span className="material-symbols-outlined text-sm">info</span>
                            {errors.blockers}
                        </p>
                    )}
                </div>

                {/* Submit button & Shortcut hint */}
                <div className="pt-2">
                    <button
                        type="submit"
                        disabled={submitting}
                        className={`w-full font-black py-4 px-6 rounded-2xl transition-all flex items-center justify-center gap-2.5 shadow-lg active:scale-[0.99] disabled:opacity-50 cursor-pointer ${
                            submittedStandup && isEditing
                                ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-amber-600/20 hover:shadow-amber-600/30'
                                : 'bg-primary hover:bg-primary/95 text-on-primary shadow-primary/20 hover:shadow-primary/30'
                        }`}
                    >
                        {submitting ? (
                            <>
                                <div className="w-5 h-5 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                                <span>{submittedStandup && isEditing ? 'ĐANG CẬP NHẬT...' : 'ĐANG GỬI BÁO CÁO...'}</span>
                            </>
                        ) : (
                            <>
                                <span className="material-symbols-outlined text-xl">
                                    {submittedStandup && isEditing ? 'save' : 'send'}
                                </span>
                                <span>{submittedStandup && isEditing ? 'CẬP NHẬT DAILY' : 'GỬI DAILY STANDUP'}</span>
                            </>
                        )}
                    </button>

                    <p className="mt-2 text-center text-[11px] text-on-surface-variant/60 font-medium">
                        Phím tắt: <kbd className="px-1.5 py-0.5 bg-surface-container-highest rounded text-[10px] font-mono font-bold">Ctrl</kbd> + <kbd className="px-1.5 py-0.5 bg-surface-container-highest rounded text-[10px] font-mono font-bold">Enter</kbd> để {submittedStandup && isEditing ? 'cập nhật nhanh' : 'gửi nhanh'}
                    </p>
                </div>
            </form>
        </div>
    );
}
