import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import './Login.css'; // mantém seu CSS existente

export default function Auth() {
  const { signIn, signUp, user, loading: authLoading } = useAuth();
  const [mode, setMode] = useState('login'); // 'login' ou 'signup'
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      if (mode === 'login') {
        await signIn(email, password);
        // O redirecionamento será feito pelo useEffect acima
      } else {
        const result = await signUp(email, password);
        
        if (result.user && !result.user.email_confirmed_at) {
          setError('Verifique seu email para confirmar o cadastro.');
        } else {
          console.log('Usuário criado:', result.user);
          setMode('login');
          setError('Conta criada com sucesso! Faça login.');
        }
      }
    } catch (err) {
      console.error('Erro de autenticação:', err);
      
      // Tratamento de erros mais específico
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
      <form
        onSubmit={handleSubmit}
        className={`login-form ${isLoading ? 'loading' : ''}`}
      >
        <h2 className="login-title">
          {mode === 'login' ? 'Entrar no Reino' : 'Criar sua Conta'}
        </h2>

        {error && (
          <div className={`error-message ${error.includes('sucesso') ? 'success' : ''}`}>
            {error}
          </div>
        )}

        <div className="input-group">
          <input
            type="email"
            placeholder="Digite seu email"
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
            placeholder="Digite sua senha"
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
            ? mode === 'login' ? 'Entrando...' : 'Registrando...'
            : mode === 'login' ? 'Entrar' : 'Registrar'}
        </button>

        <p className="toggle-text">
          {mode === 'login'
            ? 'Não tem conta? '
            : 'Já tem conta? '}
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
            {mode === 'login' ? 'Crie uma' : 'Faça login'}
          </button>
        </p>
      </form>
    </div>
  );
}