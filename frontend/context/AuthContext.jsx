import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../src/services/supabaseClientFront';
import piNetworkService from '../src/services/piNetworkService';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [piUser, setPiUser] = useState(null);

  useEffect(() => {
    // Inicializa Pi Network Service
    const initializePi = async () => {
      try {
        await piNetworkService.initialize();
        console.log('Pi Network Service inicializado no AuthContext');
      } catch (error) {
        console.error('Erro ao inicializar Pi Network Service:', error);
      }
    };

    initializePi();

    // Verifica autenticação Supabase existente
    getUser();

    // Listener para mudanças de auth do Supabase
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state change:', event, session);
        
        if (session?.user) {
          setUser(session.user);
        } else {
          setUser(null);
        }
        setLoading(false);
      }
    );

    return () => subscription?.unsubscribe();
  }, []);

  // Obtém usuário atual do Supabase
  const getUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    } catch (error) {
      console.error('Erro ao obter usuário:', error);
    } finally {
      setLoading(false);
    }
  };

  // Login tradicional (email/senha)
  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;
    return data;
  };

  // Registro tradicional (email/senha)
  const signUp = async (email, password) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) throw error;
    return data;
  };

  // Login via Pi Network
  const signInWithPi = async () => {
    try {
      setLoading(true);
      console.log('Iniciando login com Pi Network...');
      
      // Garante que o Pi Service está inicializado
      if (!piNetworkService.isInitialized) {
        console.log('Inicializando Pi Network Service...');
        await piNetworkService.initialize();
      }
      
      // Autentica na Pi Network usando o método padrão (que já tem mock integrado)
      const piAuthResult = await piNetworkService.authenticate();
      
      if (!piAuthResult.success) {
        throw new Error(piAuthResult.error || 'Falha na autenticação Pi');
      }

      const piUserData = piAuthResult.user;
      setPiUser(piUserData);
      console.log('Usuário Pi autenticado:', piUserData);

      // Verifica se usuário já existe no Supabase
      let supabaseUser;
      try {
        const { data: existingUser, error: searchError } = await supabase
          .from('pi_users')
          .select('*')
          .eq('pi_uid', piUserData.uid)
          .maybeSingle();

        if (searchError && searchError.code !== 'PGRST116') {
          console.warn('Erro ao buscar usuário Pi no Supabase:', searchError);
        }

        if (existingUser) {
          // Usuário já existe, atualiza dados se necessário
          const { data: updatedUser, error: updateError } = await supabase
            .from('pi_users')
            .update({
              username: piUserData.username,
              access_token: piAuthResult.accessToken,
              updated_at: new Date().toISOString()
            })
            .eq('pi_uid', piUserData.uid)
            .select()
            .single();

          if (updateError) {
            console.warn('Erro ao atualizar usuário Pi:', updateError);
          }
          supabaseUser = updatedUser || existingUser;
        } else {
          // Cria novo usuário no Supabase
          const { data: newUser, error: insertError } = await supabase
            .from('pi_users')
            .insert({
              pi_uid: piUserData.uid,
              username: piUserData.username,
              access_token: piAuthResult.accessToken
            })
            .select()
            .single();

          if (insertError) {
            console.warn('Erro ao criar usuário Pi no Supabase:', insertError);
            // Continua mesmo com erro no Supabase
            supabaseUser = { 
              id: piUserData.uid, 
              pi_uid: piUserData.uid,
              username: piUserData.username 
            };
          } else {
            supabaseUser = newUser;
          }
        }
      } catch (supabaseError) {
        console.warn('Erro nas operações do Supabase, continuando com dados locais:', supabaseError);
        supabaseUser = { 
          id: piUserData.uid, 
          pi_uid: piUserData.uid,
          username: piUserData.username 
        };
      }

      // Cria usuário customizado para compatibilidade
      const customUser = {
        id: supabaseUser.id,
        pi_uid: piUserData.uid,
        username: piUserData.username,
        email: supabaseUser.email || null,
        user_metadata: {
          pi_user: true,
          username: piUserData.username
        },
        app_metadata: {
          provider: 'pi_network'
        }
      };

      setUser(customUser);
      console.log('Login Pi Network realizado com sucesso');
      
      return { user: customUser, pi_user: piUserData };

    } catch (error) {
      console.error('Erro no login Pi Network:', error);
      
      // Tratamento específico de erros
      let errorMessage = error.message;
      
      if (error.message?.includes('Pi Network SDK não disponível')) {
        errorMessage = 'Pi Network não disponível. Abra no Pi Browser para usar esta opção.';
      } else if (error.message?.includes('cancelou')) {
        errorMessage = 'Login cancelado pelo usuário.';
      } else if (error.message?.includes('Usuário não autenticado')) {
        errorMessage = 'Falha na autenticação Pi Network.';
      }
      
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Logout
  const signOut = async () => {
    try {
      // Logout do Supabase (se autenticado tradicionalmente)
      if (user && !user.user_metadata?.pi_user) {
        await supabase.auth.signOut();
      }

      // Logout da Pi Network
      if (piUser) {
        piNetworkService.logout();
        setPiUser(null);
      }

      setUser(null);
    } catch (error) {
      console.error('Erro no logout:', error);
      throw error;
    }
  };

  // Verifica se usuário é da Pi Network
  const isPiUser = () => {
    return !!piUser || user?.user_metadata?.pi_user;
  };

  // Obtém dados do usuário Pi
  const getPiUser = () => {
    return piUser || piNetworkService.getCurrentUser();
  };

  // Cria pagamento Pi
  const createPiPayment = async (amount, memo, metadata = {}) => {
    if (!isPiUser()) {
      throw new Error('Usuário não é da Pi Network');
    }

    return await piNetworkService.createPayment(amount, memo, metadata);
  };

  const value = {
    user,
    piUser,
    loading,
    signIn,
    signUp,
    signInWithPi,
    signOut,
    isPiUser,
    getPiUser,
    createPiPayment,
    // Mantém compatibilidade
    currentUser: user
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};