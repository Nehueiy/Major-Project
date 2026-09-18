import { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import DashboardLayout from "../../layouts/DashboardLayout";
import API from "../../services/api";
import MapComponent from "../../components/destinations/MapComponent";
import {
  Trash2, Sparkles, Send, Loader2, Copy, Check,
  ChevronDown, Bot, MapPin, Plus, Map, X, User as UserIcon,
} from "lucide-react";

const SUGGESTIONS = [
  "Best hidden gems near Pokhara",
  "Day-by-day itinerary for Annapurna circuit",
  "Average daily budget breakdown for Nepal travel",
  "Local food must-tries and restaurant tips",
  "Safe transport options across Nepal",
  "Best trekking seasons and weather guide",
];

const EMOJI_REGEX = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{2190}-\u{21FF}\u{FE0F}\u{1F1E6}-\u{1F1FF}]/gu;
const cleanText = (s) => s.replace(EMOJI_REGEX, "").replace(/[ \t]{2,}/g, " ").trim();

function looksLikePlace(name) {
  if (!name || name.length > 34) return false;
  if (/^day\s*\d+/i.test(name)) return false;
  if (/[:()]/.test(name)) return false;
  if (/\bapprox\b|\bhours?\b|\bminutes?\b/i.test(name)) return false;
  return true;
}

function renderInline(line, keyPrefix, onPlaceClick) {
  const parts = [];
  const regex = /\*\*(.*?)\*\*/g;
  let lastIndex = 0;
  let match;
  let i = 0;
  while ((match = regex.exec(line)) !== null) {
    if (match.index > lastIndex) parts.push(line.slice(lastIndex, match.index));
    const label = match[1].trim();
    if (looksLikePlace(label)) {
      parts.push(
        <button
          key={`${keyPrefix}-${i}`}
          onClick={() => onPlaceClick(label)}
          className="inline-flex items-center gap-1 rounded-md bg-[var(--accent)]/10 px-1.5 py-[0.1rem] text-[0.92em] font-semibold text-[var(--accent)] transition-colors duration-150 hover:bg-[var(--accent)] hover:text-white mx-0.5 align-baseline"
          title={`View ${label} on map`}
        >
          <MapPin size={11} className="shrink-0" />
          {label}
        </button>
      );
    } else {
      parts.push(<strong key={`${keyPrefix}-${i}`} className="font-semibold text-[var(--text)]">{label}</strong>);
    }
    lastIndex = regex.lastIndex;
    i++;
  }
  if (lastIndex < line.length) parts.push(line.slice(lastIndex));
  return parts;
}

function renderText(text, onPlaceClick) {
  const lines = cleanText(text).split("\n");
  const blocks = [];
  let listBuffer = [];

  const flushList = (key) => {
    if (listBuffer.length) {
      blocks.push(<ul key={`ul-${key}`} className="my-1.5 space-y-1.5">{listBuffer}</ul>);
      listBuffer = [];
    }
  };

  lines.forEach((raw, i) => {
    const line = raw.trim();
    if (!line) { flushList(i); return; }

    const heading = line.match(/^#{1,6}\s+(.*)/);
    if (heading) {
      flushList(i);
      blocks.push(
        <h4 key={i} className="mt-3 mb-1.5 pt-2 first:mt-0 first:pt-0 border-t border-[var(--border)]/60 first:border-0 text-[12px] font-bold uppercase tracking-wide text-[var(--accent)]">
          {renderInline(heading[1], `h-${i}`, onPlaceClick)}
        </h4>
      );
      return;
    }

    const bullet = line.match(/^[-*]\s+(.*)/);
    if (bullet) {
      listBuffer.push(
        <li key={i} className="flex items-start gap-2 leading-relaxed">
          <span className="mt-[0.55em] w-1 h-1 rounded-full bg-[var(--text-dim)] shrink-0" />
          <span>{renderInline(bullet[1], `li-${i}`, onPlaceClick)}</span>
        </li>
      );
      return;
    }

    flushList(i);
    blocks.push(<p key={i} className="my-0.5 leading-relaxed">{renderInline(line, `p-${i}`, onPlaceClick)}</p>);
  });

  flushList("end");
  return blocks;
}

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-bounce [animation-delay:-0.3s]" />
      <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-bounce [animation-delay:-0.15s]" />
      <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-bounce" />
    </span>
  );
}

