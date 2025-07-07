import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../services/supabaseClientFront';
import { ENEMIES, getEnemyById } from '../utils/enemies';
import Layout from '../components/Layout';
import './PveBattle.css';

const ENEMY_ICONS = {
  warrior: '🗡️',
  assassin: '🗡️',
  tank: '🛡️',
  boss: '👑'
};

export default function PveBattle() {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [selectedEnemy, setSelectedEnemy] = useState(null);
  const [battleResult, setBattleResult] = useState(null);
  const [isBattling, setIsBattling] = useState(false);

  useEffect(() => {
    if (user) loadProfile();
  }, [user]);

  const loadProfile = async () => {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (data) {
        setProfile(data);
      }
    } catch (error) {
      console.error('Erro ao carregar perfil:', error);
    }
  };

  const handleEnemySelect = (enemyId) => {
    const enemy = getEnemyById(enemyId);
    setSelectedEnemy(enemy);
  };

  const startBattle = async (enemy) => {
    if (!profile || isBattling) return;

    setIsBattling(true);
    setBattleResult(null);

    try {
      // Simular batalha (aqui você pode implementar a lógica real)
      const playerWins = Math.random() > 0.3; // 70% chance de vitória
      
      if (playerWins) {
        // Atualizar XP e ouro no banco
        const newXp = (profile.xp || 0) + enemy.xpReward;
        const newGold = (profile.gold || 0) + enemy.goldReward;
        
        const { error } = await supabase
          .from('profiles')
          .update({ 
            xp: newXp, 
            gold: newGold,
            battles_won: (profile.battles_won || 0) + 1
          })
          .eq('id', user.id);

        if (error) throw error;

        setBattleResult({
          victory: true,
          xpGained: enemy.xpReward,
          goldGained: enemy.goldReward,
          message: `Você derrotou ${enemy.name}!`
        });

        // Recarregar perfil
        await loadProfile();
      } else {
        // Derrota
        const { error } = await supabase
          .from('profiles')
          .update({ 
            battles_lost: (profile.battles_lost || 0) + 1
          })
          .eq('id', user.id);

        if (error) throw error;

        setBattleResult({
          victory: false,
          message: `${enemy.name} te derrotou! Tente novamente.`
        });

        await loadProfile();
      }
    } catch (error) {
      console.error('Erro na batalha:', error);
      setBattleResult({
        victory: false,
        message: 'Erro na batalha. Tente novamente.'
      });
    } finally {
      setIsBattling(false);
    }
  };

  if (!profile) {
    return (
      <Layout>
        <div className="pve-battle-container">
          <div className="pve-content">
            <p>Carregando...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="pve-battle-container">
        <div className="pve-content">
          {/* Header */}
          <div className="pve-header">
            <h1 className="pve-title">PvE Battle Arena</h1>
            <p className="pve-subtitle">CHOOSE YOUR OPPONENT!</p>
          </div>

          {/* Grid de Inimigos */}
          <div className="enemies-grid">
            {Object.values(ENEMIES).map((enemy) => (
              <div 
                key={enemy.id} 
                className={`enemy-card ${enemy.type}`}
                onClick={() => handleEnemySelect(enemy.id)}
              >
                {/* Imagem do Inimigo */}
                <div className={`enemy-image ${enemy.type}`}>
                  {ENEMY_ICONS[enemy.type]}
                </div>

                {/* Informações do Inimigo */}
                <div className="enemy-info">
                  <h3 className="enemy-name">{enemy.name}</h3>
                  <p className="enemy-level">Level {enemy.level}</p>
                  <p className="enemy-description">{enemy.description}</p>

                  {/* Stats do Inimigo */}
                  <div className="enemy-stats">
                    <div className="enemy-stat">
                      <span className="stat-icon">❤️</span>
                      <span className="stat-name">HP</span>
                      <span className="stat-value">{enemy.hp}</span>
                    </div>
                    <div className="enemy-stat">
                      <span className="stat-icon">⚔️</span>
                      <span className="stat-name">ATK</span>
                      <span className="stat-value">{enemy.attack}</span>
                    </div>
                    <div className="enemy-stat">
                      <span className="stat-icon">🛡️</span>
                      <span className="stat-name">DEF</span>
                      <span className="stat-value">{enemy.defense}</span>
                    </div>
                    <div className="enemy-stat">
                      <span className="stat-icon">💨</span>
                      <span className="stat-name">SPD</span>
                      <span className="stat-value">{enemy.speed}</span>
                    </div>
                  </div>

                  {/* Recompensas */}
                  <div className="enemy-rewards">
                    <div className="reward-item">
                      <span className="reward-icon">🏆</span>
                      <span>{enemy.xpReward} XP</span>
                    </div>
                    <div className="reward-item">
                      <span className="reward-icon">💰</span>
                      <span>{enemy.goldReward} Gold</span>
                    </div>
                  </div>

                  {/* Botão de Batalha */}
                  <button
                    className="battle-button"
                    onClick={(e) => {
                      e.stopPropagation();
                      startBattle(enemy);
                    }}
                    disabled={isBattling}
                  >
                    {isBattling ? 'Battling...' : 'Battle!'}
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Informações do Jogador */}
          <div className="player-info">
            <h3>Your Stats</h3>
            <div className="player-stats">
              <div className="stat-item">
                <span>Level: {profile.level || 1}</span>
              </div>
              <div className="stat-item">
                <span>XP: {profile.xp || 0}</span>
              </div>
              <div className="stat-item">
                <span>Gold: {profile.gold || 0}</span>
              </div>
              <div className="stat-item">
                <span>Wins: {profile.battles_won || 0}</span>
              </div>
              <div className="stat-item">
                <span>Losses: {profile.battles_lost || 0}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}