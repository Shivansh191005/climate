import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from "react-leaflet";
import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import { reverseGeocode } from "../geocode";

// Default leaflet marker icon fix (Vite doesn't resolve leaflet's default asset paths)
const markerIcon = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

interface Props {
  latitude: number;
  longitude: number;
  onChange: (lat: number, lng: number, placeName?: string) => void;
}

function ClickHandler({ onChange }: { onChange: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onChange(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

// Leaflet often mounts before its container has settled to its final size
// inside a CSS grid layout, which makes it compute the wrong zoom/tile
// bounds (the "whole world" bug). Forcing a resize check right after mount
// (and once more after layout settles) fixes it without any hacky CSS.
function ResizeFix() {
  const map = useMap();
  useEffect(() => {
    const fix = () => map.invalidateSize();
    fix();
    const timer = setTimeout(fix, 200);
    window.addEventListener("resize", fix);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", fix);
    };
  }, [map]);
  return null;
}

// Keeps the map view in sync when the parent's lat/lng change from OUTSIDE
// the map itself (e.g. a search result was selected) - MapContainer's
// `center` prop only applies once, at mount, by design in react-leaflet.
function FlyToOnExternalChange({ latitude, longitude }: { latitude: number; longitude: number }) {
  const map = useMap();
  const lastExternal = useRef<[number, number]>([latitude, longitude]);

  useEffect(() => {
    const [lastLat, lastLng] = lastExternal.current;
    if (lastLat !== latitude || lastLng !== longitude) {
      map.flyTo([latitude, longitude], 10, { duration: 1.2 });
      lastExternal.current = [latitude, longitude];
    }
  }, [latitude, longitude, map]);

  return null;
}

export default function RiskMap({ latitude, longitude, onChange }: Props) {
  const [position, setPosition] = useState<[number, number]>([latitude, longitude]);
  const [resolvingName, setResolvingName] = useState(false);

  // Keep the marker in sync whenever the parent's coordinates change
  // (search selection, preset button, or our own click handler below).
  useEffect(() => {
    setPosition([latitude, longitude]);
  }, [latitude, longitude]);

  const handleMapClick = async (lat: number, lng: number) => {
    setPosition([lat, lng]);
    onChange(lat, lng); // update coordinates immediately, name follows async
    setResolvingName(true);
    try {
      const name = await reverseGeocode(lat, lng);
      if (name) onChange(lat, lng, name);
    } finally {
      setResolvingName(false);
    }
  };

  return (
    <div className="relative rounded-lg overflow-hidden border border-slate-200 dark:border-slate-600 h-72 shadow-sm">
      <MapContainer center={position} zoom={7} style={{ height: "100%", width: "100%" }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker position={position} icon={markerIcon} />
        <ClickHandler onChange={handleMapClick} />
        <ResizeFix />
        <FlyToOnExternalChange latitude={latitude} longitude={longitude} />
      </MapContainer>
      {resolvingName && (
        <div className="absolute bottom-2 left-2 z-[1000] bg-white/90 backdrop-blur px-2 py-1 rounded text-xs text-slate-500 shadow">
          Looking up place name...
        </div>
      )}
    </div>
  );
}
