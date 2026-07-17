import React, { useState, useRef, useEffect } from 'react';
import { Search, Upload, Download, X, Map as MapIcon, RotateCcw, List, Menu } from 'lucide-react';
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

const TopRightMenu = ({ onCitySelect, onExport, onImport, onUndo, waypointsCount, currentView, onViewChange }) => {
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileExpanded, setMobileExpanded] = useState(false);
  const fileInputRef = useRef(null);
  const menuRef = useRef(null);
  const isMobile = useIsMobile();

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        if (searchOpen) setSearchOpen(false);
        if (mobileExpanded) setMobileExpanded(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [searchOpen, mobileExpanded]);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      onImport(file);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleMobileAction = (action) => {
    action();
    setMobileExpanded(false);
  };

  if (isMobile) {
    return (
      <div className="top-right-menu glass-panel top-right-menu--mobile" ref={menuRef}>
        {searchOpen ? (
          <div className="search-row-mobile">
            <SearchBar onCitySelect={(city) => { onCitySelect(city); setSearchOpen(false); }} />
            <button className="icon-btn small" onClick={() => setSearchOpen(false)} title="Fermer">
              <X size={18} />
            </button>
          </div>
        ) : (
          <>
            <button className="icon-btn" onClick={() => setSearchOpen(true)} title="Rechercher">
              <Search size={20} />
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
              className={`icon-btn ${mobileExpanded ? 'active' : ''}`}
              onClick={() => setMobileExpanded(!mobileExpanded)}
              title="Menu"
            >
              {mobileExpanded ? <X size={20} /> : <Menu size={20} />}
            </button>
          </>
        )}

        {mobileExpanded && !searchOpen && (
          <div className="mobile-menu-dropdown glass-panel">
            <button
              className={`mobile-menu-item ${currentView === 'map' ? 'active' : ''}`}
              onClick={() => handleMobileAction(() => onViewChange('map'))}
            >
              <MapIcon size={18} />
              <span>Carte</span>
            </button>
            <button
              className={`mobile-menu-item ${currentView === 'saved' ? 'active' : ''}`}
              onClick={() => handleMobileAction(() => onViewChange('saved'))}
            >
              <List size={18} />
              <span>Itinéraires</span>
            </button>

            <div className="mobile-menu-divider" />

            <button
              className="mobile-menu-item"
              onClick={() => { setMobileExpanded(false); fileInputRef.current?.click(); }}
            >
              <Upload size={18} />
              <span>Importer GPX</span>
            </button>
            <button
              className="mobile-menu-item"
              onClick={() => handleMobileAction(onExport)}
              disabled={waypointsCount < 2}
            >
              <Download size={18} />
              <span>Exporter GPX</span>
            </button>
          </div>
        )}

        <input type="file" accept=".gpx" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileChange} />
      </div>
    );
  }

  return (
    <div className="top-right-menu glass-panel" ref={menuRef}>
      <div className={`search-container ${searchOpen ? 'open' : ''}`}>
        {searchOpen ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', width: '100%' }}>
            <SearchBar onCitySelect={(city) => { onCitySelect(city); setSearchOpen(false); }} />
            <button className="icon-btn small" onClick={(e) => { e.stopPropagation(); setSearchOpen(false); }} title="Close Search">
              <X size={18} />
            </button>
          </div>
        ) : (
          <button className="icon-btn" onClick={(e) => { e.stopPropagation(); setSearchOpen(true); }} title="Search">
            <Search size={22} />
          </button>
        )}
      </div>

      {!searchOpen && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          <div style={{ width: '1px', height: '20px', background: 'rgba(0,0,0,0.05)', margin: '0 0.25rem' }} />
          
          <button 
            className={`icon-btn ${currentView === 'map' ? 'active' : ''}`} 
            onClick={() => onViewChange('map')} 
            title="Map Planner"
          >
            <MapIcon size={20} />
          </button>

          <button 
            className={`icon-btn ${currentView === 'saved' ? 'active' : ''}`} 
            onClick={() => onViewChange('saved')} 
            title="Saved Routes"
          >
            <List size={20} />
          </button>

          <div style={{ width: '1px', height: '20px', background: 'rgba(0,0,0,0.05)', margin: '0 0.25rem' }} />

          <button 
            className="icon-btn" 
            onClick={(e) => { e.stopPropagation(); onUndo(); }} 
            disabled={waypointsCount === 0}
            title="Undo"
          >
            <RotateCcw size={18} />
          </button>

          <div style={{ width: '1px', height: '20px', background: 'rgba(0,0,0,0.05)', margin: '0 0.25rem' }} />

          <button className="icon-btn" onClick={() => fileInputRef.current?.click()} title="Import GPX">
            <Upload size={20} />
          </button>
          <input type="file" accept=".gpx" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileChange} />

          <button 
            className="icon-btn" 
            onClick={onExport} 
            disabled={waypointsCount < 2} 
            title="Télécharger GPX"
          >
            <Download size={20} />
          </button>
        </div>
      )}
    </div>
  );
};

export default TopRightMenu;
