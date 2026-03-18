import { useState, useEffect } from 'react';
import { Search } from 'lucide-react';
import axios from 'axios';

const SearchBar = ({ onCitySelect }) => {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (query.length > 2) {
        fetchSuggestions();
      } else {
        setSuggestions([]);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [query]);

  const fetchSuggestions = async () => {
    try {
      const response = await axios.get(`http://localhost:8000/api/search?q=${query}`);
      setSuggestions(response.data);
      setShowSuggestions(true);
    } catch (error) {
      console.error('Search error:', error);
    }
  };

  const handleSelect = (city) => {
    onCitySelect(city);
    setQuery(city.name);
    setShowSuggestions(false);
  };

  return (
    <div className="floating-search">
      <div className="search-input-wrapper">
        <Search className="search-icon" style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
        <input
          type="text"
          className="search-input"
          placeholder="Rechercher une ville..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setShowSuggestions(suggestions.length > 0)}
        />
        
        {showSuggestions && suggestions.length > 0 && (
          <div className="search-suggestions glass-panel">
            {suggestions.map((city, index) => (
              <div
                key={index}
                className="suggestion-item"
                onClick={() => handleSelect(city)}
              >
                {city.name}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SearchBar;
