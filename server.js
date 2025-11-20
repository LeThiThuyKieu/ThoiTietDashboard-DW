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

// Serve the main page
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// API to get available cities
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

// API to get current weather data (latest record)
app.get("/api/current", async (req, res) => {
  const { city } = req.query;

  if (!city) {
    return res.status(400).json({ error: "Missing city query parameter" });
  }

  try {
    const [rows] = await pool.query(
      `
        SELECT
          d.full_date AS date,
          f.temperature_2m AS temperature,
          f.humidity_2m AS humidity,
          f.loaded_at
        FROM fact_weather f
        JOIN dim_date d ON f.date_key = d.date_key
        JOIN dim_location l ON f.location_key = l.location_key
        WHERE l.city = ?
        ORDER BY d.full_date DESC, f.loaded_at DESC
        LIMIT 1
      `,
      [city]
    );

    res.json(rows[0] || null);
  } catch (error) {
    console.error("Error fetching current weather data:", error);
    res.status(500).json({ error: "Failed to fetch current weather data" });
  }
});

// API to get weather data with date filters
app.get("/api/temperature", async (req, res) => {
  const { city, from, to } = req.query;

  if (!city) {
    return res.status(400).json({ error: "Missing city query parameter" });
  }

  try {
    let query = `
      SELECT
        d.full_date AS date,
        f.temperature_2m AS temperature,
        f.humidity_2m AS humidity,
        f.loaded_at
      FROM fact_weather f
      JOIN dim_date d ON f.date_key = d.date_key
      JOIN dim_location l ON f.location_key = l.location_key
      WHERE l.city = ?
    `;

    const params = [city];

    // Add date filters
    if (from && to) {
      query += " AND d.full_date BETWEEN ? AND ?";
      params.push(from, to);
    } else if (from) {
      query += " AND d.full_date >= ?";
      params.push(from);
    } else if (to) {
      query += " AND d.full_date <= ?";
      params.push(to);
    }

    query += " ORDER BY d.full_date";

    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (error) {
    console.error("Error fetching weather data:", error);
    res.status(500).json({ error: "Failed to fetch weather data" });
  }
});

// API to get weather summary
app.get("/api/summary", async (req, res) => {
  const { city, from, to } = req.query;

  if (!city) {
    return res.status(400).json({ error: "Missing city query parameter" });
  }

  try {
    let query = `
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
      JOIN dim_date d ON f.date_key = d.date_key
      WHERE l.city = ?
    `;

    const params = [city];

    // Add date filters
    if (from && to) {
      query += " AND d.full_date BETWEEN ? AND ?";
      params.push(from, to);
    } else if (from) {
      query += " AND d.full_date >= ?";
      params.push(from);
    } else if (to) {
      query += " AND d.full_date <= ?";
      params.push(to);
    }

    const [rows] = await pool.query(query, params);
    res.json(rows[0] || {
      days: 0,
      avg_temp: 0,
      min_temp: 0,
      max_temp: 0,
      avg_humidity: 0,
      min_humidity: 0,
      max_humidity: 0
    });
  } catch (error) {
    console.error("Error fetching summary data:", error);
    res.status(500).json({ error: "Failed to fetch summary data" });
  }
});

// API to get comparison data for multiple cities
app.get("/api/compare", async (req, res) => {
  const { cities } = req.query;

  if (!cities) {
    return res.status(400).json({ error: "Missing cities query parameter" });
  }

  try {
    const cityList = Array.isArray(cities) ? cities : cities.split(',');
    const placeholders = cityList.map(() => '?').join(',');
    
    const query = `
      SELECT
        l.city,
        AVG(f.temperature_2m) AS avg_temp,
        AVG(f.humidity_2m) AS avg_humidity
      FROM fact_weather f
      JOIN dim_location l ON f.location_key = l.location_key
      WHERE l.city IN (${placeholders})
      GROUP BY l.city
    `;

    const [rows] = await pool.query(query, cityList);
    res.json(rows);
  } catch (error) {
    console.error("Error fetching comparison data:", error);
    res.status(500).json({ error: "Failed to fetch comparison data" });
  }
});

// API to export data as CSV
app.get("/api/export/csv", async (req, res) => {
  const { city, from, to } = req.query;

  if (!city) {
    return res.status(400).json({ error: "Missing city query parameter" });
  }

  try {
    let query = `
      SELECT
        d.full_date AS date,
        l.city,
        f.temperature_2m AS temperature,
        f.humidity_2m AS humidity,
        f.loaded_at
      FROM fact_weather f
      JOIN dim_date d ON f.date_key = d.date_key
      JOIN dim_location l ON f.location_key = l.location_key
      WHERE l.city = ?
    `;

    const params = [city];

    // Add date filters
    if (from && to) {
      query += " AND d.full_date BETWEEN ? AND ?";
      params.push(from, to);
    } else if (from) {
      query += " AND d.full_date >= ?";
      params.push(from);
    } else if (to) {
      query += " AND d.full_date <= ?";
      params.push(to);
    }

    query += " ORDER BY d.full_date";

    const [rows] = await pool.query(query, params);

    // Convert to CSV
    let csv = 'Ngày,Thành phố,Nhiệt độ (°C),Độ ẩm (%),Thời gian cập nhật\n';
    rows.forEach(row => {
      const date = new Date(row.date).toLocaleDateString('vi-VN');
      const loadedAt = row.loaded_at ? new Date(row.loaded_at).toLocaleString('vi-VN') : 'N/A';
      csv += `"${date}","${row.city}",${row.temperature},${row.humidity},"${loadedAt}"\n`;
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=weather_data_${city}.csv`);
    res.send(csv);
  } catch (error) {
    console.error("Error exporting data:", error);
    res.status(500).json({ error: "Failed to export data" });
  }
});

// Demo data endpoint for testing
app.get("/api/demo/data", async (req, res) => {
  const { city, from, to } = req.query;
  
  // Generate demo data
  const demoData = [];
  const startDate = from ? new Date(from) : new Date('2024-01-01');
  const endDate = to ? new Date(to) : new Date('2024-01-31');
  
  let currentDate = new Date(startDate);
  while (currentDate <= endDate) {
    demoData.push({
      date: currentDate.toISOString().split('T')[0],
      temperature: 20 + Math.random() * 15, // 20-35°C
      humidity: 50 + Math.random() * 40, // 50-90%
      loaded_at: new Date(currentDate.getTime() + 8 * 60 * 60 * 1000).toISOString() // +8 hours
    });
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  res.json(demoData);
});

app.get("/api/demo/cities", async (req, res) => {
  res.json([
    { city: "Hà Nội" },
    { city: "Hồ Chí Minh" },
    { city: "Đà Nẵng" },
    { city: "Hải Phòng" },
    { city: "Cần Thơ" }
  ]);
});

app.get("/api/demo/current", async (req, res) => {
  const { city } = req.query;
  res.json({
    date: new Date().toISOString().split('T')[0],
    temperature: 25 + Math.random() * 10,
    humidity: 60 + Math.random() * 30,
    loaded_at: new Date().toISOString()
  });
});

app.get("/api/demo/summary", async (req, res) => {
  const { city, from, to } = req.query;
  res.json({
    days: 30,
    avg_temp: 27.5,
    min_temp: 20.1,
    max_temp: 34.8,
    avg_humidity: 75.2,
    min_humidity: 52.3,
    max_humidity: 89.7
  });
});

app.get("/api/demo/compare", async (req, res) => {
  const { cities } = req.query;
  const cityList = Array.isArray(cities) ? cities : cities.split(',');
  
  const result = cityList.map(city => ({
    city: city,
    avg_temp: 25 + Math.random() * 8,
    avg_humidity: 65 + Math.random() * 25
  }));
  
  res.json(result);
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`Demo mode available - using demo endpoints`);
});