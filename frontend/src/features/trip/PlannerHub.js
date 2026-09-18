import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "../../layouts/DashboardLayout";
import API from "../../services/api";
import { Map, Plus, ArrowRight, Compass, Search, Users, Calendar, Filter, Bot } from "lucide-react";

export default function PlannerHub() {
  const navigate = useNavigate();
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) { navigate("/login"); return; }
    API.get("/trips/my")
      .then((res) => setTrips(res.data))
      .finally(() => setLoading(false));
  }, [navigate]);

  if (loading) return (
    <DashboardLayout>
      <p className="text-[var(--text-dim)] text-sm animate-pulse">Loading trips hub...</p>
    </DashboardLayout>
  );

  const filteredTrips = trips.filter((trip) => {
    const matchesSearch = trip.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === "all" ? true : trip.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const organizedCount = trips.filter((t) => t.role === "admin").length;
  const joinedCount    = trips.filter((t) => t.role === "member").length;

  // ✅ Navigate to assistant WITH full trip data
  const openAssistant = async (trip, e) => {
    e.stopPropagation();
    try {
      // Fetch full trip details including members and preferences
      const [detailRes, prefsRes, membersRes] = await Promise.all([
        API.get(`/trips/${trip.id}`),
        API.get(`/trips/${trip.id}/preferences`),
        API.get(`/trips/${trip.id}/members`),
      ]);

      navigate(`/assistant/${trip.id}`, {
        state: {
          tripId:      trip.id,
          tripName:    trip.name,
          members:     membersRes.data,
          preferences: prefsRes.data,
        },
      });
    } catch {
      // Fallback — navigate with basic info so page still loads
      navigate(`/assistant/${trip.id}`, {
        state: {
          tripId:      trip.id,
          tripName:    trip.name,
          members:     [],
          preferences: [],
        },
      });
    }
  };

  return (
    <DashboardLayout>
      <div className="fade-up max-w-5xl mx-auto px-4 sm:px-0 text-left">

        {/* Header */}
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between mb-8 pb-6 border-b border-[var(--border)]">
          <div>
            <p className="flex items-center gap-1.5 text-xs text-[var(--text-dim)] uppercase tracking-widest mb-1.5 font-bold">
              <Map size={13} strokeWidth={2} />
              Travel Hub
            </p>
            <h1 className="cinzel text-3.5xl font-bold text-[var(--text)] leading-tight">
              Your Travel Portfolios
            </h1>
            <p className="text-[var(--text-dim)] text-sm mt-1">
              Select or organize a trip itinerary, checklist preferences, and coordinate group travels.
            </p>
          </div>
          <button
            onClick={() => navigate("/create-trip")}
            className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[var(--accent)] hover:bg-[#3c5e4e]
              text-white text-sm font-bold shadow-md hover:-translate-y-0.5 transition-all border-none cursor-pointer shrink-0"
          >
            <Plus size={16} strokeWidth={2.5} /> Create a Trip
          </button>
        </div>

        {trips.length > 0 && (
          <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="px-3.5 py-1.5 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border)] text-xs text-[var(--text)] font-semibold">
                📁 Total: {trips.length}
              </div>
              <div className="px-3.5 py-1.5 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border)] text-xs text-[var(--text)] font-semibold">
                🎖️ Organized: {organizedCount}
              </div>
              <div className="px-3.5 py-1.5 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border)] text-xs text-[var(--text)] font-semibold">
                👥 Joined: {joinedCount}
              </div>
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-2.5">
              <div className="relative w-full sm:w-60">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-dim)]" />
                <input
                  type="text"
                  placeholder="Search trip names..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text)] outline-none focus:border-[var(--accent)]/50 transition-colors placeholder:text-[var(--text-dim)]"
                />
              </div>
              <div className="flex items-center gap-1.5 w-full sm:w-auto">
                <Filter size={13} className="text-[var(--text-dim)] shrink-0" />
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="w-full sm:w-auto px-3 py-2 text-xs rounded-xl border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text)] outline-none focus:border-[var(--accent)]/50 cursor-pointer font-semibold"
                >
                  <option value="all">All Roles</option>
                  <option value="admin">Organized By You</option>
                  <option value="member">Joined By You</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Trips Grid */}
        {trips.length === 0 ? (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] text-center py-16 px-4">
            <div className="w-14 h-14 rounded-xl bg-[var(--accent)]/10 flex items-center justify-center text-[var(--accent)] mx-auto mb-5">
              <Compass size={22} strokeWidth={1.8} />
            </div>
            <h3 className="cinzel text-lg font-bold text-[var(--text)] mb-2">No trips listed yet</h3>
            <p className="text-[var(--text-dim)] mb-6 text-sm max-w-sm mx-auto">
              Create a travel destination plan, configure notes, and invite companions to get started!
            </p>
            <button
              onClick={() => navigate("/create-trip")}
              className="px-6 py-3 rounded-xl bg-[var(--accent)] text-white text-sm font-bold hover:opacity-90 transition-opacity border-none cursor-pointer shadow"
            >
              Create Your First Trip
            </button>
          </div>
        ) : filteredTrips.length === 0 ? (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] text-center py-12 px-4">
            <p className="text-[var(--text-dim)] text-sm">No trips match your current search and role filters.</p>
            <button
              onClick={() => { setSearchQuery(""); setRoleFilter("all"); }}
              className="text-xs text-[var(--accent)] hover:underline mt-2 bg-transparent border-none cursor-pointer font-bold"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div
            className="grid gap-5"
            style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}
          >
            {filteredTrips.map((trip) => (
              <div
                key={trip.id}
                onClick={() => navigate(`/planner/${trip.id}`)}
                className="card card-hover cursor-pointer group flex flex-col gap-4 text-left relative overflow-hidden"
                style={{ padding: "0" }}
              >
                {/* Cover Banner */}
                <div className="h-32 w-full overflow-hidden relative bg-gradient-to-br from-[#426856]/40 to-[#2c3531]/40 shrink-0">
                  {trip.image ? (
                    <img
                      src={trip.image}
                      alt={trip.name}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-4xl opacity-20">🏔️</div>
                  )}
                  <span className={`absolute top-3 right-3 text-[10px] px-2.5 py-1 rounded-full font-bold shadow-sm capitalize
                    ${trip.role === "admin"
                      ? "bg-[var(--accent)] text-white"
                      : "bg-[var(--bg-card)] text-[var(--text)] border border-[var(--border)]"}`}
                  >
                    {trip.role === "admin" ? "Organizer" : "Companion"}
                  </span>
                </div>

                {/* Card Content */}
                <div className="p-5 flex flex-col flex-1 gap-3.5">
                  <div className="min-w-0">
                    <h3 className="cinzel text-base text-[var(--text)] font-bold truncate group-hover:text-[var(--accent)] transition-colors">
                      {trip.name}
                    </h3>
                    <p className="text-[10px] text-[var(--text-dim)] uppercase font-semibold tracking-wider mt-1.5 flex items-center gap-1">
                      <Calendar size={11} />
                      Trip ID: #{trip.id}
                    </p>
                  </div>

                  <div className="flex items-center gap-3 border-t border-[var(--border)] pt-3.5 mt-auto">
                    <div className="flex items-center gap-1 text-[var(--text-dim)] text-xs font-semibold">
                      <Users size={13} />
                      <span>Planning Group</span>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-[var(--bg-subtle)] text-[var(--text)] font-bold">
                      Code: {trip.invite_code}
                    </span>
                  </div>

                  {/* ✅ Two action buttons */}
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex items-center gap-1.5 text-xs text-[var(--accent)] font-bold group-hover:gap-2.5 transition-all flex-1">
                      <span>Open Itinerary</span>
                      <ArrowRight size={13} strokeWidth={2.5} />
                    </div>

                    {/* ✅ AI Assistant button — passes full trip data */}
                    <button
                      onClick={(e) => openAssistant(trip, e)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-[var(--accent)]/10 text-[var(--accent)] hover:bg-[var(--accent)] hover:text-white transition-all border-none cursor-pointer shrink-0"
                    >
                      <Bot size={12} />
                      AI Plan
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}