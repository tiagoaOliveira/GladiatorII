import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../services/supabaseClientFront';
import Layout from '../components/Layout';
import './Shop.css';

const Shop = () => {
  const { user } = useAuth();
  const [powers, setPowers] = useState([]);
  const [userPowers, setUserPowers] = useState([]);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadPowers();
      loadProfile();
      loadUserPowers();
    }
  }, [user]);

  const loadPowers = async () => {
    try {
      const { data, error } = await supabase
        .from('powers')
        .select('*')
        .order('min_level');
      
      if (error) {
        console.error('Erro ao carregar poderes:', error);
        return;
      }
      
      setPowers(data || []);
    } catch (error) {
      console.error('Erro ao carregar poderes:', error);
    }
  };

  const loadProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      
      if (error) {
        console.error('Erro ao carregar perfil:', error);
        return;
      }
      
      setProfile(data);
    } catch (error) {
      console.error('Erro ao carregar perfil:', error);
    }
  };

  const loadUserPowers = async () => {
    try {
      const { data, error } = await supabase
        .from('user_powers')
        .select('owned_powers')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Erro ao carregar poderes do usuário:', error);
        return;
      }

      if (!data) {
        const { error: insertError } = await supabase
          .from('user_powers')
          .insert([{ user_id: user.id, owned_powers: [] }]);

        if (insertError) {
          console.error('Erro ao criar registro de poderes:', insertError);
        }
        
        setUserPowers([]);
        setLoading(false);
        return;
      }

      setUserPowers(data.owned_powers || []);
      setLoading(false);
    } catch (error) {
      console.error('Erro ao carregar poderes do usuário:', error);
      setLoading(false);
    }
  };

  const buyPower = async (power) => {
    if (profile.gold < power.price) {
      alert('Ouro insuficiente para esta habilidade de gladiador!');
      return;
    }

    if (userPowers.includes(power.id)) {
      alert('Você já domina esta técnica de combate!');
      return;
    }

    try {
      const { error: addPowerError } = await supabase.rpc('add_power_to_user', {
        user_id_param: user.id,
        power_id_param: power.id
      });

      if (addPowerError) {
        console.error('Erro ao adicionar poder:', addPowerError);
        alert('Erro ao adquirir habilidade. Tente novamente.');
        return;
      }

      const { error: updateGoldError } = await supabase
        .from('profiles')
        .update({ gold: profile.gold - power.price })
        .eq('id', user.id);

      if (updateGoldError) {
        console.error('Erro ao atualizar gold:', updateGoldError);
        alert('Erro ao processar pagamento. Tente novamente.');
        return;
      }

      alert('Habilidade adquirida com sucesso! Vá ao perfil para equipá-la e dominar a arena!');
      
      loadProfile();
      loadUserPowers();
    } catch (error) {
      console.error('Erro ao comprar poder:', error);
      alert('Erro ao adquirir habilidade. Tente novamente.');
    }
  };

  const getPowerRarity = (price) => {
    if (price >= 1000) return 'legendary';
    if (price >= 500) return 'epic';
    if (price >= 200) return 'rare';
    return 'common';
  };

  const getArenaIcon = (rarity) => {
    switch (rarity) {
      case 'legendary': return '👑';
      case 'epic': return '🏆';
      case 'rare': return '⚔️';
    }
  };

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
          {powers.map(power => {
            const isOwned = userPowers.includes(power.id);
            const canBuy = profile?.level >= power.min_level;
            const hasGold = profile?.gold >= power.price;
            const rarity = getPowerRarity(power.price);

            return (
              <div 
                key={power.id} 
                className={`power-card ${isOwned ? 'owned' : ''} ${rarity}`}
              >
                <div className="arena-decoration">
                  {getArenaIcon(rarity)}
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

                {isOwned ? (
                  <button className="power-button owned" disabled>
                    Dominado
                  </button>
                ) : !canBuy ? (
                  <button className="power-button disabled" disabled>
                    Nível Insuficiente
                  </button>
                ) : !hasGold ? (
                  <button className="power-button disabled" disabled>
                    Aureus Insuficientes
                  </button>
                ) : (
                  <button 
                    className="power-button buy"
                    onClick={() => buyPower(power)}
                  >
                    Adquirir Habilidade
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </Layout>
  );
};

export default Shop;