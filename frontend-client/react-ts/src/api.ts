import axios from "axios";

export const TOKEN_STORAGE_KEY = "token";

const api = axios.create({
  baseURL: "/api",
});

function appPath(path: string): string {
  const base = import.meta.env.BASE_URL ?? "/";
  const normalizedBase = base.endsWith("/") ? base : `${base}/`;
  const normalizedPath = path.startsWith("/") ? path.slice(1) : path;
  return `${normalizedBase}${normalizedPath}`;
}

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_STORAGE_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Endpoints where a 401 is an expected, recoverable result (bad credentials)
// rather than an expired/invalid session — these must not trigger the
// redirect below, or a failed login attempt would hard-reload the page
// before the caller ever gets to show the error.
const AUTH_ENDPOINTS = ["/auth/login", "/auth/register", "/auth/logout"];

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const url: string = error.config?.url ?? "";
    const isAuthEndpoint = AUTH_ENDPOINTS.some((endpoint) => url.includes(endpoint));

    if (error.response?.status === 401 && !isAuthEndpoint) {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      window.location.replace(appPath("/login"));
    }
    return Promise.reject(error);
  },
);

export default api;
