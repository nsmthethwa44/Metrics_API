import express from "express";
import mysql from "mysql";
import cors from "cors";
import cookieParser from "cookie-parser";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import multer from "multer";
import path from "path";
import dotenv from "dotenv";
dotenv.config(); // Load .env variables

const app = express();
app.use(cookieParser());

app.use(
  cors({
    origin: ["https://metricssite.netlify.app"],
    credentials: true,
    methods: ["POST", "GET", "PUT", "DELETE"],
  })
);

app.use(express.json());
app.use(express.static("public"));

// Configure connection pool
const pool = mysql.createPool({
  connectionLimit: 10, // Adjust the limit as per your needs
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  connectTimeout: 30000,  // Increase timeout to 30 seconds
  timeout: 30000          // Set connection timeout
});

// Helper function to query using the connection pool
const query = (sql, values = []) =>
  new Promise((resolve, reject) => {
    pool.query(sql, values, (err, results) => {
      if (err) return reject(err);
      resolve(results);
    });
  });



const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "./public/images");
  },
  filename: (req, file, cb) => {
    cb(null, file.fieldname + "_" + Date.now() + path.extname(file.originalname));
  },
});

const upload = multer({
  storage: storage,
});


// ###########Manage-Users##############

// adding new users
const saltRounds = 10;

app.post("/addNewUser", upload.single("photo"), async (req, res) => {
  const { name, email, role, password } = req.body;
  const photo = req.file?.filename || null;
  try {
    const existingUser = await query("SELECT * FROM users WHERE email = ?", [email]);
    if (existingUser.length > 0) {
      return res.status(409).json({
        Status: "Exists",
        message: "User already exists. Please log in.",
      });
    }
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    const sql =
      "INSERT INTO users (`name`, `email`, `role`, `password`, `photo`) VALUES (?)";
    const values = [name, email, role, hashedPassword, photo];
    await query(sql, [values]);
    res.json({ Status: "Success", message: "User successfully added!" });
  } catch (err) {
    console.error("Error:", err);
    res.status(500).json({ error: "An error occurred while adding the user." });
  }
});

// getting all users
app.get("/getUsers", async (req, res) => {
  try {
    const users = await query("SELECT * FROM users ORDER BY id DESC");
    res.json({ Status: "Success", Result: users });
  } catch (err) {
    console.error("Error fetching users:", err);
    res.json({ Error: "Get users data error in SQL" });
  }
});

// remove user data
app.delete("/deleteUser/:id", async (req, res) => {
  const { id } = req.params;
  try {
    await query("DELETE FROM users WHERE id = ?", [id]);
    res.json({ Status: "Success" });
  } catch (err) {
    console.error("Error deleting user:", err);
    res.json({ Error: "Delete data error in SQL" });
  }
});

// count users
app.get("/usersCount", async (req, res) => {
  try {
    const count = await query("SELECT COUNT(id) AS users FROM users");
    res.json(count);
  } catch (err) {
    console.error("Error counting users:", err);
    res.json({ Error: "Error in running users count query" });
  }
});

// user login
app.post("/userLogin", async (req, res) => {
  const { email, password } = req.body;
  try {
    const users = await query("SELECT * FROM users WHERE email = ?", [email]);
    if (users.length === 0) {
      return res
        .status(401)
        .json({ Status: "Error", message: "User not found. Please register." });
    }
    const user = users[0];
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ Status: "Error", message: "Incorrect password." });
    }
    const token = jwt.sign(
      { id: user.id, name: user.name, email: user.email, photo: user.photo },
      "jwt-secret-key",
      { expiresIn: "1d" }
    );
    res.cookie("token", token);
    res.json({
      Status: "Success",
      message: "Login successful!",
      token,
      user: { id: user.id, name: user.name, email: user.email, photo: user.photo },
    });
  } catch (err) {
    console.error("Error logging in user:", err);
    res.status(500).json({ error: "An error occurred during login." });
  }
});

// ###########End-Manage-Users###########

