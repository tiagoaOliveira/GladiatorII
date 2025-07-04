import { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClientFront';
import './CharacterModal.css';

const CHARACTERS = {
  1: { name: 'Ninja', bgImage: 'speed.png' },
  2: { name: 'Warrior', bgImage: 'warrior.png' },
  3: { name: 'Tank', bgImage: 'champion.png' }
};

export default function CharacterModal({ user, isOpen, onClose, onCharacterChange }) {
  const [selectedCharacter, setSelectedCharacter] = useState(1);
  const [characterName, setCharacterName] = useState('');
  const [currentProfile, setCurrentProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen && user) {
      loadProfile();
    }
  }, [isOpen, user]);

  const loadProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('character_type, character_name')
        .eq('id', user.id)
        .single();

      if (error) throw error;
      
      setCurrentProfile(data);
      setSelectedCharacter(data.character_type || 1);
      setCharacterName(data.character_name || '');
    } catch (err) {
      console.error('Erro ao carregar perfil:', err);
    }
  };

  const handleSave = async () => {
    if (!characterName.trim()) {
      setError('Nome do personagem é obrigatório');
      return;
    }

    if (!/^[A-Z0-9_.-]+$/.test(characterName)) {
      setError('Nome deve conter apenas A-Z, 0-9, _, -, .');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          character_type: selectedCharacter,
          character_name: characterName.trim()
        })
        .eq('id', user.id);

      if (error) {
        if (error.message.includes('duplicate') || error.message.includes('unique')) {
          setError('Este nome já está em uso');
        } else {
          setError('Erro ao salvar alterações');
        }
        return;
      }

      onCharacterChange(selectedCharacter);
      onClose();
    } catch (err) {
      console.error('Erro:', err);
      setError('Erro inesperado');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="character-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="character-modal">
        <div className="character-header">
          <h2 className="character-title">Select Character</h2>
          <button className="close-button" onClick={onClose}>×</button>
        </div>

        <div className="character-content">
          {error && <div className="error-message">{error}</div>}
          
          <div className="name-section">
            <label className="name-label">Character Name:</label>
            <input
              type="text"
              value={characterName}
              onChange={(e) => setCharacterName(e.target.value.toUpperCase())}
              className="name-input"
              placeholder="ENTER NAME (A-Z, 0-9, _-.)"
              maxLength={20}
              disabled={loading}
            />
          </div>

          <div className="characters-grid">
            {Object.entries(CHARACTERS).map(([id, char]) => (
              <div
                key={id}
                className={`character-option ${selectedCharacter === parseInt(id) ? 'selected' : ''}`}
                onClick={() => setSelectedCharacter(parseInt(id))}
              >
                <div className="character-preview">
                  <span className="character-name">{char.name}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="character-actions">
          <button 
            onClick={handleSave}
            className="save-button"
            disabled={loading || !characterName.trim()}
          >
            {loading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}