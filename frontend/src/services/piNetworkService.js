// src/services/piNetworkService.js - Versão melhorada
class PiNetworkService {
  constructor() {
    this.isInitialized = false;
    this.currentUser = null;
    this.isTestMode = import.meta.env.VITE_PI_SANDBOX_MODE === 'true';
    this.initializationPromise = null;
  }

  // Inicializa o SDK da Pi Network (com cache de promise)
  async initialize() {
    // Se já está inicializando, retorna a promise existente
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    // Se já inicializado, retorna sucesso
    if (this.isInitialized) {
      return true;
    }

    // Cria nova promise de inicialização
    this.initializationPromise = this._doInitialize();
    
    try {
      const result = await this.initializationPromise;
      return result;
    } catch (error) {
      // Reset promise em caso de erro para permitir retry
      this.initializationPromise = null;
      throw error;
    }
  }

  async _doInitialize() {
    try {
      console.log('🥧 Inicializando Pi Network SDK...');
      console.log('📊 Configurações:', {
        testMode: this.isTestMode,
        piSDKAvailable: !!window.Pi,
        environment: import.meta.env.MODE
      });

      // Em modo de desenvolvimento/sandbox
      if (this.isTestMode) {
        console.log('🛠️ Modo sandbox ativo');
        
        if (!window.Pi) {
          console.warn('⚠️ Pi SDK não disponível - usando mock');
          this.setupMockPi();
        } else {
          console.log('✅ Pi SDK disponível - inicializando');
          await this.initializePiSDK();
        }
        
        this.isInitialized = true;
        return true;
      }

      // Modo produção - verifica Pi Browser
      if (!window.Pi) {
        throw new Error('Pi Network SDK não disponível. Execute no Pi Browser.');
      }

      await this.initializePiSDK();
      this.isInitialized = true;
      console.log('✅ Pi Network SDK inicializado com sucesso');
      return true;

    } catch (error) {
      console.error('❌ Erro ao inicializar Pi Network SDK:', error);
      
      // Em desenvolvimento, fallback para mock
      if (this.isTestMode) {
        console.warn('⚠️ Erro na inicialização, usando mock');
        this.setupMockPi();
        this.isInitialized = true;
        return true;
      }
      
      throw error;
    }
  }

  setupMockPi() {
    if (window.Pi) return; // Já existe

    const mockUsers = [
      { uid: 'mock_user_001', username: 'gladiator_dev' },
      { uid: 'mock_user_002', username: 'pi_warrior' },
      { uid: 'mock_user_003', username: 'arena_fighter' }
    ];

    window.Pi = {
      init: (config) => {
        console.log('🔧 Mock Pi.init() called with:', config);
        return Promise.resolve();
      },

      authenticate: async (scopes, callbacks) => {
        console.log('🔐 Mock Pi authenticate with scopes:', scopes);
        
        // Simula delay real
        await new Promise(resolve => setTimeout(resolve, 800));
        
        // Simula chance de cancelamento (10%)
        if (Math.random() < 0.1) {
          throw new Error('User cancelled authentication');
        }
        
        // Seleciona usuário mock aleatório
        const mockUser = mockUsers[Math.floor(Math.random() * mockUsers.length)];
        
        const result = {
          accessToken: `mock_token_${Date.now()}_${mockUser.uid}`,
          user: {
            ...mockUser,
            roles: ['user'],
            verified: true
          }
        };

        console.log('✅ Mock authentication successful:', result);
        return result;
      },

      createPayment: async (paymentData, callbacks) => {
        console.log('💰 Mock Pi createPayment:', paymentData);
        
        // Validações básicas
        if (!paymentData.amount || paymentData.amount <= 0) {
          throw new Error('Invalid payment amount');
        }
        
        // Simula processamento
        await new Promise(resolve => setTimeout(resolve, 300));
        
        const mockPayment = {
          identifier: `mock_payment_${Date.now()}`,
          amount: paymentData.amount,
          memo: paymentData.memo,
          metadata: paymentData.metadata || {},
          status: 'pending'
        };

        // Simula callback de aprovação
        setTimeout(() => {
          if (callbacks?.onReadyForServerApproval) {
            console.log('📋 Mock payment ready for approval');
            callbacks.onReadyForServerApproval(mockPayment.identifier);
          }
        }, 100);

        return mockPayment;
      }
    };
    
    console.log('✅ Mock Pi SDK configurado');
  }

