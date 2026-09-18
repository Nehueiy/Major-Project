import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import DashboardLayout from "../../layouts/DashboardLayout";
import { MapPin } from "lucide-react";

// ✅ Fix broken default marker icon in React
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require("leaflet/dist/images/marker-icon-2x.png"),
  iconUrl: require("leaflet/dist/images/marker-icon.png"),
  shadowUrl: require("leaflet/dist/images/marker-shadow.png"),
});

// ✅ Recenter map when location loads
function RecenterMap({ position }) {
  const map = useMap();
  useEffect(() => {
    if (position) {
      map.setView(position, 14);
    }
  }, [position, map]);
  return null;
}

export default function MapPage() {
  const navigate = useNavigate();
  const [userLocation, setUserLocation] = useState(null);
  const [locationName, setLocationName] = useState("Detecting location...");

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const coords = [pos.coords.latitude, pos.coords.longitude];
          setUserLocation(coords);

          // ✅ Free reverse geocoding using OpenStreetMap Nominatim (no API key needed)
          try {
            const res = await fetch(
              `https://nominatim.openstreetmap.org/reverse?lat=${coords[0]}&lon=${coords[1]}&format=json`
            );
            const data = await res.json();
            setLocationName(data.display_name || "Your Location");
          } catch {
            setLocationName("Your Location");
          }
        },
        () => {
          setUserLocation([28.2096, 83.9856]);
          setLocationName("Pokhara, Nepal");
        }
      );
    } else {
      setUserLocation([28.2096, 83.9856]);
      setLocationName("Pokhara, Nepal");
    }
  }, []);

  return (
    <DashboardLayout>

      {/* Header */}
      <div className="flex items-end justify-between mb-6">
        <div>
          <button
            onClick={() => navigate("/dashboard")}
            className="bg-transparent border-none text-[var(--text-dim)] text-sm cursor-pointer p-0 mb-2 hover:text-[var(--text)] transition-colors"
          >
            ← Back to Dashboard
          </button>
          <h2 className="cinzel text-3xl text-[var(--accent)] m-0">
            Your Location
          </h2>
        </div>

        {/* Location pill */}
        <div className="flex items-center gap-2 bg-[var(--bg-card)] border border-[var(--border)] rounded-full px-4 py-2 text-xs text-[var(--text-dim)] max-w-[280px]">
          <MapPin size={13} className="text-[var(--accent)] shrink-0" />
          <span className="overflow-hidden text-ellipsis whitespace-nowrap">
            {locationName}
          </span>
        </div>
      </div>

      {/* Map */}
      <div
        className="rounded-2xl overflow-hidden border border-[var(--border)] min-h-[400px]"
        style={{ height: "calc(100vh - 220px)" }}
      >
        {userLocation ? (
          <MapContainer
            center={userLocation}
            zoom={14}
            style={{ width: "100%", height: "100%" }}
            zoomControl={true}
            scrollWheelZoom={true}
            attributionControl={false}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            <Marker position={userLocation}>
              <Popup>
                <div className="text-xs max-w-[200px]">
                  <p className="font-semibold m-0 mb-1">📍 You are here</p>
                  <p className="m-0 opacity-70 text-[0.7rem]">{locationName}</p>
                </div>
              </Popup>
            </Marker>

            <RecenterMap position={userLocation} />
          </MapContainer>
        ) : (
          <div className="w-full h-full bg-[var(--bg)] flex flex-col items-center justify-center gap-3 text-[var(--text-dim)]">
            <MapPin size={32} />
            <p className="text-sm">Loading your location...</p>
          </div>
        )}
      </div>

    </DashboardLayout>
  );
}