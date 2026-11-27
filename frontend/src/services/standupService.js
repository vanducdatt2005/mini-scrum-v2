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

/**
 * Lấy danh sách Blocker trong Sprint ("Ai đang kẹt" - AC1)
 * GET /api/sprints/:sprintId/blockers?status=OPEN|CLOSED|ALL
 */
export const getSprintBlockers = async (sprintId, status = 'OPEN') => {
    const response = await api.get(`/sprints/${sprintId}/blockers`, {
        params: status ? { status } : {}
    });
    return response.data;
};

/**
 * Gỡ / Đóng Blocker dành cho SM/PO (AC2 & DoD)
 * PATCH /api/sprints/:sprintId/blockers/:dailyId/resolve
 */
export const resolveSprintBlocker = async (sprintId, dailyId) => {
    const response = await api.patch(`/sprints/${sprintId}/blockers/${dailyId}/resolve`);
    return response.data;
};

/**
 * Lấy chi tiết 1 bản ghi Daily Standup gốc
 * GET /api/sprints/daily-standups/:dailyId
 */
export const getDailyStandupDetail = async (dailyId) => {
    const response = await api.get(`/sprints/daily-standups/${dailyId}`);
    return response.data;
};

/**
 * Lấy Bản tin hôm nay (Daily Digest / Team Standup Board - AC1, AC2)
 * GET /api/projects/:projectId/sprints/:sprintId/daily-digest?date=YYYY-MM-DD&onlyBlocked=false
 */
export const getDailyDigest = async (projectId, sprintId, date = '', onlyBlocked = false) => {
    const params = {};
    if (date) params.date = date;
    if (onlyBlocked) params.onlyBlocked = 'true';

    try {
        const response = await api.get(`/projects/${projectId}/sprints/${sprintId}/daily-digest`, { params });
        return response.data;
    } catch (err) {
        // Fallback sang endpoint theo sprintId
        const response = await api.get(`/sprints/${sprintId}/daily-digest`, { params });
        return response.data;
    }
};

/**
 * Lấy chuỗi ngày gửi Daily liên tiếp trong Sprint (Sprint Daily Streak)
 * GET /api/users/me/daily-streak?sprintId=...
 */
export const getMyDailyStreak = async (sprintId = null) => {
    const params = sprintId ? { sprintId } : {};
    const response = await api.get('/users/me/daily-streak', { params });
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
