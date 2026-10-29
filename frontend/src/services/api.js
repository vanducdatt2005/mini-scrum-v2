//frontend/src/services/api.js
import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || `http://${window.location.hostname}:5000/api`,
  headers: { 'Content-Type': 'application/json' },
});

// Thêm interceptor để tự động gắn token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

export const registerUser = (data) => api.post('/register', data);
export const loginUser = (data) => api.post('/login', data);

export const addMemberToProject = (projectId, data) =>
  api.post(`/project/${projectId}/members`, data);

export const updateProject = (id, data) => api.patch(`/project/${id}`, data);

export const getUserStory = (id) => api.get(`/userstory/${id}`);
export const createUserStory = (data) => api.post('/userstory', data);
export const updateUserStory = (id, data) => api.patch(`/userstory/${id}`, data);
export const deleteUserStory = (id) => api.delete(`/userstory/${id}`);
export const getStoriesByProject = (projectId) => api.get(`/project/${projectId}/userstories`);
export const getMyProjectRole = (projectId) => api.get(`/project/${projectId}/role`);
export const getDashboardStats = (projectId) => api.get(`/project/${projectId}/dashboard`);

// SPRINTS
export const getSprintsByProject = (projectId) => api.get(`/project/${projectId}/sprints`);
export const createSprint = (projectId, data) => api.post(`/project/${projectId}/sprints`, data);
export const updateSprint = (id, data) => api.patch(`/sprint/${id}`, data);
export const getSprintDetails = (id) => api.get(`/sprint/${id}`);

// REORDER
export const reorderStories = (stories) => api.patch('/userstory/reorder', { stories });

// TASKS
export const createStoryTask = (storyId, data) => api.post(`/userstory/${storyId}/tasks`, data);
export const updateTask = (id, data) => api.patch(`/tasks/${id}`, data);
export const assignTaskByEmail = (id, email) => api.patch(`/tasks/${id}/assign`, { email });
export const deleteTask = (id) => api.delete(`/tasks/${id}`);
export const getStoryTasks = (storyId) => api.get(`/userstory/${storyId}/tasks`);

// COMMENTS
export const getStoryComments = (storyId) => api.get(`/userstory/${storyId}/comments?t=${Date.now()}`);
export const createStoryComment = (storyId, content) => api.post(`/userstory/${storyId}/comments`, { content });
// TASK COMMENTS (US-046)
export const getTaskComments = (taskId) => api.get(`/tasks/${taskId}/comments?t=${Date.now()}`);
export const createTaskComment = (taskId, content) => api.post(`/tasks/${taskId}/comments`, { content });
// LỜI MỜI
export const getInvitations = () => api.get('/invitations');
export const respondToInvitation = (id, action) => api.post(`/invitations/${id}/respond`, { action });

export const uploadAttachment = (formData) => {
  return api.post('/attachments/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
};

export const getAttachments = (entityType, entityId) => {
  return api.get(`/attachments?${entityType}Id=${entityId}`);
};
// Thêm hàm này vào api.js
export const deleteAttachment = (id) => {
  return api.delete(`/attachments/${id}`);
};

// MEMBERS
export const getProjectMembers = (projectId) => api.get(`/project/${projectId}/members`);
export const deleteProject = (projectId) => api.delete(`/project/${projectId}`);

// SPRINT CEREMONIES (US-023 & US-024)
export const getSprintCeremonies = (sprintId) => api.get(`/sprints/${sprintId}/ceremonies`);
export const getSprintReview = (sprintId) => api.get(`/sprints/${sprintId}/review`);
export const saveSprintReview = (sprintId, data) => api.put(`/sprints/${sprintId}/review`, data);
export const getSprintRetrospective = (sprintId) => api.get(`/sprints/${sprintId}/retrospective`);
export const saveSprintRetrospective = (sprintId, data) => api.put(`/sprints/${sprintId}/retrospective`, data);

// NOTIFICATIONS
export const getNotifications = () => api.get('/notifications');
export const markNotificationAsRead = (id) => api.patch(`/notifications/${id}/read`);

// USER SETTINGS
export const getUserProfile = () => api.get('/user/profile');
export const updateUserProfile = (formData) => api.patch('/user/profile', formData, {
  headers: { 'Content-Type': 'multipart/form-data' }
});
export const changePassword = (data) => api.post('/user/change-password', data);

// AVATAR HELPER
export const getAvatarUrl = (avatarPath) => {
  if (!avatarPath) return null;
  if (avatarPath.startsWith('http://') || avatarPath.startsWith('https://') || avatarPath.startsWith('data:')) {
    return avatarPath;
  }
  const backendBase = import.meta.env.VITE_API_URL 
    ? import.meta.env.VITE_API_URL.replace(/\/api\/?$/, '') 
    : `http://${window.location.hostname}:5000`;
  return `${backendBase}${avatarPath}`;
};

export default api;
