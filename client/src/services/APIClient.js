import axios from "axios";
import TokenManager from "./TokenManager";

const API_BASE_URL = "http://localhost:4000/api";

const APIClient = axios.create({
  baseURL: API_BASE_URL,
});

APIClient.interceptors.request.use((config) => {
  const token = TokenManager.getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

APIClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const status = error.response?.status;
    const refreshToken = TokenManager.getRefreshToken();
    const url = originalRequest?.url || '';

    if (
      status === 401 &&
      refreshToken &&
      !originalRequest?._retry &&
      !url.includes('/auth/login') &&
      !url.includes('/auth/register') &&
      !url.includes('/auth/refresh')
    ) {
      originalRequest._retry = true;

      try {
        const res = await axios.post(`${API_BASE_URL}/auth/refresh`, { refreshToken });
        TokenManager.setTokens(res.data.accessToken, refreshToken);
        originalRequest.headers.Authorization = `Bearer ${res.data.accessToken}`;
        return APIClient(originalRequest);
      } catch {
        TokenManager.clear();
        window.dispatchEvent(new Event('auth:expired'));
      }
    } else if (status === 401) {
      TokenManager.clear();
      window.dispatchEvent(new Event('auth:expired'));
    }

    return Promise.reject(error);
  }
);

export default APIClient;
