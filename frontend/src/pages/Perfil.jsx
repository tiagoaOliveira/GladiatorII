import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../services/supabaseClientFront';
import CharacterModal from '../components/CharacterModal';
import Layout from '../components/Layout';
import './Perfil.css';

const CHARACTERS = {
  1: {
    name: 'Assassin',
    bgImage: 'speed.png',
    hp: 800,
    attack: 70,
    defense: 150,
    critical: 25,
    speed: 1.2
  },
  2: {
    name: 'Warrior',
    bgImage: 'critical.png',
    hp: 1000,
    attack: 85,
    defense: 100,
    critical: 40,
    speed: 1
  },
  3: {
    name: 'Tank',
    bgImage: 'reflect.png',
    hp: 1200,
    attack: 60,
    defense: 300,
    critical: 20,
    speed: 1
  }
};

export default function Perfil() {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [characterType, setCharacterType] = useState(null);
  const [isCharacterModalOpen, setIsCharacterModalOpen] = useState(false);
  const [isChangingCharacter, setIsChangingCharacter] = useState(false);

  const BACKGROUND_IMAGES = {
    1: 'speed.png',
    2: 'critical.png',
    3: 'reflect.png'
  };

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
        setCharacterType(data.character_type || 1);
      }
    } catch (error) {
      console.error('Erro ao carregar perfil:', error);
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

  if (characterType === null) {
    return <Layout><div className="perfil-container"></div></Layout>;
  }

  const currentCharacter = CHARACTERS[characterType];

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
                <span className="attribute-value">{currentCharacter.hp}</span>
              </div>
            </div>

            <div className="attribute-item">
              <div className="attribute-icon attack">⚔️</div>
              <div className="attribute-info">
                <span className="attribute-name">Attack</span>
                <span className="attribute-value">{currentCharacter.attack}</span>
              </div>
            </div>

            <div className="attribute-item">
              <div className="attribute-icon defense">🛡️</div>
              <div className="attribute-info">
                <span className="attribute-name">Defense</span>
                <span className="attribute-value">{currentCharacter.defense}</span>
              </div>
            </div>

            <div className="attribute-item">
              <div className="attribute-icon critical">💥</div>
              <div className="attribute-info">
                <span className="attribute-name">Critical</span>
                <span className="attribute-value">{currentCharacter.critical}</span>
              </div>
            </div>

            <div className="attribute-item">
              <div className="attribute-icon speed">💨</div>
              <div className="attribute-info">
                <span className="attribute-name">Speed</span>
                <span className="attribute-value">{currentCharacter.speed}</span>
              </div>
            </div>
          </div>
        </div>

        <CharacterModal
          user={user}
          profile={profile}
          isOpen={isCharacterModalOpen}
          onClose={() => setIsCharacterModalOpen(false)}
          onCharacterChange={handleCharacterChange}
        />
      </div>
    </Layout>
  );
}