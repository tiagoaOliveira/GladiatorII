import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import './Login.css';

export default function Auth() {
  const { signIn, signUp, signInWithPi, user, loading: authLoading } = useAuth();
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  // Redirecionar se o usuário já estiver logado
  useEffect(() => {
    if (user && !authLoading) {
      window.location.href = '/Perfil';
    }
  }, [user, authLoading]);

  // Login tradicional (email/senha)
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      if (mode === 'login') {
        await signIn(email, password);
      } else {
        const result = await signUp(email, password);
        
        if (result.user && !result.user.email_confirmed_at) {
          setError('Verifique seu email para confirmar o cadastro.');
        } else {
          setMode('login');
          setError('Conta criada com sucesso! Faça login.');
        }
      }
    } catch (err) {
      console.error('Erro de autenticação:', err);
      
      if (err.message.includes('Invalid login credentials')) {
        setError('Email ou senha incorretos');
      } else if (err.message.includes('User already registered')) {
        setError('Este email já está cadastrado');
      } else if (err.message.includes('Password should be at least')) {
        setError('A senha deve ter pelo menos 6 caracteres');
      } else {
        setError(err.message || 'Erro inesperado');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Login via Pi Network
  const handlePiLogin = async () => {
    setError(null);
    setIsLoading(true);

    try {
      const result = await signInWithPi();
      console.log('Login Pi Network realizado:', result);
      // Redirecionamento será feito pelo useEffect acima
    } catch (err) {
      console.error('Erro no login Pi Network:', err);
      
      if (err.message.includes('Pi Network SDK não disponível')) {
        setError('Pi Network não disponível. Abra no Pi Browser para usar esta opção.');
      } else if (err.message.includes('Usuário cancelou')) {
        setError('Login cancelado pelo usuário.');
      } else {
        setError(err.message || 'Erro no login Pi Network');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Mostrar loading enquanto verifica autenticação
  if (authLoading) {
    return (
      <div className="login-container">
        <div className="login-form">
          <p>Verificando autenticação...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="login-container">
      <div className={`login-form ${isLoading ? 'loading' : ''}`}>
        <h2 className="login-title">
          {mode === 'login' ? 'Join the Realm' : 'Create Account'}
        </h2>

        {error && (
          <div className={`error-message ${error.includes('sucesso') ? 'success' : ''}`}>
            {error}
          </div>
        )}

        {/* Botão Pi Network */}
        <button
          type="button"
          onClick={handlePiLogin}
          className="pi-login-button"
          disabled={isLoading}
        >
          {isLoading ? 'Conectando...' : '🥧 Login com Pi Network'}
        </button>

        <div className="divider">
          <span>ou</span>
        </div>

        {/* Login tradicional */}
        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <input
              type="email"
              placeholder="Input your Email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="login-input"
              required
              disabled={isLoading}
            />
          </div>
          <div className="input-group">
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="login-input"
              required
              disabled={isLoading}
              minLength={6}
            />
          </div>

          <button
            type="submit"
            className="login-button"
            disabled={isLoading || !email || !password}
          >
            {isLoading
              ? mode === 'login' ? 'Starting...' : 'Registering...'
              : mode === 'login' ? 'Login' : 'Sign Up'}
          </button>
        </form>

        <p className="toggle-text">
          {mode === 'login'
            ? 'Dont Registered? '
            : 'Already Registered? '}
          <button
            type="button"
            className="toggle-link"
            onClick={() => {
              setError(null);
              setEmail('');
              setPassword('');
              setMode(mode === 'login' ? 'signup' : 'login');
            }}
            disabled={isLoading}
          >
            {mode === 'login' ? 'Sign Up' : 'Login'}
          </button>
        </p>
      </div>
    </div>
  );
}