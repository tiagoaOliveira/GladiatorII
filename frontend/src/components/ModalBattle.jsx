import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../services/supabaseClientFront';
import { BattleSystem } from '../services/BattleSystem';
import './ModalBattle.css';

export default function ModalBattle({ isOpen, onClose, opponent }) {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [playerStats, setPlayerStats] = useState(null);
  const [userPowers, setUserPowers] = useState(null);
  
  // Estados do oponente
  const [opponentProfile, setOpponentProfile] = useState(null);
  const [opponentStats, setOpponentStats] = useState(null);
  const [opponentPowers, setOpponentPowers] = useState(null);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Estados da batalha
  const [battleState, setBattleState] = useState('preparation');
  const [battleSystem, setBattleSystem] = useState(null);
  const [battleData, setBattleData] = useState(null);
  const [battleResult, setBattleResult] = useState(null);
  const [battleLog, setBattleLog] = useState([]);

  // Função para carregar dados de um usuário
  const loadUserData = useCallback(async (userId) => {
    // 1. Buscar perfil
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (profileError) {
      throw new Error(`Erro ao carregar perfil: ${profileError.message}`);
    }

    // 2. Calcular stats
    const { data: statsData, error: statsError } = await supabase
      .rpc('calculate_character_stats', {
        character_type_id: profileData.character_type || 1,
        level: profileData.level || 1
      });

    if (statsError) {
      throw new Error(`Erro ao calcular stats: ${statsError.message}`);
    }

    // 3. Carregar poderes
    const { data: userPowersData, error: userPowersError } = await supabase
      .from('user_powers')
      .select('*')
      .eq('user_id', userId)
      .single();

    let powersData = null;
    if (!userPowersError && userPowersData) {
      const powerPromises = [];
      powersData = { ...userPowersData };

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
    }

    return {
      profile: profileData,
      stats: statsData[0],
      powers: powersData
    };
  }, []);

  // Carregar dados de ambos os jogadores
  const loadBattleData = useCallback(async () => {
    if (!user?.id || !opponent?.id) return;

    try {
      setLoading(true);
      setError(null);

      // Carregar dados do jogador atual
      const playerData = await loadUserData(user.id);
      setProfile(playerData.profile);
      setPlayerStats(playerData.stats);
      setUserPowers(playerData.powers);

      // Carregar dados do oponente
      const opponentData = await loadUserData(opponent.id);
      setOpponentProfile(opponentData.profile);
      setOpponentStats(opponentData.stats);
      setOpponentPowers(opponentData.powers);

    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  }, [user?.id, opponent?.id, loadUserData]);

  // Carregar dados quando o modal abrir
  useEffect(() => {
    if (isOpen && user && opponent) {
      loadBattleData();
    }
  }, [isOpen, loadBattleData, user, opponent]);

  // Limpar estados quando o modal fechar
  useEffect(() => {
    if (!isOpen) {
      resetBattle();
      setError(null);
    }
  }, [isOpen]);

  const handleBattleUpdate = useCallback((data) => {
    setBattleData(data);
    setBattleLog(data.log || []);
  }, []);

  const handleBattleEnd = useCallback((result) => {
    setBattleResult(result);
    setBattleState('ended');
  }, []);

  const startBattle = useCallback(() => {
    if (!playerStats || !opponentStats) {
      setError('Dados de batalha incompletos');
      return;
    }

    try {
      // Parar batalha anterior se existir
      if (battleSystem) {
        battleSystem.stopBattle();
      }

      // Preparar poderes do jogador
      const playerEquippedPowers = [];
      if (userPowers?.power_1) playerEquippedPowers.push(userPowers.power_1);
      if (userPowers?.power_2) playerEquippedPowers.push(userPowers.power_2);
      if (userPowers?.power_3) playerEquippedPowers.push(userPowers.power_3);

      // Preparar poderes do oponente
      const opponentEquippedPowers = [];
      if (opponentPowers?.power_1) opponentEquippedPowers.push(opponentPowers.power_1);
      if (opponentPowers?.power_2) opponentEquippedPowers.push(opponentPowers.power_2);
      if (opponentPowers?.power_3) opponentEquippedPowers.push(opponentPowers.power_3);

      // Criar sistema de batalha PvP
      const battle = new BattleSystem(
        { ...playerStats, name: profile?.character_name || 'Player 1' },
        { ...opponentStats, name: opponentProfile?.character_name || 'Player 2' },
        playerEquippedPowers,
        opponentEquippedPowers,
        handleBattleUpdate,
        handleBattleEnd
      );

      setBattleSystem(battle);
      setBattleState('fighting');
      setBattleData(null);
      setBattleResult(null);
      setBattleLog([]);
      setError(null);

      battle.startBattle();
    } catch (error) {
      console.error('Erro ao iniciar batalha:', error);
      setError('Erro ao iniciar batalha');
    }
  }, [playerStats, opponentStats, userPowers, opponentPowers, profile, opponentProfile, battleSystem, handleBattleUpdate, handleBattleEnd]);

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
  }, [battleSystem]);

  const getCharacterIcon = (characterType) => {
    const icons = {
      1: '🏃‍♂️', // Assassin
      2: '⚔️',   // Warrior
      3: '🛡️'    // Tank
    };
    return icons[characterType] || '⚔️';
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
          <h2 className="modal-title">PvP Battle Arena</h2>
          <button className="close-button" onClick={onClose}>✕</button>
        </div>

        <div className="battle-content">
          {loading ? (
            <div className="loading">
              <div className="loading-spinner"></div>
              <p>Preparing PvP battle...</p>
            </div>
          ) : error ? (
            <div className="error-message">
              <p>❌ {error}</p>
              <button className="action-button" onClick={loadBattleData}>
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
                            width: `${(battleData.player1.currentHp / battleData.player1.maxHp) * 100}%` 
                          }}
                        />
                        <span className="hp-text">
                          {battleData.player1.currentHp}/{battleData.player1.maxHp}
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

                {/* Oponente */}
                <div className="fighter enemy">
                  <div className="fighter-image">
                    <div className={`character-orb character-${opponentProfile?.character_type || 1}`}>
                      {getCharacterIcon(opponentProfile?.character_type || 1)}
                    </div>
                    {battleData && (
                      <div className="hp-bar">
                        <div
                          className="hp-fill enemy-hp"
                          style={{ 
                            width: `${(battleData.player2.currentHp / battleData.player2.maxHp) * 100}%` 
                          }}
                        />
                        <span className="hp-text">
                          {battleData.player2.currentHp}/{battleData.player2.maxHp}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="fighter-info">
                    <h3 className="fighter-name">{opponentProfile?.character_name}</h3>
                    <p className="fighter-level">Level {opponentProfile?.level}</p>
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
                      <h4>Opponent Stats</h4>
                      <div className="stats-grid-modal">
                        <div className="stat-item">
                          <span className="stat-icon-modal">❤️</span>
                          <span className="stat-name-modal">HP</span>
                          <span className="stat-value-modal">{opponentStats?.hp}</span>
                        </div>
                        <div className="stat-item">
                          <span className="stat-icon-modal">⚔️</span>
                          <span className="stat-name-modal">Attack</span>
                          <span className="stat-value-modal">{opponentStats?.attack}</span>
                        </div>
                        <div className="stat-item">
                          <span className="stat-icon-modal">🛡️</span>
                          <span className="stat-name-modal">Defense</span>
                          <span className="stat-value-modal">{opponentStats?.defense}</span>
                        </div>
                        <div className="stat-item">
                          <span className="stat-icon-modal">💥</span>
                          <span className="stat-name-modal">Critical</span>
                          <span className="stat-value-modal">{opponentStats?.critical}%</span>
                        </div>
                        <div className="stat-item">
                          <span className="stat-icon-modal">💨</span>
                          <span className="stat-name-modal">Speed</span>
                          <span className="stat-value-modal">{opponentStats?.speed}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Battle Actions */}
                  <div className="battle-actions">
                    <button 
                      className="action-button start-battle" 
                      onClick={startBattle}
                      disabled={!playerStats || !opponentStats}
                    >
                      Start PvP Battle
                    </button>
                  </div>
                </>
              )}

              {battleState === 'fighting' && (
                <div className="battle-progress">
                  <div className="battle-info">
                    <h4>⚔️ PvP Battle in Progress...</h4>
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
                      {battleResult.result === 'player1_victory' ? '🏆 YOU WIN!' : 
                       battleResult.result === 'player2_victory' ? '💀 YOU LOSE!' : 
                       '⚖️ DRAW!'}
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