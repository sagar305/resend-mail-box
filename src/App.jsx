import { AuthProvider } from './context/AuthProvider.jsx';
import { useAuth } from './context/authContext.js';
import LoginPage from './pages/LoginPage.jsx';
import MailboxPage from './pages/MailboxPage.jsx';

function Gate() {
  const { user, checking } = useAuth();

  if (checking) {
    return (
      <div className="flex min-h-full items-center justify-center">
        <p className="text-sm text-slate-400">Loading…</p>
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
