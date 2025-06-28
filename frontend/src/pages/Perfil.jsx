import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../services/supabaseClientFront'; 
import './Perfil.css';

export default function Perfil() {
  const { user, signOut, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadProfile() {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        // Busca o perfil do usuário
        const { data, error } = await supabase
          .from('profiles')
          .select('id, email, created_at')
          .eq('id', user.id)
          .single();

        if (error) {
          console.error('Erro ao carregar perfil:', error);
          setError('Erro ao carregar perfil');
        } else {
          setProfile(data);
        }
      } catch (err) {
        setError('Erro inesperado');
        console.error('Erro inesperado:', err);
      } finally {
        setLoading(false);
      }
    }

    if (!authLoading) {
      loadProfile();
    }
  }, [user, authLoading]);

  const handleLogout = async () => {
    try {
      await signOut();
      // O redirecionamento será feito automaticamente pelo AuthContext
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
      setError('Erro ao fazer logout');
    }
  };

  if (authLoading || loading) {
    return (
      <div className="container-perfil">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
        <p>Carregando perfil...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center container-perfil">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md w-full mx-4">
          <p className="text-red-600 mb-4 text-center">{error}</p>
          <div className="flex gap-2">
            <button 
              onClick={() => window.location.reload()}
              className="flex-1 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
            >
              Tentar Novamente
            </button>
            <button 
              onClick={handleLogout}
              className="flex-1 px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
            >
              Sair
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!profile && !loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 max-w-md w-full mx-4">
          <p className="text-yellow-700 mb-4 text-center">Perfil não encontrado</p>
          <button 
            onClick={handleLogout}
            className="w-full px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
          >
            Voltar ao Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container-perfil">
      <div className="bg-white shadow-lg rounded-lg p-8 max-w-md w-full">
        <div className="text-center mb-6">
          <div className="w-20 h-20 bg-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-white text-2xl font-bold">
              {profile?.email?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U'}
            </span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Perfil do Usuário</h1>
        </div>
        
        <div className="space-y-4">
          <div className="bg-gray-50 p-4 rounded-lg">
            <label className="block text-sm font-medium text-gray-600 mb-1">ID do Usuário:</label>
            <p className="text-gray-900 font-mono text-sm break-all">
              {profile?.id || user?.id}
            </p>
          </div>
          
          <div className="bg-gray-50 p-4 rounded-lg">
            <label className="block text-sm font-medium text-gray-600 mb-1">Email:</label>
            <p className="text-gray-900">
              {profile?.email || user?.email}
            </p>
          </div>
          
          {profile?.created_at && (
            <div className="bg-gray-50 p-4 rounded-lg">
              <label className="block text-sm font-medium text-gray-600 mb-1">Membro desde:</label>
              <p className="text-gray-900">
                {new Date(profile.created_at).toLocaleDateString('pt-BR', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </p>
            </div>
          )}

          <div className="bg-gray-50 p-4 rounded-lg">
            <label className="block text-sm font-medium text-gray-600 mb-1">Status:</label>
            <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
              Ativo
            </span>
          </div>
        </div>

        <div className="mt-8 space-y-3">
          <button 
            onClick={() => window.location.href = '/'}
            className="w-full px-4 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium"
          >
            Voltar ao Início
          </button>
          
          <button 
            onClick={handleLogout}
            className="w-full px-4 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-medium"
          >
            Sair da Conta
          </button>
        </div>
      </div>
    </div>
  );
}