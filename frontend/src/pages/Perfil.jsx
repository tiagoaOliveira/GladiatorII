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
        {/* Substitua a div arena-orb por esta: */}
        <div 
          className="arena-orb"
          onClick={() => setIsCharacterModalOpen(true)}
        >
          <div className="orb-content">
            <div className="orb-level">
              <span className="level-number">{profile?.level || 1}</span>
            </div>
            <div className="orb-name">
              {profile?.character_name || 'Gladiator'}
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