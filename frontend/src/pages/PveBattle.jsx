import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../services/supabaseClientFront';
import Layout from '../components/Layout';
import ModalBattle from '../components/ModalBattle';
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
  const [enemies, setEnemies] = useState([]);
  const [enemyStats, setEnemyStats] = useState({});
  const [selectedEnemy, setSelectedEnemy] = useState(null);
  const [battleResult, setBattleResult] = useState(null);
  const [isBattling, setIsBattling] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isBattleModalOpen, setIsBattleModalOpen] = useState(false);
  const [selectedEnemyForBattle, setSelectedEnemyForBattle] = useState(null);

  useEffect(() => {
    if (user) {
      loadProfile();
      loadEnemies();
    }
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

  const loadEnemies = async () => {
    try {
      // Carregar todos os inimigos
      const { data: enemiesData, error: enemiesError } = await supabase
        .from('enemies')
        .select('*')
        .order('level', { ascending: true });

      if (enemiesError) throw enemiesError;

      setEnemies(enemiesData);

      // Calcular stats para cada inimigo
      const statsPromises = enemiesData.map(async (enemy) => {
        const { data: statsData, error: statsError } = await supabase
          .rpc('calculate_enemy_stats', {
            enemy_id: enemy.id
          });

        if (statsError) {
          console.error(`Erro ao calcular stats do inimigo ${enemy.id}:`, statsError);
          return null;
        }

        return {
          enemyId: enemy.id,
          stats: statsData[0]
        };
      });

      const resolvedStats = await Promise.all(statsPromises);
      const statsMap = {};

      resolvedStats.forEach(item => {
        if (item) {
          statsMap[item.enemyId] = item.stats;
        }
      });

      setEnemyStats(statsMap);
    } catch (error) {
      console.error('Erro ao carregar inimigos:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEnemySelect = (enemy) => {
    setSelectedEnemy(enemy);
  };

  const openBattleModal = (enemy) => {
    setSelectedEnemyForBattle(enemy);
    setIsBattleModalOpen(true);
  };

  if (loading) {
    return (
      <Layout>
        <div className="pve-battle-container">
          <div className="pve-content">
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              height: '50vh',
              color: 'var(--text-light)',
              fontSize: '1.5rem'
            }}>
              Carregando inimigos...
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  if (!profile) {
    return (
      <Layout>
        <div className="pve-battle-container">
          <div className="pve-content">
            <p>Erro ao carregar perfil. Tente novamente.</p>
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
            {enemies.map((enemy) => {
              const stats = enemyStats[enemy.id];
              if (!stats) return null;

              return (
                <div
                  key={enemy.id}
                  className={`enemy-card ${enemy.type}`}
                  onClick={() => handleEnemySelect(enemy)}
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
                        <span className="stat-value">{stats.hp}</span>
                      </div>
                      <div className="enemy-stat">
                        <span className="stat-icon">⚔️</span>
                        <span className="stat-name">ATK</span>
                        <span className="stat-value">{stats.attack}</span>
                      </div>
                      <div className="enemy-stat">
                        <span className="stat-icon">🛡️</span>
                        <span className="stat-name">DEF</span>
                        <span className="stat-value">{stats.defense}</span>
                      </div>
                      <div className="enemy-stat">
                        <span className="stat-icon">💨</span>
                        <span className="stat-name">SPD</span>
                        <span className="stat-value">{stats.speed}</span>
                      </div>
                    </div>

                    {/* Recompensas */}
                    <div className="enemy-rewards">
                      <div className="reward-item">
                        <span className="reward-icon">🏆</span>
                        <span>{enemy.xp_reward} XP</span>
                      </div>
                      <div className="reward-item">
                        <span className="reward-icon">💰</span>
                        <span>{enemy.gold_reward} Gold</span>
                      </div>
                    </div>

                    {/* Botão de Batalha */}
                    <button
                      className="battle-button"
                      onClick={(e) => {
                        e.stopPropagation();
                        openBattleModal(enemy);
                      }}
                      disabled={isBattling}
                    >
                      Battle!
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Modal de Batalha */}
          {isBattleModalOpen && (
            <ModalBattle
              isOpen={isBattleModalOpen}
              onClose={() => setIsBattleModalOpen(false)}
              enemy={selectedEnemyForBattle}
              enemyStats={enemyStats[selectedEnemyForBattle?.id]}
            />
          )}
        </div>
      </div>
    </Layout>
  );
}