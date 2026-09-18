import { useEffect, useState, useRef } from "react";
import { MapPin, Trash2, Plus, Search } from "lucide-react";
import API from "../../services/api";

export default function TripPlaces({ tripId }) {
  const [places, setPlaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const mapRef = useRef(null);
  const googleMapInstance = useRef(null);
  const markersRef = useRef([]);
  const autocompleteService = useRef(null);
  const placesService = useRef(null);

  // Load places from DB
  useEffect(() => {
    API.get(`/trips/${tripId}/places`)
      .then((res) => setPlaces(res.data))
      .catch((err) => console.error("Error fetching places:", err))
      .finally(() => setLoading(false));
  }, [tripId]);

  // Poll until Google Maps is ready
  useEffect(() => {
    let checkGoogleInterval = setInterval(() => {
      if (
        window.google &&
        window.google.maps &&
        window.google.maps.places &&
        window.google.maps.marker &&          // ✅ check marker library too
        mapRef.current
      ) {
        clearInterval(checkGoogleInterval);
        initMap();
      }
    }, 300);

    return () => clearInterval(checkGoogleInterval);
  }, [loading]);

  const initMap = () => {
    if (googleMapInstance.current) return; // Prevent duplicate init

    try {
      autocompleteService.current =
        new window.google.maps.places.AutocompleteService();

      googleMapInstance.current = new window.google.maps.Map(mapRef.current, {
        center: { lat: 28.3949, lng: 84.124 },
        zoom: 7,
        mapId: "YOUR_MAP_ID_HERE", // ✅ required for AdvancedMarkerElement
      });

      placesService.current = new window.google.maps.places.PlacesService(
        googleMapInstance.current
      );

      renderMarkers();
    } catch (error) {
      console.error("Google Maps SDK failed to construct:", error);
    }
  };

  const renderMarkers = () => {
    if (!googleMapInstance.current) return;

    // ✅ Clear old markers correctly for AdvancedMarkerElement
    markersRef.current.forEach((m) => (m.map = null));
    markersRef.current = [];

    if (places.length === 0) return;

    const bounds = new window.google.maps.LatLngBounds();

    places.forEach((place) => {
      if (!place.lat || !place.lng) return;

      // ✅ Fix 1 — define position properly
      const position = {
        lat: parseFloat(place.lat),
        lng: parseFloat(place.lng),
      };

      // ✅ Fix 2 — use position and googleMapInstance.current
      const marker = new google.maps.marker.AdvancedMarkerElement({
        position: position,
        map: googleMapInstance.current,
        title: place.name,
      });

      markersRef.current.push(marker);
      bounds.extend(position);
    });

    googleMapInstance.current.fitBounds(bounds);
    if (places.length === 1) googleMapInstance.current.setZoom(13);
  };

  useEffect(() => {
    renderMarkers();
  }, [places]);

  const handleQueryChange = (e) => {
    const val = e.target.value;
    setQuery(val);

    if (!val.trim() || val.length < 2 || !autocompleteService.current) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    autocompleteService.current.getPlacePredictions(
      { input: val },
      (predictions, status) => {
        if (
          status === window.google.maps.places.PlacesServiceStatus.OK &&
          predictions
        ) {
          setSuggestions(predictions);
          setShowSuggestions(true);
        }
      }
    );
  };

  const handleSelectSuggestion = (suggestion) => {
    setShowSuggestions(false);
    setQuery(suggestion.description);
    setAdding(true);

    if (!placesService.current) return;

    placesService.current.getDetails(
      {
        placeId: suggestion.place_id,
        fields: ["name", "formatted_address", "geometry"],
      },
      async (place, status) => {
        if (
          status === window.google.maps.places.PlacesServiceStatus.OK &&
          place
        ) {
          try {
            const lat = place.geometry.location.lat();
            const lng = place.geometry.location.lng();

            const res = await API.post(`/trips/${tripId}/places`, {
              name: place.name,
              address: place.formatted_address || "",
              lat,
              lng,
              place_id: suggestion.place_id,
            });

            setPlaces((prev) => [...prev, res.data]);
            setQuery("");
          } catch (err) {
            console.error(err);
          } finally {
            setAdding(false);
          }
        } else {
          setAdding(false);
        }
      }
    );
  };

  const handleDelete = async (placeId) => {
    try {
      await API.delete(`/trips/${tripId}/places/${placeId}`);
      setPlaces((prev) => prev.filter((p) => p.id !== placeId));
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="mt-10 rounded-[16px] border border-[rgba(0,0,0,0.06)] bg-white p-6">
      <h3 className="cinzel text-xl font-bold text-[#2B3E34] mb-5">
        📌 Places to Visit
      </h3>

      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <div className="relative mb-5">
            <input
              type="text"
              placeholder="Search and add a place..."
              value={query}
              onChange={handleQueryChange}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 250)}
              className="w-full rounded-[10px] border border-slate-300 px-4 py-3 outline-none transition focus:border-slate-400 disabled:cursor-not-allowed"
              disabled={adding}
            />

            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute inset-x-0 top-full z-50 mt-2 rounded-[10px] border border-slate-300 bg-white shadow-[0_4px_12px_rgba(0,0,0,0.1)]">
                {suggestions.map((s, i) => (
                  <div
                    key={i}
                    onMouseDown={() => handleSelectSuggestion(s)}
                    className="cursor-pointer border-b border-slate-100 px-4 py-3 text-sm text-slate-700 last:border-b-0 hover:bg-slate-50"
                  >
                    {s.description}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3">
            {places.length === 0 ? (
              <p className="text-sm text-slate-400">
                No destinations added yet.
              </p>
            ) : (
              places.map((place) => (
                <div
                  key={place.id}
                  className="flex items-center justify-between rounded-[10px] border border-slate-200 bg-slate-50 px-4 py-3"
                >
                  <div>
                    <p className="m-0 text-sm font-semibold text-slate-900">
                      {place.name}
                    </p>
                    <p className="m-0 text-xs text-slate-500">
                      {place.address}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDelete(place.id)}
                    className="text-slate-500 transition-colors hover:text-slate-700"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        <div
          ref={mapRef}
          className="h-[350px] rounded-[12px] border border-slate-200 bg-slate-100 w-full"
        />
      </div>
    </div>
  );
}