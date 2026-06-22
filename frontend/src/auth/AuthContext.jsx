import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { getCurrentUser, loginUser } from "../services/authApi";
import { clearStoredAuthToken, getStoredAuthToken, setStoredAuthToken } from "../services/authToken";


const AuthContext = createContext(null);


export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => getStoredAuthToken());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function restoreSession() {
      const storedToken = getStoredAuthToken();

      if (!storedToken) {
        if (isMounted) {
          setToken(null);
          setUser(null);
          setLoading(false);
        }
        return;
      }

      try {
        const currentUser = await getCurrentUser();
        if (isMounted) {
          setToken(storedToken);
          setUser(currentUser);
        }
      } catch {
        clearStoredAuthToken();
        if (isMounted) {
          setToken(null);
          setUser(null);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    restoreSession();

    return () => {
      isMounted = false;
    };
  }, []);

  const login = useCallback(async (username, password) => {
    const loginResponse = await loginUser(username, password);
    const accessToken = loginResponse.access_token;

    setStoredAuthToken(accessToken);
    setToken(accessToken);

    try {
      const currentUser = await getCurrentUser();
      setUser(currentUser);

      return currentUser;
    } catch (error) {
      clearStoredAuthToken();
      setToken(null);
      setUser(null);
      throw error;
    }
  }, []);

  const logout = useCallback(() => {
    clearStoredAuthToken();
    setToken(null);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      token,
      loading,
      login,
      logout,
    }),
    [loading, login, logout, token, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}


export function useAuth() {
  const context = useContext(AuthContext);

  if (context === null) {
    throw new Error("useAuth must be used within AuthProvider.");
  }

  return context;
}
