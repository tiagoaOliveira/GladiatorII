import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../services/supabaseClientFront';
import CharacterModal from '../components/CharacterModal';
import Layout from '../components/Layout';
import './Perfil.css';

// Debounce utility function
const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

export default function Perfil() {
  const { user } = useAuth();
  
  // Estados consolidados
  const [profile, setProfile] = useState(null);
  const [characterType, setCharacterType] = useState(null);
  const [isCharacterModalOpen, setIsCharacterModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userPowers, setUserPowers] = useState({ slot_1: null, slot_2: null, slot_3: null });
  const [availablePowers, setAvailablePowers] = useState([]);
  const [showPowerSelector, setShowPowerSelector] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [powerActionLoading, setPowerActionLoading] = useState(false);
  
  // Cache para evitar recarregamentos desnecessários
  const [dataCache, setDataCache] = useState({
    characterTypes: new Map(),
    powers: new Map(),
    lastProfileUpdate: null,
    lastPowersUpdate: null
  });

  // Função para calcular stats (memoizada)
  const calculateStats = useCallback((characterData, level) => {
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
  }, []);

  // Função para obter dados do character type do cache
  const getCachedCharacterData = useCallback((characterTypeId) => {
    const cached = dataCache.characterTypes.get(characterTypeId);
    if (cached && Date.now() - cached.timestamp < 5 * 60 * 1000) { // 5 minutos
      return cached.data;
    }
    return null;
  }, [dataCache.characterTypes]);

  // Função principal para carregar todos os dados iniciais
  const loadInitialData = useCallback(async () => {
    if (!user?.id) return;

    try {
      setLoading(true);
      
      // Carregar dados em paralelo
      const [profileResult, characterTypesResult, userPowersResult] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('character_types').select('*'),
        supabase.from('user_powers').select(`
          equipped_power_1,
          equipped_power_2,
          equipped_power_3,
          owned_powers,
          power_1:equipped_power_1(id, name, icon, description, activation_chance),
          power_2:equipped_power_2(id, name, icon, description, activation_chance),
          power_3:equipped_power_3(id, name, icon, description, activation_chance)
        `).eq('user_id', user.id).single()
      ]);

      // Processar perfil
      if (profileResult.data) {
        setProfile(profileResult.data);
        setCharacterType(profileResult.data.character_type || 1);
      }

      // Cache dos character types
      if (characterTypesResult.data) {
        const characterTypesMap = new Map();
        characterTypesResult.data.forEach(ct => {
          characterTypesMap.set(ct.id, {
            data: ct,
            timestamp: Date.now()
          });
        });
        
        setDataCache(prev => ({
          ...prev,
          characterTypes: characterTypesMap,
          lastProfileUpdate: Date.now()
        }));
      }

      // Processar poderes do usuário
      if (userPowersResult.data) {
        const powersData = userPowersResult.data;
        
        // Montar poderes equipados usando os dados do JOIN
        const newUserPowers = { slot_1: null, slot_2: null, slot_3: null };
        
        for (let i = 1; i <= 3; i++) {
          const powerData = powersData[`power_${i}`];
          if (powerData) {
            newUserPowers[`slot_${i}`] = powerData;
          }
        }

        setUserPowers(newUserPowers);

        // Carregar poderes disponíveis se existirem
        if (powersData.owned_powers && powersData.owned_powers.length > 0) {
          const { data: availablePowersData, error: availableError } = await supabase
            .from('powers')
            .select('id, name, icon, description, activation_chance')
            .in('id', powersData.owned_powers);

          if (!availableError && availablePowersData) {
            setAvailablePowers(availablePowersData);
          }
        }

        setDataCache(prev => ({
          ...prev,
          lastPowersUpdate: Date.now()
        }));
      } else {
        // Se não há registro de poderes, criar um vazio
        const { error: insertError } = await supabase
          .from('user_powers')
          .insert([{ user_id: user.id, owned_powers: [] }]);

        if (insertError) {
          console.error('Erro ao criar registro de poderes:', insertError);
        }
        
        setUserPowers({ slot_1: null, slot_2: null, slot_3: null });
        setAvailablePowers([]);
      }

    } catch (error) {
      console.error('Erro ao carregar dados iniciais:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  // Função otimizada para equipar poder com update otimista
  const equipPower = async (powerId) => {
    if (powerActionLoading) return;
    
    setPowerActionLoading(true);
    
    // Update otimista - atualizar UI imediatamente
    const powerData = availablePowers.find(p => p.id === powerId);
    const previousPower = userPowers[`slot_${selectedSlot}`];
    
    setUserPowers(prev => ({
      ...prev,
      [`slot_${selectedSlot}`]: powerData
    }));

    try {
      const { error } = await supabase.rpc('equip_power', {
        user_id_param: user.id,
        power_id_param: powerId,
        slot_param: selectedSlot
      });

      if (error) {
        // Reverter mudança otimista em caso de erro
        setUserPowers(prev => ({
          ...prev,
          [`slot_${selectedSlot}`]: previousPower
        }));
        throw error;
      }

      setShowPowerSelector(false);
    } catch (error) {
      console.error('Erro ao equipar poder:', error);
    } finally {
      setPowerActionLoading(false);
    }
  };

  // Função otimizada para desequipar poder
  const unequipPower = async (slot) => {
    if (!userPowers[`slot_${slot}`] || powerActionLoading) return;

    setPowerActionLoading(true);
    
    // Update otimista
    const previousPower = userPowers[`slot_${slot}`];
    setUserPowers(prev => ({
      ...prev,
      [`slot_${slot}`]: null
    }));

    try {
      const { error } = await supabase.rpc('unequip_power', {
        user_id_param: user.id,
        slot_param: slot
      });

      if (error) {
        // Reverter mudança otimista em caso de erro
        setUserPowers(prev => ({
          ...prev,
          [`slot_${slot}`]: previousPower
        }));
        throw error;
      }

      setShowPowerSelector(false);
    } catch (error) {
      console.error('Erro ao desequipar poder:', error);
    } finally {
      setPowerActionLoading(false);
    }
  };

  // Debounced function para mudanças de personagem
  const debouncedCharacterUpdate = useCallback(
    debounce(async (newCharacterType) => {
      try {
        const { error } = await supabase
          .from('profiles')
          .update({ character_type: newCharacterType })
          .eq('id', user.id);

        if (error) throw error;
      } catch (error) {
        console.error('Erro ao atualizar personagem:', error);
        // Reverter mudança em caso de erro
        setCharacterType(profile?.character_type || 1);
      }
    }, 500),
    [user?.id, profile?.character_type]
  );

  // Função para mudar personagem com update otimista
  const changeCharacter = async (direction) => {
    if (!user?.id) return;

    let newCharacterType;
    if (direction === 'next') {
      newCharacterType = characterType === 3 ? 1 : characterType + 1;
    } else {
      newCharacterType = characterType === 1 ? 3 : characterType - 1;
    }

    // Update otimista
    setCharacterType(newCharacterType);
    
    // Update no backend com debounce
    debouncedCharacterUpdate(newCharacterType);
  };

  // Função para abrir seletor de poderes
  const openPowerSelector = (slot) => {
    if (availablePowers.length === 0) return;
    setSelectedSlot(slot);
    setShowPowerSelector(true);
  };

  // Memoizar poderes disponíveis para seleção
  const availablePowersForSelection = useMemo(() => {
    const equippedPowerIds = Object.values(userPowers)
      .filter(power => power !== null)
      .map(power => power.id);
    
    return availablePowers.filter(power => !equippedPowerIds.includes(power.id));
  }, [userPowers, availablePowers]);

  // Memoizar dados do personagem atual
  const currentCharacterData = useMemo(() => {
    if (!characterType) return null;
    return getCachedCharacterData(characterType);
  }, [characterType, getCachedCharacterData]);

  // Memoizar stats calculadas
  const characterStats = useMemo(() => {
    if (!currentCharacterData || !profile) return null;
    return calculateStats(currentCharacterData, profile.level || 1);
  }, [currentCharacterData, profile, calculateStats]);

  // Função para verificar se um poder está equipado
  const isPowerEquipped = useCallback((powerId) => {
    return Object.values(userPowers).some(power => power && power.id === powerId);
  }, [userPowers]);

  // Função para obter o slot onde o poder está equipado
  const getPowerSlot = useCallback((powerId) => {
    for (let i = 1; i <= 3; i++) {
      if (userPowers[`slot_${i}`] && userPowers[`slot_${i}`].id === powerId) {
        return i;
      }
    }
    return null;
  }, [userPowers]);

  // Effect principal para carregar dados iniciais
  useEffect(() => {
    if (user?.id) {
      loadInitialData();
    }
  }, [user?.id, loadInitialData]);

  // Setup de real-time subscriptions
  useEffect(() => {
    if (!user?.id) return;

    const subscription = supabase
      .channel('profile-changes')
      .on('postgres_changes', 
        { 
          event: 'UPDATE', 
          schema: 'public', 
          table: 'profiles',
          filter: `id=eq.${user.id}`
        }, 
        (payload) => {
          setProfile(payload.new);
          if (payload.new.character_type !== characterType) {
            setCharacterType(payload.new.character_type);
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [user?.id, characterType]);

  // Loading state
  if (loading || !currentCharacterData || !characterStats) {
    return (
      <Layout>
        <div className="perfil-container">
          <div className="loading-container">
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
                  <div 
                    className="power-item" 
                    onClick={() => openPowerSelector(slot)}
                  >
                    <span className="power-icon">{power.icon}</span>
                  </div>
                ) : isUnlocked ? (
                  <div
                    className="power-empty"
                    onClick={() => openPowerSelector(slot)}
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
                {availablePowersForSelection.length > 0 ? (
                  availablePowersForSelection.map(power => (
                    <div
                      key={power.id}
                      className={`selectable-power ${powerActionLoading ? 'loading' : ''}`}
                      onClick={() => {
                        if (powerActionLoading) return;
                        equipPower(power.id);
                      }}
                    >
                      <span className="power-icon">{power.icon}</span>
                      <div className="power-details">
                        <span className="power-name">{power.name}</span>
                        <p className="power-description">{power.description}</p>
                        <small className="power-chance">
                          Chance de ativação: {power.activation_chance}%
                        </small>
                      </div>
                    </div>
                  ))
                ) : (
                  <p>
                    {availablePowers.length === 0 
                      ? "Nenhum poder disponível. Compre poderes na loja!" 
                      : "Todos os poderes disponíveis já estão equipados!"
                    }
                  </p>
                )}
              </div>
              <div className='select-power-modal'>
                {userPowers[`slot_${selectedSlot}`] && (
                  <button
                    className={`remove-power-btn ${powerActionLoading ? 'loading' : ''}`}
                    onClick={() => {
                      if (powerActionLoading) return;
                      unequipPower(selectedSlot);
                    }}
                    disabled={powerActionLoading}
                  >
                    Remove Power
                  </button>
                )}
                <button
                  className="close-selector"
                  onClick={() => setShowPowerSelector(false)}
                  disabled={powerActionLoading}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Seta Direita */}
        <button
          className="character-nav-arrow right"
          onClick={() => changeCharacter('next')}
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
          characterData={currentCharacterData}
          characterStats={characterStats}
          isOpen={isCharacterModalOpen}
          onClose={() => setIsCharacterModalOpen(false)}
          onCharacterChange={(newCharacterType) => {
            setCharacterType(newCharacterType);
            debouncedCharacterUpdate(newCharacterType);
          }}
        />
      </div>
    </Layout>
  );
}