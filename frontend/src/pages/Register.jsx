import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import ThemeToggle from '../components/ThemeToggle';

export default function Register() {
  const [form, setForm] = useState({ email: '', password: '', confirmPassword: '', fullName: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const navigate = useNavigate();

  const passwordRequirements = [
    { label: 'Ít nhất 8 ký tự', test: (p) => p.length >= 8 },
    { label: 'Chữ hoa (A-Z)', test: (p) => /[A-Z]/.test(p) },
    { label: 'Chữ thường (a-z)', test: (p) => /[a-z]/.test(p) },
    { label: 'Số (0-9)', test: (p) => /\d/.test(p) },
    { label: 'Ký tự đặc biệt (@, $, !, ...)', test: (p) => /[@$!%*?&]/.test(p) },
  ];

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); 
    setSuccess(''); 
    setLoading(true);
    if (form.password !== form.confirmPassword) {
      setError('Mật khẩu nhập lại không khớp!');
      setLoading(false);
      return;
    }

    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!passwordRegex.test(form.password)) {
      setError('Mật khẩu không đạt yêu cầu bảo mật!');
      setLoading(false);
      return;
    }

    try {
      const baseUrl = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:5000/api`;
      const res = await axios.post(`${baseUrl}/register`, form);
      setSuccess('Đăng ký thành công! Đang chuyển hướng...');
      localStorage.setItem('userId', res.data.userId);
      setTimeout(() => navigate('/dashboard'), 1500);
    } catch (err) {
      setError(err.response?.data?.error || 'Lỗi kết nối server. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden transition-colors duration-500">
      {/* Theme Toggle - Top Right */}
      <div className="absolute top-6 right-6 z-50">
        <ThemeToggle />
      </div>

      {/* Background decoration */}
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-80 h-80 bg-primary/5 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-surface-container-lowest rounded-[2.5rem] p-8 md:p-12 shadow-2xl border border-outline-variant/10 z-10 animate-in fade-in zoom-in-95 duration-700">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-10 justify-center">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-primary-container flex items-center justify-center text-on-primary shadow-lg shadow-primary/20">
            <span className="material-symbols-outlined text-2xl">rocket_launch</span>
          </div>
          <span className="text-2xl font-black text-primary tracking-tighter font-['Manrope']">Mini Scrum</span>
        </div>

        <h1 className="text-3xl font-black text-on-surface tracking-tight text-center mb-2 font-['Manrope']">Tạo tài khoản</h1>
        <p className="text-on-surface-variant text-center mb-10 font-medium">Bắt đầu quản lý dự án một cách chuyên nghiệp.</p>

        {error && (
          <div className="bg-error/10 border border-error/20 rounded-2xl p-4 mb-8 flex items-center gap-3 text-error text-sm font-bold animate-in slide-in-from-top-2">
            <span className="material-symbols-outlined text-lg">error</span>
            {error}
          </div>
        )}

        {success && (
          <div className="bg-green-500/10 border border-green-500/20 rounded-2xl p-4 mb-8 flex items-center gap-3 text-green-600 dark:text-green-400 text-sm font-bold animate-in slide-in-from-top-2">
            <span className="material-symbols-outlined text-lg">check_circle</span>
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <label className="text-sm font-bold text-on-surface-variant ml-1">Họ và tên</label>
            <input
              type="text" 
              name="fullName" 
              placeholder="Nguyễn Văn A"
              value={form.fullName} 
              onChange={handleChange}
              className="w-full px-5 py-4 bg-surface-container-low border border-outline-variant/10 rounded-2xl text-on-surface focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all font-medium" 
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-bold text-on-surface-variant ml-1">Email</label>
            <input
              type="email" 
              name="email" 
              placeholder="name@company.com"
              value={form.email} 
              onChange={handleChange}
              className="w-full px-5 py-4 bg-surface-container-low border border-outline-variant/10 rounded-2xl text-on-surface focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all font-medium" 
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-bold text-on-surface-variant ml-1">Mật khẩu</label>
            <div className="relative group">
              <input
                type={showPassword ? "text" : "password"} 
                name="password" 
                placeholder="••••••••"
                value={form.password} 
                onChange={handleChange}
                className="w-full px-5 py-4 bg-surface-container-low border border-outline-variant/10 rounded-2xl text-on-surface focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all font-medium pr-12"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant/50 hover:text-primary transition-colors focus:outline-none"
              >
                <span className="material-symbols-outlined text-xl">
                  {showPassword ? 'visibility_off' : 'visibility'}
                </span>
              </button>
            </div>
            
            {/* Password Requirements UI */}
            <div className="mt-4 p-4 bg-surface-container rounded-2xl border border-outline-variant/5 space-y-2 animate-in fade-in slide-in-from-top-1 duration-500">
              <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant/50 mb-2 px-1">Yêu cầu mật khẩu</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2">
                {passwordRequirements.map((req, index) => {
                  const isMet = req.test(form.password);
                  return (
                    <div key={index} className="flex items-center gap-2 px-1">
                      <div className={`w-4 h-4 rounded-full flex items-center justify-center transition-all duration-500 ${isMet ? 'bg-primary shadow-lg shadow-primary/20 scale-110' : 'bg-outline-variant/20'}`}>
                        <span className={`material-symbols-outlined text-[10px] font-bold ${isMet ? 'text-on-primary' : 'text-transparent'}`}>check</span>
                      </div>
                      <span className={`text-[11px] font-bold transition-colors duration-500 ${isMet ? 'text-on-surface' : 'text-on-surface-variant/40'}`}>
                        {req.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-bold text-on-surface-variant ml-1">Nhập lại mật khẩu</label>
            <div className="relative group">
              <input
                type={showConfirmPassword ? "text" : "password"} 
                name="confirmPassword" 
                placeholder="••••••••"
                value={form.confirmPassword} 
                onChange={handleChange}
                className="w-full px-5 py-4 bg-surface-container-low border border-outline-variant/10 rounded-2xl text-on-surface focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all font-medium pr-12"
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant/50 hover:text-primary transition-colors focus:outline-none"
              >
                <span className="material-symbols-outlined text-xl">
                  {showConfirmPassword ? 'visibility_off' : 'visibility'}
                </span>
              </button>
            </div>
          </div>
          <button 
            type="submit" 
            disabled={loading}
            className="w-full py-4 bg-primary text-on-primary rounded-2xl font-black shadow-xl shadow-primary/20 hover:scale-[0.98] active:scale-95 disabled:opacity-70 transition-all text-base mt-4 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <div className="w-5 h-5 border-2 border-on-primary/20 border-t-on-primary rounded-full animate-spin" />
                Đang xử lý...
              </>
            ) : "Đăng ký ngay"}
          </button>
        </form>

        <div className="relative my-10">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-outline-variant/10"></div>
          </div>
          <div className="relative flex justify-center text-xs uppercase font-black tracking-widest text-on-surface-variant/40">
            <span className="bg-surface-container-lowest px-4">Hoặc</span>
          </div>
        </div>

        <p className="text-center text-on-surface-variant font-medium">
          Đã có tài khoản?{" "}
          <Link to="/login" className="text-primary font-black hover:underline underline-offset-4 decoration-2">Đăng nhập</Link>
        </p>
      </div>
    </div>
  );
}
