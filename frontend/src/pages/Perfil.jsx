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
  const [powerActionLoading, setPowerActionLoading] = useState(false);

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

  // Função para carregar poderes do usuário com nova estrutura
  const loadUserPowers = async () => {
    try {
      const { data, error } = await supabase
        .from('user_powers')
        .select(`
          equipped_power_1,
          equipped_power_2,
          equipped_power_3,
          owned_powers
        `)
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        console.error('Erro ao carregar poderes:', error);
        return;
      }

      // Se não há registro, criar um vazio
      if (!data) {
        const { error: insertError } = await supabase
          .from('user_powers')
          .insert([{ user_id: user.id, owned_powers: [] }]);

        if (insertError) {
          console.error('Erro ao criar registro de poderes:', insertError);
          return;
        }
        
        setUserPowers({ slot_1: null, slot_2: null, slot_3: null });
        setAvailablePowers([]);
        return;
      }

      // Carregar detalhes dos poderes equipados
      const equippedPowerIds = [
        data.equipped_power_1,
        data.equipped_power_2,
        data.equipped_power_3
      ].filter(id => id !== null);

      let equippedPowersData = [];
      if (equippedPowerIds.length > 0) {
        const { data: powersData, error: powersError } = await supabase
          .from('powers')
          .select('id, name, icon, description')
          .in('id', equippedPowerIds);

        if (powersError) {
          console.error('Erro ao carregar detalhes dos poderes:', powersError);
        } else {
          equippedPowersData = powersData;
        }
      }

      // Montar objeto de poderes equipados
      const newUserPowers = { slot_1: null, slot_2: null, slot_3: null };
      
      for (let i = 1; i <= 3; i++) {
        const powerId = data[`equipped_power_${i}`];
        if (powerId) {
          const powerData = equippedPowersData.find(p => p.id === powerId);
          if (powerData) {
            newUserPowers[`slot_${i}`] = powerData;
          }
        }
      }

      setUserPowers(newUserPowers);

      // Carregar poderes disponíveis
      if (data.owned_powers && data.owned_powers.length > 0) {
        const { data: availablePowersData, error: availableError } = await supabase
          .from('powers')
          .select('id, name, icon, description, activation_chance')
          .in('id', data.owned_powers);

        if (availableError) {
          console.error('Erro ao carregar poderes disponíveis:', availableError);
        } else {
          setAvailablePowers(availablePowersData || []);
        }
      } else {
        setAvailablePowers([]);
      }

    } catch (error) {
      console.error('Erro ao carregar poderes:', error);
    }
  };

  const equipPower = async (powerId) => {
    setPowerActionLoading(true);
    try {
      const { error } = await supabase.rpc('equip_power', {
        user_id_param: user.id,
        power_id_param: powerId,
        slot_param: selectedSlot
      });

      if (error) {
        console.error('Erro ao equipar poder:', error);
        return;
      }

      // Recarregar dados
      await loadUserPowers();
      setShowPowerSelector(false);
    } catch (error) {
      console.error('Erro ao equipar poder:', error);
    } finally {
      setPowerActionLoading(false);
    }
  };

  const unequipPower = async (slot) => {
    if (!userPowers[`slot_${slot}`]) return;

    setPowerActionLoading(true);
    try {
      const { error } = await supabase.rpc('unequip_power', {
        user_id_param: user.id,
        slot_param: slot
      });

      if (error) {
        console.error('Erro ao desequipar poder:', error);
        return;
      }

      await loadUserPowers();
    } catch (error) {
      console.error('Erro ao desequipar poder:', error);
    } finally {
      setPowerActionLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadProfile();
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      loadUserPowers();
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
      const { data: characterTypeData, error: characterError } = await supabase
        .from('character_types')
        .select('*')
        .eq('id', characterType)
        .single();

      if (characterError) throw characterError;

      setCharacterData(characterTypeData);

      const calculatedStats = calculateStats(characterTypeData, profile.level || 1);
      setCharacterStats(calculatedStats);
    } catch (error) {
      console.error('Erro ao carregar dados do personagem:', error);
    }
  };

  const handleCharacterChange = (newCharacterType) => {
    setCharacterType(newCharacterType);
    loadProfile();
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
      await loadCharacterData();
    } catch (error) {
      console.error('Erro ao mudar personagem:', error);
    } finally {
      setIsChangingCharacter(false);
    }
  };

  // Função para verificar se um poder está equipado
  const isPowerEquipped = (powerId) => {
    return Object.values(userPowers).some(power => power && power.id === powerId);
  };

  // Função para obter o slot onde o poder está equipado
  const getPowerSlot = (powerId) => {
    for (let i = 1; i <= 3; i++) {
      if (userPowers[`slot_${i}`] && userPowers[`slot_${i}`].id === powerId) {
        return i;
      }
    }
    return null;
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
                  </div>
                ) : isUnlocked ? (
                  <div
                    className="power-empty"
                    onClick={() => {
                      if (availablePowers.length === 0) {
                        return;
                      }
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
                  availablePowers.map(power => {
                    const isEquipped = isPowerEquipped(power.id);
                    const equippedSlot = getPowerSlot(power.id);
                    
                    return (
                      <div
                        key={power.id}
                        className={`selectable-power ${isEquipped ? 'equipped' : ''}`}
                        onClick={() => {
                          if (powerActionLoading) return;
                          equipPower(power.id);
                        }}
                        style={{ 
                          opacity: powerActionLoading ? 0.6 : 1,
                          cursor: powerActionLoading ? 'not-allowed' : 'pointer'
                        }}
                      >
                        <span className="power-icon">{power.icon}</span>
                        <div className="power-details">
                          <span className="power-name">{power.name}</span>
                          <p className="power-description">{power.description}</p>
                          <small style={{ color: 'var(--text-secondary)' }}>
                            Chance de ativação: {power.activation_chance}%
                          </small>
                          {isEquipped && (
                            <small className="equipped-indicator">
                              Equipado no Slot {equippedSlot}
                            </small>
                          )}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p>Nenhum poder disponível. Compre poderes na loja!</p>
                )}
              </div>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                <button
                  className="close-selector"
                  onClick={() => setShowPowerSelector(false)}
                  disabled={powerActionLoading}
                >
                  Cancelar
                </button>
              </div>
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