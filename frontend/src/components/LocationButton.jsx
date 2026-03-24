import { useState, useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import { LocateFixed, Loader2 } from 'lucide-react';

const LocationButton = () => {
  const map = useMap();
  const [loading, setLoading] = useState(false);
  const [marker, setMarker] = useState(null);
  const buttonRef = useRef(null);
  
  useEffect(() => {
    if (buttonRef.current) {
      L.DomEvent.disableClickPropagation(buttonRef.current);
      L.DomEvent.disableScrollPropagation(buttonRef.current);
    }
  }, []);

  const handleLocate = (e) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    if (!navigator.geolocation) return;
    setLoading(true);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;

        // Remove previous marker
        if (marker) marker.remove();

        // Create a "you are here" circle marker
        const circleMarker = L.circleMarker([latitude, longitude], {
          radius: 10,
          fillColor: '#3b82f6',
          color: '#fff',
          weight: 3,
          opacity: 1,
          fillOpacity: 0.9,
        }).bindPopup('📍 Vous êtes ici').addTo(map);

        setMarker(circleMarker);
        map.flyTo([latitude, longitude], 16, { duration: 1.5 });
        setLoading(false);
      },
      () => {
        setLoading(false);
        alert('Impossible d\'obtenir votre position.');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  return (
    <button
      ref={buttonRef}
      className="map-fab-btn glass-panel"
      onClick={handleLocate}
      title="Ma position"
      style={{ top: '160px', left: '12px' }}
    >
      {loading ? <Loader2 size={22} className="animate-spin" /> : <LocateFixed size={22} />}
    </button>
  );
};

export default LocationButton;
