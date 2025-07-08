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

  useEffect(() => {
    if (user) loadProfile();
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
      // Carregar dados do tipo de personagem
      const { data: characterTypeData, error: characterError } = await supabase
        .from('character_types')
        .select('*')
        .eq('id', characterType)
        .single();

      if (characterError) throw characterError;

      setCharacterData(characterTypeData);

      // Calcular stats baseado no level do jogador
      const { data: statsData, error: statsError } = await supabase
        .rpc('calculate_character_stats', {
          character_type_id: characterType,
          level: profile.level || 1
        });

      if (statsError) throw statsError;

      if (statsData && statsData.length > 0) {
        setCharacterStats(statsData[0]);
      }
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
      await loadProfile();
    } catch (error) {
      console.error('Erro ao mudar personagem:', error);
    } finally {
      setIsChangingCharacter(false);
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
            Carregando personagem...
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