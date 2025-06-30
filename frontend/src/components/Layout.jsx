import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import ConfigModal from '../components/ConfigModal';
import './Layout.css';

export default function Layout({ children }) {
  const { user } = useAuth();
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

  return (
    <div className="layout-container">
      {/* Header com menu */}
      <header className="layout-header">
        <div className="header-content">
          <h1 className="game-title">GLADIATOR</h1>
          
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
            <button className="nav-button">PvE Battle</button>
            <button className="nav-button">Tournament</button>
            <button className="nav-button">Shop</button>
            <button className="nav-button" onClick={openConfig}>Config</button>
          </nav>
        </div>

        {/* Menu mobile */}
        <nav className={`mobile-nav ${isMenuOpen ? 'open' : ''}`}>
          <div className="mobile-nav-content">
            <button className="nav-button mobile" onClick={closeMenu}>
              PvE Battle
            </button>
            <button className="nav-button mobile" onClick={closeMenu}>
              Tournament
            </button>
            <button className="nav-button mobile" onClick={closeMenu}>
              Shop
            </button>
            <button className="nav-button mobile" onClick={openConfig}>
              Config
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