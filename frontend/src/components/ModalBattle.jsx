import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../services/supabaseClientFront';
import { BattleSystem } from '../services/BattleSystem';
import './ModalBattle.css';

export default function ModalBattle({ isOpen, onClose, enemy, enemyStats }) {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [characterData, setCharacterData] = useState(null);
  const [playerStats, setPlayerStats] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Estados da batalha
  const [battleState, setBattleState] = useState('preparation'); // preparation, fighting, ended
  const [battleSystem, setBattleSystem] = useState(null);
  const [battleData, setBattleData] = useState(null);
  const [battleResult, setBattleResult] = useState(null);
  const [battleLog, setBattleLog] = useState([]);

  useEffect(() => {
    if (isOpen && user) {
      loadPlayerData();
    }
  }, [isOpen, user]);

  const loadPlayerData = async () => {
    try {
      // Carregar perfil do jogador
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profileData) {
        setProfile(profileData);

        // Carregar dados do tipo de personagem
        const { data: characterTypeData } = await supabase
          .from('character_types')
          .select('*')
          .eq('id', profileData.character_type || 1)
          .single();

        if (characterTypeData) {
          setCharacterData(characterTypeData);

          // Calcular stats do jogador
          const { data: statsData } = await supabase
            .rpc('calculate_character_stats', {
              character_type_id: profileData.character_type || 1,
              level: profileData.level || 1
            });

          if (statsData && statsData.length > 0) {
            setPlayerStats(statsData[0]);
          }
        }
      }
    } catch (error) {
      console.error('Erro ao carregar dados do jogador:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBattleUpdate = (data) => {
    setBattleData(data);
    setBattleLog(data.log);
  };

  const handleBattleEnd = async (result) => {
    setBattleResult(result);
    setBattleState('ended');
    
    // Se vitória, atualizar XP e Gold do jogador
    if (result.result === 'victory') {
      try {
        const newXp = (profile.xp || 0) + enemy.xp_reward;
        const newGold = (profile.gold || 0) + enemy.gold_reward;
        
        await supabase
          .from('profiles')
          .update({ 
            xp: newXp, 
            gold: newGold 
          })
          .eq('id', user.id);
        
        // Atualizar perfil local
        setProfile(prev => ({
          ...prev,
          xp: newXp,
          gold: newGold
        }));
      } catch (error) {
        console.error('Erro ao atualizar recompensas:', error);
      }
    }
  };

  const startBattle = () => {
    if (!playerStats || !enemyStats) return;
    
    const battle = new BattleSystem(
      playerStats,
      enemyStats,
      handleBattleUpdate,
      handleBattleEnd
    );
    
    setBattleSystem(battle);
    setBattleState('fighting');
    setBattleData(null);
    setBattleResult(null);
    setBattleLog([]);
    
    battle.startBattle();
  };

  const resetBattle = () => {
    if (battleSystem) {
      battleSystem.stopBattle();
    }
    setBattleState('preparation');
    setBattleSystem(null);
    setBattleData(null);
    setBattleResult(null);
    setBattleLog([]);
  };

  const getCharacterIcon = (characterType) => {
    switch (characterType) {
      case 1: return '🏃‍♂️'; // Assassin
      case 2: return '⚔️'; // Warrior
      case 3: return '🛡️'; // Tank
      default: return '⚔️';
    }
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

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-battle" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Battle Arena</h2>
          <button className="close-button" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="battle-content">
          {loading ? (
            <div className="loading">
              <p>Preparing battle...</p>
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
                          style={{ width: `${battleData.player.hpPercent}%` }}
                        />
                        <span className="hp-text">
                          {battleData.player.currentHp}/{battleData.player.maxHp}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="fighter-info">
                    <h3 className="fighter-name">{profile?.character_name}</h3>
                    <p className="fighter-level">Level {profile?.level || 1}</p>
                    <p className="fighter-type">{characterData?.name || 'Warrior'}</p>
                  </div>
                </div>

                {/* VS */}
                <div className="vs-separator">
                  <span className="vs-text">VS</span>
                </div>

                {/* Inimigo */}
                <div className="fighter enemy">
                  <div className="fighter-image">
                    <div className={`enemy-orb ${enemy?.type || 'warrior'}`}>
                      {getEnemyIcon(enemy?.type)}
                    </div>
                    {battleData && (
                      <div className="hp-bar">
                        <div 
                          className="hp-fill enemy-hp" 
                          style={{ width: `${battleData.enemy.hpPercent}%` }}
                        />
                        <span className="hp-text">
                          {battleData.enemy.currentHp}/{battleData.enemy.maxHp}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="fighter-info">
                    <h3 className="fighter-name">{enemy?.name || 'Enemy'}</h3>
                    <p className="fighter-level">Level {enemy?.level || 1}</p>
                    <p className="fighter-type">{enemy?.type || 'warrior'}</p>
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
                          <span className="stat-value-modal">{playerStats?.hp || 0}</span>
                        </div>
                        <div className="stat-item">
                          <span className="stat-icon-modal">⚔️</span>
                          <span className="stat-name-modal">Attack</span>
                          <span className="stat-value-modal">{playerStats?.attack || 0}</span>
                        </div>
                        <div className="stat-item">
                          <span className="stat-icon-modal">🛡️</span>
                          <span className="stat-name-modal">Defense</span>
                          <span className="stat-value-modal">{playerStats?.defense || 0}</span>
                        </div>
                        <div className="stat-item">
                          <span className="stat-icon-modal">💥</span>
                          <span className="stat-name-modal">Critical</span>
                          <span className="stat-value-modal">{playerStats?.critical || 0}</span>
                        </div>
                        <div className="stat-item">
                          <span className="stat-icon-modal">💨</span>
                          <span className="stat-name-modal">Speed</span>
                          <span className="stat-value-modal">{playerStats?.speed || 0}</span>
                        </div>
                      </div>
                    </div>

                    <div className="stats-section enemy-stats-modal">
                      <h4>Enemy Stats</h4>
                      <div className="stats-grid-modal">
                        <div className="stat-item">
                          <span className="stat-icon-modal">❤️</span>
                          <span className="stat-name-modal">HP</span>
                          <span className="stat-value-modal">{enemyStats?.hp || 0}</span>
                        </div>
                        <div className="stat-item">
                          <span className="stat-icon-modal">⚔️</span>
                          <span className="stat-name-modal">Attack</span>
                          <span className="stat-value-modal">{enemyStats?.attack || 0}</span>
                        </div>
                        <div className="stat-item">
                          <span className="stat-icon-modal">🛡️</span>
                          <span className="stat-name-modal">Defense</span>
                          <span className="stat-value-modal">{enemyStats?.defense || 0}</span>
                        </div>
                        <div className="stat-item">
                          <span className="stat-icon-modal">💥</span>
                          <span className="stat-name-modal">Critical</span>
                          <span className="stat-value-modal">{enemyStats?.critical || 0}</span>
                        </div>
                        <div className="stat-item">
                          <span className="stat-icon-modal">💨</span>
                          <span className="stat-name-modal">Speed</span>
                          <span className="stat-value-modal">{enemyStats?.speed || 0}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Battle Actions */}
                  <div className="battle-actions">
                    <button className="action-button start-battle" onClick={startBattle}>
                      Start Battle
                    </button>
                  </div>
                </>
              )}

              {battleState === 'fighting' && (
                <div className="battle-progress">
                  <div className="battle-info">
                    <h4>Battle in Progress...</h4>
                    {battleData && (
                      <p>Duration: {formatTime(Date.now() - battleSystem.battleStartTime)}</p>
                    )}
                  </div>
                  
                  {/* Log da Batalha */}
                  <div className="battle-log">
                    <h5>Battle Log</h5>
                    <div className="log-entries">
                      {battleLog.slice(-5).map((entry, index) => (
                        <div key={index} className={`log-entry ${entry.isCritical ? 'critical' : ''}`}>
                          <span className="log-time">{formatTime(entry.timestamp)}</span>
                          <span className="log-text">
                            {entry.attacker} dealt {entry.damage} damage to {entry.defender}
                            {entry.isCritical && <span className="critical-text"> CRITICAL!</span>}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {battleState === 'ended' && battleResult && (
                <div className="battle-results">
                  <div className={`result-header ${battleResult.result}`}>
                    <h3>{battleResult.result === 'victory' ? '🏆 VICTORY!' : '💀 DEFEAT!'}</h3>
                    <p>Battle Duration: {formatTime(battleResult.duration)}</p>
                  </div>
                  
                  {battleResult.result === 'victory' && (
                    <div className="rewards">
                      <h4>Rewards:</h4>
                      <div className="reward-items">
                        <div className="reward-item">
                          <span className="reward-icon">🏆</span>
                          <span>+{enemy.xp_reward} XP</span>
                        </div>
                        <div className="reward-item">
                          <span className="reward-icon">💰</span>
                          <span>+{enemy.gold_reward} Gold</span>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <div className="battle-actions">
                    <button className="action-button start-battle" onClick={resetBattle}>
                      Fight Again
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