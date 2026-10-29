import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { toast } from 'react-hot-toast';

export default function EditProject() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ name: '', description: '', goal: '' });
  const [loading, setLoading] = useState(true);
  const [submitLoading, setSubmitLoading] = useState(false);

  useEffect(() => {
    const fetchProject = async () => {
      try {
        const res = await api.get(`/project/${id}`);
        setFormData({ 
          name: res.data.name || '', 
          description: res.data.description || '', 
          goal: res.data.goal || '' 
        });
      } catch (err) {
        toast.error(err.response?.data?.error || 'Không thể tải thông tin dự án.');
      } finally {
        setLoading(false);
      }
    };
    fetchProject();
  }, [id]);

  const handleChange = (e) => setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitLoading(true);
    try {
      await api.patch(`/project/${id}`, formData);
      toast.success('Cập nhật dự án thành công!');
      setTimeout(() => navigate(`/dashboard`), 1000);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Không thể lưu. Vui lòng thử lại.');
    } finally {
      setSubmitLoading(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-surface">
      <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-surface-container-lowest font-['Inter']">
      <nav className="bg-surface-container h-16 flex items-center justify-between px-6 border-b border-outline-variant/10 sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-on-primary">
            <span className="material-symbols-outlined text-lg">settings</span>
          </div>
          <span className="font-bold text-on-surface tracking-tight hidden sm:inline">Mini Scrum • Cài đặt Dự án</span>
        </div>
        <button 
          onClick={() => navigate(`/projects/${id}/backlog`)}
          className="px-4 py-2 bg-surface text-primary border border-primary/20 rounded-xl text-xs font-bold hover:bg-primary/5 transition-all"
        >
          ← Quay lại Dự án
        </button>
      </nav>

      <main className="max-w-3xl mx-auto py-8 md:py-16 px-4 md:px-6">
        <div className="bg-white rounded-[2rem] md:rounded-[3rem] shadow-2xl shadow-surface-variant/5 border border-outline-variant/10 overflow-hidden">
          <div className="p-8 md:p-12 border-b border-outline-variant/10 bg-surface-container-low">
            <div className="flex flex-col md:flex-row md:items-center gap-6">
              <div className="w-16 h-16 md:w-20 md:h-20 bg-primary/10 rounded-[1.5rem] flex items-center justify-center text-primary">
                <span className="material-symbols-outlined text-3xl md:text-4xl">edit_note</span>
              </div>
              <div className="flex-1">
                <h1 className="text-3xl md:text-4xl font-extrabold text-on-surface tracking-tighter mb-2">Chỉnh sửa dự án</h1>
                <p className="text-sm md:text-base text-on-surface-variant font-medium opacity-70">
                  Cập nhật tên, mục tiêu và mô tả để đội ngũ của bạn luôn đi đúng hướng.
                </p>
              </div>
            </div>
          </div>

          <div className="p-8 md:p-12">
            <form onSubmit={handleSubmit} className="space-y-8">
              <div className="space-y-3">
                <label className="block text-xs font-black text-primary uppercase tracking-widest px-1">Tên dự án <span className="text-error">*</span></label>
                <input
                  name="name" 
                  value={formData.name} 
                  onChange={handleChange}
                  placeholder="Ví dụ: Hệ thống quản lý kho"
                  className="w-full bg-surface-container-low px-6 py-4 rounded-2xl border border-outline-variant/10 focus:border-primary focus:ring-4 focus:ring-primary/5 outline-none transition-all text-sm font-bold text-on-surface placeholder:text-on-surface-variant/30"
                  required 
                  disabled={submitLoading}
                />
              </div>

              <div className="space-y-3">
                <label className="block text-xs font-black text-primary uppercase tracking-widest px-1">Mục tiêu dự án (Goal)</label>
                <textarea
                  name="goal" 
                  value={formData.goal} 
                  onChange={handleChange}
                  placeholder="Mục tiêu lớn nhất dự án muốn đạt được là gì?"
                  className="w-full bg-surface-container-low px-6 py-4 rounded-2xl border border-outline-variant/10 focus:border-primary focus:ring-4 focus:ring-primary/5 outline-none transition-all text-sm font-medium text-on-surface placeholder:text-on-surface-variant/30 min-h-[120px] resize-none"
                  disabled={submitLoading}
                />
              </div>

              <div className="space-y-3">
                <label className="block text-xs font-black text-primary uppercase tracking-widest px-1">Mô tả chi tiết</label>
                <textarea
                  name="description" 
                  value={formData.description} 
                  onChange={handleChange}
                  placeholder="Thêm các thông tin bổ sung về dự án..."
                  className="w-full bg-surface-container-low px-6 py-4 rounded-2xl border border-outline-variant/10 focus:border-primary focus:ring-4 focus:ring-primary/5 outline-none transition-all text-sm font-medium text-on-surface placeholder:text-on-surface-variant/30 min-h-[160px] resize-none"
                  disabled={submitLoading}
                />
              </div>

              <div className="pt-6 flex flex-col sm:flex-row items-center gap-4">
                <button
                  type="submit"
                  disabled={submitLoading}
                  className={`w-full sm:w-auto px-12 py-4 bg-primary text-on-primary rounded-2xl font-black shadow-xl shadow-primary/20 hover:scale-[0.98] active:scale-95 transition-all text-sm flex items-center justify-center gap-3 ${submitLoading ? 'opacity-70 cursor-not-allowed' : ''}`}
                >
                  {submitLoading ? (
                    <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  ) : (
                    <span className="material-symbols-outlined">save</span>
                  )}
                  {submitLoading ? 'Đang lưu...' : 'Lưu thay đổi'}
                </button>
                <button
                  type="button"
                  onClick={() => navigate(-1)}
                  className="w-full sm:w-auto px-10 py-4 bg-surface-container text-on-surface-variant rounded-2xl font-black text-sm border border-outline-variant/10 hover:bg-surface-container-high transition-all"
                >
                  Hủy bỏ
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Info Box */}
        <div className="mt-8 bg-primary/5 rounded-3xl p-6 border border-primary/10 flex items-start gap-4">
          <span className="material-symbols-outlined text-primary">info</span>
          <p className="text-xs text-primary/80 font-medium leading-relaxed">
            Mọi thay đổi về tên dự án sẽ ảnh hưởng đến tất cả thành viên trong nhóm. Hãy chắc chắn rằng bạn đã thảo luận với team trước khi thực hiện các thay đổi lớn.
          </p>
        </div>
      </main>
    </div>
  );
}
