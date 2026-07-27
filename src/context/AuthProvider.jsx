import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../api/client.js';
import { AuthContext } from './authContext.js';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [mailboxAddress, setMailboxAddress] = useState('');
  const [checking, setChecking] = useState(true);

  const [connectionError, setConnectionError] = useState(null);

  // Restore the session from the httpOnly cookie on first load.
  const check = useCallback(async () => {
    setChecking(true);
    setConnectionError(null);
    try {
      const data = await api.me();
      setUser(data.user);
      setMailboxAddress(data.mailboxAddress);
    } catch (error) {
      // Only a 401 means "not signed in yet". Anything else — the API being
      // down, a network drop — must NOT masquerade as a logged-out user, or an
      // outage looks exactly like being silently signed out.
      if (error.status !== 401) setConnectionError(error.message);
      setUser(null);
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    check();
  }, [check]);

  const login = useCallback(async (username, password) => {
    const data = await api.login(username, password);
    setConnectionError(null);
    setUser(data.user);
    setMailboxAddress(data.mailboxAddress);
  }, []);

  const logout = useCallback(async () => {
    await api.logout().catch(() => {});
    setUser(null);
    setMailboxAddress('');
  }, []);

  const value = useMemo(
    () => ({ user, mailboxAddress, checking, connectionError, login, logout, retry: check }),
    [user, mailboxAddress, checking, connectionError, login, logout, check],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
