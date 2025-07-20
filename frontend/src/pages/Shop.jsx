import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import Layout from '../components/Layout';
import './Shop.css';

const Shop = () => {
  const { user } = useAuth();


  return (
<Layout>
      <div className="shop-container">
        <div className="shop-header">
          <h1 className="shop-title">Arsenal do Gladiador</h1>
          <p className="shop-subtitle">Loja de Equipamentos e Habilidades</p>
          <div className="shop-gold">
            🪙 {/* Exibe um valor fixo ou nada */}
            0
          </div>
        </div>

        <div className="shop-content">
          <p className="shop-message">
            A loja está sendo preparada... Em breve novos itens estarão disponíveis para fortalecer seu gladiador!
          </p>
        </div>
      </div>
    </Layout>
  );
};

export default Shop;