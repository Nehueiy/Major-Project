import { useEffect, useState, Fragment } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import DashboardLayout from "../../layouts/DashboardLayout";
import API from "../../services/api";
import {
  Copy, Check, Link2, ChevronDown, ChevronUp, ArrowLeft, X, ClipboardList,
  CalendarDays, CheckSquare, Plus, Trash2, ListTodo, MapPin, Compass, Award,
  AlertTriangle, Sparkles, Loader2,
} from "lucide-react";
import FinalDestinationView from "../../components/trip/FinalDestinationView";

const TRIP_TYPES = ["Adventure", "Hiking", "Trekking", "Relaxing", "Cultural", "Beach", "Wildlife", "Road Trip"];
const FOOD_OPTIONS = ["No preference", "Vegetarian", "Non-Vegetarian", "Vegan", "Halal"];
const ACCOMMODATION_OPTIONS = ["No preference", "Hotel", "Camping", "Homestay", "Resort", "Hostel"];

const inputClass =
  "w-full px-4 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] text-sm text-[var(--text)] " +
  "placeholder:text-[var(--text-dim)]/50 outline-none focus:border-[var(--accent)]/50 transition-all";

const pillClass = (active) =>
  `px-3.5 py-1.5 rounded-full text-xs font-semibold border cursor-pointer transition-all duration-200 ${
    active
      ? "bg-[var(--accent)] border-[var(--accent)] text-white shadow-sm"
      : "border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-dim)] hover:border-[var(--accent)]/50 hover:text-[var(--accent)]"
  }`;

