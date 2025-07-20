import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../services/supabaseClientFront';
import ModalBattle from '../components/ModalBattle';
import './Tournament.css';

const Tournament = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [opponents, setOpponents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedOpponent, setSelectedOpponent] = useState(null);
  const [battleModalOpen, setBattleModalOpen] = useState(false);
  const [leaderboard, setLeaderboard] = useState([]);

  // Carregar perfil do usuário
  const loadUserProfile = async () => {
    if (!user?.id) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) throw error;
      setProfile(data);
    } catch (error) {
      console.error('Erro ao carregar perfil:', error);
      setError(error.message);
    }
  };

  // Carregar oponentes disponíveis (excluindo o próprio usuário)
  const loadOpponents = async () => {
    if (!user?.id) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, character_name, character_type, level, ranked_points, victories, defeats')
        .neq('id', user.id)
        .not('character_name', 'is', null)
        .order('ranked_points', { ascending: false })
        .limit(20);

      if (error) throw error;
      setOpponents(data || []);
    } catch (error) {
      console.error('Erro ao carregar oponentes:', error);
      setError(error.message);
    }
  };

  // Carregar leaderboard
  const loadLeaderboard = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('character_name, ranked_points, victories, defeats, level')
        .not('character_name', 'is', null)
        .order('ranked_points', { ascending: false })
        .limit(10);

      if (error) throw error;
      setLeaderboard(data || []);
    } catch (error) {
      console.error('Erro ao carregar leaderboard:', error);
    }
  };

  // Carregar todos os dados
  const loadData = async () => {
    setLoading(true);
    setError(null);

    try {
      await Promise.all([
        loadUserProfile(),
        loadOpponents(),
        loadLeaderboard()
      ]);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      setError('Erro ao carregar dados do torneio');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.id) {
      loadData();
    }
  }, [user?.id]);

  // Atualizar pontos após batalha
  const updateRankedPoints = async (playerId, isVictory) => {
    try {
      const pointsChange = isVictory ? 30 : -10;
      const statField = isVictory ? 'victories' : 'defeats';

      const { error } = await supabase
        .from('profiles')
        .update({
          ranked_points: Math.max(0, (profile?.ranked_points || 0) + pointsChange),
          [statField]: (profile?.[statField] || 0) + 1
        })
        .eq('id', playerId);

      if (error) throw error;

      console.log(`Pontos atualizados: ${isVictory ? '+30' : '-10'} pontos`);
      
      // Recarregar dados
      await loadData();
    } catch (error) {
      console.error('Erro ao atualizar pontos:', error);
    }
  };

  // Atualizar pontos do oponente (simulado)
  const updateOpponentPoints = async (opponentId, isVictory) => {
    try {
      // Buscar dados atuais do oponente
      const { data: opponentData, error: fetchError } = await supabase
        .from('profiles')
        .select('ranked_points, victories, defeats')
        .eq('id', opponentId)
        .single();

      if (fetchError) throw fetchError;

      const pointsChange = isVictory ? 30 : -10;
      const statField = isVictory ? 'victories' : 'defeats';

      const { error } = await supabase
        .from('profiles')
        .update({
          ranked_points: Math.max(0, (opponentData.ranked_points || 0) + pointsChange),
          [statField]: (opponentData[statField] || 0) + 1
        })
        .eq('id', opponentId);

      if (error) throw error;
    } catch (error) {
      console.error('Erro ao atualizar pontos do oponente:', error);
    }
  };

  // Lidar com fim da batalha
  const handleBattleEnd = async (battleResult) => {
    try {
      const isPlayerVictory = battleResult.result === 'player1_victory';
      
      // Atualizar pontos do jogador
      await updateRankedPoints(user.id, isPlayerVictory);
      
      // Atualizar pontos do oponente (vitória contrária)
      if (selectedOpponent) {
        await updateOpponentPoints(selectedOpponent.id, !isPlayerVictory);
      }

      console.log('Resultado da batalha processado:', battleResult.result);
    } catch (error) {
      console.error('Erro ao processar resultado da batalha:', error);
    }
  };

  const startBattle = (opponent) => {
    setSelectedOpponent(opponent);
    setBattleModalOpen(true);
  };

  const closeBattleModal = () => {
    setBattleModalOpen(false);
    setSelectedOpponent(null);
  };

  const getCharacterTypeName = (type) => {
    const types = {
      1: 'Assassin',
      2: 'Warrior', 
      3: 'Tank'
    };
    return types[type] || 'Unknown';
  };

  const getCharacterIcon = (type) => {
    const icons = {
      1: '🏃‍♂️',
      2: '⚔️',
      3: '🛡️'
    };
    return icons[type] || '⚔️';
  };

  if (loading) {
    return (
      <div className="tournament-loading">
        <h1>Carregando Torneio...</h1>
      </div>
    );
  }

  if (error) {
    return (
      <div className="tournament-error">
        <h1>Erro</h1>
        <p>{error}</p>
        <button className="tournament-error-btn" onClick={loadData}>Tentar Novamente</button>
      </div>
    );
  }

  if (!profile?.character_name) {
    return (
      <div className="no-character">
        <h1 className="no-character-title">Torneio Ranqueado</h1>
        <p className="no-character-text">Você precisa criar um personagem antes de participar do torneio.</p>
      </div>
    );
  }

  return (
    <div className="tournament">
      <h1 className="tournament-title">🏆 Torneio Ranqueado</h1>
      
      {/* Perfil do Jogador */}
      <div className="player-profile">
        <h2 className="player-profile-title">Seu Perfil</h2>
        <div className="player-info">
          <span className="player-icon">{getCharacterIcon(profile.character_type)}</span>
          <div className="player-details">
            <p><strong>{profile.character_name}</strong></p>
            <p>{getCharacterTypeName(profile.character_type)} - Level {profile.level}</p>
            <p>Pontos Ranqueados: <strong>{profile.ranked_points || 0}</strong></p>
            <p>Vitórias: {profile.victories || 0} | Derrotas: {profile.defeats || 0}</p>
            {(profile.victories + profile.defeats) > 0 && (
              <p>Taxa de Vitória: {Math.round((profile.victories / (profile.victories + profile.defeats)) * 100)}%</p>
            )}
          </div>
        </div>
      </div>

      {/* Leaderboard */}
      <div className="leaderboard">
        <h2 className="leaderboard-title">🎯 Top 10 Ranking</h2>
        <div className="leaderboard-list">
          {leaderboard.map((player, index) => (
            <div key={index} className="leaderboard-item">
              <span className="leaderboard-rank">#{index + 1} {player.character_name}</span>
              <span className="leaderboard-points">{player.ranked_points} pontos</span>
            </div>
          ))}
        </div>
      </div>

      {/* Lista de Oponentes */}
      <div className="opponents">
        <h2 className="opponents-title">⚔️ Oponentes Disponíveis</h2>
        {opponents.length === 0 ? (
          <p className="opponents-empty">Nenhum oponente disponível no momento.</p>
        ) : (
          <div className="opponents-grid">
            {opponents.map((opponent) => (
              <div key={opponent.id} className="opponent-card">
                <div className="opponent-info">
                  <span className="opponent-icon">{getCharacterIcon(opponent.character_type)}</span>
                  <div className="opponent-details">
                    <p><strong>{opponent.character_name}</strong></p>
                    <p>{getCharacterTypeName(opponent.character_type)} - Level {opponent.level}</p>
                    <p>Pontos: {opponent.ranked_points || 0}</p>
                    <p className="opponent-stats">
                      V: {opponent.victories || 0} | D: {opponent.defeats || 0}
                    </p>
                  </div>
                </div>
                <button 
                  className="challenge-btn"
                  onClick={() => startBattle(opponent)}
                >
                  Desafiar
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Informações do Sistema de Pontos */}
      <div className="points-system">
        <h3 className="points-system-title">📊 Sistema de Pontuação</h3>
        <p>• Vitória: +30 pontos ranqueados</p>
        <p>• Derrota: -10 pontos ranqueados</p>
        <p>• Os pontos não podem ficar negativos</p>
      </div>

      {/* Modal de Batalha */}
      {battleModalOpen && selectedOpponent && (
        <ModalBattle
          isOpen={battleModalOpen}
          onClose={closeBattleModal}
          opponent={selectedOpponent}
          onBattleEnd={handleBattleEnd}
        />
      )}
    </div>
  );
};

export default Tournament;