const express = require("express");
const cors = require("cors");
require("dotenv").config();

const pool = require("./config/db");
const authRoutes = require("./routes/auth");
const tripsRoutes = require("./routes/trips");
const preferencesRoutes = require("./routes/preferences");
const placesRoutes = require("./routes/places");
const expensesRoutes = require("./routes/expenses");
const aiRoutes = require("./routes/ai");
const tripPlanRoutes = require("./routes/tripPlan");
const notificationsRoutes = require("./routes/notifications");
const commentsRoutes = require("./routes/comments");
const migrateWorkflow = require("./migrate_workflow");

const app = express();

const allowedOrigins = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  process.env.LOCAL_URL,
  process.env.NGROK_URL,
  process.env.PROD_URL,
].filter(Boolean);

app.use(cors({
  origin:(origin, callback) => {
    if (!origin) return callback(null, true);

    const isLocalDevOrigin = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
    if (allowedOrigins.includes(origin) || isLocalDevOrigin) return callback(null, true);
     console.log("CORS rejected origin:", origin);
    callback(new Error("Not allowed by CORS"));
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "ngrok-skip-browser-warning"],
  credentials: true,
}));
app.options(/.*/, cors());

app.use(express.json());

app.get("/", (req, res) => res.send("AI Trip Backend Running"));

if (process.env.NODE_ENV !== "production") {
  app.get("/db-test", async (req, res) => {
    try {
      const result = await pool.query("SELECT NOW()");
      res.json(result.rows[0]);
    } catch (err) {
      res.status(500).json({ error: "DB connection failed" });
    }
  });
}

app.use("/api/auth", authRoutes);

// All four share the /api/trips base — each file's internal routes
// already start with "/:id/...", so URLs are unchanged from before the split
app.use("/api/trips", tripsRoutes);
app.use("/api/trips", preferencesRoutes);
app.use("/api/trips", placesRoutes);
app.use("/api/trips", expensesRoutes);
app.use("/api/trips", tripPlanRoutes);

app.use("/api/ai", aiRoutes);
app.use("/api/notifications", notificationsRoutes);
app.use("/api/trips", commentsRoutes); // Will handle /api/trips/:id/comments

// Temporary endpoint for DB migration
app.get("/api/migrate-workflow", async (req, res) => {
  try {
    const result = await migrateWorkflow();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.use((req, res) => res.status(404).json({ error: "Route not found" }));

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ error: err.message || "Internal server error" });
});

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));