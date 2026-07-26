import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../api/client.js';
import { AuthContext } from './authContext.js';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [mailboxAddress, setMailboxAddress] = useState('');
  const [checking, setChecking] = useState(true);

  // Restore the session from the httpOnly cookie on first load.
  useEffect(() => {
    let cancelled = false;
    api
      .me()
      .then((data) => {
        if (cancelled) return;
        setUser(data.user);
        setMailboxAddress(data.mailboxAddress);
      })
      .catch(() => {
        // A 401 here just means "not signed in yet".
      })
      .finally(() => {
        if (!cancelled) setChecking(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (username, password) => {
    const data = await api.login(username, password);
    setUser(data.user);
    setMailboxAddress(data.mailboxAddress);
  }, []);

  const logout = useCallback(async () => {
    await api.logout().catch(() => {});
    setUser(null);
    setMailboxAddress('');
  }, []);

  const value = useMemo(
    () => ({ user, mailboxAddress, checking, login, logout }),
    [user, mailboxAddress, checking, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
