import { useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../store/useAuth';
import { isFirebaseConfigured } from '../firebase/config';
import { Button } from '../components/ui/Button';
import { Labeled, TextInput } from '../components/ui/Field';
import { Spinner } from '../components/ui/Spinner';

export default function LoginPage() {
  const { user, loading, error, loginGoogle, loginEmail, registerEmail } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner className="size-8" />
      </div>
    );
  }
  if (user) return <Navigate to="/" replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === 'login') await loginEmail(email, password);
      else await registerEmail(email, password);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-full items-center justify-center bg-gradient-to-br from-brand-900 to-slate-900 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
        <div className="mb-6 text-center">
          <img src="/favicon.svg" alt="" className="mx-auto mb-3 size-12" />
          <h1 className="text-xl font-bold text-slate-900">Assistente CFO</h1>
          <p className="mt-1 text-sm text-slate-500">
            O diretor financeiro virtual da sua empresa
          </p>
        </div>

        {!isFirebaseConfigured && (
          <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
            <strong>Configuração pendente:</strong> o projeto Firebase ainda não foi configurado.
            Siga as instruções em <code>SETUP.md</code> para ativar a autenticação, a base de
            dados e o serviço de IA.
          </div>
        )}

        <Button
          variant="secondary"
          className="w-full"
          onClick={() => void loginGoogle()}
          disabled={!isFirebaseConfigured}
        >
          <svg className="size-4" viewBox="0 0 24 24" aria-hidden>
            <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.7v3h3.9c2.3-2.1 3.5-5.2 3.5-8.9z" />
            <path fill="#34A853" d="M12 24c3.2 0 6-1 7.9-2.9l-3.9-3a7.2 7.2 0 0 1-10.8-3.8H1.3v3.1A12 12 0 0 0 12 24z" />
            <path fill="#FBBC05" d="M5.2 14.3a7.2 7.2 0 0 1 0-4.6V6.6H1.3a12 12 0 0 0 0 10.8l3.9-3.1z" />
            <path fill="#EA4335" d="M12 4.8c1.8 0 3.4.6 4.6 1.8L20.1 3A12 12 0 0 0 1.3 6.6l3.9 3.1A7.2 7.2 0 0 1 12 4.8z" />
          </svg>
          Continuar com Google
        </Button>

        <div className="my-5 flex items-center gap-3 text-xs text-slate-400">
          <div className="h-px flex-1 bg-slate-200" /> ou <div className="h-px flex-1 bg-slate-200" />
        </div>

        <form onSubmit={submit} className="flex flex-col gap-3">
          <Labeled label="Email">
            <TextInput
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Labeled>
          <Labeled label="Palavra-passe">
            <TextInput
              type="password"
              required
              minLength={6}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Labeled>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" busy={busy} disabled={!isFirebaseConfigured}>
            {mode === 'login' ? 'Iniciar sessão' : 'Criar conta'}
          </Button>
        </form>

        <button
          onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
          className="mt-4 w-full text-center text-sm text-brand-700 hover:underline"
        >
          {mode === 'login' ? 'Não tem conta? Registe-se' : 'Já tem conta? Inicie sessão'}
        </button>
      </div>
    </div>
  );
}
