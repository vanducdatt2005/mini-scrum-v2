import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import ThemeToggle from "../components/ThemeToggle";
import { loginUser } from "../services/api"; // 🌟 Bước 1: Import hàm chuẩn từ api.js

function Login() {
  const [form, setForm] = useState({ email: "", password: "" });
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      // 🌟 Bước 2: Thay thế toàn bộ đoạn fetch cũ bằng hàm loginUser
      const res = await loginUser(form);
      const data = res.data; // Axios trả kết quả về trong object .data

      // Lưu trữ thông tin đăng nhập vào localStorage
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      
      // Cập nhật Context trạng thái đăng nhập toàn hệ thống
      login(data.user);
      navigate("/dashboard");
    } catch (error) {
      // 🌟 Bước 3: Đọc lỗi trả về từ Backend thông qua Axios một cách an toàn
      const errorMsg = error.response?.data?.error || "Không thể kết nối server";
      setMessage(errorMsg);
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
      <div className="absolute top-[-10%] right-[-10%] w-96 h-96 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-80 h-80 bg-primary/5 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-surface-container-lowest rounded-[2.5rem] p-8 md:p-12 shadow-2xl border border-outline-variant/10 z-10 animate-in fade-in zoom-in-95 duration-700">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-10 justify-center">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-primary-container flex items-center justify-center text-on-primary shadow-lg shadow-primary/20">
            <span className="material-symbols-outlined text-2xl">rocket_launch</span>
          </div>
          <span className="text-2xl font-black text-primary tracking-tighter font-['Manrope']">Mini Scrum</span>
        </div>

        <h1 className="text-3xl font-black text-on-surface tracking-tight text-center mb-2 font-['Manrope']">Chào mừng trở lại!</h1>
        <p className="text-on-surface-variant text-center mb-10 font-medium">Hãy tiếp tục hành trình Scrum của bạn.</p>

        {message && (
          <div className="bg-error/10 border border-error/20 rounded-2xl p-4 mb-8 flex items-center gap-3 text-error text-sm font-bold animate-in slide-in-from-top-2">
            <span className="material-symbols-outlined text-lg">error</span>
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
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
            <input
              type="password" 
              name="password" 
              placeholder="••••••••"
              value={form.password} 
              onChange={handleChange}
              className="w-full px-5 py-4 bg-surface-container-low border border-outline-variant/10 rounded-2xl text-on-surface focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all font-medium"
              required
            />
          </div>
          
          <button 
            type="submit" 
            disabled={loading}
            className="w-full py-4 bg-primary text-on-primary rounded-2xl font-black shadow-xl shadow-primary/20 hover:scale-[0.98] active:scale-95 disabled:opacity-70 transition-all text-base mt-4 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <div className="w-5 h-5 border-2 border-on-primary/20 border-t-on-primary rounded-full animate-spin" />
                Đang đăng nhập...
              </>
            ) : "Đăng nhập ngay"}
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
          Mới tham gia?{" "}
          <Link to="/register" className="text-primary font-black hover:underline underline-offset-4 decoration-2">Tạo tài khoản</Link>
        </p>
      </div>
    </div>
  );
}

export default Login;