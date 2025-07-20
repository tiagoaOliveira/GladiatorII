import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../services/supabaseClientFront';
import { BattleSystem } from '../services/BattleSystem';
import './ModalBattle.css';

export default function ModalBattle({ isOpen, onClose, enemy, enemyStats }) {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [playerStats, setPlayerStats] = useState(null);
  const [userPowers, setUserPowers] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Estados da batalha
  const [battleState, setBattleState] = useState('preparation');
  const [battleSystem, setBattleSystem] = useState(null);
  const [battleData, setBattleData] = useState(null);
  const [battleResult, setBattleResult] = useState(null);
  const [battleLog, setBattleLog] = useState([]);
  const [rewardsProcessed, setRewardsProcessed] = useState(false);

  // Carregar dados do jogador
  const loadPlayerData = useCallback(async () => {
    if (!user?.id) return;

    try {
      setLoading(true);
      setError(null);

      // 1. Buscar perfil do jogador
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profileError) {
        throw new Error(`Erro ao carregar perfil: ${profileError.message}`);
      }

      if (!profileData) {
        throw new Error('Perfil não encontrado');
      }

      setProfile(profileData);

      // 2. Calcular stats do jogador
      const { data: statsData, error: statsError } = await supabase
        .rpc('calculate_character_stats', {
          character_type_id: profileData.character_type || 1,
          level: profileData.level || 1
        });

      if (statsError) {
        throw new Error(`Erro ao calcular stats: ${statsError.message}`);
      }

      if (!statsData || statsData.length === 0) {
        throw new Error('Não foi possível calcular os stats do personagem');
      }

      setPlayerStats(statsData[0]);

      // 3. Carregar poderes do usuário
      const { data: userPowersData, error: userPowersError } = await supabase
        .from('user_powers')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (userPowersError && userPowersError.code !== 'PGRST116') {
        console.warn('Erro ao carregar poderes do usuário:', userPowersError);
        setUserPowers(null);
      } else if (userPowersData) {
        // Buscar detalhes dos poderes equipados
        const powerPromises = [];
        const powersData = { ...userPowersData };

        const powerSlots = [
          { field: 'equipped_power_1', slot: 'power_1' },
          { field: 'equipped_power_2', slot: 'power_2' },
          { field: 'equipped_power_3', slot: 'power_3' }
        ];

        powerSlots.forEach(({ field, slot }) => {
          if (userPowersData[field]) {
            powerPromises.push(
              supabase
                .from('powers')
                .select('*')
                .eq('id', userPowersData[field])
                .single()
                .then(result => ({ slot, data: result.data, error: result.error }))
            );
          }
        });

        if (powerPromises.length > 0) {
          const powerResults = await Promise.all(powerPromises);
          
          powerResults.forEach(result => {
            if (!result.error && result.data) {
              powersData[result.slot] = result.data;
            }
          });
        }

        setUserPowers(powersData);
      }

    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  // Carregar dados quando o modal abrir
  useEffect(() => {
    if (isOpen && user) {
      loadPlayerData();
    }
  }, [isOpen, loadPlayerData, user]);

  // Limpar estados quando o modal fechar
  useEffect(() => {
    if (!isOpen) {
      resetBattle();
      setError(null);
      setRewardsProcessed(false);
    }
  }, [isOpen]);

  const handleBattleUpdate = useCallback((data) => {
    setBattleData(data);
    setBattleLog(data.log || []);
  }, []);

  const handleBattleEnd = useCallback(async (result) => {
    setBattleResult(result);
    setBattleState('ended');

    // Processar recompensas apenas uma vez
    if (result.result === 'victory' && !rewardsProcessed) {
      setRewardsProcessed(true);
      
      try {
        const newXp = (profile.xp || 0) + (enemy.xp_reward || 100);
        const newGold = (profile.gold || 0) + (enemy.gold_reward || 50);
        
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ xp: newXp, gold: newGold })
          .eq('id', user.id);
        
        if (!updateError) {
          setProfile(prev => ({ ...prev, xp: newXp, gold: newGold }));
        }
      } catch (error) {
        console.error('Erro ao processar recompensas:', error);
      }
    }
  }, [rewardsProcessed, profile, enemy, user]);

  const startBattle = useCallback(() => {
    if (!playerStats || !enemyStats) {
      setError('Dados de batalha incompletos');
      return;
    }

    try {
      // Parar batalha anterior se existir
      if (battleSystem) {
        battleSystem.stopBattle();
      }

      // Criar sistema de batalha com poderes
      const equippedPowers = [];
      if (userPowers?.power_1) equippedPowers.push(userPowers.power_1);
      if (userPowers?.power_2) equippedPowers.push(userPowers.power_2);
      if (userPowers?.power_3) equippedPowers.push(userPowers.power_3);

      const battle = new BattleSystem(
        playerStats,
        enemyStats,
        equippedPowers,
        handleBattleUpdate,
        handleBattleEnd
      );

      setBattleSystem(battle);
      setBattleState('fighting');
      setBattleData(null);
      setBattleResult(null);
      setBattleLog([]);
      setError(null);
      setRewardsProcessed(false);

      battle.startBattle();
    } catch (error) {
      console.error('Erro ao iniciar batalha:', error);
      setError('Erro ao iniciar batalha');
    }
  }, [playerStats, enemyStats, userPowers, battleSystem, handleBattleUpdate, handleBattleEnd]);

  const resetBattle = useCallback(() => {
    if (battleSystem) {
      battleSystem.stopBattle();
    }
    setBattleState('preparation');
    setBattleSystem(null);
    setBattleData(null);
    setBattleResult(null);
    setBattleLog([]);
    setError(null);
    setRewardsProcessed(false);
  }, [battleSystem]);

  const getCharacterIcon = (characterType) => {
    const icons = {
      1: '🏃‍♂️', // Assassin
      2: '⚔️',   // Warrior
      3: '🛡️'    // Tank
    };
    return icons[characterType] || '⚔️';
  };

  const getEnemyIcon = (enemyType) => {
    const icons = {
      warrior: '🗡️',
      assassin: '🗡️',
      tank: '🛡️',
      boss: '👑'
    };
    return icons[enemyType] || '⚔️';
  };

  const formatTime = (ms) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const formatLogEntry = (entry) => {
    if (entry.type === 'system') {
      return entry.message;
    }
    
    if (entry.type === 'attack') {
      let text = `${entry.attacker} dealt ${entry.damage} damage to ${entry.defender}`;
      
      if (entry.isCritical) {
        text += ' CRITICAL!';
      }
      
      return text;
    }
    
    return entry.message || 'Unknown event';
  };

  const getLogEntryClass = (entry) => {
    let className = 'log-entry';
    
    if (entry.type === 'system' || entry.isPowerActivation) {
      className += ' power-activated';
    }
    
    if (entry.isCritical) {
      className += ' critical';
    }
    
    return className;
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-battle" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Battle Arena</h2>
          <button className="close-button" onClick={onClose}>✕</button>
        </div>

        <div className="battle-content">
          {loading ? (
            <div className="loading">
              <div className="loading-spinner"></div>
              <p>Preparing battle...</p>
            </div>
          ) : error ? (
            <div className="error-message">
              <p>❌ {error}</p>
              <button className="action-button" onClick={loadPlayerData}>
                Try Again
              </button>
            </div>
          ) : (
            <>
              {/* Área de Batalha */}
              <div className="battle-arena">
                {/* Jogador */}
                <div className="fighter player">
                  <div className="fighter-image">
                    <div className={`character-orb character-${profile?.character_type || 1}`}>
                      {getCharacterIcon(profile?.character_type || 1)}
                    </div>
                    {battleData && (
                      <div className="hp-bar">
                        <div
                          className="hp-fill player-hp"
                          style={{ 
                            width: `${(battleData.player.currentHp / battleData.player.maxHp) * 100}%` 
                          }}
                        />
                        <span className="hp-text">
                          {battleData.player.currentHp}/{battleData.player.maxHp}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="fighter-info">
                    <h3 className="fighter-name">{profile?.character_name}</h3>
                    <p className="fighter-level">Level {profile?.level}</p>
                  </div>
                </div>

                {/* VS */}
                <div className="vs-separator">
                  <span className="vs-text">VS</span>
                </div>

                {/* Inimigo */}
                <div className="fighter enemy">
                  <div className="fighter-image">
                    <div className={`enemy-orb ${enemy?.type}`}>
                      {getEnemyIcon(enemy?.type)}
                    </div>
                    {battleData && (
                      <div className="hp-bar">
                        <div
                          className="hp-fill enemy-hp"
                          style={{ 
                            width: `${(battleData.enemy.currentHp / battleData.enemy.maxHp) * 100}%` 
                          }}
                        />
                        <span className="hp-text">
                          {battleData.enemy.currentHp}/{battleData.enemy.maxHp}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="fighter-info">
                    <h3 className="fighter-name">{enemy?.name}</h3>
                    <p className="fighter-level">Level {enemy?.level}</p>
                    <p className="fighter-type">{enemy?.type}</p>
                  </div>
                </div>
              </div>

              {/* Estados da Batalha */}
              {battleState === 'preparation' && (
                <>
                  {/* Stats Comparison */}
                  <div className="stats-comparison">
                    <div className="stats-section player-stats">
                      <h4>Your Stats</h4>
                      <div className="stats-grid-modal">
                        <div className="stat-item">
                          <span className="stat-icon-modal">❤️</span>
                          <span className="stat-name-modal">HP</span>
                          <span className="stat-value-modal">{playerStats?.hp}</span>
                        </div>
                        <div className="stat-item">
                          <span className="stat-icon-modal">⚔️</span>
                          <span className="stat-name-modal">Attack</span>
                          <span className="stat-value-modal">{playerStats?.attack}</span>
                        </div>
                        <div className="stat-item">
                          <span className="stat-icon-modal">🛡️</span>
                          <span className="stat-name-modal">Defense</span>
                          <span className="stat-value-modal">{playerStats?.defense}</span>
                        </div>
                        <div className="stat-item">
                          <span className="stat-icon-modal">💥</span>
                          <span className="stat-name-modal">Critical</span>
                          <span className="stat-value-modal">{playerStats?.critical}%</span>
                        </div>
                        <div className="stat-item">
                          <span className="stat-icon-modal">💨</span>
                          <span className="stat-name-modal">Speed</span>
                          <span className="stat-value-modal">{playerStats?.speed}</span>
                        </div>
                      </div>
                    </div>

                    <div className="stats-section enemy-stats-modal">
                      <h4>Enemy Stats</h4>
                      <div className="stats-grid-modal">
                        <div className="stat-item">
                          <span className="stat-icon-modal">❤️</span>
                          <span className="stat-name-modal">HP</span>
                          <span className="stat-value-modal">{enemyStats?.hp}</span>
                        </div>
                        <div className="stat-item">
                          <span className="stat-icon-modal">⚔️</span>
                          <span className="stat-name-modal">Attack</span>
                          <span className="stat-value-modal">{enemyStats?.attack}</span>
                        </div>
                        <div className="stat-item">
                          <span className="stat-icon-modal">🛡️</span>
                          <span className="stat-name-modal">Defense</span>
                          <span className="stat-value-modal">{enemyStats?.defense}</span>
                        </div>
                        <div className="stat-item">
                          <span className="stat-icon-modal">💥</span>
                          <span className="stat-name-modal">Critical</span>
                          <span className="stat-value-modal">{enemyStats?.critical}%</span>
                        </div>
                        <div className="stat-item">
                          <span className="stat-icon-modal">💨</span>
                          <span className="stat-name-modal">Speed</span>
                          <span className="stat-value-modal">{enemyStats?.speed}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Battle Actions */}
                  <div className="battle-actions">
                    <button 
                      className="action-button start-battle" 
                      onClick={startBattle}
                      disabled={!playerStats || !enemyStats}
                    >
                      Start Battle
                    </button>
                  </div>
                </>
              )}

              {battleState === 'fighting' && (
                <div className="battle-progress">
                  <div className="battle-info">
                    <h4>⚔️ Battle in Progress...</h4>
                    {battleSystem && (
                      <p>Duration: {formatTime(Date.now() - battleSystem.battleStartTime)}</p>
                    )}
                  </div>

                  {/* Log da Batalha */}
                  <div className="battle-log">
                    <h5>Battle Log:</h5>
                    <div className="log-entries">
                      {battleLog.length === 0 ? (
                        <div className="log-entry">Battle starting...</div>
                      ) : (
                        battleLog.slice(-8).map((entry, index) => (
                          <div key={index} className={getLogEntryClass(entry)}>
                            <span className="log-time">
                              {formatTime(entry.timestamp)}
                            </span>
                            <span className="log-text">
                              {formatLogEntry(entry)}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="battle-actions">
                    <button className="action-button stop-battle" onClick={resetBattle}>
                      Stop Battle
                    </button>
                  </div>
                </div>
              )}

              {battleState === 'ended' && battleResult && (
                <div className="battle-results">
                  <div className={`result-header ${battleResult.result}`}>
                    <h3>
                      {battleResult.result === 'victory' ? '🏆 VICTORY!' : '💀 DEFEAT!'}
                    </h3>
                    <p>Battle Duration: {formatTime(battleResult.duration)}</p>
                  </div>

                  {/* Log Final da Batalha */}
                  <div className="battle-log final-log">
                    <h5>Final Battle Log:</h5>
                    <div className="log-entries">
                      {battleLog.slice(-10).map((entry, index) => (
                        <div key={index} className={getLogEntryClass(entry)}>
                          <span className="log-time">
                            {formatTime(entry.timestamp)}
                          </span>
                          <span className="log-text">
                            {formatLogEntry(entry)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {battleResult.result === 'victory' && (
                    <div className="rewards">
                      <h4>🎁 Rewards:</h4>
                      <div className="reward-items">
                        <div className="reward-item">
                          <span className="reward-icon">🏆</span>
                          <span>+{enemy.xp_reward || 100} XP</span>
                        </div>
                        <div className="reward-item">
                          <span className="reward-icon">💰</span>
                          <span>+{enemy.gold_reward || 50} Gold</span>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="battle-actions">
                    <button className="action-button start-battle" onClick={resetBattle}>
                      Fight Again
                    </button>
                    <button className="action-button secondary" onClick={onClose}>
                      Close
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}