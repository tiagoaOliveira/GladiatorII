import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../services/supabaseClientFront';
import CharacterModal from '../components/CharacterModal';
import Layout from '../components/Layout';
import './Perfil.css';

export default function Perfil() {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [characterType, setCharacterType] = useState(null);
  const [characterData, setCharacterData] = useState(null);
  const [characterStats, setCharacterStats] = useState(null);
  const [isCharacterModalOpen, setIsCharacterModalOpen] = useState(false);
  const [isChangingCharacter, setIsChangingCharacter] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userPowers, setUserPowers] = useState({ slot_1: null, slot_2: null, slot_3: null });
  const [availablePowers, setAvailablePowers] = useState([]);
  const [showPowerSelector, setShowPowerSelector] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);

  const calculateStats = (characterData, level) => {
    const growthRates = {
      1: { hp: 25, attack: 3 }, // Assassin
      2: { hp: 35, attack: 4 }, // Warrior  
      3: { hp: 45, attack: 2 }  // Tank
    };

    const growth = growthRates[characterData.id] || { hp: 30, attack: 3 };
    return {
      hp: characterData.base_hp + (growth.hp * (level - 1)),
      attack: characterData.base_attack + (growth.attack * (level - 1)),
      defense: characterData.base_defense,
      critical: characterData.base_critical,
      speed: characterData.base_speed
    };
  };

  const loadUserPowers = async () => {
    try {
      const { data } = await supabase.rpc('get_user_powers', { user_id_param: user.id });
      if (data && data.length > 0) {
        setUserPowers({
          slot_1: data[0].slot_1_power_id ? {
            id: data[0].slot_1_power_id,
            name: data[0].slot_1_power_name,
            icon: data[0].slot_1_power_icon
          } : null,
          slot_2: data[0].slot_2_power_id ? {
            id: data[0].slot_2_power_id,
            name: data[0].slot_2_power_name,
            icon: data[0].slot_2_power_icon
          } : null,
          slot_3: data[0].slot_3_power_id ? {
            id: data[0].slot_3_power_id,
            name: data[0].slot_3_power_name,
            icon: data[0].slot_3_power_icon
          } : null
        });
      }
    } catch (error) {
      console.error('Erro ao carregar poderes:', error);
    }
  };

  const loadAvailablePowers = async () => {
    try {
      const { data } = await supabase
        .from('user_powers')
        .select(`
        power_id,
        powers (id, name, icon, description)
      `)
        .eq('user_id', user.id)
        .is('slot_position', null);

      setAvailablePowers(data?.map(item => item.powers) || []);
    } catch (error) {
      console.error('Erro ao carregar poderes disponíveis:', error);
    }
  };
  const equipPower = async (powerId) => {
    try {
      // Remove poder atual do slot se houver
      if (userPowers[`slot_${selectedSlot}`]) {
        await supabase
          .from('user_powers')
          .update({ slot_position: null })
          .eq('user_id', user.id)
          .eq('power_id', userPowers[`slot_${selectedSlot}`].id);
      }

      // Equipar novo poder
      await supabase
        .from('user_powers')
        .update({ slot_position: selectedSlot })
        .eq('user_id', user.id)
        .eq('power_id', powerId);

      // Recarregar dados
      loadUserPowers();
      loadAvailablePowers();
      setShowPowerSelector(false);
    } catch (error) {
      console.error('Erro ao equipar poder:', error);
    }
  };
  const unequipPower = async (slot) => {
    try {
      await supabase
        .from('user_powers')
        .update({ slot_position: null })
        .eq('user_id', user.id)
        .eq('power_id', userPowers[`slot_${slot}`].id);

      loadUserPowers();
      loadAvailablePowers();
    } catch (error) {
      console.error('Erro ao desequipar poder:', error);
    }
  };

  useEffect(() => {
    if (user) {
      loadProfile();
      loadUserPowers();
      loadAvailablePowers();
    }
  }, [user]);

  useEffect(() => {
    if (characterType && profile) {
      loadCharacterData();
    }
  }, [characterType, profile]);

  const loadProfile = async () => {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (data) {
        setProfile(data);
        setCharacterType(data.character_type || 1);
      }
    } catch (error) {
      console.error('Erro ao carregar perfil:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCharacterData = async () => {
    try {
      // Carregar apenas dados do tipo de personagem
      const { data: characterTypeData, error: characterError } = await supabase
        .from('character_types')
        .select('*')
        .eq('id', characterType)
        .single();

      if (characterError) throw characterError;

      setCharacterData(characterTypeData);

      // Calcular stats no frontend
      const calculatedStats = calculateStats(characterTypeData, profile.level || 1);
      setCharacterStats(calculatedStats);
    } catch (error) {
      console.error('Erro ao carregar dados do personagem:', error);
    }
  };

  const handleCharacterChange = (newCharacterType) => {
    setCharacterType(newCharacterType);
    loadProfile(); // Recarrega o perfil
  };

  const changeCharacter = async (direction) => {
    if (isChangingCharacter) return;

    setIsChangingCharacter(true);

    let newCharacterType;
    if (direction === 'next') {
      newCharacterType = characterType === 3 ? 1 : characterType + 1;
    } else {
      newCharacterType = characterType === 1 ? 3 : characterType - 1;
    }

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ character_type: newCharacterType })
        .eq('id', user.id);

      if (error) throw error;

      setCharacterType(newCharacterType);
    } catch (error) {
      console.error('Erro ao mudar personagem:', error);
    } finally {
      setIsChangingCharacter(false);
    }
    setCharacterType(newCharacterType);
    // Recalcular stats para o novo personagem
    if (characterData) {
      const calculatedStats = calculateStats(characterData, profile.level || 1);
      setCharacterStats(calculatedStats);
    }
  };

  if (loading || !characterData || !characterStats) {
    return (
      <Layout>
        <div className="perfil-container">
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: '100vh',
            color: 'var(--text-light)',
            fontSize: '1.5rem'
          }}>
            Loading...
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className={`perfil-container character-${characterType}`}>
        {/* Seta Esquerda */}
        <button
          className="character-nav-arrow left"
          onClick={() => changeCharacter('prev')}
          disabled={isChangingCharacter}
        >
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
            <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {/* Orbe do Personagem */}
        <div
          className="arena-orb"
          onClick={() => setIsCharacterModalOpen(true)}
        >
          <div className="orb-content">
            <div className="orb-level">
              <span className="level-number">LV. {profile?.level || 1}</span>
            </div>
          </div>
        </div>

        {/* Power Slots */}
        <div className="power-slots">
          {[1, 2, 3].map(slot => {
            const power = userPowers[`slot_${slot}`];
            const isUnlocked = profile?.level >= (slot * 2 - 1);

            return (
              <div key={slot} className="power-slot">
                {power ? (
                  <div className="power-item" onClick={() => unequipPower(slot)}>
                    <span className="power-icon">{power.icon}</span>
                    <span className="power-name">{power.name}</span>
                    <span className="remove-hint">Clique para remover</span>
                  </div>
                ) : isUnlocked ? (
                  <div
                    className="power-empty"
                    onClick={() => {
                      setSelectedSlot(slot);
                      setShowPowerSelector(true);
                    }}
                  >
                    <span className="empty-icon">+</span>
                    <span className="empty-text">Empty</span>
                  </div>
                ) : (
                  <div className="power-locked">
                    <span className="locked-icon">🔒</span>
                    <span className="locked-text">Lv.{slot * 2 - 1}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Modal de Seleção de Poder */}
        {showPowerSelector && (
          <div className="power-selector-modal">
            <div className="power-selector-content">
              <h3>Selecione um poder para o Slot {selectedSlot}</h3>
              <div className="available-powers">
                {availablePowers.length > 0 ? (
                  availablePowers.map(power => (
                    <div
                      key={power.id}
                      className="selectable-power"
                      onClick={() => equipPower(power.id)}
                    >
                      <span className="power-icon">{power.icon}</span>
                      <span className="power-name">{power.name}</span>
                      <p className="power-description">{power.description}</p>
                    </div>
                  ))
                ) : (
                  <p>Nenhum poder disponível. Compre poderes na loja!</p>
                )}
              </div>
              <button
                className="close-selector"
                onClick={() => setShowPowerSelector(false)}
              >
                Fechar
              </button>
            </div>
          </div>
        )}

        {/* Seta Direita */}
        <button
          className="character-nav-arrow right"
          onClick={() => changeCharacter('next')}
          disabled={isChangingCharacter}
        >
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
            <path d="M9 18L15 12L9 6" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {/* Painel de Atributos */}
        <div className="character-attributes">
          <div className="attributes-grid">
            <div className="attribute-item">
              <div className="attribute-icon hp">❤️</div>
              <div className="attribute-info">
                <span className="attribute-name">Health</span>
                <span className="attribute-value">{characterStats.hp}</span>
              </div>
            </div>

            <div className="attribute-item">
              <div className="attribute-icon attack">⚔️</div>
              <div className="attribute-info">
                <span className="attribute-name">Attack</span>
                <span className="attribute-value">{characterStats.attack}</span>
              </div>
            </div>

            <div className="attribute-item">
              <div className="attribute-icon defense">🛡️</div>
              <div className="attribute-info">
                <span className="attribute-name">Defense</span>
                <span className="attribute-value">{characterStats.defense}</span>
              </div>
            </div>

            <div className="attribute-item">
              <div className="attribute-icon critical">💥</div>
              <div className="attribute-info">
                <span className="attribute-name">Critical</span>
                <span className="attribute-value">{characterStats.critical}</span>
              </div>
            </div>

            <div className="attribute-item">
              <div className="attribute-icon speed">💨</div>
              <div className="attribute-info">
                <span className="attribute-name">Speed</span>
                <span className="attribute-value">{characterStats.speed}</span>
              </div>
            </div>
          </div>
        </div>

        <CharacterModal
          user={user}
          profile={profile}
          characterData={characterData}
          characterStats={characterStats}
          isOpen={isCharacterModalOpen}
          onClose={() => setIsCharacterModalOpen(false)}
          onCharacterChange={handleCharacterChange}
        />
      </div>
    </Layout>
  );
}