export default function Planner() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [user, setUser] = useState(null);
  const [trip, setTrip] = useState(null);
  const [members, setMembers] = useState([]);
  const [role, setRole] = useState("");
  const [preferences, setPreferences] = useState(null);
  const [allPreferences, setAllPreferences] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null); // NEW — real error surfaced to the user
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [linkedPlaces, setLinkedPlaces] = useState([]);
  const [budget, setBudget] = useState("");
  const [tripTypes, setTripTypes] = useState([]);
  const [food, setFood] = useState("No preference");
  const [accommodation, setAccommodation] = useState("No preference");
  const [notes, setNotes] = useState("");
  
  const [generating, setGenerating] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [genError, setGenError] = useState(null);

  const [isFormExpanded, setIsFormExpanded] = useState(false);
  const [isIndividualPrefsExpanded, setIsIndividualPrefsExpanded] = useState(true);

  // Day-by-Day scheduler states
  const [activeDayTab, setActiveDayTab] = useState("All");
  const [itineraryDays, setItineraryDays] = useState({});

  // Group Checklist states
  const [checklist, setChecklist] = useState({ bookings: [], packing: [], transport: [] });
  const [newTodoText, setNewTodoText] = useState("");
  const [activeTodoTab, setActiveTodoTab] = useState("bookings");

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) { navigate("/login", { state: { redirectTo: location.pathname } }); return; }
    if (!id) {
      console.error("Planner: route matched with no :id param — check the <Route path> for this page.");
      navigate("/planner");
      return;
    }

    let cancelled = false;
    setLoading(true);
    setLoadError(null);

    // Trip + preferences are essential — if either fails, we genuinely can't render this page.
    // Places is treated as "nice to have": if that one endpoint hiccups, we still show the trip
    // instead of bouncing the user all the way back to the dashboard.
    Promise.all([
      API.get(`/trips/${id}`),
      API.get(`/trips/${id}/preferences`),
      API.get(`/trips/${id}/places`).catch((err) => {
        console.warn(`Planner: /trips/${id}/places failed, continuing without linked places.`, err);
        return { data: { places: [] } };
      }),
      API.get("/auth/me").catch((err) => {
        console.warn("Planner: /auth/me failed", err);
        return { data: null };
      }),
    ])
      .then(([tripRes, prefRes, placesRes, userRes]) => {
        if (cancelled) return;

        setUser(userRes.data);
        setTrip(tripRes.data.trip);
        setMembers(tripRes.data.members);
        setRole(prefRes.data.role);
        setLinkedPlaces(placesRes.data.places || placesRes.data || []);

        // Load schedule itinerary state
        const savedItinerary = localStorage.getItem(`trip_itinerary_${id}`);
        setItineraryDays(savedItinerary ? JSON.parse(savedItinerary) : {});

        // Load checklists state
        const savedChecklist = localStorage.getItem(`trip_checklist_${id}`);
        if (savedChecklist) {
          setChecklist(JSON.parse(savedChecklist));
        } else {
          // Templates for standard pre-trip items
          setChecklist({
            bookings: [
              { id: 1, text: "Book travel flights / train tickets", completed: false },
              { id: 2, text: "Confirm hotel / resort stays reservations", completed: false },
              { id: 3, text: "Pre-book tour guides or attraction entry slots", completed: false }
            ],
            packing: [
              { id: 4, text: "Pack primary clothing & comfortable footwear", completed: false },
              { id: 5, text: "Prepare travel document pouch (ID, ticket copies)", completed: false },
              { id: 6, text: "Chargers, power banks, and adapters", completed: false },
              { id: 7, text: "Personal toiletries & basic medical kit", completed: false }
            ],
            transport: [
              { id: 8, text: "Rent local vehicle or identify local cab service", completed: false },
              { id: 9, text: "Download offline maps for the region", completed: false }
            ]
          });
        }

        if (prefRes.data.role === "admin") {
          setAllPreferences(prefRes.data.preferences);
        } else {
          const pref = prefRes.data.preferences;
          if (pref) {
            setBudget(pref.budget || "");
            setTripTypes(pref.trip_types || []);
            setFood(pref.food_preference || "No preference");
            setAccommodation(pref.accommodation || "No preference");
            setNotes(pref.notes || "");
            setPreferences(pref);
          }
        }
      })
      .catch((err) => {
        if (cancelled) return;
        // Log the real reason instead of swallowing it — check your console/network tab
        // to see exactly which request and status code caused this.
        console.error(`Planner: failed to load trip ${id}`, err);

        const status = err?.response?.status;
        if (status === 404) {
          setLoadError("This trip couldn't be found. It may have been deleted.");
        } else if (status === 401) {
          navigate("/login", { state: { redirectTo: location.pathname } });
          return;
        } else if (status === 403) {
          setLoadError("You don't have access to this trip.");
        } else {
          setLoadError("Something went wrong while loading this trip. Please try again.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [id, navigate, location.pathname]);

  const inviteLink = trip ? `${window.location.origin}/join/${trip.invite_code}` : "";

  const toggleTripType = (type) => {
    setTripTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await API.post(`/trips/${id}/preferences`, {
        budget: parseInt(budget) || null,
        trip_types: tripTypes,
        food_preference: food,
        accommodation,
        notes,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      if (role === "admin") {
        const prefRes = await API.get(`/trips/${id}/preferences`);
        setAllPreferences(prefRes.data.preferences);
      }
    } catch (err) {
      alert(err.response?.data?.error || "Failed to save preferences");
    } finally {
      setSaving(false);
    }
  };

  const handleRemovePlace = async (placeId) => {
    if (!window.confirm("Are you sure you want to remove this destination?")) return;
    try {
      await API.delete(`/trips/${id}/places/${placeId}`);
      setLinkedPlaces((prev) => prev.filter((p) => p.id !== placeId));
      // Remove from schedule as well
      const updatedItinerary = { ...itineraryDays };
      delete updatedItinerary[placeId];
      setItineraryDays(updatedItinerary);
      localStorage.setItem(`trip_itinerary_${id}`, JSON.stringify(updatedItinerary));
    } catch (err) {
      alert(err.response?.data?.error || "Failed to remove destination");
    }
  };

  const handleGenerateDestination = async () => {
    setGenerating(true);
    setGenError(null);
    try {
      const prefRes = await API.get(`/trips/${id}/preferences`);
      const allPrefs = prefRes.data.preferences;
      if (!allPrefs?.length) {
        setGenError("No members have submitted preferences yet.");
        return;
      }
      await API.post("/ai/final-recommendation", {
        tripId: parseInt(id),
        tripName: trip?.name,
        members,
        preferences: allPrefs,
      });
      // Instead of relying solely on window reload, re-fetch the trip details
      const updatedTrip = await API.get(`/trips/${id}`);
      setTrip(updatedTrip.data.trip);
    } catch (err) {
      console.error("Failed to generate recommendation", err);
      setGenError(err.response?.data?.error || "Failed to generate a recommendation.");
    } finally {
      setGenerating(false);
    }
  };

  const handleAcceptDestination = async () => {
    setAccepting(true);
    try {
      await API.post(`/trips/${id}/accept-recommendation`);
      const updatedTrip = await API.get(`/trips/${id}`);
      setTrip(updatedTrip.data.trip);
      setMembers(updatedTrip.data.members);
    } catch (err) {
      alert(err.response?.data?.error || "Failed to accept recommendation");
    } finally {
      setAccepting(false);
    }
  };

  // Itinerary Assignment Helper
  const handleAssignDay = (placeId, day) => {
    const updated = { ...itineraryDays, [placeId]: day };
    setItineraryDays(updated);
    localStorage.setItem(`trip_itinerary_${id}`, JSON.stringify(updated));
  };

  // Checklist Helpers
  const handleToggleTodo = (category, itemId) => {
    const updated = {
      ...checklist,
      [category]: checklist[category].map((item) =>
        item.id === itemId ? { ...item, completed: !item.completed } : item
      )
    };
    setChecklist(updated);
    localStorage.setItem(`trip_checklist_${id}`, JSON.stringify(updated));
  };

  const handleAddTodo = () => {
    if (!newTodoText.trim()) return;
    const newItem = {
      id: Date.now(),
      text: newTodoText.trim(),
      completed: false
    };
    const updated = {
      ...checklist,
      [activeTodoTab]: [...checklist[activeTodoTab], newItem]
    };
    setChecklist(updated);
    setNewTodoText("");
    localStorage.setItem(`trip_checklist_${id}`, JSON.stringify(updated));
  };

  const handleRemoveTodo = (category, itemId) => {
    const updated = {
      ...checklist,
      [category]: checklist[category].filter((item) => item.id !== itemId)
    };
    setChecklist(updated);
    localStorage.setItem(`trip_checklist_${id}`, JSON.stringify(updated));
  };

  if (loading) {
    return (
      <DashboardLayout>
        <p className="text-[var(--text-dim)] text-sm animate-pulse">Loading trip details...</p>
      </DashboardLayout>
    );
  }

  // NEW — show the real problem instead of silently bouncing back to /dashboard
  if (loadError) {
    return (
      <DashboardLayout>
        <div className="max-w-md mx-auto text-center py-20">
          <div className="w-12 h-12 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle size={20} />
          </div>
          <p className="text-[var(--text)] font-semibold mb-1">{loadError}</p>
          <p className="text-[var(--text-dim)] text-xs mb-6">
            Open your browser console for the full error if this keeps happening.
          </p>
          <button
            onClick={() => navigate("/dashboard")}
            className="btn btn-primary px-5 py-2.5 text-xs font-bold"
          >
            Back to Dashboard
          </button>
        </div>
      </DashboardLayout>
    );
  }

  const membersWithoutPrefs = members.filter(
    (m) => !allPreferences.find((p) => p.user_id === m.id)
  );

  const uniquePlaces = linkedPlaces.filter(
    (place, index, self) => self.findIndex((p) => p.id === place.id) === index
  );

  // Group Preference calculations (Admin View)
  const budgets = allPreferences.map((p) => p.budget).filter(Boolean);
  const minBudget = budgets.length ? Math.min(...budgets) : 0;
  const maxBudget = budgets.length ? Math.max(...budgets) : 0;
  const avgBudget = budgets.length ? budgets.reduce((sum, b) => sum + b, 0) / budgets.length : 0;

  // Ranked trip types
  const typeCounts = {};
  allPreferences.forEach((p) => {
    (p.trip_types || []).forEach((t) => {
      typeCounts[t] = (typeCounts[t] || 0) + 1;
    });
  });
  const rankedTripTypes = Object.entries(typeCounts).sort((a, b) => b[1] - a[1]);

  // Accommodation Consensus
  const accCounts = {};
  allPreferences.forEach((p) => {
    const opt = p.accommodation || "No preference";
    if (opt !== "No preference") accCounts[opt] = (accCounts[opt] || 0) + 1;
  });
  const favoriteAcc = Object.entries(accCounts).sort((a, b) => b[1] - a[1])[0];

  // Food Consensus
  const foodCounts = {};
  allPreferences.forEach((p) => {
    const opt = p.food_preference || "No preference";
    if (opt !== "No preference") foodCounts[opt] = (foodCounts[opt] || 0) + 1;
  });
  const favoriteFood = Object.entries(foodCounts).sort((a, b) => b[1] - a[1])[0];

  // Filter places for schedule tab
  const filteredPlaces = uniquePlaces.filter((p) => {
    const placeDay = itineraryDays[p.id];
    if (activeDayTab === "All") return true;
    if (activeDayTab === "Unscheduled") return !placeDay || placeDay === "Unscheduled";
    return placeDay === activeDayTab;
  });

  const ITINERARY_DAYS_LIST = ["Day 1", "Day 2", "Day 3", "Day 4", "Day 5", "Unscheduled"];

  // NEW — whether it's worth showing the "View Final Destination" shortcut:
  // once the AI has produced (or is producing) a recommendation, or the destination
  // is already confirmed, everyone benefits from a direct link there.
  const hasFinalDestinationActivity =
    !!trip?.final_destination_data ||
    trip?.status === "ai_processing" ||
    trip?.status === "recommendation_ready" ||
    trip?.status === "destination_confirmed";

  return (
    <DashboardLayout>
      <div className="fade-up max-w-5xl mx-auto px-4 sm:px-0 text-left">

        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6 sm:mb-8 border-b border-[var(--border)] pb-5">
          <div>
            <button
              onClick={() => navigate("/dashboard")}
              className="flex items-center gap-1 text-xs text-[var(--text-dim)] bg-transparent border-none
                cursor-pointer hover:text-[var(--text)] transition-colors mb-1.5 p-0 font-semibold"
            >
              <ArrowLeft size={12} /> Back to Dashboard
            </button>
            <h1 className="cinzel text-3.5xl text-[var(--accent)] font-bold break-words leading-tight">
              {trip?.name}
            </h1>
            <p className="text-[var(--text-dim)] text-sm mt-0.5">
              {members.length} member{members.length !== 1 ? "s" : ""} · {role === "admin" ? "Organizer View" : "Trip Companion"}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* NEW — jump straight to the AI's final pick once there's something to see there.
                Shown to everyone (not just admins) since members need to view/accept it too. */}
            {/* NEW — final destination inline instead of separate page */}
            {hasFinalDestinationActivity && trip?.status !== "ai_processing" && (
              <button
                onClick={() => {
                  document.getElementById('final-destination-section')?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[var(--accent)]/30
                  bg-[var(--accent)]/5 text-[var(--accent)] text-xs font-bold hover:bg-[var(--accent)]/10
                  transition-colors cursor-pointer"
              >
                <Sparkles size={14} /> View Final Destination
              </button>
            )}

            {trip?.status === "ai_processing" && (
               <span className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[var(--accent)]/30
                 bg-[var(--accent)]/5 text-[var(--accent)] text-xs font-bold">
                 <Loader2 size={14} className="animate-spin" /> AI is choosing…
               </span>
            )}

            {role === "admin" && (
              <button
                onClick={() =>
                  navigate(`/assistant/${id}`, {
                    state: {
                      tripId: parseInt(id),
                      tripName: trip?.name,
                      members: members,
                      preferences: allPreferences,
                    },
                  })
                }
                className="btn btn-primary shadow-md hover:-translate-y-0.5 transition-all text-xs font-bold py-2.5 px-4 flex items-center gap-2"
              >
                <Award size={14} /> Send to AI Planner
              </button>
            )}
          </div>
        </div>

        {/* Invite & Roster section */}
        {role === "admin" && (
          <div className="grid gap-6 grid-cols-1 md:grid-cols-[1.5fr_1fr] mb-6 sm:mb-8">
            {/* Invite Center */}
            <div className="rounded-2xl border border-[var(--accent)]/20 bg-[var(--accent)]/5 p-5 flex flex-col justify-between gap-4">
              <div>
                <h3 className="cinzel text-sm font-bold text-[var(--text)] flex items-center gap-2">
                  <Link2 size={15} className="text-[var(--accent)]" />
                  Trip Invite Center
                </h3>
                <p className="text-xs text-[var(--text-dim)] mt-1">
                  Share this unique portal address to let other friends join this planning group.
                </p>
              </div>

              <div className="flex items-center gap-3 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl px-3.5 py-2.5 min-w-0">
                <span className="text-xs text-[var(--text-dim)] truncate flex-1 font-medium">{inviteLink}</span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(inviteLink);
                    setCopiedLink(true);
                    setTimeout(() => setCopiedLink(false), 2000);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--accent)] text-white
                    text-xs font-bold hover:opacity-90 transition-opacity border-none cursor-pointer shrink-0"
                >
                  {copiedLink ? <Check size={12} /> : <Copy size={12} />}
                  {copiedLink ? "Copied" : "Copy Link"}
                </button>
              </div>
            </div>

            {/* Attendance Roster status */}
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5 flex flex-col justify-between gap-3">
              <div>
                <h3 className="cinzel text-sm font-bold text-[var(--text)] flex items-center gap-2">
                  👥 Group Roster Status
                </h3>
                <p className="text-xs text-[var(--text-dim)] mt-1">
                  {allPreferences.length} of {members.length} members submitted preferences.
                </p>
              </div>

              {membersWithoutPrefs.length > 0 ? (
                <div>
                  <p className="text-[10px] text-amber-600 uppercase tracking-widest font-bold mb-1.5">Waiting on Preferences:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {membersWithoutPrefs.map((m) => (
                      <span key={m.id} className="text-[10px] font-semibold px-2.5 py-1 rounded-full bg-[var(--bg-subtle)] text-[var(--text)] border border-[var(--border)]">
                        {m.name}
                      </span>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-semibold">
                  <CheckSquare size={14} /> Ready! All preferences submitted.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Preference Visual Analytics (Admin Dashboard) */}
        {role === "admin" && allPreferences.length > 0 && (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5 mb-6 sm:mb-8">
            <div className="flex items-center gap-2 mb-5">
              <span className="text-lg">📊</span>
              <h2 className="cinzel text-base text-[var(--text)] font-bold">Group Preference Analytics</h2>
            </div>

            <div className="grid gap-6 grid-cols-1 md:grid-cols-3">
              {/* Budget Range spectrum */}
              <div className="flex flex-col gap-2.5 border-r border-[var(--border)] pr-4 last:border-0">
                <h4 className="text-xs text-[var(--text-dim)] uppercase tracking-widest font-bold">💰 Budget Consensus</h4>
                {budgets.length === 0 ? (
                  <p className="text-xs text-[var(--text-dim)]">Not specified</p>
                ) : (
                  <div className="mt-1 flex flex-col gap-1.5">
                    <div className="flex items-end justify-between">
                      <span className="text-[10px] text-[var(--text-dim)]">Min: Rs. {minBudget.toLocaleString()}</span>
                      <span className="text-sm font-bold text-[var(--text)]">Avg: Rs. {Math.round(avgBudget).toLocaleString()}</span>
                      <span className="text-[10px] text-[var(--text-dim)]">Max: Rs. {maxBudget.toLocaleString()}</span>
                    </div>
                    {/* Visual spectrum bar */}
                    <div className="h-2 w-full rounded-full bg-[var(--bg-subtle)] border border-[var(--border)] overflow-hidden relative">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-400 to-[var(--accent)]"
                        style={{
                          width: `${Math.min(100, Math.max(15, (avgBudget / maxBudget) * 100))}%`
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Trip Types Ranking */}
              <div className="flex flex-col gap-2 border-r border-[var(--border)] pr-4 last:border-0">
                <h4 className="text-xs text-[var(--text-dim)] uppercase tracking-widest font-bold">🎒 Top Travel Styles</h4>
                <div className="flex flex-col gap-1.5 mt-1">
                  {rankedTripTypes.length === 0 ? (
                    <p className="text-xs text-[var(--text-dim)]">No preference votes yet</p>
                  ) : (
                    rankedTripTypes.slice(0, 3).map(([type, votes], idx) => (
                      <div key={idx} className="flex items-center justify-between text-xs text-[var(--text)]">
                        <span className="font-semibold">{idx+1}. {type}</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[var(--accent)]/10 text-[var(--accent)]">
                          {votes} {votes === 1 ? "vote" : "votes"}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Stays & Dining consensus */}
              <div className="flex flex-col gap-2.5">
                <h4 className="text-xs text-[var(--text-dim)] uppercase tracking-widest font-bold">🏨 Group Favorites</h4>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[var(--text-dim)]">Lodging:</span>
                    <span className="font-bold text-[var(--text)] truncate max-w-[140px]" title={favoriteAcc ? favoriteAcc[0] : "None"}>
                      {favoriteAcc ? `${favoriteAcc[0]} (${favoriteAcc[1]} votes)` : "None"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[var(--text-dim)]">Dining Style:</span>
                    <span className="font-bold text-[var(--text)] truncate max-w-[140px]" title={favoriteFood ? favoriteFood[0] : "None"}>
                      {favoriteFood ? `${favoriteFood[0]} (${favoriteFood[1]} votes)` : "None"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Accordion trigger to view individual preferences list */}
            <div className="mt-4 pt-3 border-t border-[var(--border)] flex justify-end">
              <button
                onClick={() => setIsIndividualPrefsExpanded(!isIndividualPrefsExpanded)}
                className="text-xs text-[var(--accent)] hover:underline font-semibold bg-transparent border-none cursor-pointer flex items-center gap-1"
              >
                {isIndividualPrefsExpanded ? "Hide Individual Preferences" : "Show Individual Preferences"}
                {isIndividualPrefsExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              </button>
            </div>

            {isIndividualPrefsExpanded && (
              <div
                className="grid gap-4 mt-4 pt-4 border-t border-[var(--border)]"
                style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}
              >
                {allPreferences.map((pref) => (
                  <div key={pref.user_id} className="rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)]/40 p-4">
                    <div className="flex items-center gap-2.5 mb-3">
                      <div className="w-8 h-8 rounded-full bg-[var(--accent)] flex items-center justify-center text-xs text-white font-bold shrink-0">
                        {pref.name?.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-[var(--text)] truncate">{pref.name}</p>
                        <p className="text-[10px] text-[var(--text-dim)] truncate">{pref.email}</p>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <PrefRow icon="💰" label="Budget" value={pref.budget ? `Rs. ${pref.budget.toLocaleString()}` : "Not specified"} />
                      <PrefRow icon="🎒" label="Trip type" value={pref.trip_types?.length ? pref.trip_types.join(", ") : "Not specified"} />
                      <PrefRow icon="🍽️" label="Food" value={pref.food_preference || "Not specified"} />
                      <PrefRow icon="🏨" label="Stay" value={pref.accommodation || "Not specified"} />
                      {pref.notes && <PrefRow icon="📝" label="Notes" value={pref.notes} />}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Day-by-Day Itinerary Planner */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5 mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <h2 className="cinzel text-base text-[var(--text)] font-bold flex items-center gap-2">
              <MapPin size={16} className="text-[var(--accent)]" />
              Day-by-Day Itinerary Organizer
            </h2>
            
            {/* Day selector tabs */}
            <div className="flex flex-wrap gap-1 bg-[var(--bg-subtle)] p-1 rounded-xl border border-[var(--border)]">
              {["All", "Day 1", "Day 2", "Day 3", "Day 4", "Day 5", "Unscheduled"].map((tab) => {
                const isActive = activeDayTab === tab;
                return (
                  <button
                    key={tab}
                    onClick={() => setActiveDayTab(tab)}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold border-none cursor-pointer transition-all ${
                      isActive
                        ? "bg-[var(--accent)] text-white shadow-sm"
                        : "text-[var(--text-dim)] bg-transparent hover:text-[var(--text)]"
                    }`}
                  >
                    {tab}
                  </button>
                );
              })}
            </div>
          </div>

          {/* AI Suggested Final Destination Section inline */}
          {hasFinalDestinationActivity && trip?.final_destination_data && (
            <div id="final-destination-section" className="mb-6">
              <FinalDestinationView
                trip={trip}
                data={trip.final_destination_data}
                members={members}
                onAccept={handleAcceptDestination}
                hasAccepted={!!members.find((m) => m.id === user?.id)?.has_accepted_recommendation || accepting}
                onRegenerate={role === "admin" ? () => navigate(`/assistant/${id}`, {
                  state: {
                    tripId: parseInt(id),
                    tripName: trip?.name,
                    members: members,
                    preferences: allPreferences,
                  },
                }) : null}
                generating={generating}
              />
              {genError && <p className="text-xs text-red-500 mt-2 font-bold">{genError}</p>}
            </div>
          )}

          {filteredPlaces.length === 0 ? (
            <div className="text-center py-10 border border-dashed border-[var(--border)] rounded-xl">
              <Compass size={24} className="text-[var(--text-dim)]/40 mx-auto mb-2" />
              <p className="text-[var(--text-dim)] text-xs font-semibold">No destinations scheduled in {activeDayTab === "All" ? "your trip" : activeDayTab}.</p>
              {activeDayTab !== "All" && (
                <button
                  onClick={() => setActiveDayTab("All")}
                  className="text-xs text-[var(--accent)] hover:underline mt-1.5 font-bold bg-transparent border-none cursor-pointer"
                >
                  Show All Places to assign schedules
                </button>
              )}
            </div>
          ) : (
            <div
              className="grid gap-4"
              style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}
            >
              {trip?.final_destination_data?.itinerary?.filter(
                (item) => activeDayTab === "All" || activeDayTab === `Day ${item.day}`
              ).map((item, idx) => (
                <Fragment key={`ai-day-frag-${idx}`}>
                  {/* The overall plan summary for the day */}
                  <div
                    key={`ai-day-${idx}`}
                    className="relative rounded-2xl border border-[var(--accent)]/50 bg-[var(--accent)]/5 p-4 flex flex-col gap-3 shadow-sm"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-[var(--accent)]/20 flex items-center justify-center text-[var(--accent)] shrink-0 font-bold border border-[var(--accent)]/30">
                        Day {item.day}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-[var(--text)]">AI Suggested Plan</p>
                        <p className="text-xs text-[var(--text-dim)] mt-1 whitespace-pre-wrap">{item.plan}</p>
                      </div>
                    </div>
                  </div>

                  {/* Render the specific structured places for the day exactly like normal places */}
                  {item.places && item.places.map((place, pIdx) => (
                    <div
                      key={`ai-place-${idx}-${pIdx}`}
                      className="relative rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-3.5 flex flex-col gap-3 group hover:border-[var(--accent)]/30 hover:shadow-sm transition-all"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-12 h-12 rounded-xl bg-[var(--bg-subtle)] flex items-center justify-center text-[var(--accent)] shrink-0 font-bold border border-[var(--border)]">
                          ✨
                        </div>
                        <div className="min-w-0 flex-1 pr-2">
                          <p className="text-sm font-bold text-[var(--text)] truncate">{place.name}</p>
                          <p className="text-[10px] text-[var(--text-dim)] line-clamp-2 mt-0.5">{place.details}</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between border-t border-[var(--border)]/60 pt-2.5 mt-1.5">
                        <span className="text-[10px] text-[var(--text-dim)] font-semibold">Scheduled for:</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-[var(--accent)]/10 text-[var(--accent)]">
                          Day {item.day}
                        </span>
                      </div>
                    </div>
                  ))}
                </Fragment>
              ))}
              {filteredPlaces.map((p) => {
                const day = itineraryDays[p.id] || "Unscheduled";
                return (
                  <div
                    key={p.id}
                    className="relative rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-3.5 flex flex-col gap-3 group hover:border-[var(--accent)]/30 hover:shadow-sm transition-all"
                  >
                    <div className="flex items-start gap-3">
                      {p.image_url ? (
                        <img
                          src={p.image_url}
                          alt={p.name}
                          className="w-12 h-12 rounded-xl object-cover shrink-0 border border-[var(--border)]"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-[var(--bg-subtle)] flex items-center justify-center text-[var(--text-dim)] shrink-0 font-bold border border-[var(--border)]">
                          🗺️
                        </div>
                      )}
                      <div className="min-w-0 flex-1 pr-6">
                        <p className="text-sm font-bold text-[var(--text)] truncate">{p.name}</p>
                        <p className="text-[10px] text-[var(--text-dim)] truncate mt-0.5">{p.location || p.address}</p>
                      </div>
                    </div>

                    {/* Day allocation controls */}
                    <div className="flex items-center justify-between border-t border-[var(--border)]/60 pt-2.5 mt-1.5">
                      <span className="text-[10px] text-[var(--text-dim)] font-semibold">Assign Itinerary:</span>
                      <select
                        value={day}
                        onChange={(e) => handleAssignDay(p.id, e.target.value)}
                        className="text-xs px-2.5 py-1 rounded-lg border border-[var(--border)] bg-[var(--bg-subtle)] text-[var(--text)] font-bold focus:border-[var(--accent)] outline-none cursor-pointer"
                      >
                        {ITINERARY_DAYS_LIST.map((dOption) => (
                          <option key={dOption} value={dOption}>{dOption}</option>
                        ))}
                      </select>
                    </div>

                    {/* Delete item */}
                    <button
                      onClick={() => handleRemovePlace(p.id)}
                      title="Remove place"
                      className="absolute top-2 right-2 text-[var(--text-dim)] hover:text-red-500 transition-colors
                        bg-transparent border-none cursor-pointer p-1 rounded-md"
                    >
                      <X size={14} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Pre-trip checklists/To-Dos */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5 mb-6 sm:mb-8">
          <div className="flex items-center gap-2 mb-4 border-b border-[var(--border)] pb-3">
            <ListTodo size={16} className="text-[var(--accent)]" />
            <h2 className="cinzel text-base text-[var(--text)] font-bold">Group Pre-Trip Checklist</h2>
          </div>

          <div className="flex flex-col md:flex-row gap-5">
            {/* Category Sidebar tabs */}
            <div className="flex md:flex-col gap-1 bg-[var(--bg-subtle)] p-1.5 rounded-xl md:w-44 shrink-0 border border-[var(--border)]">
              <button
                onClick={() => setActiveTodoTab("bookings")}
                className={`flex-1 md:text-left px-3 py-2 rounded-lg text-xs font-semibold border-none cursor-pointer transition-all ${
                  activeTodoTab === "bookings" ? "bg-[var(--accent)] text-white" : "text-[var(--text-dim)] bg-transparent hover:text-[var(--text)]"
                }`}
              >
                ✈️ Bookings
              </button>
              <button
                onClick={() => setActiveTodoTab("packing")}
                className={`flex-1 md:text-left px-3 py-2 rounded-lg text-xs font-semibold border-none cursor-pointer transition-all ${
                  activeTodoTab === "packing" ? "bg-[var(--accent)] text-white" : "text-[var(--text-dim)] bg-transparent hover:text-[var(--text)]"
                }`}
              >
                🎒 Packing List
              </button>
              <button
                onClick={() => setActiveTodoTab("transport")}
                className={`flex-1 md:text-left px-3 py-2 rounded-lg text-xs font-semibold border-none cursor-pointer transition-all ${
                  activeTodoTab === "transport" ? "bg-[var(--accent)] text-white" : "text-[var(--text-dim)] bg-transparent hover:text-[var(--text)]"
                }`}
              >
                🚗 Transit & Local
              </button>
            </div>

            {/* List and additions */}
            <div className="flex-1 flex flex-col gap-3">
              {/* Add form */}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder={`Add new task to ${activeTodoTab}...`}
                  value={newTodoText}
                  onChange={(e) => setNewTodoText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddTodo()}
                  className="flex-1 px-3 py-2 text-xs rounded-xl border border-[var(--border)] bg-[var(--bg-card)] outline-none text-[var(--text)] focus:border-[var(--accent)]/55 transition-colors placeholder:text-[var(--text-dim)]/50"
                />
                <button
                  onClick={handleAddTodo}
                  className="px-3.5 py-2 rounded-xl bg-[var(--accent)] text-white border-none cursor-pointer font-bold text-xs hover:opacity-90 transition-opacity"
                >
                  Add Item
                </button>
              </div>

              {/* Items listing */}
              <div className="flex flex-col gap-2 max-h-60 overflow-y-auto pr-1">
                {(checklist[activeTodoTab] || []).length === 0 ? (
                  <p className="text-[var(--text-dim)] text-xs py-4 italic">No checklist items added.</p>
                ) : (
                  (checklist[activeTodoTab] || []).map((todo) => (
                    <div
                      key={todo.id}
                      onClick={() => handleToggleTodo(activeTodoTab, todo.id)}
                      className={`flex items-center justify-between gap-3 p-2.5 rounded-xl border cursor-pointer transition-all ${
                        todo.completed
                          ? "bg-[var(--bg-subtle)] border-[var(--border)] opacity-60 line-through text-[var(--text-dim)]"
                          : "bg-[var(--bg-card)] border-[var(--border)] hover:border-[var(--accent)]/20 text-[var(--text)]"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <input
                          type="checkbox"
                          checked={todo.completed}
                          readOnly
                          className="w-3.5 h-3.5 text-[var(--accent)] rounded focus:ring-[var(--accent)] cursor-pointer"
                        />
                        <span className="text-xs font-semibold truncate">{todo.text}</span>
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveTodo(activeTodoTab, todo.id);
                        }}
                        className="text-[var(--text-dim)] hover:text-red-500 bg-transparent border-none cursor-pointer p-1 rounded transition-colors"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Foldable Preferences configuration */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5 mb-6 sm:mb-10">
          <div
            onClick={() => setIsFormExpanded(!isFormExpanded)}
            className="flex items-center justify-between cursor-pointer gap-3"
          >
            <div>
              <h3 className="cinzel text-base text-[var(--text)] font-bold flex items-center gap-1.5">
                🛠️ Configure Your Personal Preferences
              </h3>
              <p className="text-[var(--text-dim)] text-xs mt-1">
                {isFormExpanded ? "Collapse panel to hide settings" : "Expand to select lodging, budgets, and culinary favorites"}
              </p>
            </div>
            <button className="text-[var(--text-dim)] bg-transparent border-none cursor-pointer shrink-0">
              {isFormExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </button>
          </div>

          {isFormExpanded && (
            <div className="mt-6 pt-6 border-t border-[var(--border)]">
              <PreferenceForm
                budget={budget} setBudget={setBudget}
                tripTypes={tripTypes} toggleTripType={toggleTripType}
                food={food} setFood={setFood}
                accommodation={accommodation} setAccommodation={setAccommodation}
                notes={notes} setNotes={setNotes}
                onSave={handleSave} saving={saving} saved={saved}
              />
            </div>
          )}
        </div>

      </div>
    </DashboardLayout>
  );
}

// Inline Sub-Components
function PrefRow({ icon, label, value }) {
  return (
    <div className="flex gap-2 items-start text-left">
      <span className="text-sm shrink-0">{icon}</span>
      <div className="min-w-0">
        <p className="text-[9px] text-[var(--text-dim)] uppercase tracking-widest font-semibold">{label}</p>
        <p className="text-xs text-[var(--text)] font-bold break-words leading-tight mt-0.5">{value}</p>
      </div>
    </div>
  );
}

function PreferenceForm({ budget, setBudget, tripTypes, toggleTripType, food, setFood, accommodation, setAccommodation, notes, setNotes, onSave, saving, saved }) {
  return (
    <div className="flex flex-col gap-6 text-left">
      <div>
        <label className="text-xs text-[var(--text-dim)] uppercase tracking-widest font-bold block mb-2">
          💰 Personal Budget (Rs.)
        </label>
        <input
          type="number"
          placeholder="e.g. 20000"
          value={budget}
          onChange={(e) => setBudget(e.target.value)}
          className={inputClass}
        />
      </div>

      <div>
        <label className="text-xs text-[var(--text-dim)] uppercase tracking-widest font-bold block mb-3">
          🎒 Desired Trip Styles (Select all that match)
        </label>
        <div className="flex flex-wrap gap-2">
          {TRIP_TYPES.map((type) => (
            <button key={type} type="button" onClick={() => toggleTripType(type)} className={pillClass(tripTypes.includes(type))}>
              {type}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-xs text-[var(--text-dim)] uppercase tracking-widest font-bold block mb-3">
          🍽️ Food & Diet Preference
        </label>
        <div className="flex flex-wrap gap-2">
          {FOOD_OPTIONS.map((option) => (
            <button key={option} type="button" onClick={() => setFood(option)} className={pillClass(food === option)}>
              {option}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-xs text-[var(--text-dim)] uppercase tracking-widest font-bold block mb-3">
          🏨 accommodation choice
        </label>
        <div className="flex flex-wrap gap-2">
          {ACCOMMODATION_OPTIONS.map((option) => (
            <button key={option} type="button" onClick={() => setAccommodation(option)} className={pillClass(accommodation === option)}>
              {option}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-xs text-[var(--text-dim)] uppercase tracking-widest font-bold block mb-2">
          📝 Notes & Special Requests
        </label>
        <textarea
          placeholder="Specific landmarks, packing questions, or health conditions..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className={`${inputClass} resize-y`}
        />
      </div>

      <button
        onClick={onSave}
        disabled={saving}
        className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[var(--accent)] text-white
          text-sm font-bold hover:opacity-90 disabled:opacity-60 transition-opacity border-none cursor-pointer shadow-sm"
      >
        {saving ? "Saving..." : saved ? (<><Check size={16} /> Saved Successfully!</>) : "Save Trip Preferences"}
      </button>
    </div>
  );
}