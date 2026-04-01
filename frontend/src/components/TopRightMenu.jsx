import React, { useState, useRef, useEffect } from 'react';
import { Search, Upload, Download, X, Calendar, Map as MapIcon, RotateCcw, List } from 'lucide-react';
import SearchBar from './SearchBar';

const TopRightMenu = ({ onCitySelect, onExport, onImport, onUndo, waypointsCount, currentView, onViewChange }) => {
  const [searchOpen, setSearchOpen] = useState(false);
  const fileInputRef = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
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
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

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
            className={`icon-btn ${currentView === 'training' ? 'active' : ''}`} 
            onClick={() => onViewChange('training')} 
            title="Training Calendar"
          >
            <Calendar size={20} />
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
            title="Export GPX"
          >
            <Download size={20} />
          </button>
        </div>
      )}
    </div>
  );
};

export default TopRightMenu;
