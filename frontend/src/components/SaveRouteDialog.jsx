import React, { useEffect, useState } from 'react';
import { Save, X, Mountain } from 'lucide-react';

/**
 * Branded save dialog replacing native prompt/confirm/alert for route saving.
 * Handles route name, optional trek name, and active-trek step confirmation.
 */
const SaveRouteDialog = ({
  open,
  defaultName,
  activeTrek,
  saving = false,
  error = null,
  onCancel,
  onSubmit,
}) => {
  const [routeName, setRouteName] = useState(defaultName || '');
  const [trekName, setTrekName] = useState('');
  const [localError, setLocalError] = useState(null);

  useEffect(() => {
    if (open) {
      setRouteName(defaultName || '');
      setTrekName('');
      setLocalError(null);
    }
  }, [open, defaultName]);

  if (!open) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmedName = routeName.trim();
    if (!trimmedName) {
      setLocalError("Le nom de l'itinéraire est requis.");
      return;
    }
    setLocalError(null);
    onSubmit({
      name: trimmedName,
      trekName: activeTrek ? null : (trekName.trim() || null),
    });
  };

  const displayError = localError || error;

  return (
    <div className="pin-prompt-overlay" onClick={onCancel} role="presentation">
      <div
        className="pin-prompt-card glass-panel save-route-dialog"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="save-route-title"
      >
        <button
          type="button"
          className="save-route-dialog__close"
          onClick={onCancel}
          disabled={saving}
          aria-label="Fermer"
        >
          <X size={18} />
        </button>

        <div className="pin-prompt-icon">
          <Save size={28} />
        </div>
        <h2 id="save-route-title">Enregistrer</h2>
        <p className="pin-prompt-subtitle">
          {activeTrek
            ? `Nouvelle étape du trek « ${activeTrek.name} »`
            : 'Donnez un nom à votre itinéraire'}
        </p>

        <form onSubmit={handleSubmit} className="pin-prompt-form">
          <label className="save-route-dialog__label" htmlFor="save-route-name">
            Nom de l&apos;itinéraire
          </label>
          <input
            id="save-route-name"
            type="text"
            value={routeName}
            onChange={(e) => {
              setRouteName(e.target.value);
              setLocalError(null);
            }}
            placeholder="Ex: Boucle du lac"
            autoFocus
            disabled={saving}
            className="pin-prompt-input"
          />

          {activeTrek ? (
            <div className="save-route-dialog__trek-banner">
              <Mountain size={16} />
              <span>
                Ce segment sera ajouté au trek <strong>{activeTrek.name}</strong>
              </span>
            </div>
          ) : (
            <>
              <label className="save-route-dialog__label" htmlFor="save-trek-name">
                Nom du trek <span className="save-route-dialog__optional">(optionnel)</span>
              </label>
              <input
                id="save-trek-name"
                type="text"
                value={trekName}
                onChange={(e) => setTrekName(e.target.value)}
                placeholder="Pour grouper plusieurs étapes"
                disabled={saving}
                className="pin-prompt-input"
              />
            </>
          )}

          {displayError && <p className="pin-prompt-error">{displayError}</p>}

          <div className="pin-prompt-create-actions">
            <button
              type="button"
              className="pin-prompt-btn secondary"
              onClick={onCancel}
              disabled={saving}
            >
              Annuler
            </button>
            <button
              type="submit"
              className="pin-prompt-btn primary"
              disabled={saving || !routeName.trim()}
            >
              <Save size={16} />
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SaveRouteDialog;
