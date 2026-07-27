import { useEffect, useRef } from 'react';
import L from 'leaflet';
import { Mountain, Route } from 'lucide-react';

/**
 * Toggle between surface (road type) and elevation (grade) trace coloring.
 * Placed below the POI button.
 */
const TraceStyleToggle = ({ colorMode, onToggle, disabled }) => {
  const buttonRef = useRef(null);

  useEffect(() => {
    if (buttonRef.current) {
      L.DomEvent.disableClickPropagation(buttonRef.current);
      L.DomEvent.disableScrollPropagation(buttonRef.current);
    }
  }, []);

  const isElevation = colorMode === 'elevation';

  return (
    <button
      ref={buttonRef}
      type="button"
      className="trace-style-btn glass-panel"
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        if (!disabled) onToggle();
      }}
      disabled={disabled}
      title={
        disabled
          ? 'Profil d\'altitude indisponible'
          : isElevation
            ? 'Colorer par type de voie'
            : 'Colorer par dénivelé'
      }
      style={
        isElevation
          ? { borderColor: '#10b981', background: 'rgba(16, 185, 129, 0.12)' }
          : undefined
      }
    >
      {isElevation ? (
        <Mountain size={18} style={{ color: '#10b981' }} />
      ) : (
        <Route size={18} />
      )}
    </button>
  );
};

export default TraceStyleToggle;
