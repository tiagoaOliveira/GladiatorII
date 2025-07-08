import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import ConfigModal from '../components/ConfigModal';
import './Layout.css';

export default function Layout({ children }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isConfigOpen, setIsConfigOpen] = useState(false);

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const closeMenu = () => {
    setIsMenuOpen(false);
  };

  const openConfig = () => {
    setIsConfigOpen(true);
    closeMenu();
  };

  const closeConfig = () => {
    setIsConfigOpen(false);
  };

  const handleNavigation = (path) => {
    navigate(path);
    closeMenu();
  };

  return (
    <div className="layout-container">
      {/* Header com menu */}
      <header className="layout-header">
        <div className="header-content">
          <h1 className="game-title" onClick={() => handleNavigation('/Perfil')}>
            GLADIATOR
          </h1>
          
          {/* Menu hambúrguer */}
          <button 
            className="menu-toggle"
            onClick={toggleMenu}
            aria-label="Menu"
          >
            <span className={`hamburger-line ${isMenuOpen ? 'active' : ''}`}></span>
            <span className={`hamburger-line ${isMenuOpen ? 'active' : ''}`}></span>
            <span className={`hamburger-line ${isMenuOpen ? 'active' : ''}`}></span>
          </button>

          {/* Menu desktop */}
          <nav className="desktop-nav">
            <button 
              className="nav-button" 
              onClick={() => handleNavigation('/PveBattle')}
              title="PvE Battle"
            >
              ⚔️
            </button>
            <button 
              className="nav-button" 
              onClick={() => handleNavigation('/Tournament')}
              title="Tournament"
            >
              👑
            </button>
            <button 
              className="nav-button" 
              onClick={() => handleNavigation('/Shop')}
              title="Shop"
            >
              🛒
            </button>
            <button 
              className="nav-button" 
              onClick={openConfig}
              title="Config"
            >
              ⚙️
            </button>
          </nav>
        </div>

        {/* Menu mobile */}
        <nav className={`mobile-nav ${isMenuOpen ? 'open' : ''}`}>
          <div className="mobile-nav-content">
            <button 
              className="nav-button mobile" 
              onClick={() => handleNavigation('/PveBattle')}
              title="PvE Battle"
            >
              ⚔️
            </button>
            <button 
              className="nav-button mobile" 
              onClick={() => handleNavigation('/Tournament')}
              title="Tournament"
            >
              👑
            </button>
            <button 
              className="nav-button mobile" 
              onClick={() => handleNavigation('/Shop')}
              title="Shop"
            >
              🛒
            </button>
            <button 
              className="nav-button mobile" 
              onClick={openConfig}
              title="Config"
            >
              ⚙️
            </button>
          </div>
        </nav>

        {/* Overlay para fechar menu em mobile */}
        {isMenuOpen && (
          <div className="menu-overlay" onClick={closeMenu}></div>
        )}
      </header>

      {/* Conteúdo principal */}
      <main className="layout-main">
        {children}
      </main>

      {/* Modal de configuração */}
      {isConfigOpen && (
        <ConfigModal user={user} onClose={closeConfig} />
      )}
    </div>
  );
}