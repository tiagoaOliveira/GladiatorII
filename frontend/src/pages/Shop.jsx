import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../services/supabaseClientFront';
import Layout from '../components/Layout';

const Shop = () => {
  const { user } = useAuth();
  const [powers, setPowers] = useState([]);
  const [userPowers, setUserPowers] = useState([]);
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    if (user) {
      loadPowers();
      loadProfile();
      loadUserPowers();
    }
  }, [user]);

  const loadPowers = async () => {
    const { data } = await supabase.from('powers').select('*').order('min_level');
    setPowers(data || []);
  };

  const loadProfile = async () => {
    const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    setProfile(data);
  };

  const loadUserPowers = async () => {
    const { data } = await supabase.from('user_powers').select('power_id').eq('user_id', user.id);
    setUserPowers(data?.map(p => p.power_id) || []);
  };

  const buyPower = async (power) => {
    if (profile.gold < power.price) {
      alert('Ouro insuficiente!');
      return;
    }

    try {
      // Atualizar gold do perfil
      await supabase.from('profiles').update({
        gold: profile.gold - power.price
      }).eq('id', user.id);

      // Adicionar poder ao usuário (sem slot definido)
      await supabase.from('user_powers').insert({
        user_id: user.id,
        power_id: power.id
        // slot_position será null por padrão
      });

      alert('Poder comprado com sucesso! Vá ao perfil para equipá-lo.');
      loadProfile();
      loadUserPowers();
    } catch (error) {
      console.error('Erro ao comprar poder:', error);
    }
  };;

  return (
    <Layout>
      <div style={{ padding: '2rem' }}>
        <h1>Shop - Poderes</h1>
        <p>Ouro: {profile?.gold || 0}</p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
          {powers.map(power => (
            <div key={power.id} style={{
              border: '1px solid #ccc',
              padding: '1rem',
              borderRadius: '8px',
              backgroundColor: userPowers.includes(power.id) ? '#f0f0f0' : 'white'
            }}>
              <h3>{power.icon} {power.name}</h3>
              <p>{power.description}</p>
              <p>Preço: {power.price} ouro</p>
              <p>Nível mínimo: {power.min_level}</p>

              {userPowers.includes(power.id) ? (
                <button disabled>Já possui</button>
              ) : profile?.level >= power.min_level ? (
                <button onClick={() => buyPower(power)}>Comprar</button>
              ) : (
                <button disabled>Nível insuficiente</button>
              )}
            </div>
          ))}
        </div>
      </div>
    </Layout>
  );
};

export default Shop;