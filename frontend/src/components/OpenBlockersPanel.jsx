import React, { useState, useEffect } from 'react';
import { getSprintBlockers, resolveSprintBlocker, getDailyStandupDetail } from '../services/standupService';

/**
 * OpenBlockersPanel - Màn hình "Ai đang kẹt" & Gỡ Blocker
 * Dành riêng cho Scrum Master / Product Owner và cả nhóm theo dõi vướng mắc:
 * - Lọc OPEN (mặc định), CLOSED, ALL
 * - Sắp xếp mới nhất lên đầu (AC1)
 * - Nút "Đã gỡ" kèm Confirm Dialog (AC2)
 * - Phân quyền: Chỉ SM/PO mới thấy và bấm được nút "Đã gỡ" (DoD)
 * - Xem nhanh nội dung Daily gốc của ngày hôm đó (AC2)
 * - Toast thông báo đóng Blocker
 */
export default function OpenBlockersPanel({
    sprintId,
    userRole = 'MEMBER',
    onBlockerResolved,
    className = ''
}) {
    const [blockers, setBlockers] = useState([]);
    const [statusFilter, setStatusFilter] = useState('OPEN'); // 'OPEN' | 'CLOSED' | 'ALL'
    const [loading, setLoading] = useState(true);
    const [resolvingId, setResolvingId] = useState(null);
    const [confirmModal, setConfirmModal] = useState({ isOpen: false, blocker: null });
    const [detailModal, setDetailModal] = useState({ isOpen: false, standup: null, loading: false });
    const [toast, setToast] = useState(null); // { type: 'success' | 'error', message }

    // Kiểm tra quyền SM / PO / ADMIN (DoD Permission)
    const normalizedRole = (userRole || '').toUpperCase();
    const isManagement = ['SM', 'PO', 'SCRUM_MASTER', 'PRODUCT_OWNER', 'ADMIN'].includes(normalizedRole);

    // Auto-hide toast sau 3.5s
    useEffect(() => {
        if (toast) {
            const timer = setTimeout(() => setToast(null), 3500);
            return () => clearTimeout(timer);
        }
    }, [toast]);

    useEffect(() => {
        if (sprintId) {
            loadBlockers();
        }
    }, [sprintId, statusFilter]);

    const loadBlockers = async () => {
        setLoading(true);
        try {
            const data = await getSprintBlockers(sprintId, statusFilter);
            setBlockers(data.blockers || []);
        } catch (err) {
            console.error('Lỗi tải danh sách blocker:', err);
        } finally {
            setLoading(false);
        }
    };

    // Mở Confirm Dialog gỡ Blocker
    const handleOpenConfirm = (blocker) => {
        setConfirmModal({ isOpen: true, blocker });
    };

    // Xác nhận gỡ Blocker
    const handleConfirmResolve = async () => {
        const blocker = confirmModal.blocker;
        if (!blocker) return;

        setResolvingId(blocker.id);
        setConfirmModal({ isOpen: false, blocker: null });

        try {
            const updated = await resolveSprintBlocker(sprintId, blocker.id);

            // Cập nhật state danh sách
            if (statusFilter === 'OPEN') {
                setBlockers(prev => prev.filter(b => b.id !== blocker.id));
            } else {
                setBlockers(prev => prev.map(b => b.id === blocker.id ? updated : b));
            }

            setToast({
                type: 'success',
                message: `Đã đóng Blocker cho ${blocker.user?.fullName || 'thành viên'}!`
            });

            if (onBlockerResolved) {
                onBlockerResolved(updated);
            }
        } catch (err) {
            console.error('Lỗi khi gỡ Blocker:', err);
            setToast({
                type: 'error',
                message: err.response?.data?.error || 'Có lỗi xảy ra khi gỡ Blocker'
            });
        } finally {
            setResolvingId(null);
        }
    };

    // Xem nhanh chi tiết Daily gốc
    const handleViewDetail = async (blocker) => {
        setDetailModal({ isOpen: true, standup: blocker, loading: true });
        try {
            const fullDetail = await getDailyStandupDetail(blocker.id);
            setDetailModal({ isOpen: true, standup: fullDetail, loading: false });
        } catch (err) {
            // Dùng dữ liệu hiện có nếu API lỗi
            setDetailModal({ isOpen: true, standup: blocker, loading: false });
        }
    };

    // Format ngày giờ hiển thị
    const formatDateTime = (dateInput) => {
        if (!dateInput) return '';
        const d = new Date(dateInput);
        if (isNaN(d.getTime())) return '';
        return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) + 
               ', ' + d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
    };

    return (
        <div className={`space-y-6 ${className}`}>
            {/* Toast Notification */}
            {toast && (
                <div className={`fixed top-6 right-6 z-[200] flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl text-white animate-in slide-in-from-top-3 duration-300 ${
                    toast.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'
                }`}>
                    <span className="material-symbols-outlined text-xl">
                        {toast.type === 'success' ? 'check_circle' : 'error'}
                    </span>
                    <span className="text-sm font-bold">{toast.message}</span>
                    <button onClick={() => setToast(null)} className="ml-2 opacity-70 hover:opacity-100 transition-opacity">
                        <span className="material-symbols-outlined text-lg">close</span>
                    </button>
                </div>
            )}

            {/* Header & Bộ lọc trạng thái */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 bg-surface-container rounded-3xl border border-outline-variant/15 shadow-sm">
                <div>
                    <div className="flex items-center gap-2.5">
                        <div className="w-10 h-10 rounded-xl bg-red-500/15 text-red-600 flex items-center justify-center">
                            <span className="material-symbols-outlined text-2xl font-bold">support_agent</span>
                        </div>
                        <div>
                            <h2 className="text-lg font-black text-on-surface tracking-tight">
                                Danh sách Blocker ("Ai đang kẹt")
                            </h2>
                            <p className="text-xs text-on-surface-variant/70 font-medium">
                                Theo dõi và giải quyết các trở ngại của thành viên trong Sprint
                            </p>
                        </div>
                    </div>
                </div>

                {/* Filter Switcher: OPEN | CLOSED | ALL */}
                <div className="flex items-center gap-1 bg-surface-container-low p-1 rounded-2xl border border-outline-variant/10 shrink-0">
                    <button
                        type="button"
                        onClick={() => setStatusFilter('OPEN')}
                        className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                            statusFilter === 'OPEN'
                                ? 'bg-red-600 text-white shadow-sm shadow-red-500/20'
                                : 'text-on-surface-variant hover:bg-surface-container-high'
                        }`}
                    >
                        <span className="material-symbols-outlined text-sm">report</span>
                        <span>Đang kẹt (OPEN)</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setStatusFilter('CLOSED')}
                        className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                            statusFilter === 'CLOSED'
                                ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-500/20'
                                : 'text-on-surface-variant hover:bg-surface-container-high'
                        }`}
                    >
                        <span className="material-symbols-outlined text-sm">check_circle</span>
                        <span>Đã gỡ (CLOSED)</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setStatusFilter('ALL')}
                        className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                            statusFilter === 'ALL'
                                ? 'bg-primary text-on-primary shadow-sm shadow-primary/20'
                                : 'text-on-surface-variant hover:bg-surface-container-high'
                        }`}
                    >
                        <span>Tất cả</span>
                    </button>
                </div>
            </div>

            {/* Danh sách Blockers */}
            {loading ? (
                <div className="py-16 flex flex-col items-center justify-center bg-surface-container-low/30 rounded-3xl border border-outline-variant/10">
                    <div className="w-10 h-10 border-3 border-primary/20 border-t-primary rounded-full animate-spin mb-3" />
                    <p className="text-xs font-bold text-on-surface-variant/60 uppercase tracking-wider">
                        Đang tải danh sách Blocker...
                    </p>
                </div>
            ) : blockers.length === 0 ? (
                <div className="py-16 px-4 text-center bg-surface-container-low/30 rounded-3xl border-2 border-dashed border-outline-variant/20 animate-in fade-in duration-300">
                    <div className="w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center mx-auto mb-4">
                        <span className="material-symbols-outlined text-4xl">celebration</span>
                    </div>
                    <h3 className="text-base md:text-lg font-black text-on-surface mb-1">
                        {statusFilter === 'OPEN' 
                            ? 'Tuyệt vời! Không có ai đang bị kẹt' 
                            : 'Không có dữ liệu blocker phù hợp'}
                    </h3>
                    <p className="text-xs text-on-surface-variant/70 max-w-md mx-auto">
                        {statusFilter === 'OPEN'
                            ? 'Toàn bộ thành viên trong Sprint đang tiến triển thuận lợi và không báo vướng mắc nào chưa được gỡ.'
                            : 'Hãy chọn bộ lọc khác để xem lại lịch sử.'}
                    </p>
                </div>
            ) : (
                <div className="space-y-4 animate-in fade-in duration-300">
                    {blockers.map((item) => {
                        const isClosed = item.blockerStatus === 'CLOSED';
                        return (
                            <div 
                                key={item.id}
                                className={`rounded-3xl p-5 md:p-6 transition-all border ${
                                    isClosed 
                                        ? 'bg-surface-container-lowest/60 border-outline-variant/15 opacity-90' 
                                        : 'bg-surface-container border-red-500/30 shadow-md shadow-red-500/5 hover:border-red-500/50'
                                }`}
                            >
                                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                                    {/* Thông tin thành viên & Trạng thái */}
                                    <div className="flex items-start gap-3.5">
                                        <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-primary to-primary-container text-on-primary font-black text-sm flex items-center justify-center shrink-0 shadow-sm">
                                            {item.user?.fullName?.[0] || item.user?.email?.[0]?.toUpperCase() || 'U'}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <h4 className="font-black text-sm md:text-base text-on-surface">
                                                    {item.user?.fullName || item.user?.email}
                                                </h4>
                                                {isClosed ? (
                                                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
                                                        <span className="material-symbols-outlined text-xs">check_circle</span>
                                                        ĐÃ GỠ
                                                    </span>
                                                ) : (
                                                    <span className="px-2.5 py-0.5 rounded-full bg-red-600 text-white text-[10px] font-black uppercase tracking-wider flex items-center gap-1 animate-pulse shadow-sm shadow-red-500/20">
                                                        <span className="material-symbols-outlined text-xs">emergency</span>
                                                        ĐANG KẸT
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-[11px] text-on-surface-variant/70 font-medium mt-0.5 flex items-center gap-1.5">
                                                <span className="material-symbols-outlined text-xs">schedule</span>
                                                Báo kẹt lúc: {formatDateTime(item.createdAt || item.date || item.reportDate)}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Action buttons */}
                                    <div className="flex items-center gap-2 self-end md:self-start shrink-0">
                                        {/* Nút xem chi tiết Daily gốc */}
                                        <button
                                            type="button"
                                            onClick={() => handleViewDetail(item)}
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-surface-container-low hover:bg-surface-container-high text-on-surface text-xs font-bold rounded-xl border border-outline-variant/15 transition-all cursor-pointer"
                                            title="Xem toàn bộ nội dung báo cáo Daily gốc của ngày này"
                                        >
                                            <span className="material-symbols-outlined text-sm">visibility</span>
                                            <span>Xem Daily</span>
                                        </button>

                                        {/* Nút "Đã gỡ" (Resolve) - Chỉ hiển thị cho SM/PO (DoD) */}
                                        {!isClosed && isManagement && (
                                            <button
                                                type="button"
                                                disabled={resolvingId === item.id}
                                                onClick={() => handleOpenConfirm(item)}
                                                className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-black rounded-xl shadow-md shadow-emerald-600/20 transition-all cursor-pointer disabled:opacity-50"
                                            >
                                                {resolvingId === item.id ? (
                                                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                ) : (
                                                    <span className="material-symbols-outlined text-sm">task_alt</span>
                                                )}
                                                <span>Đã gỡ</span>
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* KHUNG LÝ DO KẸT NỔI BẬT */}
                                <div className={`mt-4 p-4 rounded-2xl border ${
                                    isClosed 
                                        ? 'bg-surface-container-low/50 border-outline-variant/10' 
                                        : 'bg-red-500/10 border-red-500/25'
                                }`}>
                                    <div className={`flex items-center gap-1.5 text-xs font-black uppercase tracking-wider mb-1.5 ${
                                        isClosed ? 'text-on-surface-variant/80' : 'text-red-700 dark:text-red-400'
                                    }`}>
                                        <span className="material-symbols-outlined text-sm">
                                            {isClosed ? 'check' : 'warning'}
                                        </span>
                                        <span>Lý do vướng mắc:</span>
                                    </div>
                                    <p className={`text-sm font-bold leading-relaxed pl-5 ${
                                        isClosed ? 'text-on-surface/80' : 'text-red-950 dark:text-red-100'
                                    }`}>
                                        {item.blockerNote || '(Chưa ghi chi tiết lý do)'}
                                    </p>
                                </div>

                                {/* Thông tin giải quyết (nếu đã CLOSED) */}
                                {isClosed && (
                                    <div className="mt-3 flex items-center gap-1.5 text-xs text-emerald-800 dark:text-emerald-300 font-medium pl-1">
                                        <span className="material-symbols-outlined text-sm">verified</span>
                                        <span>
                                            Đã gỡ lúc {formatDateTime(item.blockerResolvedAt)} bởi <strong>{item.resolver?.fullName || item.resolver?.email || 'Scrum Master'}</strong>
                                        </span>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* CONFIRM DIALOG: XÁC NHẬN GỠ BLOCKER */}
            {confirmModal.isOpen && confirmModal.blocker && (
                <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
                    <div className="bg-surface-container rounded-3xl p-6 md:p-8 max-w-md w-full border border-outline-variant/20 shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 text-emerald-600 flex items-center justify-center mb-4">
                            <span className="material-symbols-outlined text-2xl font-bold">task_alt</span>
                        </div>
                        <h3 className="text-lg font-black text-on-surface mb-2">
                            Xác nhận đã gỡ Blocker?
                        </h3>
                        <p className="text-sm text-on-surface-variant/80 leading-relaxed mb-6">
                            Xác nhận bạn đã hỗ trợ gỡ vướng mắc này cho{' '}
                            <strong>{confirmModal.blocker.user?.fullName || 'thành viên'}</strong>? Trạng thái sẽ chuyển thành "ĐÃ GỠ" nhưng toàn bộ nội dung Daily gốc vẫn được bảo toàn.
                        </p>
                        <div className="flex items-center justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => setConfirmModal({ isOpen: false, blocker: null })}
                                className="px-4 py-2.5 rounded-xl font-bold text-xs text-on-surface-variant hover:bg-surface-container-high transition-colors cursor-pointer"
                            >
                                Hủy bỏ
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmResolve}
                                className="px-5 py-2.5 rounded-xl font-black text-xs bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20 active:scale-95 transition-all cursor-pointer"
                            >
                                Xác nhận Đã gỡ
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL XEM NHANH CHI TIẾT DAILY GỐC (AC2) */}
            {detailModal.isOpen && detailModal.standup && (
                <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
                    <div className="bg-surface-container rounded-3xl p-6 md:p-8 max-w-2xl w-full border border-outline-variant/20 shadow-2xl max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between pb-4 border-b border-outline-variant/10 mb-5">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
                                    <span className="material-symbols-outlined text-xl">description</span>
                                </div>
                                <div>
                                    <h3 className="text-base font-black text-on-surface">
                                        Chi tiết Daily Standup gốc
                                    </h3>
                                    <p className="text-xs text-on-surface-variant/70">
                                        Bởi {detailModal.standup.user?.fullName || detailModal.standup.user?.email} • Ngày {formatDateTime(detailModal.standup.createdAt || detailModal.standup.reportDate)}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setDetailModal({ isOpen: false, standup: null, loading: false })}
                                className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-surface-container-high text-on-surface-variant transition-colors"
                            >
                                <span className="material-symbols-outlined text-lg">close</span>
                            </button>
                        </div>

                        {/* Nội dung 3 câu hỏi Daily */}
                        <div className="space-y-4">
                            <div className="p-4 bg-surface-container-low rounded-2xl border border-outline-variant/10">
                                <div className="text-xs font-black text-primary uppercase tracking-wider mb-1 flex items-center gap-1.5">
                                    <span className="material-symbols-outlined text-sm">task_alt</span>
                                    1. Hôm qua đã hoàn thành:
                                </div>
                                <p className="text-sm text-on-surface whitespace-pre-wrap pl-5 leading-relaxed">
                                    {detailModal.standup.yesterdayWork || detailModal.standup.yesterday || '(Không có nội dung)'}
                                </p>
                            </div>

                            <div className="p-4 bg-surface-container-low rounded-2xl border border-outline-variant/10">
                                <div className="text-xs font-black text-primary uppercase tracking-wider mb-1 flex items-center gap-1.5">
                                    <span className="material-symbols-outlined text-sm">flag</span>
                                    2. Hôm nay sẽ làm:
                                </div>
                                <p className="text-sm text-on-surface whitespace-pre-wrap pl-5 leading-relaxed">
                                    {detailModal.standup.todayPlan || detailModal.standup.today || '(Không có nội dung)'}
                                </p>
                            </div>

                            <div className="p-4 bg-surface-container-low rounded-2xl border border-outline-variant/10">
                                <div className="text-xs font-black text-on-surface-variant uppercase tracking-wider mb-1 flex items-center gap-1.5">
                                    <span className="material-symbols-outlined text-sm">info</span>
                                    3. Khó khăn / Vướng mắc:
                                </div>
                                <p className="text-sm text-on-surface whitespace-pre-wrap pl-5 leading-relaxed">
                                    {detailModal.standup.blockers || '(Không có vướng mắc)'}
                                </p>
                            </div>

                            {/* Lý do cờ kẹt */}
                            <div className="p-4 bg-red-500/10 rounded-2xl border border-red-500/25">
                                <div className="text-xs font-black text-red-700 dark:text-red-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                                    <span className="material-symbols-outlined text-sm">emergency</span>
                                    Cờ Đang kẹt & Lý do ngắn:
                                </div>
                                <p className="text-sm font-bold text-red-950 dark:text-red-100 pl-5 leading-relaxed">
                                    {detailModal.standup.blockerNote || '(Không có note)'}
                                </p>
                                {detailModal.standup.blockerStatus === 'CLOSED' && (
                                    <p className="mt-2 text-xs text-emerald-800 dark:text-emerald-300 font-semibold pl-5">
                                        ✓ Đã gỡ lúc {formatDateTime(detailModal.standup.blockerResolvedAt)} bởi {detailModal.standup.resolver?.fullName || 'SM/PO'}
                                    </p>
                                )}
                            </div>
                        </div>

                        <div className="mt-6 flex justify-end">
                            <button
                                type="button"
                                onClick={() => setDetailModal({ isOpen: false, standup: null, loading: false })}
                                className="px-5 py-2.5 rounded-xl bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-bold text-xs transition-colors cursor-pointer"
                            >
                                Đóng
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
