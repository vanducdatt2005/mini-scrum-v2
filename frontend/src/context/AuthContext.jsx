import { createContext, useContext, useState, useEffect } from "react";
import { getUserProfile } from "../services/api";

const AuthContext = createContext();

export const useAuth = () => {
  return useContext(AuthContext);
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Tải nhanh từ localStorage để tránh chớp màn hình
    const savedUser = localStorage.getItem("user");
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (e) {
        console.error("Lỗi đọc user từ localStorage:", e);
      }
    }

    // 2. Tự động đồng bộ thông tin hồ sơ và avatar mới nhất từ server
    const token = localStorage.getItem("token");
    if (token) {
      getUserProfile()
        .then((res) => {
          if (res.data) {
            setUser((prev) => {
              const freshUser = { ...prev, ...res.data };
              localStorage.setItem("user", JSON.stringify(freshUser));
              return freshUser;
            });
          }
        })
        .catch((err) => {
          console.warn("Không thể tự động đồng bộ hồ sơ user từ server:", err?.message || err);
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, []);

  const login = (userData) => {
    setUser(userData);
    localStorage.setItem("user", JSON.stringify(userData));
  };

  const updateUser = (data) => {
    setUser((prev) => {
      const updated = { ...prev, ...data };
      localStorage.setItem("user", JSON.stringify(updated));
      return updated;
    });
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("user");
    localStorage.removeItem("token");
  };

  const value = {
    user,
    login,
    updateUser,
    logout,
    loading,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading ? children : <div>Đang tải...</div>}
    </AuthContext.Provider>
  );
};
