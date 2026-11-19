import api from './api';

/**
 * Gửi báo cáo Daily Standup nhanh cho Sprint (3 fields)
 * POST /api/sprints/:sprintId/daily-standups
 */
export const submitSprintDailyStandup = async (sprintId, data) => {
    const response = await api.post(`/sprints/${sprintId}/daily-standups`, data);
    return response.data;
};

/**
 * Cập nhật báo cáo Daily đã gửi trong cùng ngày (Edit Same-Day Daily Standup)
 * PUT /api/sprints/:sprintId/daily-standups/:idOrToday
 */
export const updateSprintDailyStandup = async (sprintId, idOrToday, data) => {
    const target = idOrToday || 'today';
    const response = await api.put(`/sprints/${sprintId}/daily-standups/${target}`, data);
    return response.data;
};

/**
 * Lấy danh sách Daily Standup của các thành viên trong Sprint theo ngày
 * GET /api/sprints/:sprintId/daily-standups?date=YYYY-MM-DD
 */
export const getSprintDailyStandups = async (sprintId, date) => {
    const response = await api.get(`/sprints/${sprintId}/daily-standups`, {
        params: date ? { date } : {}
    });
    return response.data;
};

/**
 * Lấy trạng thái Daily hôm nay của user hiện tại trong Sprint
 * GET /api/sprints/:sprintId/daily-standups/me/today
 */
export const checkSprintTodayStandup = async (sprintId) => {
    const response = await api.get(`/sprints/${sprintId}/daily-standups/me/today`);
    return response.data;
};

// ==========================================
// TƯƠNG THÍCH VỚI DỰ ÁN (PROJECT-LEVEL FALLBACK)
// ==========================================
export const submitStandup = async (projectId, data) => {
    const response = await api.post(`/standups/project/${projectId}`, data);
    return response.data;
};

export const getProjectStandups = async (projectId) => {
    const response = await api.get(`/standups/project/${projectId}`);
    return response.data;
};

export const checkTodayStandup = async (projectId) => {
    const response = await api.get(`/standups/project/${projectId}/me/today`);
    return response.data;
};
