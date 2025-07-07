import React from 'react'
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import '../src/styles/globals.css'
import '../src/styles/variables.css'
import App from './App.jsx'
import Perfil from '../src/pages/Perfil.jsx';
import Login from '../src/pages/Login.jsx';
import PveBattle from '../src/pages/PveBattle.jsx';
import Tournament from '../src/pages/Tournament.jsx';
import Shop from '../src/pages/Shop.jsx';
import { AuthProvider, useAuth } from '../context/AuthContext.jsx';

// Componente de rota protegida melhorado
function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Carregando...</p>
      </div>
    );
  }
  
  if (!user) {
    return <Navigate to="/Login" replace />;
  }
  
  return children;
}

// Componente para redirecionar usuários logados
function RedirectIfAuthenticated({ children }) {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Carregando...</p>
      </div>
    );
  }
  
  if (user) {
    return <Navigate to="/Perfil" replace />;
  }
  
  return children;
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<App />} />
          <Route 
            path="/Perfil" 
            element={
              <ProtectedRoute>
                <Perfil />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/PveBattle" 
            element={
              <ProtectedRoute>
                <PveBattle />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/Tournament" 
            element={
              <ProtectedRoute>
                <Tournament />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/Shop" 
            element={
              <ProtectedRoute>
                <Shop />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/Login" 
            element={
              <RedirectIfAuthenticated>
                <Login />
              </RedirectIfAuthenticated>
            } 
          />
          {/* Rota para redirecionamento padrão */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);