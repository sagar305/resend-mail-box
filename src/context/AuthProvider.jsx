import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, API_BASE_URL, ApiError, isCrossOrigin } from '../api/client.js';
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

    // The credentials were right, so confirm the session cookie actually stuck.
    // A 401 here means the browser accepted the response but refused to store or
    // resend the cookie — the signature of third-party cookie blocking, which is
    // the default on iOS (every browser there is WebKit). Without this check the
    // app would appear to log in and then silently bounce back to the login form
    // with no explanation.
    try {
      await api.me();
    } catch (error) {
      if (error.status === 401) {
        throw new ApiError(
          401,
          isCrossOrigin()
            ? `Signed in, but your browser refused to keep the session cookie. The API is on a different domain (${API_BASE_URL}), which makes the cookie third-party — blocked by default on iOS and in Safari. Serve the API from this same domain instead (unset VITE_API_BASE_URL and use the /api rewrite).`
            : 'Signed in, but the session cookie was not stored. Check that cookies are enabled for this site and that you are not in a private window.',
          'cookie_blocked',
        );
      }
      // Anything else (server down mid-login) is not a credentials problem.
      throw error;
    }

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
