import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../services/supabaseClientFront';
import CharacterModal from '../components/CharacterModal';
import Layout from '../components/Layout';
import './Perfil.css';



export default function Perfil() {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [characterType, setCharacterType] = useState(1);
  const [isCharacterModalOpen, setIsCharacterModalOpen] = useState(false);

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
  return (
    <Layout>
      <div className={`perfil-container character-${characterType}`}>
        <div className="arena-content">
          <div className="arena-stats">
            <div className="stat-card">
              <h3>Level</h3>
              <span className="stat-number">{profile?.level || 1}</span>
            </div>
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
            onClick={() => setIsCharacterModalOpen(true)}
          >
            Change Character
          </button>
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