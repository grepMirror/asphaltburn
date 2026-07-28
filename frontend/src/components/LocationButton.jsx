import { useState, useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import { LocateFixed, Loader2, Navigation } from 'lucide-react';

/**
 * Tap once: locate. Tap again while following: stop.
 * Continuous watchPosition works offline (device GPS).
 */
const LocationButton = () => {
  const map = useMap();
  const [loading, setLoading] = useState(false);
  const [following, setFollowing] = useState(false);
  const markerRef = useRef(null);
  const watchIdRef = useRef(null);
  const buttonRef = useRef(null);

  useEffect(() => {
    if (buttonRef.current) {
      L.DomEvent.disableClickPropagation(buttonRef.current);
      L.DomEvent.disableScrollPropagation(buttonRef.current);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (watchIdRef.current != null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      if (markerRef.current) {
        markerRef.current.remove();
        markerRef.current = null;
      }
    };
  }, []);

  const upsertMarker = (latitude, longitude) => {
    if (markerRef.current) {
      markerRef.current.setLatLng([latitude, longitude]);
      return;
    }
    markerRef.current = L.circleMarker([latitude, longitude], {
      radius: 10,
      fillColor: '#3b82f6',
      color: '#fff',
      weight: 3,
      opacity: 1,
      fillOpacity: 0.9,
    })
      .bindPopup('Vous êtes ici')
      .addTo(map);
  };

  const stopFollow = () => {
    if (watchIdRef.current != null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setFollowing(false);
    setLoading(false);
  };

  const startFollow = () => {
    if (!navigator.geolocation) {
      alert('Géolocalisation non disponible sur cet appareil.');
      return;
    }

    setLoading(true);
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        upsertMarker(latitude, longitude);
        map.setView([latitude, longitude], Math.max(map.getZoom(), 15), { animate: true });
        setLoading(false);
        setFollowing(true);
      },
      () => {
        stopFollow();
        alert('Impossible d\'obtenir votre position.');
      },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 }
    );
  };

  const handleClick = (e) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    if (following || watchIdRef.current != null) {
      stopFollow();
      return;
    }
    startFollow();
  };

  return (
    <button
      ref={buttonRef}
      className={`map-fab-btn glass-panel ${following ? 'active' : ''}`}
      onClick={handleClick}
      title={following ? 'Arrêter le suivi GPS' : 'Suivre ma position'}
      style={{ top: '160px', left: '12px' }}
    >
      {loading ? (
        <Loader2 size={22} className="animate-spin" />
      ) : following ? (
        <Navigation size={22} />
      ) : (
        <LocateFixed size={22} />
      )}
    </button>
  );
};

export default LocationButton;