function HistorySkeleton() {
  return (
    <div className="flex-1 flex flex-col justify-end gap-3 p-1">
      <div className="flex justify-start">
        <div className="h-9 w-2/5 rounded-2xl rounded-bl-md bg-[var(--bg-subtle)] animate-pulse" />
      </div>
      <div className="flex justify-end">
        <div className="h-9 w-1/3 rounded-2xl rounded-br-md bg-[var(--bg-subtle)] animate-pulse" />
      </div>
      <div className="flex justify-start">
        <div className="h-14 w-3/5 rounded-2xl rounded-bl-md bg-[var(--bg-subtle)] animate-pulse" />
      </div>
    </div>
  );
}

export default function Assistant() {
  const location  = useLocation();
  const navigate  = useNavigate();
  const { tripId: paramTripId } = useParams(); // ✅ get tripId from URL
  const stateData = location.state;
  const endRef    = useRef(null);
  const textareaRef = useRef(null);

  const [trips,        setTrips]        = useState([]);
  const [selectedId,   setSelectedId]   = useState(stateData?.tripId || paramTripId || null);
  const [selectedName, setSelectedName] = useState(stateData?.tripName || null);
  const [activeTripData, setActiveTripData] = useState(stateData || null); // ✅ unified trip data
  const [tripLoading,  setTripLoading]  = useState(false);

  const [messages,     setMessages]     = useState([]);
  const [input,        setInput]        = useState("");
  const [loading,      setLoading]      = useState(false);
  const [generating,   setGenerating]   = useState(false);
  const [histLoading,  setHistLoading]  = useState(false);
  const [copiedIdx,    setCopiedIdx]    = useState(null);
  const [showTripDrop, setShowTripDrop] = useState(false);
  const [mapQuery,     setMapQuery]     = useState("Nepal");
  const [activePlace,  setActivePlace]  = useState(null);
  const [addingPlace,  setAddingPlace]  = useState(false);
  const [addedPlace,   setAddedPlace]   = useState(null);
  const [showBanner,   setShowBanner]   = useState(false);
  const [mobileView,   setMobileView]   = useState("chat");
  const [planShared,   setPlanShared]   = useState(false);
  const [genError,     setGenError]     = useState(null);

  // ✅ Fetch all trips for dropdown
  useEffect(() => {
    API.get("/trips/my").then(r => setTrips(r.data)).catch(() => {});
  }, []);

  // ✅ If tripData wasn't passed via state, fetch it from API
  useEffect(() => {
    if (!selectedId) return;

    // Already have full data from navigation state
    if (stateData?.tripId === selectedId && stateData?.preferences) {
      setActiveTripData(stateData);
      setSelectedName(stateData.tripName);
      setShowBanner(stateData.preferences.length > 0);
      return;
    }

    // Fetch from API
    setTripLoading(true);
    Promise.all([
      API.get(`/trips/${selectedId}`),
      API.get(`/trips/${selectedId}/preferences`).catch(() => ({ data: [] })),
      API.get(`/trips/${selectedId}/members`).catch(() => ({ data: [] })),
    ])
      .then(([tripRes, prefsRes, membersRes]) => {
        const trip = tripRes.data;
        const data = {
          tripId:      selectedId,
          tripName:    trip.name,
          members:     membersRes.data,
          preferences: prefsRes.data,
        };
        setActiveTripData(data);
        setSelectedName(trip.name);
        setShowBanner(prefsRes.data.length > 0);
      })
      .catch(() => {
        setShowBanner(false);
      })
      .finally(() => setTripLoading(false));
  }, [selectedId]);

  // Load chat history
  useEffect(() => {
    setHistLoading(true);
    const url = selectedId ? `/ai/history?trip_id=${selectedId}` : "/ai/history";
    API.get(url)
      .then(r => {
        if (r.data.length > 0) {
          setMessages(r.data.map(m => ({ sender: m.sender, text: m.message })));
        } else {
          setMessages([{ sender: "ai", text: selectedId
            ? `Chat context loaded for **"${selectedName}"**. Ask me anything or generate a group plan!`
            : "Hello! I'm **YatraVerse AI** — your Nepal travel guide. Ask me about destinations, budgets, itineraries, or anything trip-related." }]);
        }
      })
      .catch(() => setMessages([{ sender: "ai", text: "Ready to help you plan your next adventure in Nepal!" }]))
      .finally(() => setHistLoading(false));
  }, [selectedId]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }, [input]);

  const persist = async (sender, message) => {
    try { await API.post("/ai/history", { sender, message, trip_id: selectedId }); } catch {}
  };

  const send = async (text) => {
    const msg = text || input.trim();
    if (!msg || loading) return;
    setMessages(p => [...p, { sender: "user", text: msg }]);
    setInput("");
    setLoading(true);
    await persist("user", msg);
    try {
      const res = await API.post("/ai/chat", { message: msg });
      setMessages(p => [...p, { sender: "ai", text: res.data.reply }]);
      await persist("ai", res.data.reply);
    } catch {
      setMessages(p => [...p, { sender: "ai", text: "Something went wrong. Please try again." }]);
    } finally { setLoading(false); }
  };

  const generatePlan = async (overrideDestination = null) => {
    // ✅ Use activeTripData instead of tripData
    if (!selectedId) {
      setMessages(p => [...p, { sender: "ai", text: "Please select a trip first." }]);
      return;
    }
    if (!activeTripData?.preferences?.length) {
      setMessages(p => [...p, {
        sender: "ai",
        text: "No preferences found for this trip. Make sure all members have submitted their preferences before generating a plan.",
      }]);
      return;
    }

    setGenerating(true);
    setGenError(null);

    const userMsg = overrideDestination
      ? `Generate the final AI trip recommendation specifically for **"${overrideDestination}"** based on our chat.`
      : `Generate the final AI trip recommendation for **"${activeTripData.tripName}"** based on all members' submitted preferences.`;
    setMessages(p => [...p, { sender: "user", text: userMsg }]);
    await persist("user", userMsg);

    try {
      await API.post("/ai/final-recommendation", {
        tripId:              selectedId,
        tripName:            activeTripData.tripName,
        members:             activeTripData.members,
        preferences:         activeTripData.preferences,
        chatHistory:         messages,
        overrideDestination,
      });

      const doneMsg = "Your group's final destination is ready! Taking you there now — every member can open the same page.";
      setMessages(p => [...p, { sender: "ai", text: doneMsg }]);
      await persist("ai", doneMsg);

      setPlanShared(true);
      setTimeout(() => navigate(`/planner/${selectedId}/destination`), 900);
    } catch (err) {
      const errMsg = err.response?.data?.error || "Failed to generate the final destination. Please try again.";
      setGenError(errMsg);
      setMessages(p => [...p, { sender: "ai", text: errMsg }]);
    } finally {
      setGenerating(false);
    }
  };

  const clearHistory = async () => {
    if (!window.confirm("Clear this chat history?")) return;
    try {
      await API.delete(selectedId ? `/ai/history?trip_id=${selectedId}` : "/ai/history");
      setMessages([{ sender: "ai", text: "Chat cleared. Ask me anything about Nepal travel!" }]);
    } catch { alert("Failed to clear."); }
  };

  const copyMsg = (text, i) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(i);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  const handlePlaceClick = (place) => {
    setMapQuery(place);
    setActivePlace(place);
    setAddedPlace(null);
    setMobileView("map");
  };

  const handleAddToTrip = async () => {
    if (!activePlace || !selectedId) return;
    setAddingPlace(true);
    try {
      await API.post(`/trips/${selectedId}/places`, { name: activePlace });
      setAddedPlace(activePlace);
    } catch {
      alert("Failed to add place to trip. Please try again.");
    } finally {
      setAddingPlace(false);
    }
  };

  useEffect(() => {
    const prevHtml = document.documentElement.style.overflow;
    const prevBody = document.body.style.overflow;
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = prevHtml;
      document.body.style.overflow = prevBody;
    };
  }, []);

  return (
    <DashboardLayout>
      <style>{`
        html, body { margin:0!important;padding:0!important;overflow:hidden!important;height:100%!important;scrollbar-width:thin;scrollbar-color:var(--border) var(--bg-subtle,transparent); }
        html::-webkit-scrollbar,body::-webkit-scrollbar{width:5px;height:5px}
        html::-webkit-scrollbar-track,body::-webkit-scrollbar-track{background:var(--bg-subtle,transparent)}
        html::-webkit-scrollbar-thumb,body::-webkit-scrollbar-thumb{background:var(--border);border-radius:999px;border:1px solid transparent;background-clip:padding-box}
        .av-scroll{scrollbar-width:thin;scrollbar-color:var(--border) var(--bg-subtle,transparent)}
        .av-scroll::-webkit-scrollbar{width:5px;height:5px}
        .av-scroll::-webkit-scrollbar-track{background:var(--bg-subtle,transparent);border-radius:999px;margin-block:4px}
        .av-scroll::-webkit-scrollbar-thumb{background:var(--border);border-radius:999px;transition:background .15s ease}
        .av-scroll::-webkit-scrollbar-thumb:hover{background:var(--accent)}
        .av-scroll-hidden::-webkit-scrollbar{display:none}
        .av-scroll-hidden{-ms-overflow-style:none;scrollbar-width:none}
      `}</style>

      {planShared && (
        <div className="fixed top-4 sm:top-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 px-4 sm:px-5 py-3 rounded-2xl shadow-xl text-xs sm:text-sm font-bold text-white bg-[var(--accent)] backdrop-blur-xl animate-[fadeInDown_0.3s_ease] max-w-[92vw]">
          <Check size={16} className="shrink-0" />
          <span className="truncate">Plan shared! All trip members can now view it in the Planner.</span>
        </div>
      )}

      <div className="fade-up relative flex h-[calc(100vh-75px)] max-h-[calc(100vh-75px)] gap-0 overflow-hidden">

        {/* ── LEFT: Chat Panel ── */}
        <div className={`flex flex-col flex-1 min-w-0 h-full px-3 sm:px-5 py-3 sm:py-5 overflow-hidden ${mobileView === "map" ? "hidden lg:flex" : "flex"}`}>

          {/* Header */}
          <div className="flex flex-wrap items-center justify-between gap-y-2 gap-x-3 mb-3 sm:mb-4 pb-3 sm:pb-4 border-b border-[var(--border)] shrink-0">
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-[var(--accent)]/10 flex items-center justify-center text-[var(--accent)] shrink-0">
                <Bot size={18} strokeWidth={1.8} />
              </div>
              <div className="min-w-0">
                <h1 className="cinzel text-lg sm:text-xl font-bold text-[var(--text)] truncate">AI Travel Assistant</h1>
                <p className="text-[11px] sm:text-xs text-[var(--text-dim)] truncate">Powered by YatraVerse · Nepal specialist</p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <div className="relative">
                <button
                  onClick={() => setShowTripDrop(!showTripDrop)}
                  className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] text-[11px] sm:text-xs text-[var(--text)] hover:bg-[var(--bg-subtle)] transition-colors cursor-pointer font-semibold max-w-[38vw] sm:max-w-none"
                >
                  <span className="truncate">{selectedName || "General Chat"}</span>
                  <ChevronDown size={12} className={`shrink-0 transition-transform duration-200 ${showTripDrop ? "rotate-180" : ""}`} />
                </button>
                {showTripDrop && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowTripDrop(false)} />
                    <div className="av-scroll absolute right-0 top-full mt-1.5 w-56 max-h-72 overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--bg-card)] shadow-xl z-20 animate-[fadeInDown_0.15s_ease]">
                      <button
                        onClick={() => { setSelectedId(null); setSelectedName(null); setActiveTripData(null); setShowBanner(false); setShowTripDrop(false); }}
                        className="w-full text-left px-4 py-2.5 text-xs text-[var(--text)] hover:bg-[var(--bg-subtle)] transition-colors border-none bg-transparent cursor-pointer font-semibold"
                      >
                        General Chat
                      </button>
                      {trips.map(t => (
                        <button
                          key={t.id}
                          onClick={() => { setSelectedId(t.id); setSelectedName(t.name); setActiveTripData(null); setShowTripDrop(false); }}
                          className="w-full text-left px-4 py-2.5 text-xs text-[var(--text)] hover:bg-[var(--bg-subtle)] transition-colors border-none bg-transparent cursor-pointer border-t border-[var(--border)]/50 truncate"
                        >
                          {t.name}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
              <button
                onClick={clearHistory}
                className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] text-[11px] sm:text-xs text-[var(--text-dim)] hover:text-red-500 hover:border-red-200 transition-colors cursor-pointer"
              >
                <Trash2 size={12} /> <span className="hidden sm:inline">Clear</span>
              </button>
            </div>
          </div>

          {/* ✅ Generate Banner — shows when trip has preferences */}
          {showBanner && activeTripData?.preferences?.length > 0 && (
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3 px-4 py-3 rounded-xl border border-[var(--accent)]/30 bg-[var(--accent)]/5 shrink-0">
              <div className="min-w-0">
                <p className="text-sm font-bold text-[var(--text)] truncate">{activeTripData.tripName}</p>
                <p className="text-xs text-[var(--text-dim)]">
                  {activeTripData.preferences.length} of {activeTripData.members?.length} members submitted preferences
                  {tripLoading && <span className="text-[var(--accent)]"> · Loading...</span>}
                  {genError && <span className="text-red-500 font-semibold"> · {genError}</span>}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-auto">
                <button
                  onClick={() => generatePlan()}
                  disabled={generating || tripLoading}
                  className="btn btn-primary flex items-center gap-2 px-4 py-2 text-xs disabled:opacity-50"
                >
                  <Sparkles size={13} />
                  {generating ? "Generating…" : "Generate Final Destination"}
                </button>
                <button
                  onClick={() => setShowBanner(false)}
                  className="w-6 h-6 flex items-center justify-center rounded-full text-[var(--text-dim)] hover:text-[var(--text)] hover:bg-[var(--bg-subtle)] border-none bg-transparent cursor-pointer text-base leading-none transition-colors"
                >×</button>
              </div>
            </div>
          )}

          {/* ✅ Show loading state while fetching trip data */}
          {tripLoading && (
            <div className="mb-3 px-4 py-2 rounded-xl bg-[var(--bg-subtle)] text-xs text-[var(--text-dim)] flex items-center gap-2 shrink-0">
              <Loader2 size={12} className="animate-spin text-[var(--accent)]" />
              Loading trip preferences...
            </div>
          )}

          {/* Chat Messages */}
          <div className="av-scroll flex-1 overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] flex flex-col p-3 sm:p-4 gap-3 min-h-0">
            {histLoading ? (
              <HistorySkeleton />
            ) : (
              <>
                {messages.map((msg, i) => (
                  <div key={i} className={`flex items-end gap-2 ${msg.sender === "user" ? "justify-end" : "justify-start"}`}>
                    {msg.sender === "ai" && (
                      <div className="hidden sm:flex w-6 h-6 rounded-full bg-[var(--accent)]/10 text-[var(--accent)] items-center justify-center shrink-0 mb-1">
                        <Bot size={13} strokeWidth={2} />
                      </div>
                    )}
                    <div className="relative group max-w-[88%] sm:max-w-[78%]">
                      <div className={`px-4 py-2.5 text-sm shadow-sm
                        ${msg.sender === "user"
                          ? "bubble-user rounded-2xl rounded-br-md"
                          : "bubble-ai text-[var(--text)] rounded-2xl rounded-bl-md"}`}>
                        {renderText(msg.text, handlePlaceClick)}
                      </div>
                      {msg.sender === "ai" && (
                        <button
                          onClick={() => copyMsg(msg.text, i)}
                          className="absolute -right-1 -bottom-6 sm:-right-7 sm:bottom-2 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity p-1 text-[var(--text-dim)] hover:text-[var(--text)] bg-transparent border-none cursor-pointer"
                        >
                          {copiedIdx === i ? <Check size={13} className="text-green-500" /> : <Copy size={13} />}
                        </button>
                      )}
                    </div>
                    {msg.sender === "user" && (
                      <div className="hidden sm:flex w-6 h-6 rounded-full bg-[var(--bg-subtle)] text-[var(--text-dim)] items-center justify-center shrink-0 mb-1">
                        <UserIcon size={12} strokeWidth={2} />
                      </div>
                    )}
                  </div>
                ))}
                {(loading || generating) && (
                  <div className="flex items-end gap-2 justify-start">
                    <div className="hidden sm:flex w-6 h-6 rounded-full bg-[var(--accent)]/10 text-[var(--accent)] items-center justify-center shrink-0 mb-1">
                      <Bot size={13} strokeWidth={2} />
                    </div>
                    <div className="bubble-ai rounded-2xl rounded-bl-md px-4 py-3 flex items-center gap-2 text-sm text-[var(--text-dim)]">
                      {generating ? (
                        <><Loader2 size={13} className="animate-spin text-[var(--accent)]" /> Formulating your trip plan…</>
                      ) : (
                        <TypingDots />
                      )}
                    </div>
                  </div>
                )}
                <div ref={endRef} />
              </>
            )}
          </div>

          {/* Suggestions */}
          <div className="relative shrink-0">
            <div className="av-scroll-hidden flex gap-2 overflow-x-auto py-2">
              {SUGGESTIONS.map((s, i) => (
                <button
                  key={i}
                  onClick={() => send(s)}
                  disabled={loading}
                  className="shrink-0 px-3 py-1.5 rounded-full border border-[var(--border)] bg-[var(--bg-card)] text-xs text-[var(--text-dim)] hover:text-[var(--accent)] hover:border-[var(--accent)]/50 hover:-translate-y-px transition-all cursor-pointer whitespace-nowrap disabled:opacity-40"
                >
                  {s}
                </button>
              ))}
            </div>
            <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-[var(--bg)] to-transparent sm:hidden" />
          </div>

          {/* Input */}
          <div className="flex items-end gap-2 sm:gap-3 shrink-0">
            <textarea
              ref={textareaRef}
              rows={1}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder={selectedId ? `Ask about ${selectedName}…` : "Ask anything about Nepal travel…"}
              disabled={loading || generating || histLoading}
              className="av-scroll flex-1 resize-none px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] text-sm text-[var(--text)] placeholder:text-[var(--text-dim)]/50 outline-none focus:border-[var(--accent)]/60 focus:ring-2 focus:ring-[var(--accent)]/10 transition-colors max-h-[140px] leading-relaxed"
            />
            <button
              onClick={() => send()}
              disabled={!input.trim() || loading || generating}
              className="btn btn-primary px-4 sm:px-5 h-[46px] flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
            >
              <Send size={14} /> <span className="hidden sm:inline">Send</span>
            </button>
          </div>
        </div>

        {/* Floating map toggle (mobile) */}
        {mobileView === "chat" && (
          <button
            onClick={() => setMobileView("map")}
            className="lg:hidden fixed bottom-24 right-4 z-30 flex items-center gap-2 pl-3.5 pr-4 py-2.5 rounded-full shadow-lg text-xs font-bold text-white bg-[var(--accent)] cursor-pointer border-none"
          >
            <Map size={14} />
            Map
            {activePlace && <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />}
          </button>
        )}

        {/* ── RIGHT: Map Panel ── */}
        <div className={`flex-col shrink-0 border-l border-[var(--border)] w-full h-full fixed inset-0 z-20 bg-[var(--bg)] lg:static lg:z-auto lg:basis-[38%] lg:w-auto ${mobileView === "map" ? "flex" : "hidden lg:flex"}`}>
          <div className="px-4 py-3 border-b border-[var(--border)] bg-[var(--bg-card)] flex items-center justify-between shrink-0 gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Map size={15} className="text-[var(--accent)] shrink-0" strokeWidth={2} />
              <span className="text-sm font-bold text-[var(--text)] truncate">
                {activePlace ? activePlace : "Map View"}
              </span>
              {activePlace && (
                <span className="hidden sm:inline text-[10px] px-2 py-0.5 rounded-full bg-[var(--accent)]/10 text-[var(--accent)] font-semibold shrink-0">
                  Nepal
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {activePlace && selectedId && activeTripData?.preferences?.length > 0 && (
                <button
                  onClick={() => generatePlan(activePlace)}
                  disabled={generating}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border-none cursor-pointer disabled:cursor-not-allowed bg-[var(--accent)] text-white hover:opacity-90"
                >
                  {generating
                    ? <><Loader2 size={12} className="animate-spin" /> Generating…</>
                    : <><Sparkles size={12} /> <span className="hidden sm:inline">Set as Final Destination</span></>}
                </button>
              )}
              {activePlace && selectedId && (
                <button
                  onClick={handleAddToTrip}
                  disabled={addingPlace || !!addedPlace}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border-none cursor-pointer disabled:cursor-not-allowed"
                  style={{
                    background: addedPlace ? "rgba(34,197,94,0.1)" : "var(--bg-subtle)",
                    color: addedPlace ? "#22c55e" : "var(--text)",
                    border: "1px solid var(--border)",
                    opacity: addingPlace ? 0.6 : 1,
                  }}
                >
                  {addedPlace
                    ? <><Check size={12} /> Added!</>
                    : addingPlace
                    ? <><Loader2 size={12} className="animate-spin" /> Adding…</>
                    : <><Plus size={12} /> <span className="hidden sm:inline">Add to Trip Places</span></>}
                </button>
              )}
              <button
                onClick={() => setMobileView("chat")}
                className="lg:hidden w-7 h-7 flex items-center justify-center rounded-full text-[var(--text-dim)] hover:text-[var(--text)] hover:bg-[var(--bg-subtle)] border-none bg-transparent cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          <div className="flex-1 relative min-h-0">
            <MapComponent selectedDestination={mapQuery} />
            {!activePlace && (
              <div
                className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full text-xs font-semibold text-[var(--text-dim)] flex items-center gap-2 pointer-events-none max-w-[90%] text-center"
                style={{ background: "var(--bg-card)", border: "1px solid var(--border)", backdropFilter: "blur(8px)" }}
              >
                <MapPin size={12} className="text-[var(--accent)] shrink-0" />
                <span className="truncate">Click a highlighted place in chat to explore it here</span>
              </div>
            )}
          </div>
        </div>

      </div>
    </DashboardLayout>
  );
}