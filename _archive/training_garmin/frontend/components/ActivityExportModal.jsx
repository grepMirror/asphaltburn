import React, { useEffect, useMemo, useState } from 'react';
import { X, Copy, Share2 } from 'lucide-react';
import {
  copyActivitiesForLlm,
  countActivitiesInRange,
  defaultExportEndDate,
  defaultExportStartDate,
  shareActivitiesForLlm,
} from '../utils/activityExport';

const ActivityExportModal = ({ activities, onClose }) => {
  const [startDate, setStartDate] = useState(defaultExportStartDate);
  const [endDate, setEndDate] = useState(defaultExportEndDate);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(null);

  const previewCount = useMemo(
    () => countActivitiesInRange(activities, startDate, endDate),
    [activities, startDate, endDate],
  );

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const validateRange = () => {
    if (!startDate || !endDate) {
      setError('Choisissez une date de début et une date de fin.');
      return false;
    }
    if (startDate > endDate) {
      setError('La date de début doit être avant la date de fin.');
      return false;
    }
    if (previewCount === 0) {
      setError('Aucune activité sur cette période.');
      return false;
    }
    return true;
  };

  const handleCopy = async () => {
    if (!validateRange()) return;
    setBusy('copy');
    setError('');
    setSuccess('');
    try {
      const count = await copyActivitiesForLlm(activities, { startDate, endDate });
      setSuccess(`${count} activité${count > 1 ? 's' : ''} copiée${count > 1 ? 's' : ''} — collez dans votre LLM.`);
    } catch (e) {
      setError(e?.message || 'Impossible de copier.');
    } finally {
      setBusy(null);
    }
  };

  const handleShare = async () => {
    if (!validateRange()) return;
    setBusy('share');
    setError('');
    setSuccess('');
    try {
      const { count, method } = await shareActivitiesForLlm(activities, { startDate, endDate });
      if (method === 'shared') {
        setSuccess(`${count} activité${count > 1 ? 's' : ''} — choisissez où enregistrer ou partager.`);
      } else {
        setSuccess(`${count} activité${count > 1 ? 's' : ''} — fichier téléchargé.`);
      }
    } catch (e) {
      if (e?.name === 'AbortError') return;
      setError(e?.message || 'Impossible de partager le fichier.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div
      className="export-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="export-modal-title"
      onClick={onClose}
    >
      <div className="export-modal glass-panel" onClick={(e) => e.stopPropagation()}>
        <div className="export-modal-handle" aria-hidden="true" />

        <div className="export-modal-header">
          <h2 id="export-modal-title">Exporter pour LLM</h2>
          <button type="button" className="icon-btn small export-modal-close" onClick={onClose} aria-label="Fermer">
            <X size={20} />
          </button>
        </div>

        <p className="export-modal-desc">
          Sur téléphone : <strong>Copier</strong> puis coller dans ChatGPT, Claude, etc. Ou <strong>Partager</strong> pour enregistrer le fichier .md.
        </p>

        <div className="export-modal-dates">
          <label>
            <span>Du</span>
            <input
              type="date"
              value={startDate}
              max={endDate || undefined}
              onChange={(e) => {
                setStartDate(e.target.value);
                setError('');
                setSuccess('');
              }}
            />
          </label>
          <label>
            <span>Au</span>
            <input
              type="date"
              value={endDate}
              min={startDate || undefined}
              onChange={(e) => {
                setEndDate(e.target.value);
                setError('');
                setSuccess('');
              }}
            />
          </label>
        </div>

        <p className="export-modal-preview" aria-live="polite">
          {startDate && endDate && startDate <= endDate
            ? `${previewCount} activité${previewCount !== 1 ? 's' : ''} sur la période`
            : 'Période invalide'}
        </p>

        {error && <p className="export-modal-error" role="alert">{error}</p>}
        {success && <p className="export-modal-success" role="status">{success}</p>}

        <div className="export-modal-actions">
          <button
            type="button"
            className="btn btn-primary export-modal-action-primary"
            onClick={handleCopy}
            disabled={!!busy}
          >
            <Copy size={20} />
            {busy === 'copy' ? 'Copie…' : 'Copier pour LLM'}
          </button>
          <button
            type="button"
            className="btn glass-panel export-modal-action-secondary"
            onClick={handleShare}
            disabled={!!busy}
          >
            <Share2 size={20} />
            {busy === 'share' ? 'Partage…' : 'Partager / fichier .md'}
          </button>
          <button type="button" className="btn export-modal-cancel" onClick={onClose} disabled={!!busy}>
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
};

export default ActivityExportModal;
