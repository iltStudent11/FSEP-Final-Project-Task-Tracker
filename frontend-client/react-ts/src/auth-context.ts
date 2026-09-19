import { createContext } from "react";
import type { User, UserRole } from "./types";

export interface AuthContextValue {
  user: User | null;
  token: string | null;
  /** True while a login/register request is in flight. */
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  /** Registration does not log the user in — the backend issues no token on
   *  register, only on login. Call `login` afterward to authenticate. */
  register: (name: string, email: string, password: string, role?: UserRole) => Promise<void>;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);
