import api from './api';

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
