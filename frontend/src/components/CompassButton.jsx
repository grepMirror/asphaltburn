import { useState, useEffect, useRef, useCallback } from 'react';
import { useMap } from 'react-leaflet';
import { Navigation } from 'lucide-react';

const CompassButton = () => {
  const map = useMap();
  const [active, setActive] = useState(false);
  const [heading, setHeading] = useState(0);
  const headingRef = useRef(0);
  const buttonRef = useRef(null);

  useEffect(() => {
    if (buttonRef.current) {
      L.DomEvent.disableClickPropagation(buttonRef.current);
      L.DomEvent.disableScrollPropagation(buttonRef.current);
    }
  }, []);

  const handleOrientation = useCallback((event) => {
    // Alpha: compass heading (0=North, 90=East, etc.)
    // On iOS, webkitCompassHeading is more reliable
    const compassHeading = event.webkitCompassHeading != null
      ? event.webkitCompassHeading
      : event.alpha != null ? (360 - event.alpha) % 360 : null;

    if (compassHeading == null) return;

    headingRef.current = compassHeading;
    setHeading(compassHeading);

    // Rotate map container
    const container = map.getContainer();
    container.style.transformOrigin = 'center center';
    container.style.transform = `rotate(${-compassHeading}deg)`;
    // Invalidate size so tiles don't misalign
    map.invalidateSize();
  }, [map]);

  const resetRotation = useCallback(() => {
    const container = map.getContainer();
    container.style.transform = '';
    map.invalidateSize();
  }, [map]);

  const toggle = async (e) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    if (active) {
      window.removeEventListener('deviceorientation', handleOrientation);
      resetRotation();
      setActive(false);
    } else {
      // iOS 13+ requires permission
      if (
        typeof DeviceOrientationEvent !== 'undefined' &&
        typeof DeviceOrientationEvent.requestPermission === 'function'
      ) {
        try {
          const permission = await DeviceOrientationEvent.requestPermission();
          if (permission !== 'granted') return;
        } catch {
          return;
        }
      }
      window.addEventListener('deviceorientation', handleOrientation);
      setActive(true);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      window.removeEventListener('deviceorientation', handleOrientation);
      resetRotation();
    };
  }, [handleOrientation, resetRotation]);

  return (
    <button
      ref={buttonRef}
      className={`map-fab-btn glass-panel ${active ? 'active' : ''}`}
      onClick={toggle}
      title={active ? 'Désactiver la boussole' : 'Activer la boussole'}
      style={{ top: '220px', left: '12px' }}
    >
      <Navigation
        size={22}
        style={{
          transform: active ? `rotate(${heading}deg)` : 'none',
          transition: active ? 'transform 0.3s ease' : 'none',
          color: active ? '#3b82f6' : 'inherit',
        }}
      />
    </button>
  );
};

export default CompassButton;
