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
  const [isCharacterModalOpen, setIsCharacterModalOpen] = useState(false);
  const [isStatsOpen, setIsStatsOpen] = useState(false);
  
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

  if (characterType === null) {
    return <Layout><div className="perfil-container"></div></Layout>;
  }

  return (
    <Layout>
      <div className={`perfil-container character-${characterType}`}>
        {/* Bola clicável */}
        <div 
          className={`arena-orb ${isStatsOpen ? 'expanded' : ''}`}
          onClick={() => setIsStatsOpen(!isStatsOpen)}
        >
          {!isStatsOpen ? (
            <div className="orb-content">
              <div className="orb-level">
                <span className="level-number">{profile?.level || 1}</span>
              </div>
              <div className="orb-name">
                {profile?.character_name || 'Gladiator'}
              </div>
            </div>
          ) : (
            <div className="arena-content">
              <div className="arena-stats">
                <div className="stat-card">
                  <h3>Victories</h3>
                  <span className="stat-number">{profile?.victories || 0}</span>
                </div>
                <div className="stat-card">
                  <h3>Defeats</h3>
                  <span className="stat-number">{profile?.defeats || 0}</span>
                </div>
                <div className="stat-card">
                  <h3>Ranked Points</h3>
                  <span className="stat-number">{profile?.ranked_points || 0}</span>
                </div>
              </div>

              <button
                className="nav-button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsCharacterModalOpen(true);
                }}
              >
                Change Character & Name
              </button>
            </div>
          )}
        </div>

        <CharacterModal
          user={user}
          isOpen={isCharacterModalOpen}
          onClose={() => setIsCharacterModalOpen(false)}
          onCharacterChange={handleCharacterChange}
        />
      </div>
    </Layout>
  );
}