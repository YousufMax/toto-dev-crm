import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, Role, ModuleId, ActionType } from '../types';
import { api, setActiveUser, setAuthToken, getAuthToken } from '../api';

interface AuthContextType {
  user: User | null;
  role: Role | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (usernameOrEmail: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  switchUser: (user: User) => Promise<void>;
  hasPermission: (moduleId: ModuleId, action: ActionType) => boolean;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize from stored session or verify token
  const refreshUser = async () => {
    const token = getAuthToken();
    if (!token) {
      setUser(null);
      setRole(null);
      setIsLoading(false);
      return;
    }

    try {
      const res = await api.getMe();
      if (res.success && res.user) {
        setUser(res.user);
        setRole(res.role);
        setActiveUser(res.user);
      } else {
        setAuthToken('');
        setUser(null);
        setRole(null);
      }
    } catch (err) {
      // If error verifying token, clear it
      console.warn('[AuthContext] Session expired or invalid token:', err);
      setAuthToken('');
      setUser(null);
      setRole(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();
  }, []);

  const login = async (usernameOrEmail: string, password: string) => {
    const res = await api.login(usernameOrEmail, password);
    if (res.success && res.token) {
      setAuthToken(res.token);
      setUser(res.user);
      setRole(res.role);
      setActiveUser(res.user);
    } else {
      throw new Error(res.message || 'Login failed.');
    }
  };

  const logout = async () => {
    try {
      await api.logout();
    } catch (e) {
      // Ignore network error on logout
    } finally {
      setAuthToken('');
      setUser(null);
      setRole(null);
    }
  };

  const switchUser = async (targetUser: User) => {
    const res = await api.switchUser(targetUser.id);
    if (res.user && res.token) {
      setAuthToken(res.token);
      setUser(res.user);
      setRole(res.role);
      setActiveUser(res.user);
    }
  };

  const hasPermission = (moduleId: ModuleId, action: ActionType): boolean => {
    if (!user) return false;
    // Super Admin & Primary Super Admin has unrestricted permissions
    if (user.isPrimarySuperAdmin || user.role === 'Super Admin' || role?.name === 'Super Admin' || role?.id === 'role-super-admin') {
      return true;
    }
    if (!role || !role.permissions) return false;
    const modulePerms = role.permissions[moduleId];
    return Boolean(modulePerms && modulePerms[action]);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        isAuthenticated: Boolean(user),
        isLoading,
        login,
        logout,
        switchUser,
        hasPermission,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
