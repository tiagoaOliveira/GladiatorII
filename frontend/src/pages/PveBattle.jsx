import { useState, useEffect, useCallback, useMemo } from 'react';
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
  
  // Estados consolidados com loading stages
  const [profile, setProfile] = useState(null);
  const [enemies, setEnemies] = useState([]);
  const [enemyStats, setEnemyStats] = useState({});
  const [selectedEnemy, setSelectedEnemy] = useState(null);
  const [battleResult, setBattleResult] = useState(null);
  const [isBattling, setIsBattling] = useState(false);
  const [loadingStages, setLoadingStages] = useState({
    profile: true,
    enemies: true,
    stats: true,
    complete: false
  });
  const [isBattleModalOpen, setIsBattleModalOpen] = useState(false);
  const [selectedEnemyForBattle, setSelectedEnemyForBattle] = useState(null);

  // Cache para evitar recarregamentos desnecessários
  const [dataCache, setDataCache] = useState({
    enemies: new Map(),
    enemyStats: new Map(),
    lastEnemiesUpdate: null,
    lastProfileUpdate: null
  });

  // Função para obter inimigos do cache
  const getCachedEnemies = useCallback(() => {
    const cached = dataCache.enemies.get('all_enemies');
    if (cached && Date.now() - cached.timestamp < 15 * 60 * 1000) { // 15 minutos
      return cached.data;
    }
    return null;
  }, [dataCache.enemies]);

  // Função para obter stats do inimigo do cache
  const getCachedEnemyStats = useCallback((enemyId) => {
    const cached = dataCache.enemyStats.get(enemyId);
    if (cached && Date.now() - cached.timestamp < 15 * 60 * 1000) { // 15 minutos
      return cached.data;
    }
    return null;
  }, [dataCache.enemyStats]);

  // Função otimizada para calcular stats de múltiplos inimigos
  const calculateMultipleEnemyStats = useCallback(async (enemyIds) => {
    const missingStats = enemyIds.filter(id => !getCachedEnemyStats(id));
    
    if (missingStats.length === 0) {
      // Todos os stats estão no cache
      const statsMap = {};
      enemyIds.forEach(id => {
        statsMap[id] = getCachedEnemyStats(id);
      });
      return statsMap;
    }

    try {
      // Calcular stats apenas para os inimigos que não estão no cache
      const statsPromises = missingStats.map(async (enemyId) => {
        const { data: statsData, error: statsError } = await supabase
          .rpc('calculate_enemy_stats', {
            enemy_id: enemyId
          });

        if (statsError) {
          console.error(`Erro ao calcular stats do inimigo ${enemyId}:`, statsError);
          return null;
        }

        return {
          enemyId,
          stats: statsData[0]
        };
      });

      const resolvedStats = await Promise.all(statsPromises);
      const newStatsMap = {};
      const newCacheEntries = new Map();

      // Processar novos stats
      resolvedStats.forEach(item => {
        if (item) {
          newStatsMap[item.enemyId] = item.stats;
          newCacheEntries.set(item.enemyId, {
            data: item.stats,
            timestamp: Date.now()
          });
        }
      });

      // Combinar com stats do cache
      const allStatsMap = { ...newStatsMap };
      enemyIds.forEach(id => {
        if (!allStatsMap[id]) {
          allStatsMap[id] = getCachedEnemyStats(id);
        }
      });

      // Atualizar cache
      setDataCache(prev => ({
        ...prev,
        enemyStats: new Map([...prev.enemyStats, ...newCacheEntries])
      }));

      return allStatsMap;
    } catch (error) {
      console.error('Erro ao calcular stats dos inimigos:', error);
      return {};
    }
  }, [getCachedEnemyStats]);

  // Função principal para carregar todos os dados iniciais
  const loadInitialData = useCallback(async () => {
    if (!user?.id) return;

    try {
      // Verificar cache de inimigos primeiro
      const cachedEnemies = getCachedEnemies();
      
      // Carregar dados em paralelo
      const promises = [
        supabase.from('profiles').select('*').eq('id', user.id).single()
      ];

      // Só carregar inimigos se não estiverem no cache
      if (!cachedEnemies) {
        promises.push(
          supabase.from('enemies').select('*').order('level', { ascending: true })
        );
      }

      const results = await Promise.all(promises);
      const [profileResult, enemiesResult] = results;

      // Processar perfil primeiro
      if (profileResult.data) {
        setProfile(profileResult.data);
        setLoadingStages(prev => ({ ...prev, profile: false }));
      }

      // Processar inimigos (do cache ou da consulta)
      let enemiesData;
      if (cachedEnemies) {
        enemiesData = cachedEnemies;
        setEnemies(cachedEnemies);
      } else if (enemiesResult?.data) {
        enemiesData = enemiesResult.data;
        setEnemies(enemiesData);
        
        // Atualizar cache
        setDataCache(prev => ({
          ...prev,
          enemies: new Map([
            ...prev.enemies,
            ['all_enemies', { data: enemiesData, timestamp: Date.now() }]
          ]),
          lastEnemiesUpdate: Date.now()
        }));
      }

      // Marcar inimigos como carregados
      setLoadingStages(prev => ({ ...prev, enemies: false }));

      // Calcular stats para todos os inimigos
      if (enemiesData && enemiesData.length > 0) {
        const enemyIds = enemiesData.map(enemy => enemy.id);
        const statsMap = await calculateMultipleEnemyStats(enemyIds);
        setEnemyStats(statsMap);
      }

      // Marcar tudo como carregado
      setLoadingStages(prev => ({ 
        ...prev, 
        stats: false, 
        complete: true 
      }));

      setDataCache(prev => ({
        ...prev,
        lastProfileUpdate: Date.now()
      }));

    } catch (error) {
      console.error('Erro ao carregar dados iniciais:', error);
      // Em caso de erro, marcar como carregado para evitar loading infinito
      setLoadingStages({
        profile: false,
        enemies: false,
        stats: false,
        complete: true
      });
    }
  }, [user?.id, getCachedEnemies, calculateMultipleEnemyStats]);

  // Função otimizada para selecionar inimigo
  const handleEnemySelect = useCallback((enemy) => {
    setSelectedEnemy(enemy);
  }, []);

  // Função otimizada para abrir modal de batalha
  const openBattleModal = useCallback((enemy) => {
    setSelectedEnemyForBattle(enemy);
    setIsBattleModalOpen(true);
  }, []);

  // Função otimizada para fechar modal de batalha
  const closeBattleModal = useCallback(() => {
    setIsBattleModalOpen(false);
    setSelectedEnemyForBattle(null);
  }, []);

  // Memoizar inimigos processados com seus stats
  const processedEnemies = useMemo(() => {
    return enemies.map(enemy => {
      const stats = enemyStats[enemy.id];
      return {
        ...enemy,
        stats,
        icon: ENEMY_ICONS[enemy.type] || '🗡️'
      };
    }).filter(enemy => enemy.stats); // Só mostrar inimigos com stats calculados
  }, [enemies, enemyStats]);

  // Effect principal para carregar dados iniciais
  useEffect(() => {
    if (user?.id) {
      loadInitialData();
    }
  }, [user?.id, loadInitialData]);

  // Setup de real-time subscriptions para profile
  useEffect(() => {
    if (!user?.id) return;

    const subscription = supabase
      .channel('pve-profile-changes')
      .on('postgres_changes', 
        { 
          event: 'UPDATE', 
          schema: 'public', 
          table: 'profiles',
          filter: `id=eq.${user.id}`
        }, 
        (payload) => {
          setProfile(payload.new);
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [user?.id]);

  // Melhor controle de loading
  const isInitialLoading = !loadingStages.complete;
  const hasMinimumData = profile && enemies.length > 0;

  // Loading progressivo
  if (isInitialLoading) {
    return (
      <Layout>
        <div className="pve-battle-container">
          <div className="pve-content">
            {/* Header sempre visível */}
            <div className="pve-header">
              <h1 className="pve-title">PvE Battle Arena</h1>
              <p className="pve-subtitle">CHOOSE YOUR OPPONENT!</p>
            </div>

            {/* Loading com progresso */}
            <div className="loading-container" style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              height: '50vh',
              color: 'var(--text-light)',
              fontSize: '1.2rem'
            }}>
              <div className="loading-spinner" style={{
                width: '40px',
                height: '40px',
                border: '3px solid rgba(255, 255, 255, 0.3)',
                borderTop: '3px solid var(--primary-color)',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
                marginBottom: '1rem'
              }}></div>
              
              <div className="loading-text">
                {loadingStages.profile ? 'Loading profile...' :
                 loadingStages.enemies ? 'Loading enemies...' :
                 loadingStages.stats ? 'Calculating stats...' :
                 'Loading...'}
              </div>

              {/* Progresso visual */}
              <div className="loading-progress" style={{
                width: '200px',
                height: '4px',
                backgroundColor: 'rgba(255, 255, 255, 0.2)',
                borderRadius: '2px',
                marginTop: '1rem',
                overflow: 'hidden'
              }}>
                <div style={{
                  height: '100%',
                  backgroundColor: 'var(--primary-color)',
                  borderRadius: '2px',
                  transition: 'width 0.3s ease',
                  width: `${(!loadingStages.profile ? 33 : 0) + 
                           (!loadingStages.enemies ? 33 : 0) + 
                           (!loadingStages.stats ? 34 : 0)}%`
                }}></div>
              </div>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  // Erro ao carregar perfil
  if (!profile) {
    return (
      <Layout>
        <div className="pve-battle-container">
          <div className="pve-content">
            <div className="pve-header">
              <h1 className="pve-title">PvE Battle Arena</h1>
              <p className="pve-subtitle">CHOOSE YOUR OPPONENT!</p>
            </div>
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              height: '50vh',
              color: 'var(--text-light)',
              fontSize: '1.2rem'
            }}>
              <p>Error loading profile. Please try again.</p>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  // Renderização principal
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
            {processedEnemies.map((enemy) => (
              <div
                key={enemy.id}
                className={`enemy-card ${enemy.type}`}
                onClick={() => handleEnemySelect(enemy)}
              >
                {/* Imagem do Inimigo */}
                <div className={`enemy-image ${enemy.type}`}>
                  {enemy.icon}
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
                      <span className="stat-value">{enemy.stats.hp}</span>
                    </div>
                    <div className="enemy-stat">
                      <span className="stat-icon">⚔️</span>
                      <span className="stat-name">ATK</span>
                      <span className="stat-value">{enemy.stats.attack}</span>
                    </div>
                    <div className="enemy-stat">
                      <span className="stat-icon">🛡️</span>
                      <span className="stat-name">DEF</span>
                      <span className="stat-value">{enemy.stats.defense}</span>
                    </div>
                    <div className="enemy-stat">
                      <span className="stat-icon">💨</span>
                      <span className="stat-name">SPD</span>
                      <span className="stat-value">{enemy.stats.speed}</span>
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
            ))}
          </div>

          {/* Mensagem se não há inimigos */}
          {processedEnemies.length === 0 && (
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              height: '30vh',
              color: 'var(--text-light)',
              fontSize: '1.2rem'
            }}>
              <p>No enemies available at the moment.</p>
            </div>
          )}

          {/* Modal de Batalha */}
          {isBattleModalOpen && selectedEnemyForBattle && (
            <ModalBattle
              isOpen={isBattleModalOpen}
              onClose={closeBattleModal}
              enemy={selectedEnemyForBattle}
              enemyStats={enemyStats[selectedEnemyForBattle.id]}
            />
          )}
        </div>
      </div>
    </Layout>
  );
}