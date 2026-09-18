const crypto = require("crypto");
const multer = require("multer");
const pool = require("../config/db");
const { uploadToCloudinary } = require("../utils/cloudinary");

const upload = multer({ storage: multer.memoryStorage() });

exports.upload = upload;

exports.createTrip = async (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: "Trip name is required" });
  }

  try {
    let imageUrl = null;
    if (req.file) {
      const result = await uploadToCloudinary(req.file.buffer);
      imageUrl = result.secure_url;
    }

    const inviteCode = crypto.randomBytes(4).toString("hex");

    const tripResult = await pool.query(
      `INSERT INTO trips (name, admin_id, invite_code, image) VALUES ($1, $2, $3, $4) RETURNING *`,
      [name.trim(), req.userId, inviteCode, imageUrl]
    );
    const trip = tripResult.rows[0];

    await pool.query(
      `INSERT INTO trip_members (trip_id, user_id, role) VALUES ($1, $2, 'admin')`,
      [trip.id, req.userId]
    );

    res.json({ trip });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create trip" });
  }
};

exports.previewTrip = async (req, res) => {
  const { inviteCode } = req.params;
  try {
    const result = await pool.query(
      `SELECT trips.id, trips.name, users.name AS admin_name
       FROM trips
       JOIN users ON trips.admin_id = users.id
       WHERE trips.invite_code = $1`,
      [inviteCode]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Invalid or expired invite link" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load trip" });
  }
};

exports.joinTrip = async (req, res) => {
  const { inviteCode } = req.params;
  try {
    const tripResult = await pool.query("SELECT * FROM trips WHERE invite_code=$1", [inviteCode]);
    if (tripResult.rows.length === 0) {
      return res.status(404).json({ error: "Invalid or expired invite link" });
    }
    const trip = tripResult.rows[0];

    const existing = await pool.query(
      "SELECT * FROM trip_members WHERE trip_id=$1 AND user_id=$2",
      [trip.id, req.userId]
    );
    if (existing.rows.length > 0) {
      return res.json({ message: "Already a member", tripId: trip.id });
    }

    await pool.query(
      `INSERT INTO trip_members (trip_id, user_id, role) VALUES ($1, $2, 'member')`,
      [trip.id, req.userId]
    );
    res.json({ message: "Joined trip successfully", tripId: trip.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to join trip" });
  }
};

exports.listMyTrips = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT trips.id, trips.name, trips.invite_code, trips.image, trip_members.role
       FROM trips
       JOIN trip_members ON trips.id = trip_members.trip_id
       WHERE trip_members.user_id = $1
       ORDER BY trips.created_at DESC`,
      [req.userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load trips" });
  }
};

exports.getTrip = async (req, res) => {
  const { id } = req.params;
  try {
    const trip = await pool.query("SELECT * FROM trips WHERE id=$1", [id]);
    const members = await pool.query(
      `SELECT users.id, users.name, users.email, trip_members.role, trip_members.has_accepted_recommendation
       FROM trip_members
       JOIN users ON trip_members.user_id = users.id
       WHERE trip_members.trip_id = $1`,
      [id]
    );
    res.json({ trip: trip.rows[0], members: members.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load trip" });
  }
};

exports.deleteTrip = async (req, res) => {
  const { id } = req.params;
  try {
    if (req.membership.role !== "admin") {
      return res.status(403).json({ error: "Only the trip admin can delete this trip" });
    }
    await pool.query("DELETE FROM trips WHERE id=$1", [id]);
    res.json({ message: "Trip deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete trip" });
  }
};

exports.acceptRecommendation = async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query(
      `UPDATE trip_members SET has_accepted_recommendation = true 
       WHERE trip_id = $1 AND user_id = $2`,
      [id, req.userId]
    );

    const membersRes = await pool.query(
      `SELECT COUNT(*) as total, 
       SUM(CASE WHEN has_accepted_recommendation THEN 1 ELSE 0 END) as accepted 
       FROM trip_members WHERE trip_id = $1`,
      [id]
    );

    const { total, accepted } = membersRes.rows[0];
    const isMajority = parseInt(accepted) > parseInt(total) / 2;

    if (isMajority) {
      await pool.query(
        `UPDATE trips SET status = 'destination_confirmed' WHERE id = $1 AND status != 'destination_confirmed'`,
        [id]
      );

      const membersList = await pool.query(`SELECT user_id FROM trip_members WHERE trip_id = $1`, [id]);
      for (const m of membersList.rows) {
        await pool.query(
          `INSERT INTO notifications (user_id, trip_id, type, message, link) 
           VALUES ($1, $2, 'destination_confirmed', 'The majority has spoken! The destination for your trip is confirmed.', '/planner/${id}')`,
          [m.user_id, id]
        );
      }

      // Automatically store the AI's structured places into the permanent trip_places table
      const tripRes = await pool.query(`SELECT final_destination_data, admin_id FROM trips WHERE id = $1`, [id]);
      const data = tripRes.rows[0]?.final_destination_data;
      const adminId = tripRes.rows[0]?.admin_id;
      
      if (data && data.itinerary && Array.isArray(data.itinerary)) {
        for (const day of data.itinerary) {
          if (day.places && Array.isArray(day.places)) {
            for (const p of day.places) {
              await pool.query(
                `INSERT INTO trip_places (trip_id, user_id, name, address, lat, lng, place_id)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [id, adminId, p.name, `Day ${day.day}: ${p.details || 'AI Suggestion'}`, null, null, null]
              );
            }
          }
        }
      }
    }

    res.json({ message: "Recommendation accepted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to accept recommendation" });
  }
};
