import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../services/supabaseClientFront';
import './ConfigModal.css';

export default function ConfigModal({ user, onClose }) {
  const { signOut } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadProfile() {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, email, created_at')
          .eq('id', user.id)
          .single();

        if (error) {
          console.error('Erro ao carregar perfil:', error);
          setError('Erro ao carregar perfil');
        } else {
          setProfile(data);
        }
      } catch (err) {
        setError('Erro inesperado');
        console.error('Erro inesperado:', err);
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
  }, [user]);

  const handleLogout = async () => {
    try {
      await signOut();
      onClose();
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
      setError('Erro ao fazer logout');
    }
  };

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="config-overlay" onClick={handleOverlayClick}>
      <div className="config-modal">
        <div className="config-header">
          <h2 className="config-title">User Info</h2>
          <button className="close-button" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="config-content">
          {loading ? (
            <div className="loading-container">
              <div className="loading-spinner"></div>
              <p>Carregando perfil...</p>
            </div>
          ) : error ? (
            <div className="error-container">
              <p className="error-text">{error}</p>
              <button 
                onClick={() => window.location.reload()}
                className="retry-button"
              >
                Tentar Novamente
              </button>
            </div>
          ) : (
            <div className="profile-info">
              <div className="profile-section">                
                <div className="info-item">
                  <label className="info-label">Gladiator ID:</label>
                  <p className="info-value">
                    {profile?.id || user?.id}
                  </p>
                </div>
                
                <div className="info-item">
                  <label className="info-label">Email:</label>
                  <p className="info-value">
                    {profile?.email || user?.email}
                  </p>
                </div>
                
                {profile?.created_at && (
                  <div className="info-item">
                    <label className="info-label">Since:</label>
                    <p className="info-value">
                      {new Date(profile.created_at).toLocaleDateString('en', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="config-actions">
          <button 
            onClick={handleLogout}
            className="logout-button"
          >
            Logout
          </button>
        </div>
      </div>
    </div>
  );
}