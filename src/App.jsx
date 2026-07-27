import { AuthProvider } from './context/AuthProvider.jsx';
import { useAuth } from './context/authContext.js';
import LoginPage from './pages/LoginPage.jsx';
import MailboxPage from './pages/MailboxPage.jsx';

function Gate() {
  const { user, checking, connectionError, retry } = useAuth();

  if (checking) {
    return (
      <div className="flex min-h-full items-center justify-center">
        <p className="text-sm text-slate-400">Loading…</p>
      </div>
    );
  }

  // A server that cannot be reached is not the same as being signed out. Showing
  // the login form here would read as "you were logged out" and send you off
  // hunting for a password problem that does not exist.
  if (connectionError) {
    return (
      <div className="flex min-h-full items-center justify-center px-4">
        <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <h1 className="text-lg font-semibold text-slate-900">Can’t reach the mailbox server</h1>
          <p className="mt-2 text-sm text-slate-600">{connectionError}</p>
          <p className="mt-3 text-xs text-slate-400">
            You are still signed in — this is the server being unavailable, not your session
            expiring. Check <code className="font-mono">/api/status</code> for details.
          </p>
          <button
            type="button"
            onClick={retry}
            className="mt-5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-700"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  return user ? <MailboxPage /> : <LoginPage />;
}

export default function App() {
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  );
}
