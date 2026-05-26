import React, { useState } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import { User, LogIn } from 'lucide-react';

const PIN_KEY = 'openrun_user_pin';

export function getStoredPin() {
  return localStorage.getItem(PIN_KEY);
}

export function clearStoredPin() {
  localStorage.removeItem(PIN_KEY);
}

const PinPrompt = ({ onAuthenticated }) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = pin.trim();
    if (!trimmed || trimmed.length < 2) {
      setError('Le nom doit faire au moins 2 caractères.');
      return;
    }

    setLoading(true);
    setError(null);
    setNotFound(false);

    try {
      await axios.get(`${API_BASE_URL}/api/users/${trimmed}/exists`);
      localStorage.setItem(PIN_KEY, trimmed);
      onAuthenticated(trimmed);
    } catch (err) {
      if (err.response?.status === 404) {
        setNotFound(true);
      } else {
        setError(err.response?.data?.detail || 'Erreur de connexion.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    const trimmed = pin.trim();
    setLoading(true);
    setError(null);

    try {
      await axios.post(`${API_BASE_URL}/api/users/${trimmed}`);
      localStorage.setItem(PIN_KEY, trimmed);
      onAuthenticated(trimmed);
    } catch (err) {
      setError(err.response?.data?.detail || 'Erreur lors de la création.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pin-prompt-overlay">
      <div className="pin-prompt-card glass-panel">
        <div className="pin-prompt-icon">
          <User size={32} />
        </div>
        <h2>Connexion</h2>
        <p className="pin-prompt-subtitle">Entrez votre identifiant pour accéder à vos itinéraires</p>

        {!notFound ? (
          <form onSubmit={handleSubmit} className="pin-prompt-form">
            <input
              type="text"
              value={pin}
              onChange={(e) => { setPin(e.target.value); setError(null); setNotFound(false); }}
              placeholder="Votre identifiant..."
              autoFocus
              disabled={loading}
              className="pin-prompt-input"
            />
            {error && <p className="pin-prompt-error">{error}</p>}
            <button type="submit" disabled={loading || !pin.trim()} className="pin-prompt-btn primary">
              <LogIn size={18} />
              {loading ? 'Connexion...' : 'Se connecter'}
            </button>
          </form>
        ) : (
          <div className="pin-prompt-create">
            <p className="pin-prompt-not-found">
              L'utilisateur <strong>"{pin.trim()}"</strong> n'existe pas.
            </p>
            <p>Voulez-vous créer ce compte ?</p>
            {error && <p className="pin-prompt-error">{error}</p>}
            <div className="pin-prompt-create-actions">
              <button onClick={handleCreate} disabled={loading} className="pin-prompt-btn primary">
                {loading ? 'Création...' : 'Oui, créer'}
              </button>
              <button onClick={() => { setNotFound(false); setError(null); }} className="pin-prompt-btn secondary">
                Non, réessayer
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PinPrompt;
