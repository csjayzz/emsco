import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000'
});

// Attach JWT to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('ems_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Clear token on 401 (expired / invalid)
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('ems_token');
      window.location.reload();
    }
    return Promise.reject(err);
  }
);

export default api;
