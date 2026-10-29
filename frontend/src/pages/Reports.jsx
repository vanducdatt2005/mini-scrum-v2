import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import MainLayout from '../components/MainLayout';
import BurndownChart from '../components/analytics/BurndownChart';
import VelocityChart from '../components/analytics/VelocityChart';
import api from '../services/api';

export default function Reports() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [sprints, setSprints] = useState([]);
  const [selectedSprintId, setSelectedSprintId] = useState('');
  const [burndownData, setBurndownData] = useState([]);
  const [velocityData, setVelocityData] = useState([]);
  // 'burndown' | 'velocity' | 'summary'
  const [activeTab, setActiveTab] = useState('burndown');
  const [userRole, setUserRole] = useState(null);
  const [isAuthorized, setIsAuthorized] = useState(true);
  const [isBurndownLoading, setIsBurndownLoading] = useState(false);
  const [isVelocityLoading, setIsVelocityLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Check role
    api.get(`/project/${projectId}/role`)
      .then(res => {
        const role = res.data.role;
        setUserRole(role);
        if (role !== 'PO' && role !== 'SM') {
          setIsAuthorized(false);
          setIsBurndownLoading(false);
          setIsVelocityLoading(false);
        }
      })
      .catch(err => {
        console.error("Error fetching role:", err);
        setIsAuthorized(false);
      });

    // Load sprints
    api.get(`/project/${projectId}/sprints`).then(res => {
      setSprints(res.data);
      const active = res.data.find(s => s.status === 'ACTIVE');
      if (active) setSelectedSprintId(active.id);
      else if (res.data.length > 0) setSelectedSprintId(res.data[0].id);
      else setIsBurndownLoading(false);
    }).catch(err => {
      console.error(err);
      setError("Không thể tải danh sách Sprint");
    });
  }, [projectId]);

  useEffect(() => {
    if (!isAuthorized) return;
    setIsVelocityLoading(true);
    api.get(`/analytics/${projectId}/velocity`).then(res => {
      setVelocityData(res.data);
      setIsVelocityLoading(false);
    }).catch(err => {
      console.error(err);
      setIsVelocityLoading(false);
    });
  }, [projectId, isAuthorized]);

  useEffect(() => {
    if (selectedSprintId) {
      setIsBurndownLoading(true);
      api.get(`/analytics/${projectId}/sprint/${selectedSprintId}/burndown`)
        .then(res => {
          setBurndownData(res.data);
          setIsBurndownLoading(false);
          setError(null);
        })
        .catch(err => {
          console.error(err);
          setBurndownData([]);
          setIsBurndownLoading(false);
          setError("Không thể tải dữ liệu Burndown");
        });
    } else {
      setIsBurndownLoading(false);
    }
  }, [projectId, selectedSprintId]);

  const downloadReport = async (format) => {
    if (!selectedSprintId) return;
    try {
      const response = await api.get(
        `/analytics/${projectId}/sprint/${selectedSprintId}/report?format=${format}`,
        { responseType: 'blob' }
      );
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Sprint_Report.${format === 'excel' ? 'xlsx' : 'pdf'}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error("Export failed", error);
      alert("Lỗi khi xuất báo cáo");
    }
  };

  const isLoading = activeTab === 'burndown' ? isBurndownLoading : isVelocityLoading;

  return (
    <MainLayout activePage="Reports" projectId={projectId}>
      <div className="max-w-6xl mx-auto py-6">
        {/* ── HEADER ── */}
        <header className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6 px-4 md:px-0">
          <div>
            <h1 className="text-4xl font-black text-on-surface tracking-tighter mb-2 font-['Manrope']">
              Báo cáo &amp; Phân tích
            </h1>
            <p className="text-on-surface-variant font-medium">Theo dõi hiệu suất và tiến độ của Sprint</p>
          </div>

          {/* Tab switcher */}
          <div className="flex bg-surface-container-high p-1 rounded-2xl border border-outline-variant/10 w-full md:w-auto">
            <button
              onClick={() => setActiveTab('burndown')}
              className={`flex-1 md:flex-none px-6 py-2.5 rounded-xl font-bold text-sm transition-all ${
                activeTab === 'burndown'
                  ? 'bg-primary text-on-primary shadow-lg shadow-primary/20'
                  : 'text-on-surface-variant hover:text-primary'
              }`}
            >
              Burndown
            </button>
            <button
              onClick={() => setActiveTab('velocity')}
              className={`flex-1 md:flex-none px-6 py-2.5 rounded-xl font-bold text-sm transition-all ${
                activeTab === 'velocity'
                  ? 'bg-primary text-on-primary shadow-lg shadow-primary/20'
                  : 'text-on-surface-variant hover:text-primary'
              }`}
            >
              Velocity
            </button>
            <button
              id="tab-summary"
              onClick={() => setActiveTab('summary')}
              className={`flex-1 md:flex-none px-6 py-2.5 rounded-xl font-bold text-sm transition-all ${
                activeTab === 'summary'
                  ? 'bg-primary text-on-primary shadow-lg shadow-primary/20'
                  : 'text-on-surface-variant hover:text-primary'
              }`}
            >
              Tổng kết
            </button>
          </div>
        </header>

        {/* ── BODY ── */}
        {!isAuthorized ? (
          /* Không có quyền */
          <div className="flex flex-col items-center justify-center py-20 px-6 animate-in fade-in zoom-in duration-500">
            <div className="bg-white/80 backdrop-blur-xl p-12 md:p-16 rounded-[4rem] border border-outline-variant/10 shadow-2xl shadow-primary/10 text-center max-w-2xl relative overflow-hidden">
              <div className="absolute -top-24 -right-24 w-48 h-48 bg-error/5 rounded-full blur-3xl" />
              <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-primary/5 rounded-full blur-3xl" />
              <div className="relative z-10">
                <div className="w-28 h-28 bg-gradient-to-br from-error/20 to-error/5 text-error rounded-[2.5rem] flex items-center justify-center mx-auto mb-10 shadow-inner">
                  <span className="material-symbols-outlined text-6xl leading-none">lock_person</span>
                </div>
                <h2 className="text-4xl font-black text-on-surface mb-6 font-['Manrope'] tracking-tight">
                  Quyền truy cập hạn chế
                </h2>
                <p className="text-on-surface-variant font-medium text-lg leading-relaxed mb-10">
                  Rất tiếc! Bạn đang đăng nhập với tư cách là{' '}
                  <span className="text-primary font-black px-2 py-1 bg-primary/5 rounded-lg border border-primary/10">Member</span>.{' '}
                  Dữ liệu phân tích chuyên sâu và báo cáo Sprint chỉ dành riêng cho{' '}
                  <span className="text-on-surface font-bold">Product Owner</span> và{' '}
                  <span className="text-on-surface font-bold">Scrum Master</span>.
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                  <button
                    onClick={() => window.history.back()}
                    className="group px-10 py-4 bg-primary text-on-primary rounded-2xl font-black text-sm hover:shadow-2xl hover:shadow-primary/30 transition-all flex items-center gap-3 active:scale-95"
                  >
                    <span className="material-symbols-outlined text-xl group-hover:-translate-x-1 transition-transform">arrow_back</span>
                    Quay lại trang trước
                  </button>
                  <button
                    onClick={() => window.location.href = '/dashboard'}
                    className="px-10 py-4 bg-surface-container-high text-on-surface-variant rounded-2xl font-black text-sm hover:bg-surface-container-highest transition-all active:scale-95"
                  >
                    Về Dashboard
                  </button>
                </div>
              </div>
              <div className="mt-12 pt-8 border-t border-outline-variant/5">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant opacity-30">
                  Mini Scrum Safety &amp; Permissions Engine
                </p>
              </div>
            </div>
          </div>

        ) : activeTab === 'summary' ? (
          /* ── TAB: TỔNG KẾT SPRINT ── */
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 px-4 md:px-0">
            {/* Sprint selector */}
            <div className="lg:col-span-1">
              <div className="bg-white p-6 rounded-[2rem] border border-outline-variant/10 shadow-sm">
                <label className="block text-xs font-black text-primary uppercase tracking-widest mb-4">
                  Chọn Sprint
                </label>
                <select
                  id="summary-sprint-select"
                  value={selectedSprintId}
                  onChange={e => setSelectedSprintId(e.target.value)}
                  className="w-full p-4 bg-surface-container-lowest border border-outline-variant/20 rounded-2xl font-bold text-sm focus:ring-2 focus:ring-primary/20 outline-none appearance-none"
                >
                  {sprints.length > 0 ? (
                    sprints.map(s => (
                      <option key={s.id} value={s.id}>{s.name} ({s.status})</option>
                    ))
                  ) : (
                    <option value="">Chưa có Sprint</option>
                  )}
                </select>
                <button
                  id="btn-go-to-summary"
                  disabled={!selectedSprintId}
                  onClick={() => navigate(`/projects/${projectId}/sprints/${selectedSprintId}/summary`)}
                  className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary text-on-primary rounded-2xl font-bold text-sm hover:shadow-lg hover:shadow-primary/25 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="material-symbols-outlined text-base leading-none">open_in_new</span>
                  Xem tổng kết Sprint
                </button>
              </div>
            </div>

            {/* Preview panel */}
            <div className="lg:col-span-3">
              <div className="bg-white p-8 md:p-12 rounded-[3.5rem] border border-outline-variant/10 shadow-xl shadow-primary/5 min-h-[400px] flex flex-col items-center justify-center gap-6 text-center">
                <div className="w-24 h-24 rounded-[2rem] bg-primary/5 flex items-center justify-center">
                  <span className="material-symbols-outlined text-5xl text-primary">emoji_events</span>
                </div>
                <div>
                  <h3 className="text-xl font-black text-on-surface font-['Manrope'] mb-2">
                    Tổng kết &amp; Đánh giá Đóng Góp
                  </h3>
                  <p className="text-on-surface-variant text-sm max-w-sm mx-auto">
                    Chọn Sprint bên trái và nhấn &ldquo;Xem tổng kết&rdquo; để xem bảng đóng góp cá nhân,
                    biểu đồ phân bổ và chỉ số đặc trưng theo vai trò.
                  </p>
                </div>
                {selectedSprintId && (
                  <button
                    onClick={() => navigate(`/projects/${projectId}/sprints/${selectedSprintId}/summary`)}
                    className="flex items-center gap-2 px-6 py-3 bg-primary text-on-primary rounded-2xl font-black text-sm hover:shadow-lg hover:shadow-primary/25 transition-all active:scale-95"
                  >
                    <span className="material-symbols-outlined text-lg leading-none">auto_awesome</span>
                    Đi tới trang Tổng kết
                  </button>
                )}
              </div>
            </div>
          </div>

        ) : (
          /* ── TAB: BURNDOWN / VELOCITY ── */
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 px-4 md:px-0">
            {/* Controls */}
            <div className="lg:col-span-1 space-y-6">
              {activeTab === 'burndown' && (
                <div className="bg-white p-6 rounded-[2rem] border border-outline-variant/10 shadow-sm animate-in slide-in-from-left-4">
                  <label className="block text-xs font-black text-primary uppercase tracking-widest mb-4">Chọn Sprint</label>
                  <select
                    value={selectedSprintId}
                    onChange={(e) => setSelectedSprintId(e.target.value)}
                    className="w-full p-4 bg-surface-container-lowest border border-outline-variant/20 rounded-2xl font-bold text-sm focus:ring-2 focus:ring-primary/20 outline-none appearance-none"
                  >
                    {sprints.length > 0 ? (
                      sprints.map(s => (
                        <option key={s.id} value={s.id}>{s.name} ({s.status})</option>
                      ))
                    ) : (
                      <option value="">Chưa có Sprint</option>
                    )}
                  </select>
                </div>
              )}

              <div className="bg-primary/5 p-6 rounded-[2rem] border border-primary/10">
                <h3 className="font-black text-primary mb-4">Xuất báo cáo Sprint</h3>
                <p className="text-xs text-on-surface-variant mb-6 leading-relaxed opacity-80">
                  Tải xuống báo cáo chi tiết bao gồm danh sách User Stories, điểm số và trạng thái hoàn thành.
                </p>
                <div className="space-y-3">
                  <button
                    onClick={() => downloadReport('pdf')}
                    disabled={!selectedSprintId}
                    className="w-full flex items-center justify-between px-6 py-3.5 bg-white text-on-surface-variant rounded-2xl font-bold text-sm hover:shadow-lg transition-all border border-outline-variant/10 group disabled:opacity-50"
                  >
                    <span className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-red-500">picture_as_pdf</span>
                      Báo cáo PDF
                    </span>
                    <span className="material-symbols-outlined text-sm opacity-0 group-hover:opacity-100 transition-opacity">download</span>
                  </button>
                  <button
                    onClick={() => downloadReport('excel')}
                    disabled={!selectedSprintId}
                    className="w-full flex items-center justify-between px-6 py-3.5 bg-white text-on-surface-variant rounded-2xl font-bold text-sm hover:shadow-lg transition-all border border-outline-variant/10 group disabled:opacity-50"
                  >
                    <span className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-green-600">table_chart</span>
                      Báo cáo Excel
                    </span>
                    <span className="material-symbols-outlined text-sm opacity-0 group-hover:opacity-100 transition-opacity">download</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Chart Display */}
            <div className="lg:col-span-3">
              <div className="bg-white p-8 md:p-12 rounded-[3.5rem] border border-outline-variant/10 shadow-xl shadow-primary/5 min-h-[560px] flex flex-col relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -mr-32 -mt-32" />

                <div className="mb-10 flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
                  <div>
                    <h2 className="text-2xl font-black text-on-surface font-['Manrope'] mb-1">
                      {activeTab === 'burndown' ? 'Tiến độ hoàn thành (Burndown Chart)' : 'Tốc độ thực hiện (Velocity Chart)'}
                    </h2>
                    <p className="text-sm font-medium text-on-surface-variant opacity-70">
                      {activeTab === 'burndown'
                        ? 'Theo dõi số điểm còn lại qua từng ngày của Sprint'
                        : 'So sánh lượng điểm mục tiêu và thực tế qua các Sprint'}
                    </p>
                  </div>

                  {activeTab === 'burndown' && burndownData.length > 0 && (
                    <div className="flex gap-4">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-primary" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Thực tế</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-slate-400" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Lý tưởng</span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex-1 flex flex-col justify-center relative z-10">
                  {error ? (
                    <div className="text-center py-20 px-10">
                      <span className="material-symbols-outlined text-5xl text-error mb-4">error</span>
                      <p className="text-on-surface-variant font-bold">{error}</p>
                      <button onClick={() => window.location.reload()} className="mt-4 text-primary text-sm font-black uppercase underline">Thử lại</button>
                    </div>
                  ) : isLoading ? (
                    <div className="flex flex-col items-center gap-4 py-20 opacity-40">
                      <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                      <span className="font-bold text-sm tracking-tight">Đang xử lý dữ liệu...</span>
                    </div>
                  ) : (
                    activeTab === 'burndown' ? (
                      <BurndownChart data={burndownData} />
                    ) : (
                      <VelocityChart data={velocityData} />
                    )
                  )}
                </div>

                <div className="mt-8 pt-8 border-t border-outline-variant/5 text-center relative z-10">
                  <p className="text-[11px] font-bold text-on-surface-variant opacity-40 uppercase tracking-widest">
                    Scrum Analytics Engine • Build 2.0
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
