import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../services/supabaseClientFront';
import Layout from '../components/Layout';
import './Shop.css';

const Shop = () => {
  const { user } = useAuth();
  
  // Estados consolidados
  const [powers, setPowers] = useState([]);
  const [userPowers, setUserPowers] = useState([]);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [purchaseLoading, setPurchaseLoading] = useState(false);
  
  // Cache para evitar recarregamentos desnecessários
  const [dataCache, setDataCache] = useState({
    powers: new Map(),
    lastPowersUpdate: null,
    lastProfileUpdate: null
  });

  // Função para obter poderes do cache
  const getCachedPowers = useCallback(() => {
    const cached = dataCache.powers.get('all_powers');
    if (cached && Date.now() - cached.timestamp < 10 * 60 * 1000) { // 10 minutos
      return cached.data;
    }
    return null;
  }, [dataCache.powers]);

  // Função principal para carregar todos os dados iniciais
  const loadInitialData = useCallback(async () => {
    if (!user?.id) return;

    try {
      setLoading(true);
      
      // Verificar cache de poderes primeiro
      const cachedPowers = getCachedPowers();
      
      // Carregar dados em paralelo
      const promises = [
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('user_powers').select('owned_powers').eq('user_id', user.id).single()
      ];

      // Só carregar poderes se não estiverem no cache
      if (!cachedPowers) {
        promises.push(
          supabase.from('powers').select('*').order('min_level')
        );
      }

      const results = await Promise.all(promises);
      const [profileResult, userPowersResult, powersResult] = results;

      // Processar perfil
      if (profileResult.data) {
        setProfile(profileResult.data);
      }

      // Processar poderes do usuário
      if (userPowersResult.data) {
        setUserPowers(userPowersResult.data.owned_powers || []);
      } else {
        // Se não há registro de poderes, criar um vazio
        const { error: insertError } = await supabase
          .from('user_powers')
          .insert([{ user_id: user.id, owned_powers: [] }]);

        if (insertError) {
          console.error('Erro ao criar registro de poderes:', insertError);
        }
        
        setUserPowers([]);
      }

      // Processar poderes (do cache ou da consulta)
      if (cachedPowers) {
        setPowers(cachedPowers);
      } else if (powersResult?.data) {
        setPowers(powersResult.data);
        
        // Atualizar cache
        setDataCache(prev => ({
          ...prev,
          powers: new Map([
            ...prev.powers,
            ['all_powers', { data: powersResult.data, timestamp: Date.now() }]
          ]),
          lastPowersUpdate: Date.now()
        }));
      }

      setDataCache(prev => ({
        ...prev,
        lastProfileUpdate: Date.now()
      }));

    } catch (error) {
      console.error('Erro ao carregar dados iniciais:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.id, getCachedPowers]);

  // Função otimizada para comprar poder com update otimista
  const buyPower = async (power) => {
    if (purchaseLoading) return;
    
    if (profile.gold < power.price) {
      alert('Ouro insuficiente para esta habilidade de gladiador!');
      return;
    }

    if (userPowers.includes(power.id)) {
      alert('Você já domina esta técnica de combate!');
      return;
    }

    setPurchaseLoading(true);
    
    // Update otimista - atualizar UI imediatamente
    const previousProfile = profile;
    const previousUserPowers = userPowers;
    
    setProfile(prev => ({
      ...prev,
      gold: prev.gold - power.price
    }));
    
    setUserPowers(prev => [...prev, power.id]);

    try {
      // Executar operações em paralelo
      const [addPowerResult, updateGoldResult] = await Promise.all([
        supabase.rpc('add_power_to_user', {
          user_id_param: user.id,
          power_id_param: power.id
        }),
        supabase
          .from('profiles')
          .update({ gold: profile.gold - power.price })
          .eq('id', user.id)
      ]);

      if (addPowerResult.error) {
        throw new Error('Erro ao adicionar poder: ' + addPowerResult.error.message);
      }

      if (updateGoldResult.error) {
        throw new Error('Erro ao atualizar gold: ' + updateGoldResult.error.message);
      }

      alert('Habilidade adquirida com sucesso! Vá ao perfil para equipá-la e dominar a arena!');
      
    } catch (error) {
      console.error('Erro ao comprar poder:', error);
      
      // Reverter mudanças otimistas em caso de erro
      setProfile(previousProfile);
      setUserPowers(previousUserPowers);
      
      alert('Erro ao adquirir habilidade. Tente novamente.');
    } finally {
      setPurchaseLoading(false);
    }
  };

  // Memoizar funções utilitárias
  const getPowerRarity = useCallback((price) => {
    if (price >= 1000) return 'legendary';
    if (price >= 500) return 'epic';
    if (price >= 200) return 'rare';
    return 'common';
  }, []);

  const getArenaIcon = useCallback((rarity) => {
    switch (rarity) {
      case 'legendary': return '👑';
      case 'epic': return '🏆';
      case 'rare': return '⚔️';
      default: return '⚡';
    }
  }, []);

  // Memoizar poderes processados
  const processedPowers = useMemo(() => {
    return powers.map(power => {
      const isOwned = userPowers.includes(power.id);
      const canBuy = profile?.level >= power.min_level;
      const hasGold = profile?.gold >= power.price;
      const rarity = getPowerRarity(power.price);
      const arenaIcon = getArenaIcon(rarity);

      return {
        ...power,
        isOwned,
        canBuy,
        hasGold,
        rarity,
        arenaIcon
      };
    });
  }, [powers, userPowers, profile, getPowerRarity, getArenaIcon]);

  // Effect principal para carregar dados iniciais
  useEffect(() => {
    if (user?.id) {
      loadInitialData();
    }
  }, [user?.id, loadInitialData]);

  // Setup de real-time subscriptions para profile
  useEffect(() => {
    if (!user?.id) return;

    const subscription = supabase
      .channel('shop-profile-changes')
      .on('postgres_changes', 
        { 
          event: 'UPDATE', 
          schema: 'public', 
          table: 'profiles',
          filter: `id=eq.${user.id}`
        }, 
        (payload) => {
          setProfile(payload.new);
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [user?.id]);

  if (loading) {
    return (
      <Layout>
        <div className="shop-container">
          <div className="shop-loading">
            <p>Loading...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="shop-container">
        <div className="shop-header">
          <h1 className="shop-title">Arsenal do Gladiador</h1>
          <p className="shop-subtitle">Habilidades e Técnicas de Combate</p>
          <div className="shop-gold">
            🪙 {profile?.gold || 0}
          </div>
        </div>

        <div className="powers-grid">
          {processedPowers.map(power => (
            <div 
              key={power.id} 
              className={`power-card ${power.isOwned ? 'owned' : ''} ${power.rarity}`}
            >
              <div className="arena-decoration">
                {power.arenaIcon}
              </div>
              
              <div className="power-header">
                <h3 className="power-name">
                  {power.icon} {power.name}
                </h3>
              </div>
              
              <p className="power-description">
                {power.description}
              </p>
              
              <div className="power-stats">
                <div className="power-stat">
                  <span className="power-stat-label">Custo:</span>
                  <span className="power-stat-value price">{power.price}</span>
                </div>
                <div className="power-stat">
                  <span className="power-stat-label">Nível Requerido:</span>
                  <span className="power-stat-value level">{power.min_level}</span>
                </div>
                <div className="power-stat">
                  <span className="power-stat-label">Taxa de Ativação:</span>
                  <span className="power-stat-value chance">{power.activation_chance}%</span>
                </div>
              </div>

              {power.isOwned ? (
                <button className="power-button owned" disabled>
                  Dominado
                </button>
              ) : !power.canBuy ? (
                <button className="power-button disabled" disabled>
                  Nível Insuficiente
                </button>
              ) : !power.hasGold ? (
                <button className="power-button disabled" disabled>
                  Aureus Insuficientes
                </button>
              ) : (
                <button 
                  className={`power-button buy ${purchaseLoading ? 'loading' : ''}`}
                  onClick={() => buyPower(power)}
                  disabled={purchaseLoading}
                >
                  {purchaseLoading ? 'Adquirindo...' : 'Adquirir Habilidade'}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </Layout>
  );
};

export default Shop;