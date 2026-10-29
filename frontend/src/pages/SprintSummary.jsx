/**
 * SprintSummary.jsx
 * -----------------------------------------------------------------------
 * Trang Tổng kết Sprint & Đánh giá Đóng Góp
 * Route: /projects/:projectId/sprints/:sprintId/summary
 *
 * Luồng:
 *  1. Load thông tin Sprint + kiểm tra role người dùng
 *  2. Nếu đã có summary → hiển thị kết quả
 *  3. Nếu chưa có và user là PO/SM → hiển thị form Generate
 *  4. PO/SM có thể nhập specialMetric cho Tester/Designer và tái tạo
 *
 * Component sử dụng:
 *  - MainLayout (layout chung)
 *  - ContributionChart (biểu đồ đóng góp)
 *  - api (axios instance)
 * -----------------------------------------------------------------------
 */

import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import MainLayout from '../components/MainLayout';
import ContributionChart from '../components/analytics/ContributionChart';
import api, { getAvatarUrl } from '../services/api';

// ── Màu sắc theo vai trò ──────────────────────────────────────
const ROLE_STYLE = {
  PO:       { label: 'Product Owner', cls: 'bg-amber-100 text-amber-700 border-amber-200' },
  SM:       { label: 'Scrum Master',  cls: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
  DEV:      { label: 'Developer',     cls: 'bg-blue-100 text-blue-700 border-blue-200' },
  TESTER:   { label: 'QA Tester',     cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  DESIGNER: { label: 'Designer',      cls: 'bg-purple-100 text-purple-700 border-purple-200' },
  MEMBER:   { label: 'Member',        cls: 'bg-gray-100 text-gray-600 border-gray-200' },
};

const getRoleStyle = (role) => ROLE_STYLE[role] || ROLE_STYLE.MEMBER;

/** Định dạng chỉ số đặc trưng theo vai trò */
const formatSpecialMetric = (role, metric = {}) => {
  if (!metric || Object.keys(metric).length === 0) return null;
  switch (role) {
    case 'TESTER':
      return [
        metric.testCases != null && `${metric.testCases} Test Cases`,
        metric.bugsFound != null && `${metric.bugsFound} Bugs`,
      ].filter(Boolean).join(' · ');
    case 'DESIGNER':
      return [
        metric.screens     != null && `${metric.screens} Screens`,
        metric.components  != null && `${metric.components} Components`,
      ].filter(Boolean).join(' · ');
    default:
      return null;
  }
};

// ── Summary Cards ──────────────────────────────────────────────
function SummaryCard({ icon, label, value, unit, accent }) {
  return (
    <div className={`bg-white rounded-3xl border p-6 flex flex-col gap-2 shadow-sm
      hover:-translate-y-1 transition-transform duration-300 border-outline-variant/10
      relative overflow-hidden`}>
      {/* Accent top bar */}
      <div className={`absolute top-0 inset-x-0 h-1 rounded-t-3xl ${accent}`} />
      <div className="text-2xl mt-1">{icon}</div>
      <div className="text-xs font-black uppercase tracking-widest text-on-surface-variant/60 mt-1">
        {label}
      </div>
      <div className="text-4xl font-black text-on-surface leading-none">{value}</div>
      {unit && <div className="text-sm text-on-surface-variant font-medium">{unit}</div>}
    </div>
  );
}

// ── Special Metric Input (cho form generate) ───────────────────
function SpecialMetricInput({ member, value, onChange }) {
  const role = member.roleInProject;

  if (!['TESTER', 'DESIGNER'].includes(role)) return null;

  return (
    <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/15 p-4">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center
          text-xs font-black text-primary">
          {(member.fullName || '?').split(' ').slice(-1)[0]?.[0]?.toUpperCase()}
        </div>
        <div>
          <div className="text-sm font-bold text-on-surface">{member.fullName}</div>
          <div className="text-xs text-on-surface-variant">{getRoleStyle(role).label}</div>
        </div>
      </div>

      {role === 'TESTER' && (
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wide">
              Test Cases chạy
            </span>
            <input
              id={`tc-${member.id}`}
              type="number" min="0"
              value={value?.testCases ?? ''}
              onChange={e => onChange({ ...value, testCases: parseInt(e.target.value) || 0 })}
              className="w-full px-3 py-2 rounded-xl border border-outline-variant/20
                bg-white text-sm font-bold focus:ring-2 focus:ring-primary/20 outline-none"
              placeholder="0"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wide">
              Bugs tìm thấy
            </span>
            <input
              id={`bug-${member.id}`}
              type="number" min="0"
              value={value?.bugsFound ?? ''}
              onChange={e => onChange({ ...value, bugsFound: parseInt(e.target.value) || 0 })}
              className="w-full px-3 py-2 rounded-xl border border-outline-variant/20
                bg-white text-sm font-bold focus:ring-2 focus:ring-primary/20 outline-none"
              placeholder="0"
            />
          </label>
        </div>
      )}

      {role === 'DESIGNER' && (
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wide">
              Screens thiết kế
            </span>
            <input
              id={`sc-${member.id}`}
              type="number" min="0"
              value={value?.screens ?? ''}
              onChange={e => onChange({ ...value, screens: parseInt(e.target.value) || 0 })}
              className="w-full px-3 py-2 rounded-xl border border-outline-variant/20
                bg-white text-sm font-bold focus:ring-2 focus:ring-primary/20 outline-none"
              placeholder="0"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wide">
              Components tạo
            </span>
            <input
              id={`cp-${member.id}`}
              type="number" min="0"
              value={value?.components ?? ''}
              onChange={e => onChange({ ...value, components: parseInt(e.target.value) || 0 })}
              className="w-full px-3 py-2 rounded-xl border border-outline-variant/20
                bg-white text-sm font-bold focus:ring-2 focus:ring-primary/20 outline-none"
              placeholder="0"
            />
          </label>
        </div>
      )}
    </div>
  );
}

// ── Contribution Table Row ─────────────────────────────────────
function ContributionRow({ c, index }) {
  const rs          = getRoleStyle(c.roleInSprint);
  const specialText = formatSpecialMetric(c.roleInSprint, c.specialMetric);
  const pct         = c.contributionPct;

  // Màu thanh tiến độ theo thứ tự
  const barColors = [
    'bg-indigo-500', 'bg-emerald-500', 'bg-amber-500',
    'bg-red-500', 'bg-violet-500', 'bg-cyan-500', 'bg-orange-500', 'bg-pink-500',
  ];
  const barColor = barColors[index % barColors.length];

  return (
    <tr className="border-b border-outline-variant/8 hover:bg-surface-container-lowest/50
      transition-colors group">
      {/* # */}
      <td className="px-5 py-4 text-sm font-black text-on-surface-variant/40 w-10">
        {String(index + 1).padStart(2, '0')}
      </td>

      {/* Thành viên */}
      <td className="px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full overflow-hidden bg-primary/10 flex items-center justify-center
            font-bold text-sm text-primary flex-shrink-0 border border-primary/10">
            {c.user?.avatar ? (
              <img 
                src={getAvatarUrl(c.user.avatar)} 
                alt="Avatar" 
                className="w-full h-full object-cover"
              />
            ) : (
              (c.user?.fullName || '?').split(' ').slice(-2).map(w => w[0]).join('').toUpperCase()
            )}
          </div>
          <div>
            <div className="font-semibold text-sm text-on-surface">
              {c.user?.fullName || 'Ẩn danh'}
            </div>
            <div className="text-xs text-on-surface-variant">{c.user?.email}</div>
          </div>
        </div>
      </td>

      {/* Vai trò */}
      <td className="px-5 py-4">
        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold
          border ${rs.cls}`}>
          {rs.label}
        </span>
      </td>

      {/* Story Points */}
      <td className="px-5 py-4 text-center">
        <div className="text-lg font-black text-on-surface">{c.storyPoints}</div>
        <div className="text-[10px] text-on-surface-variant uppercase tracking-wide">SP</div>
      </td>

      {/* Số giờ */}
      <td className="px-5 py-4 text-center">
        <div className="text-lg font-black text-on-surface">{c.hoursWorked}</div>
        <div className="text-[10px] text-on-surface-variant uppercase tracking-wide">giờ</div>
      </td>

      {/* Stories hoàn thành */}
      <td className="px-5 py-4 text-center">
        <div className="text-lg font-black text-on-surface">{c.storiesCompleted}</div>
        <div className="text-[10px] text-on-surface-variant uppercase tracking-wide">stories</div>
      </td>

      {/* Chỉ số đặc trưng */}
      <td className="px-5 py-4">
        {specialText ? (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl
            bg-surface-container-high text-xs font-semibold text-on-surface-variant border
            border-outline-variant/10">
            <span className="text-primary">◆</span>
            {specialText}
          </span>
        ) : (
          <span className="text-xs text-on-surface-variant/40 italic">–</span>
        )}
      </td>

      {/* % Đóng góp + Bar */}
      <td className="px-5 py-4 min-w-[160px]">
        <div className="flex justify-between items-center mb-1.5">
          <span className="text-base font-black text-on-surface">{pct.toFixed(1)}%</span>
        </div>
        <div className="h-2 bg-black/5 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full ${barColor} transition-all duration-1000 ease-out`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </td>
    </tr>
  );
}

// ── Main Page ──────────────────────────────────────────────────
export default function SprintSummary() {
  const { projectId, sprintId } = useParams();
  const navigate                = useNavigate();

  const [summary,       setSummary]       = useState(null);
  const [sprint,        setSprint]        = useState(null);
  const [members,       setMembers]       = useState([]);
  const [userRole,      setUserRole]      = useState(null);
  const [isLoading,     setIsLoading]     = useState(true);
  const [isGenerating,  setIsGenerating]  = useState(false);
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [error,         setError]         = useState(null);
  const [noSummary,     setNoSummary]     = useState(false);
  const [notes,         setNotes]         = useState('');
  const [showGenForm,   setShowGenForm]   = useState(false);

  // specialMetrics: { [userId]: { testCases, bugsFound, screens, components } }
  const [specialMetrics, setSpecialMetrics] = useState({});

  const isPOorSM = userRole === 'PO' || userRole === 'SM';

  // ── Fetch dữ liệu ──────────────────────────────────────────
  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Parallel: role + sprint info + summary
      const [roleRes, sprintRes, summaryRes, membersRes] = await Promise.allSettled([
        api.get(`/project/${projectId}/role`),
        api.get(`/sprint/${sprintId}`),
        api.get(`/sprints/${sprintId}/summary`),
        api.get(`/project/${projectId}/members`),
      ]);

      if (roleRes.status === 'fulfilled')    setUserRole(roleRes.value.data.role);
      if (sprintRes.status === 'fulfilled')  setSprint(sprintRes.value.data);
      if (membersRes.status === 'fulfilled') setMembers(membersRes.value.data || []);

      if (summaryRes.status === 'fulfilled') {
        setSummary(summaryRes.value.data);
        setNotes(summaryRes.value.data.notes || '');
        setNoSummary(false);
      } else {
        // 404 = chưa generate, các lỗi khác = lỗi thật
        const status = summaryRes.reason?.response?.status;
        if (status === 404) setNoSummary(true);
        else setError(summaryRes.reason?.response?.data?.error || 'Lỗi khi tải dữ liệu');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [projectId, sprintId]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Generate Summary ────────────────────────────────────────
  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const res = await api.post(`/sprints/${sprintId}/summary/generate`, {
        memberSpecialMetrics: specialMetrics,
      });
      setSummary(res.data.summary);
      setNotes(res.data.summary.notes || '');
      setNoSummary(false);
      setShowGenForm(false);
    } catch (err) {
      setError(err.response?.data?.error || 'Lỗi khi tạo tổng kết');
    } finally {
      setIsGenerating(false);
    }
  };

  // ── Save Notes ──────────────────────────────────────────────
  const handleSaveNotes = async () => {
    setIsSavingNotes(true);
    try {
      await api.patch(`/sprints/${sprintId}/summary/notes`, { notes });
      // Optimistic update
    } catch (err) {
      setError(err.response?.data?.error || 'Lỗi khi lưu ghi chú');
    } finally {
      setIsSavingNotes(false);
    }
  };

  // ── Members cần nhập specialMetric (Tester/Designer) ────────
  const specialMembers = members.filter(m =>
    ['TESTER', 'DESIGNER'].includes(m.role) && m.status === 'ACCEPTED'
  ).map(m => ({ ...m, roleInProject: m.role }));

  // ── Tổng dữ liệu đã có summary ──────────────────────────────
  const doneStories = summary?.contributions?.reduce((s, c) => s + c.storiesCompleted, 0) ?? 0;

  // ============================================================
  // RENDER
  // ============================================================

  if (isLoading) {
    return (
      <MainLayout activePage="Reports" projectId={projectId}>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 opacity-50">
          <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
          <span className="font-bold text-sm">Đang tải dữ liệu tổng kết...</span>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout activePage="Reports" projectId={projectId}>
      <div className="max-w-6xl mx-auto py-6 px-4 md:px-0">

        {/* ── HEADER ── */}
        <header className="mb-8 flex flex-col md:flex-row md:items-start justify-between gap-5">
          <div>
            {/* Breadcrumb */}
            <div className="flex items-center gap-2 text-xs text-on-surface-variant mb-3">
              <button
                onClick={() => navigate(`/projects/${projectId}/reports`)}
                className="hover:text-primary transition-colors font-semibold"
              >
                Báo cáo
              </button>
              <span>›</span>
              <span className="font-bold text-on-surface">Tổng kết Sprint</span>
            </div>

            <h1 className="text-3xl font-black text-on-surface tracking-tight font-['Manrope']">
              Tổng kết Sprint
              {sprint?.name && (
                <span className="ml-3 text-xl font-bold text-primary">· {sprint.name}</span>
              )}
            </h1>
            <p className="text-on-surface-variant font-medium mt-1">
              Đánh giá mức độ đóng góp của từng thành viên trong Sprint này
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Badge trạng thái Sprint */}
            {sprint?.status && (
              <span className={`px-4 py-1.5 rounded-full text-xs font-black border uppercase tracking-wide ${
                sprint.status === 'COMPLETED'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : sprint.status === 'ACTIVE'
                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                  : 'bg-gray-50 text-gray-600 border-gray-200'
              }`}>
                {sprint.status === 'COMPLETED' ? '✅ Đã hoàn thành'
                  : sprint.status === 'ACTIVE' ? '🔵 Đang chạy'
                  : '⏸ Chờ'}
              </span>
            )}

            {/* Nút Generate (PO/SM) */}
            {isPOorSM && (
              <button
                id="btn-generate-summary"
                onClick={() => setShowGenForm(!showGenForm)}
                className="flex items-center gap-2 px-5 py-2.5 bg-primary text-on-primary
                  rounded-2xl font-bold text-sm hover:shadow-lg hover:shadow-primary/25
                  transition-all active:scale-95"
              >
                <span className="material-symbols-outlined text-lg leading-none">auto_awesome</span>
                {summary ? 'Tái tạo tổng kết' : 'Tạo tổng kết'}
              </button>
            )}
          </div>
        </header>

        {/* ── ERROR ── */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-2xl text-red-700
            text-sm font-semibold flex items-center gap-3">
            <span className="material-symbols-outlined">error</span>
            {error}
            <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600">✕</button>
          </div>
        )}

        {/* ── GENERATE FORM (hiện khi chưa có summary hoặc khi bấm "Tái tạo") ── */}
        {(noSummary || showGenForm) && isPOorSM && (
          <div className="mb-8 bg-white rounded-[2rem] border border-outline-variant/10
            shadow-xl shadow-primary/5 p-8 animate-in slide-in-from-top-3 duration-300">
            <h2 className="text-lg font-black text-on-surface mb-2 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">settings_suggest</span>
              {summary ? 'Tái tạo Tổng kết Sprint' : 'Khởi tạo Tổng kết Sprint'}
            </h2>
            <p className="text-sm text-on-surface-variant mb-6">
              Hệ thống sẽ tự động tổng hợp từ các User Story có trạng thái <strong>DONE</strong>.
              {specialMembers.length > 0 && ' Vui lòng nhập thêm chỉ số đặc trưng cho Tester/Designer.'}
            </p>

            {/* Nhập specialMetric */}
            {specialMembers.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-black text-on-surface-variant uppercase tracking-widest mb-3">
                  Chỉ số đặc trưng
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {specialMembers.map(m => (
                    <SpecialMetricInput
                      key={m.userId}
                      member={m}
                      value={specialMetrics[m.userId] || {}}
                      onChange={val => setSpecialMetrics(prev => ({ ...prev, [m.userId]: val }))}
                    />
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button
                id="btn-confirm-generate"
                onClick={handleGenerate}
                disabled={isGenerating}
                className="flex items-center gap-2 px-6 py-3 bg-primary text-on-primary
                  rounded-2xl font-black text-sm hover:shadow-lg hover:shadow-primary/25
                  transition-all active:scale-95 disabled:opacity-50"
              >
                {isGenerating ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Đang tính toán...
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-lg leading-none">calculate</span>
                    Xác nhận tạo tổng kết
                  </>
                )}
              </button>
              {showGenForm && (
                <button
                  onClick={() => setShowGenForm(false)}
                  className="px-6 py-3 bg-surface-container-high text-on-surface-variant
                    rounded-2xl font-bold text-sm hover:bg-surface-container-highest transition-all"
                >
                  Hủy
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── KHÔNG CÓ SUMMARY & KHÔNG PHẢI PO/SM ── */}
        {noSummary && !isPOorSM && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-20 h-20 rounded-[2rem] bg-surface-container-high flex items-center
              justify-center mb-6">
              <span className="material-symbols-outlined text-4xl text-on-surface-variant/40">
                hourglass_empty
              </span>
            </div>
            <h2 className="text-xl font-black text-on-surface mb-2">Chưa có tổng kết</h2>
            <p className="text-on-surface-variant text-sm max-w-sm">
              PO hoặc Scrum Master cần tạo tổng kết cho Sprint này để xem kết quả đóng góp.
            </p>
          </div>
        )}

        {/* ── KẾT QUẢ TỔNG KẾT ── */}
        {summary && (
          <div className="space-y-8 animate-in fade-in duration-500">

            {/* ── SUMMARY CARDS ── */}
            <section aria-label="Thẻ tổng quan">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <SummaryCard
                  icon="🎯" label="Tổng Story Points"
                  value={summary.totalSP}
                  unit={`/ ${summary.plannedSP} SP kế hoạch`}
                  accent="bg-gradient-to-r from-indigo-500 to-blue-500"
                />
                <SummaryCard
                  icon="⏱️" label="Tổng Giờ Dự Án"
                  value={summary.totalHours}
                  unit="giờ làm việc"
                  accent="bg-gradient-to-r from-emerald-500 to-teal-500"
                />
                <SummaryCard
                  icon="✅" label="Tỉ Lệ Hoàn Thành"
                  value={`${summary.completionRate.toFixed(0)}%`}
                  unit={`${doneStories} stories DONE`}
                  accent="bg-gradient-to-r from-amber-500 to-orange-500"
                />
                <SummaryCard
                  icon="👥" label="Thành Viên"
                  value={summary.contributions?.length || 0}
                  unit="người đóng góp"
                  accent="bg-gradient-to-r from-violet-500 to-purple-500"
                />
              </div>
            </section>

            {/* ── BIỂU ĐỒ ĐÓNG GÓP ── */}
            <section aria-label="Biểu đồ đóng góp">
              <div className="bg-white rounded-[3rem] border border-outline-variant/10
                shadow-xl shadow-primary/5 p-8 md:p-10">
                <div className="mb-6">
                  <h2 className="text-xl font-black text-on-surface font-['Manrope']">
                    Phân Bổ Đóng Góp
                  </h2>
                  <p className="text-sm text-on-surface-variant mt-1">
                    Tỉ lệ % đóng góp cuối cùng theo Story Points, giờ làm việc và vai trò
                  </p>
                </div>
                <ContributionChart contributions={summary.contributions || []} />
              </div>
            </section>

            {/* ── BẢNG CHI TIẾT ── */}
            <section aria-label="Bảng đóng góp cá nhân">
              <div className="bg-white rounded-[3rem] border border-outline-variant/10
                shadow-xl shadow-primary/5 overflow-hidden">
                <div className="px-8 pt-8 pb-4 flex items-start justify-between flex-wrap gap-4">
                  <div>
                    <h2 className="text-xl font-black text-on-surface font-['Manrope']">
                      Bảng Đóng Góp Cá Nhân
                    </h2>
                    <p className="text-sm text-on-surface-variant mt-1">
                      Chi tiết Story Points, giờ làm việc và chỉ số đặc trưng theo vai trò
                    </p>
                  </div>
                  <span className="text-xs font-black uppercase tracking-widest px-3 py-1.5
                    bg-primary/5 text-primary rounded-xl border border-primary/10">
                    {summary.contributions?.length} thành viên
                  </span>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                  <table className="w-full" id="contribution-table">
                    <thead>
                      <tr className="bg-surface-container-lowest border-y border-outline-variant/8">
                        {['#', 'Thành viên', 'Vai trò', 'SP', 'Giờ', 'Stories', 'Chỉ số đặc trưng', '% Đóng góp']
                          .map(h => (
                            <th key={h} className="px-5 py-3.5 text-left text-[11px] font-black
                              uppercase tracking-widest text-on-surface-variant/60">
                              {h}
                            </th>
                          ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(summary.contributions || []).map((c, i) => (
                        <ContributionRow key={c.id || c.userId} c={c} index={i} />
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Footer table */}
                <div className="px-8 py-4 bg-surface-container-lowest/50 border-t
                  border-outline-variant/8 flex gap-6 text-xs text-on-surface-variant flex-wrap">
                  <span>Tổng: <strong className="text-on-surface">{summary.totalSP} SP</strong></span>
                  <span>Tổng giờ: <strong className="text-on-surface">{summary.totalHours}h</strong></span>
                  <span>Tạo lúc: <strong className="text-on-surface">
                    {new Date(summary.createdAt).toLocaleString('vi-VN')}
                  </strong></span>
                </div>
              </div>
            </section>

            {/* ── GHI CHÚ / RETROSPECTIVE (PO/SM) ── */}
            {isPOorSM && (
              <section aria-label="Ghi chú tổng kết">
                <div className="bg-white rounded-[2.5rem] border border-outline-variant/10
                  shadow-lg shadow-primary/3 p-8">
                  <h2 className="text-lg font-black text-on-surface mb-1 flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-xl">edit_note</span>
                    Ghi chú Retrospective
                  </h2>
                  <p className="text-sm text-on-surface-variant mb-4">
                    Nhận xét của PO/SM về kết quả Sprint (hiển thị cho mọi thành viên)
                  </p>
                  <textarea
                    id="summary-notes"
                    rows={4}
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="Nhập nhận xét, điểm nổi bật, bài học kinh nghiệm của Sprint này..."
                    className="w-full p-4 bg-surface-container-lowest border border-outline-variant/20
                      rounded-2xl text-sm font-medium resize-none focus:ring-2 focus:ring-primary/20
                      outline-none text-on-surface placeholder:text-on-surface-variant/40"
                  />
                  <div className="flex justify-end mt-3">
                    <button
                      id="btn-save-notes"
                      onClick={handleSaveNotes}
                      disabled={isSavingNotes}
                      className="flex items-center gap-2 px-5 py-2.5 bg-primary text-on-primary
                        rounded-2xl font-bold text-sm hover:shadow-lg hover:shadow-primary/20
                        transition-all active:scale-95 disabled:opacity-50"
                    >
                      {isSavingNotes ? 'Đang lưu...' : '💾 Lưu ghi chú'}
                    </button>
                  </div>
                </div>
              </section>
            )}

            {/* ── GHI CHÚ READ-ONLY cho Member ── */}
            {!isPOorSM && summary.notes && (
              <section>
                <div className="bg-amber-50 border border-amber-200 rounded-[2rem] p-6">
                  <h2 className="text-sm font-black text-amber-700 uppercase tracking-widest mb-2 flex items-center gap-2">
                    <span className="material-symbols-outlined text-base">sticky_note_2</span>
                    Nhận xét từ PO/SM
                  </h2>
                  <p className="text-sm text-amber-800 leading-relaxed">{summary.notes}</p>
                </div>
              </section>
            )}

          </div>
        )}
      </div>
    </MainLayout>
  );
}