// Repeat similar refactoring for Manage-Campaigns, Donations, and other sections
// Use `query` for all database operations

// ###########Manage-Campaigns##############

// Adding new campaign
app.post("/addNewCampaign", upload.single("photo"), async (req, res) => {
  const { name, description, goal, startDate, endDate } = req.body;
  const photo = req.file?.filename || null;
  try {
    const sql =
      "INSERT INTO campaigns (`name`, `description`, `goal`, `startDate`, `endDate`, `photo`) VALUES (?)";
    const values = [name, description, goal, startDate, endDate, photo];
    await query(sql, [values]);
    res.json({ Status: "Success", message: "Campaign successfully added!" });
  } catch (err) {
    console.error("Error adding campaign:", err);
    res.status(500).json({ error: "An error occurred while adding the campaign." });
  }
});

// Getting all campaigns
app.get("/getCampaigns", async (req, res) => {
  try {
    const campaigns = await query("SELECT * FROM campaigns ORDER BY id DESC");
    res.json({ Status: "Success", Result: campaigns });
  } catch (err) {
    console.error("Error fetching campaigns:", err);
    res.json({ Error: "Get campaigns data error in SQL" });
  }
});

// Remove campaign
app.delete("/deleteCampaign/:id", async (req, res) => {
  const { id } = req.params;
  try {
    await query("DELETE FROM campaigns WHERE id = ?", [id]);
    res.json({ Status: "Success" });
  } catch (err) {
    console.error("Error deleting campaign:", err);
    res.json({ Error: "Delete campaign error in SQL" });
  }
});

// Count campaigns
app.get("/campaignsCount", async (req, res) => {
  try {
    const count = await query("SELECT COUNT(id) AS campaigns FROM campaigns");
    res.json(count);
  } catch (err) {
    console.error("Error counting campaigns:", err);
    res.json({ Error: "Error in running campaigns count query" });
  }
});

// ###########Manage-Donations##############

// Add new donation
app.post("/addNewDonation", async (req, res) => {
  const { campaignId, donorName, amount, donationDate } = req.body;
  try {
    const sql =
      "INSERT INTO donations (`campaignId`, `donorName`, `amount`, `donationDate`) VALUES (?)";
    const values = [campaignId, donorName, amount, donationDate];
    await query(sql, [values]);
    res.json({ Status: "Success", message: "Donation successfully added!" });
  } catch (err) {
    console.error("Error adding donation:", err);
    res.status(500).json({ error: "An error occurred while adding the donation." });
  }
});

// Get all donations
app.get("/getDonations", async (req, res) => {
  try {
    const donations = await query(
      "SELECT d.*, c.name AS campaignName FROM donations d JOIN campaigns c ON d.campaignId = c.id ORDER BY d.id DESC"
    );
    res.json({ Status: "Success", Result: donations });
  } catch (err) {
    console.error("Error fetching donations:", err);
    res.json({ Error: "Get donations data error in SQL" });
  }
});

// Remove donation
app.delete("/deleteDonation/:id", async (req, res) => {
  const { id } = req.params;
  try {
    await query("DELETE FROM donations WHERE id = ?", [id]);
    res.json({ Status: "Success" });
  } catch (err) {
    console.error("Error deleting donation:", err);
    res.json({ Error: "Delete donation error in SQL" });
  }
});

// Count donations
app.get("/donationsCount", async (req, res) => {
  try {
    const count = await query("SELECT COUNT(id) AS donations FROM donations");
    res.json(count);
  } catch (err) {
    console.error("Error counting donations:", err);
    res.json({ Error: "Error in running donations count query" });
  }
});

// ###########Miscellaneous##############

// Logout user
app.post("/logout", (req, res) => {
  res.clearCookie("token");
  res.json({ Status: "Success", message: "Logged out successfully!" });
});

// Home route (for testing)
app.get("/", (req, res) => {
  res.json("Welcome to the API!");
});

// ###########Server Configuration##############
const PORT = process.env.PORT || 8081;

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

