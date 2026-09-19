import { useCallback, useState, type ReactNode } from "react";
import api, { TOKEN_STORAGE_KEY } from "./api";
import { AuthContext } from "./auth-context";
import type { LoginResponse, RegisterResponse, User, UserRole } from "./types";

export const USER_STORAGE_KEY = "user";

function readStoredUser(): User | null {
  const storedUser = localStorage.getItem(USER_STORAGE_KEY);
  if (!storedUser) return null;

  try {
    return JSON.parse(storedUser) as User;
  } catch {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(USER_STORAGE_KEY);
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  // Restored synchronously (localStorage is synchronous), so there is no
  // separate "restoring" phase to model with a loading flag.
  const [user, setUser] = useState<User | null>(readStoredUser);
  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem(TOKEN_STORAGE_KEY),
  );
  const [loading, setLoading] = useState(false);

  const login = useCallback(async (email: string, password: string) => {
    setLoading(true);
    try {
      const { data } = await api.post<LoginResponse>("/auth/login", { email, password });

      localStorage.setItem(TOKEN_STORAGE_KEY, data.token);
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(data.user));
      setToken(data.token);
      setUser(data.user);
    } finally {
      setLoading(false);
    }
  }, []);

  const register = useCallback(
    async (name: string, email: string, password: string, role?: UserRole) => {
      setLoading(true);
      try {
        await api.post<RegisterResponse>("/auth/register", { name, email, password, role });
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(USER_STORAGE_KEY);
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
