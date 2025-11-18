const express = require("express");
const mysql = require("mysql2/promise");
const cors = require("cors");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

const pool = mysql.createPool({
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "datawarehouse",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.get("/api/cities", async (_req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT DISTINCT city FROM dim_location ORDER BY city"
    );
    res.json(rows);
  } catch (error) {
    console.error("Error fetching cities:", error);
    res.status(500).json({ error: "Failed to fetch cities" });
  }
});

app.get("/api/temperature", async (req, res) => {
  const { city } = req.query;

  if (!city) {
    return res.status(400).json({ error: "Missing city query parameter" });
  }

  try {
    const [rows] = await pool.query(
      `
        SELECT
          d.full_date AS date,
          d.day_of_week,
          d.calendar_month,
          d.calendar_year,
          f.temperature_2m AS temperature,
          f.humidity_2m AS humidity
        FROM fact_weather f
        JOIN dim_date d ON f.date_key = d.date_key
        JOIN dim_location l ON f.location_key = l.location_key
        WHERE l.city = ?
        ORDER BY d.full_date
        LIMIT 365
      `,
      [city]
    );

    res.json(rows);
  } catch (error) {
    console.error("Error fetching weather data:", error);
    res.status(500).json({ error: "Failed to fetch weather data" });
  }
});

// API summary: min / max / avg cho 1 thành phố
app.get("/api/summary", async (req, res) => {
  const { city } = req.query;

  if (!city) {
    return res.status(400).json({ error: "Missing city query parameter" });
  }

  try {
    const [rows] = await pool.query(
      `
        SELECT
          COUNT(*) AS days,
          AVG(f.temperature_2m) AS avg_temp,
          MIN(f.temperature_2m) AS min_temp,
          MAX(f.temperature_2m) AS max_temp,
          AVG(f.humidity_2m) AS avg_humidity,
          MIN(f.humidity_2m) AS min_humidity,
          MAX(f.humidity_2m) AS max_humidity
        FROM fact_weather f
        JOIN dim_location l ON f.location_key = l.location_key
        WHERE l.city = ?
      `,
      [city]
    );

    res.json(rows[0] || null);
  } catch (error) {
    console.error("Error fetching summary data:", error);
    res.status(500).json({ error: "Failed to fetch summary data" });
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
