import React, { useState, useRef, useEffect } from 'react';
import { Menu, Search, Upload, Download, X, Calendar, Map as MapIcon } from 'lucide-react';
import SearchBar from './SearchBar';

const TopRightMenu = ({ onCitySelect, onExport, onImport, waypointsCount, currentView, onViewChange }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const fileInputRef = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false);
        // Only close search if it's open and the click is outside the entire menu area
        if (searchOpen) setSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [searchOpen]);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      onImport(file);
    }
    setMenuOpen(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="top-right-menu" ref={menuRef}>
      
      {/* Search Container */}
      <div className={`search-container ${searchOpen ? 'open' : ''}`}>
        {searchOpen ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%' }}>
            <SearchBar onCitySelect={(city) => { onCitySelect(city); setSearchOpen(false); }} />
            <button className="btn glass-panel icon-btn close-search-btn" onClick={() => setSearchOpen(false)} title="Fermer la recherche">
              <X size={24} />
            </button>
          </div>
        ) : (
          <button className="btn glass-panel icon-btn" onClick={() => setSearchOpen(true)} title="Rechercher une ville">
            <Search size={28} />
          </button>
        )}
      </div>

      {/* Burger Menu Toggle */}
      <button className={`btn glass-panel icon-btn ${menuOpen ? 'active' : ''}`} onClick={() => setMenuOpen(!menuOpen)} title="Menu">
        {menuOpen ? <X size={28} /> : <Menu size={28} />}
      </button>

      {/* Dropdown Menu */}
      <div className={`dropdown-menu glass-panel ${menuOpen ? 'open' : ''}`}>
        {currentView === 'map' ? (
          <button className="btn menu-item" onClick={() => { onViewChange('training'); setMenuOpen(false); }}>
            <Calendar size={18} /> Calendrier d'entrainement
          </button>
        ) : (
          <button className="btn menu-item" onClick={() => { onViewChange('map'); setMenuOpen(false); }}>
            <MapIcon size={18} /> Planificateur d'itinéraire
          </button>
        )}

        <div className="menu-divider"></div>

        <button className="btn menu-item" onClick={() => fileInputRef.current?.click()}>
          <Upload size={18} /> Importer un GPX
        </button>
        <input type="file" accept=".gpx" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileChange} />
        
        <div className="menu-divider"></div>

        <button 
          className="btn menu-item" 
          onClick={() => { onExport(); setMenuOpen(false); }} 
          disabled={waypointsCount < 2}
        >
          <Download size={18} /> Exporter en GPX
        </button>
      </div>
    </div>
  );
};

export default TopRightMenu;