  async initializePiSDK() {
    if (!window.Pi?.init) {
      throw new Error('Pi.init() não disponível');
    }

    const config = {
      version: "2.0",
      sandbox: this.isTestMode
    };

    console.log('⚙️ Chamando Pi.init() com:', config);
    
    try {
      await window.Pi.init(config);
      console.log('✅ Pi.init() executado com sucesso');
    } catch (error) {
      console.error('❌ Erro em Pi.init():', error);
      throw new Error(`Falha na inicialização do Pi SDK: ${error.message}`);
    }
  }

  async authenticate() {
    try {
      // Garante inicialização
      if (!this.isInitialized) {
        console.log('📱 Inicializando Pi SDK para autenticação...');
        await this.initialize();
      }

      console.log('🔐 Iniciando autenticação Pi Network...');

      const scopes = ['username', 'payments'];
      const authResult = await window.Pi.authenticate(scopes, {
        onIncompletePaymentFound: (payment) => {
          console.log('💸 Pagamento incompleto encontrado:', payment);
        }
      });

      console.log('✅ Autenticação Pi bem-sucedida:', {
        user: authResult.user?.username,
        hasToken: !!authResult.accessToken
      });

      this.currentUser = authResult.user;
      
      return {
        success: true,
        user: this.currentUser,
        accessToken: authResult.accessToken
      };

    } catch (error) {
      console.error('❌ Erro na autenticação Pi:', error);
      
      let errorMessage = 'Erro na autenticação Pi Network';
      
      if (error.message?.includes('User cancelled')) {
        errorMessage = 'Autenticação cancelada pelo usuário';
      } else if (error.message?.includes('SDK não disponível')) {
        errorMessage = 'Pi Network SDK não disponível';
      } else if (error.message?.includes('Network')) {
        errorMessage = 'Erro de conexão com Pi Network';
      }

      return {
        success: false,
        error: errorMessage,
        originalError: error.message
      };
    }
  }

  async createPayment(amount, memo, metadata = {}) {
    try {
      if (!this.isAuthenticated()) {
        throw new Error('Usuário não autenticado na Pi Network');
      }

      // Validações
      const numAmount = parseFloat(amount);
      if (isNaN(numAmount) || numAmount <= 0) {
        throw new Error('Valor de pagamento inválido');
      }

      if (!memo || memo.trim().length === 0) {
        throw new Error('Memo do pagamento é obrigatório');
      }

      const paymentData = {
        amount: numAmount,
        memo: memo.trim(),
        metadata: {
          ...metadata,
          timestamp: new Date().toISOString(),
          app: 'gladiator'
        }
      };

      console.log('💰 Criando pagamento Pi:', paymentData);

      const payment = await window.Pi.createPayment(paymentData, {
        onReadyForServerApproval: (paymentId) => {
          console.log('📋 Pagamento pronto para aprovação:', paymentId);
        },
        onReadyForServerCompletion: (paymentId, txid) => {
          console.log('✅ Pagamento pronto para conclusão:', paymentId, txid);
        },
        onCancel: (paymentId) => {
          console.log('❌ Pagamento cancelado:', paymentId);
        },
        onError: (error, payment) => {
          console.error('💥 Erro no pagamento:', error, payment);
        }
      });

      return {
        success: true,
        payment: payment
      };

    } catch (error) {
      console.error('❌ Erro ao criar pagamento Pi:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  isAuthenticated() {
    return !!this.currentUser;
  }

  getCurrentUser() {
    return this.currentUser;
  }

  logout() {
    this.currentUser = null;
    console.log('👋 Usuário Pi desconectado');
  }

  isDevelopment() {
    return this.isTestMode;
  }

  // Método de diagnóstico
  getStatus() {
    return {
      isInitialized: this.isInitialized,
      isAuthenticated: this.isAuthenticated(),
      isTestMode: this.isTestMode,
      currentUser: this.currentUser?.username || null,
      piSDKAvailable: !!window.Pi
    };
  }

  // Reset completo (útil para debug)
  reset() {
    this.isInitialized = false;
    this.currentUser = null;
    this.initializationPromise = null;
    console.log('🔄 Pi Network Service resetado');
  }
}

// Instância singleton
export const piNetworkService = new PiNetworkService();
export default piNetworkService;