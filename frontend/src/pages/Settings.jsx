import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import MainLayout from '../components/MainLayout';
import api, { getUserProfile, updateUserProfile, changePassword, getAvatarUrl } from '../services/api';
import { toast } from 'react-hot-toast';

export default function Settings() {
  const navigate = useNavigate();
  const { user, login } = useAuth() || {};
  
  // Profile state
  const [profileData, setProfileData] = useState({
    id: '',
    email: '',
    fullName: '',
    avatar: ''
  });
  
  // Password state
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  
  // States for changes/validation
  const [initialName, setInitialName] = useState('');
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  
  const [loading, setLoading] = useState(true);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await getUserProfile();
        const data = res.data;
        setProfileData({
          id: data.id || '',
          email: data.email || '',
          fullName: data.fullName || '',
          avatar: data.avatar || ''
        });
        setInitialName(data.fullName || '');
        if (data.avatar) {
          setAvatarPreview(getAvatarUrl(data.avatar));
        }
      } catch (err) {
        toast.error('Không thể tải thông tin cá nhân.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, []);

  // Handle Text inputs
  const handleProfileChange = (e) => {
    const { value } = e.target;
    setProfileData(prev => ({ ...prev, fullName: value }));
    
    // Validate fullName (không chứa ký tự đặc biệt như @, #, $, ...)
    const specialCharRegex = /[@#\$%\^&\*\(\)\+=\{\}\[\]\<\>\?\/\\\|~`_]/;
    if (!value || value.trim() === '') {
      setErrors(prev => ({ ...prev, fullName: 'Họ và tên không được để trống' }));
    } else if (specialCharRegex.test(value)) {
      setErrors(prev => ({ ...prev, fullName: 'Họ và tên không được chứa ký tự đặc biệt (@, #, $, ...)' }));
    } else {
      setErrors(prev => {
        const { fullName, ...rest } = prev;
        return rest;
      });
    }
  };

  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswordData(prev => ({ ...prev, [name]: value }));

    if (name === 'newPassword') {
      const isLengthValid = value.length >= 8;
      const hasLetterAndNumber = /^(?=.*[A-Za-z])(?=.*\d)/.test(value);
      
      if (value && (!isLengthValid || !hasLetterAndNumber)) {
        setErrors(prev => ({ ...prev, newPassword: 'Mật khẩu mới chưa đạt yêu cầu bảo mật' }));
      } else {
        setErrors(prev => {
          const { newPassword, ...rest } = prev;
          return rest;
        });
      }
    }

    if (name === 'confirmPassword' || name === 'newPassword') {
      const otherValue = name === 'confirmPassword' ? passwordData.newPassword : value;
      const thisValue = name === 'confirmPassword' ? value : passwordData.confirmPassword;
      if (thisValue && thisValue !== otherValue) {
        setErrors(prev => ({ ...prev, confirmPassword: 'Mật khẩu xác nhận không khớp' }));
      } else {
        setErrors(prev => {
          const { confirmPassword, ...rest } = prev;
          return rest;
        });
      }
    }
  };

  // Handle file select
  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Chỉ chấp nhận các định dạng file ảnh (.jpg, .jpeg, .png)');
      return;
    }

    // Validate size (5MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error('Dung lượng ảnh tối đa không quá 5MB');
      return;
    }

    setAvatarFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setAvatarPreview(reader.result);
    };
    reader.readAsDataURL(file);
  };

  // Check if form is dirty (has changes)
  const isProfileChanged = profileData.fullName !== initialName || avatarFile !== null;
  const isPasswordEntered = passwordData.currentPassword !== '' || passwordData.newPassword !== '' || passwordData.confirmPassword !== '';
  const hasChanges = isProfileChanged || isPasswordEntered;

  // Check validation rules
  const isProfileValid = profileData.fullName.trim() !== '' && !errors.fullName;
  const isPasswordValid = !isPasswordEntered || (
    passwordData.currentPassword !== '' &&
    passwordData.newPassword !== '' &&
    passwordData.confirmPassword !== '' &&
    passwordData.newPassword.length >= 8 &&
    /^(?=.*[A-Za-z])(?=.*\d)/.test(passwordData.newPassword) &&
    passwordData.newPassword === passwordData.confirmPassword &&
    !errors.confirmPassword
  );

  const canSubmit = hasChanges && isProfileValid && isPasswordValid && !submitLoading;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;

    setSubmitLoading(true);
    let success = false;
    let updatedUser = null;

    try {
      // 1. Save Profile Info (Fullname/Avatar)
      if (isProfileChanged) {
        const formData = new FormData();
        formData.append('fullName', profileData.fullName.trim());
        if (avatarFile) {
          formData.append('avatar', avatarFile);
        }

        const res = await updateUserProfile(formData);
        updatedUser = res.data.user;
        setInitialName(updatedUser.fullName);
        setProfileData(prev => ({
          ...prev,
          fullName: updatedUser.fullName,
          avatar: updatedUser.avatar
        }));
        setAvatarFile(null);
        success = true;
      }

      // 2. Change password if entered
      if (isPasswordEntered) {
        await changePassword({
          currentPassword: passwordData.currentPassword,
          newPassword: passwordData.newPassword,
          confirmPassword: passwordData.confirmPassword
        });
        
        setPasswordData({
          currentPassword: '',
          newPassword: '',
          confirmPassword: ''
        });
        success = true;
      }

      if (success) {
        toast.success('Cập nhật thông tin cá nhân thành công!');
        // Update reactive Auth Context if user updated profile info
        if (updatedUser && login) {
          login({
            ...user,
            fullName: updatedUser.fullName,
            avatar: updatedUser.avatar
          });
        }
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Không thể lưu thay đổi. Vui lòng thử lại.');
      console.error(err);
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleCancel = () => {
    if (window.confirm('Bạn có chắc chắn muốn hủy bỏ toàn bộ các thay đổi chưa lưu?')) {
      // Reset profile values
      setProfileData(prev => ({
        ...prev,
        fullName: initialName
      }));
      setAvatarFile(null);
      if (profileData.avatar) {
        setAvatarPreview(getAvatarUrl(profileData.avatar));
      } else {
        setAvatarPreview(null);
      }
      
      // Reset password values
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });

      // Clear errors
      setErrors({});
      
      toast.success('Đã hủy bỏ các thay đổi.');
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-surface">
      <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
    </div>
  );

  return (
    <MainLayout activePage="Settings">
      <div className="max-w-4xl mx-auto py-6 font-['Inter']">
        {/* Header */}
        <header className="mb-8 px-4 md:px-0">
          <h1 className="text-4xl font-black text-on-surface tracking-tighter mb-2 font-['Manrope']">
            Cài đặt cá nhân
          </h1>
          <p className="text-on-surface-variant font-medium">
            Quản lý thông tin tài khoản, ảnh đại diện và bảo mật mật khẩu của bạn.
          </p>
        </header>

        {/* Content Box */}
        <div className="bg-white dark:bg-surface-container-low rounded-[2rem] md:rounded-[3rem] shadow-xl shadow-surface-variant/5 border border-outline-variant/10 overflow-hidden">
          <form onSubmit={handleSubmit} className="divide-y divide-outline-variant/10">
            {/* SECTION 1: PROFILE INFO */}
            <div className="p-8 md:p-12 space-y-8">
              <h2 className="text-xl font-bold text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">person</span>
                Thông tin cá nhân
              </h2>

              <div className="flex flex-col md:flex-row gap-8 items-start">
                {/* Avatar upload */}
                <div className="flex flex-col items-center gap-4 shrink-0 w-full md:w-auto">
                  <div className="relative group">
                    <div className="w-28 h-28 md:w-32 md:h-32 rounded-full overflow-hidden bg-primary/10 border-2 border-primary/20 flex items-center justify-center text-primary font-bold text-3xl md:text-4xl shadow-inner">
                      {avatarPreview ? (
                        <img src={avatarPreview} alt="Avatar Preview" className="w-full h-full object-cover" />
                      ) : (
                        profileData.fullName?.charAt(0).toUpperCase() || 'U'
                      )}
                    </div>
                    <label className="absolute inset-0 bg-black/40 hover:bg-black/60 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-xs font-bold gap-1">
                      <span className="material-symbols-outlined text-sm">photo_camera</span>
                      Thay đổi
                      <input 
                        type="file" 
                        accept="image/png, image/jpeg, image/jpg" 
                        onChange={handleAvatarChange} 
                        className="hidden" 
                      />
                    </label>
                  </div>
                  <div className="text-center text-[10px] text-on-surface-variant opacity-75">
                    Hỗ trợ .jpg, .png (Max 5MB)
                  </div>
                </div>

                {/* Form fields */}
                <div className="flex-1 w-full space-y-6">
                  {/* User ID */}
                  <div className="space-y-2">
                    <label className="block text-xs font-black text-primary uppercase tracking-widest px-1">Mã định danh (User ID)</label>
                    <input
                      type="text"
                      value={profileData.id}
                      disabled
                      className="w-full bg-surface-container-high px-5 py-3.5 rounded-2xl border border-outline-variant/10 outline-none text-sm font-bold text-on-surface-variant cursor-not-allowed opacity-75"
                    />
                  </div>

                  {/* Email */}
                  <div className="space-y-2">
                    <label className="block text-xs font-black text-primary uppercase tracking-widest px-1">Email / Tên đăng nhập</label>
                    <input
                      type="text"
                      value={profileData.email}
                      disabled
                      className="w-full bg-surface-container-high px-5 py-3.5 rounded-2xl border border-outline-variant/10 outline-none text-sm font-bold text-on-surface-variant cursor-not-allowed opacity-75"
                    />
                  </div>

                  {/* Fullname */}
                  <div className="space-y-2">
                    <label className="block text-xs font-black text-primary uppercase tracking-widest px-1">Họ và tên <span className="text-error">*</span></label>
                    <input
                      type="text"
                      value={profileData.fullName}
                      onChange={handleProfileChange}
                      placeholder="Nhập họ và tên..."
                      className={`w-full bg-surface-container-low px-5 py-3.5 rounded-2xl border outline-none text-sm font-bold text-on-surface placeholder:text-on-surface-variant/30 focus:ring-4 focus:ring-primary/5 transition-all
                        ${errors.fullName ? 'border-error focus:border-error focus:ring-error/5' : 'border-outline-variant/10 focus:border-primary'}`}
                      required
                    />
                    {errors.fullName && (
                      <p className="text-xs font-medium text-error px-1">{errors.fullName}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* SECTION 2: PASSWORD SETTINGS */}
            <div className="p-8 md:p-12 space-y-8">
              <h2 className="text-xl font-bold text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">security</span>
                Bảo mật &amp; Đổi mật khẩu
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Form fields */}
                <div className="space-y-6">
                  {/* Current Password */}
                  <div className="space-y-2">
                    <label className="block text-xs font-black text-primary uppercase tracking-widest px-1">Mật khẩu hiện tại</label>
                    <input
                      type="password"
                      name="currentPassword"
                      value={passwordData.currentPassword}
                      onChange={handlePasswordChange}
                      placeholder="Nhập mật khẩu hiện tại..."
                      className="w-full bg-surface-container-low px-5 py-3.5 rounded-2xl border border-outline-variant/10 outline-none text-sm font-medium text-on-surface placeholder:text-on-surface-variant/30 focus:border-primary focus:ring-4 focus:ring-primary/5 transition-all"
                    />
                  </div>

                  {/* New Password */}
                  <div className="space-y-2">
                    <label className="block text-xs font-black text-primary uppercase tracking-widest px-1">Mật khẩu mới</label>
                    <input
                      type="password"
                      name="newPassword"
                      value={passwordData.newPassword}
                      onChange={handlePasswordChange}
                      placeholder="Nhập mật khẩu mới..."
                      className={`w-full bg-surface-container-low px-5 py-3.5 rounded-2xl border outline-none text-sm font-medium text-on-surface placeholder:text-on-surface-variant/30 focus:ring-4 focus:ring-primary/5 transition-all
                        ${errors.newPassword ? 'border-error focus:border-error focus:ring-error/5' : 'border-outline-variant/10 focus:border-primary'}`}
                    />
                  </div>

                  {/* Confirm Password */}
                  <div className="space-y-2">
                    <label className="block text-xs font-black text-primary uppercase tracking-widest px-1">Xác nhận mật khẩu mới</label>
                    <input
                      type="password"
                      name="confirmPassword"
                      value={passwordData.confirmPassword}
                      onChange={handlePasswordChange}
                      placeholder="Xác nhận lại mật khẩu mới..."
                      className={`w-full bg-surface-container-low px-5 py-3.5 rounded-2xl border outline-none text-sm font-medium text-on-surface placeholder:text-on-surface-variant/30 focus:ring-4 focus:ring-primary/5 transition-all
                        ${errors.confirmPassword ? 'border-error focus:border-error focus:ring-error/5' : 'border-outline-variant/10 focus:border-primary'}`}
                    />
                    {errors.confirmPassword && (
                      <p className="text-xs font-medium text-error px-1">{errors.confirmPassword}</p>
                    )}
                  </div>
                </div>

                {/* Password strength checklist */}
                <div className="bg-surface-container-low p-6 rounded-3xl border border-outline-variant/10 flex flex-col justify-center space-y-4">
                  <h3 className="text-xs font-black text-primary uppercase tracking-wider">Yêu cầu cho mật khẩu mới:</h3>
                  <ul className="space-y-3">
                    <li className="flex items-center gap-3 text-xs font-medium">
                      <span className={`material-symbols-outlined text-base leading-none
                        ${passwordData.newPassword.length >= 8 ? 'text-green-500 font-bold' : 'text-on-surface-variant/40'}`}>
                        {passwordData.newPassword.length >= 8 ? 'check_circle' : 'circle'}
                      </span>
                      <span className={passwordData.newPassword.length >= 8 ? 'text-green-600 dark:text-green-400' : 'text-on-surface-variant'}>
                        Tối thiểu 8 ký tự
                      </span>
                    </li>
                    <li className="flex items-center gap-3 text-xs font-medium">
                      <span className={`material-symbols-outlined text-base leading-none
                        ${/^(?=.*[A-Za-z])(?=.*\d)/.test(passwordData.newPassword) ? 'text-green-500 font-bold' : 'text-on-surface-variant/40'}`}>
                        {/^(?=.*[A-Za-z])(?=.*\d)/.test(passwordData.newPassword) ? 'check_circle' : 'circle'}
                      </span>
                      <span className={/^(?=.*[A-Za-z])(?=.*\d)/.test(passwordData.newPassword) ? 'text-green-600 dark:text-green-400' : 'text-on-surface-variant'}>
                        Bao gồm cả chữ và số (ví dụ: a-z, 0-9)
                      </span>
                    </li>
                  </ul>
                  <div className="text-[10px] text-on-surface-variant/60 leading-relaxed pt-2 border-t border-outline-variant/5">
                    Mật khẩu có độ bảo mật cao giúp tài khoản của bạn an toàn hơn trước các truy cập trái phép.
                  </div>
                </div>
              </div>
            </div>

            {/* ACTION FOOTER */}
            <div className="p-8 md:p-12 flex flex-col sm:flex-row items-center gap-4 bg-surface-container-lowest">
              <button
                type="submit"
                disabled={!canSubmit}
                className={`w-full sm:w-auto px-12 py-4 rounded-2xl font-black text-sm flex items-center justify-center gap-3 shadow-xl transition-all duration-200 active:scale-95
                  ${canSubmit
                    ? 'bg-primary text-on-primary shadow-primary/20 hover:scale-[0.98]'
                    : 'bg-surface-container-high text-on-surface-variant/40 border border-outline-variant/5 shadow-none cursor-not-allowed opacity-50'}`}
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
                onClick={handleCancel}
                disabled={!hasChanges || submitLoading}
                className={`w-full sm:w-auto px-10 py-4 rounded-2xl font-black text-sm border transition-all duration-200 active:scale-95
                  ${hasChanges && !submitLoading
                    ? 'bg-surface-container text-on-surface-variant border-outline-variant/20 hover:bg-surface-container-high'
                    : 'bg-surface-container-low text-on-surface-variant/20 border-transparent shadow-none cursor-not-allowed opacity-50'}`}
              >
                Hủy bỏ
              </button>
            </div>
          </form>
        </div>
      </div>
    </MainLayout>
  );
}
