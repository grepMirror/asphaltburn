import React, { useState, useRef, useEffect } from 'react';
import {
  Search, Upload, Download, X, Map as MapIcon, RotateCcw, List, Menu, Save, Trash2, WifiOff, HardDrive,
} from 'lucide-react';
import SearchBar from './SearchBar';

const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return isMobile;
};

const TopRightMenu = ({
  onCitySelect,
  onExport,
  onImport,
  onUndo,
  onSave,
  onReset,
  waypointsCount,
  currentView,
  onViewChange,
  onSaveOffline,
  onClearOffline,
  canSaveOffline = false,
  hasOfflinePack = false,
  offlineSaving = false,
}) => {
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuExpanded, setMenuExpanded] = useState(false);
  const fileInputRef = useRef(null);
  const menuRef = useRef(null);
  const isMobile = useIsMobile();

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        if (searchOpen) setSearchOpen(false);
        if (menuExpanded) setMenuExpanded(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [searchOpen, menuExpanded]);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      onImport(file);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleMenuAction = (action) => {
    action();
    setMenuExpanded(false);
  };

  return (
    <div
      className={`top-right-menu glass-panel ${isMobile ? 'top-right-menu--mobile' : ''}`}
      ref={menuRef}
    >
      {searchOpen ? (
        <div className={isMobile ? 'search-row-mobile' : 'search-container open'}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', width: '100%' }}>
            <SearchBar onCitySelect={(city) => { onCitySelect(city); setSearchOpen(false); }} />
            <button
              className="icon-btn small"
              onClick={() => setSearchOpen(false)}
              title="Fermer"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      ) : (
        <>
          <button className="icon-btn" onClick={() => setSearchOpen(true)} title="Rechercher">
            <Search size={isMobile ? 20 : 22} />
          </button>
          <button
            className="icon-btn"
            onClick={(e) => { e.stopPropagation(); onUndo(); }}
            disabled={waypointsCount === 0}
            title="Annuler"
          >
            <RotateCcw size={18} />
          </button>
          <button
            className={`icon-btn ${menuExpanded ? 'active' : ''}`}
            onClick={() => setMenuExpanded(!menuExpanded)}
            title="Menu"
          >
            {menuExpanded ? <X size={20} /> : <Menu size={20} />}
          </button>
        </>
      )}

      {menuExpanded && !searchOpen && (
        <div className="mobile-menu-dropdown glass-panel">
          <button
            className={`mobile-menu-item ${currentView === 'map' ? 'active' : ''}`}
            onClick={() => handleMenuAction(() => onViewChange('map'))}
          >
            <MapIcon size={18} />
            <span>Carte</span>
          </button>
          <button
            className={`mobile-menu-item ${currentView === 'saved' ? 'active' : ''}`}
            onClick={() => handleMenuAction(() => onViewChange('saved'))}
          >
            <List size={18} />
            <span>Itinéraires</span>
          </button>

          <div className="mobile-menu-divider" />

          <button
            className="mobile-menu-item"
            onClick={() => { setMenuExpanded(false); fileInputRef.current?.click(); }}
          >
            <Upload size={18} />
            <span>Importer GPX</span>
          </button>
          <button
            className="mobile-menu-item"
            onClick={() => handleMenuAction(onExport)}
            disabled={waypointsCount < 2}
          >
            <Download size={18} />
            <span>Exporter GPX</span>
          </button>

          <div className="mobile-menu-divider" />

          <button
            className="mobile-menu-item"
            onClick={() => handleMenuAction(onSaveOffline)}
            disabled={!canSaveOffline || offlineSaving}
          >
            <HardDrive size={18} />
            <span>{offlineSaving ? 'Téléchargement…' : 'Sauver hors-ligne'}</span>
          </button>
          <button
            className="mobile-menu-item"
            onClick={() => handleMenuAction(onClearOffline)}
            disabled={!hasOfflinePack || offlineSaving}
          >
            <WifiOff size={18} />
            <span>Effacer hors-ligne</span>
          </button>

          <div className="mobile-menu-divider" />

          <button
            className="mobile-menu-item"
            onClick={() => handleMenuAction(onSave)}
            disabled={waypointsCount < 2}
          >
            <Save size={18} />
            <span>Enregistrer</span>
          </button>
          <button
            className="mobile-menu-item mobile-menu-item--danger"
            onClick={() => handleMenuAction(onReset)}
            disabled={waypointsCount === 0}
          >
            <Trash2 size={18} />
            <span>Reset</span>
          </button>
        </div>
      )}

      <input
        type="file"
        accept=".gpx"
        ref={fileInputRef}
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
    </div>
  );
};

export default TopRightMenu;
