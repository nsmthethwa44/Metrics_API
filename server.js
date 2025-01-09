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
app.post("/createCampaign", upload.single("image"), async (req, res) => {
  const { name, description, goal, startDate, endDate } = req.body;
  const image = req.file?.filename || null;
  try {
    const sql =
      "INSERT INTO campaigns (`name`, `description`, `goal`, `startDate`, `endDate`, `photo`) VALUES (?)";
    const values = [name, description, goal, startDate, endDate, image];
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

// update campaign status 
app.put("/updateCampaignStatus/:id", (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
  
    const sql = "UPDATE campaigns SET status = ? WHERE id = ?";
    con.query(sql, [status, id], (err, result) => {
        if (err) {
            return res.json({ Status: "Error", Error: "Error updating campaign status" });
        }
        return res.json({ Status: "Success", Message: "Campaign status updated successfully" });
    });
  });
  
    
  // count active or inactive campaign status 
app.get('/countAllCampaignsStatus', (req, res) => {
    // SQL query to count statuses
    const sql = `SELECT status, COUNT(*) as count FROM campaigns GROUP BY status`;
    con.query(sql, (error, rows) => {
      if (error) {
        console.error('Error counting campaign statuses:', error);
        return res.status(500).json({ success: false, message: 'Error counting statuses' });
      }
      // Structure the response
      const statusCounts = {
        active: 0,
        inactive: 0,
      };
      rows.forEach(row => {
        statusCounts[row.status.toLowerCase()] = row.count;
      });
  
      res.json({ success: true, result: statusCounts });
    });
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

// updating campaign funds
app.put('/updateRaisedAmount', (req, res) => {
    const updateSql = `
      UPDATE campaigns
      SET raised = (
        SELECT COALESCE(SUM(d.amount), 0)
        FROM donations d
        WHERE d.campaign_id = campaigns.id
      );
    `;
  
    con.query(updateSql, (err) => {
      if (err) return res.json({ Error: "SQL Error" });
  
      // Fetch updated campaigns
      const fetchSql = `SELECT * FROM campaigns`;
  
      con.query(fetchSql, (err, result) => {
        if (err) return res.json({ Error: "SQL Fetch Error" });
        return res.json({ Status: "Success", Result: result });
      });
    });
  });

// ###########Manage-Donations##############

// Add new donation
app.post("/addToDonations", async (req, res) => {
   const { user_id, campaign_id, amount,  message} = req.body;
  if (!user_id || !campaign_id || !amount || !message) {
    return res.status(400).json({ error: "All fields are required!" });
}
  try {
    const sql = "INSERT INTO donations (`user_id`, `campaign_id`, `amount`, `message`) VALUES (?)";
    const values = [user_id, campaign_id, amount, message];
    await query(sql, [values]);
    res.json({ Status: "Success", message: "Donation successfully added!" });
  } catch (err) {
    console.error("Error adding donation:", err);
    res.status(500).json({ error: "An error occurred while adding the donation." });
  }
});

app.get("/getMyDonations/:user_id", (req, res) => {
    const { user_id } = req.params;
    const sql = `
    SELECT 
    c.id, 
    c.title, 
    c.image, 
    d.amount, 
    d.message, 
    d.date,
    u.name, 
    u.photo
    FROM campaigns c 
    LEFT JOIN 
    donations d ON c.id = d.campaign_id
    LEFT JOIN 
    users u ON d.user_id  = u.id WHERE d.user_id = ?; 
    `;
    con.query(sql, [user_id], (err, results) => {
      if (err) {
        console.error("Error fetching donations data:", err);
        return res.status(500).json({ success: false, message: "Server error" });
      }
      res.json({ success: true, Result: results });
    });
  });

// Get all donations
// app.get("/getDonations", async (req, res) => {
//   try {
//     const donations = await query(
//       "SELECT d.*, c.name AS campaignName FROM donations d JOIN campaigns c ON d.campaignId = c.id ORDER BY d.id DESC"
//     );
//     res.json({ Status: "Success", Result: donations });
//   } catch (err) {
//     console.error("Error fetching donations:", err);
//     res.json({ Error: "Get donations data error in SQL" });
//   }
// });

app.get("/getDonations", (req, res) => {
  const sql = `
    SELECT 
       d.id,
      d.message, 
      d.date, 
      d.amount, 
      c.title, 
      c.image, 
      u.name,
      u.photo
    FROM 
      donations d 
    JOIN 
      users u ON d.user_id = u.id 
  JOIN 
      campaigns c ON d.campaign_id = c.id
    ORDER BY 
      d.date DESC
  `;
  
  con.query(sql, (err, result) => {
    if (err) {
      console.error("SQL Error:", err); // Log the actual SQL error
      return res.json({ Error: "Get donations data error in SQL" });
    }
    return res.json({ Status: "Success", Result: result });
  });
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

// add user donation 
app.post("/addToDonations", (req, res) => {
  const { user_id, campaign_id, amount,  message} = req.body;
  if (!user_id || !campaign_id || !amount || !message) {
    return res.status(400).json({ error: "All fields are required!" });
}
  const sql = "INSERT INTO donations (`user_id`, `campaign_id`, `amount`, `message`) VALUES (?)";
  const values = [user_id, campaign_id, amount, message];

  con.query(sql, [values], (err, result) => {
    if (err) {
      console.error("Database Error:", err);
      return res.status(500).json({ error: "Failed to insert data." });
    }
    res.json({Status: "Success"})
  });
});

// ###########Miscellaneous##############

// Get leaderboard data
app.get('/getLeaderboard', (req, res) => {
  const sql = `
    SELECT 
        ROW_NUMBER() OVER (ORDER BY SUM(d.amount) DESC) AS rank,
        u.name AS contributor_name,
        u.photo,
        SUM(d.amount) AS total_donations,
        COUNT(d.id) AS number_of_donations,
        MAX(d.date) AS last_donation_date,
        COUNT(DISTINCT d.campaign_id) AS campaigns_supported
    FROM donations d
    JOIN users u ON d.user_id = u.id
    GROUP BY u.id
    ORDER BY total_donations DESC
  `;
  
  con.query(sql, (err, results) => {
    if (err) {
      console.error("SQL Error:", err); // Log the actual SQL error
      return res.json({ Error: "Get donations data error in SQL" });
    }
    return res.json({ Status: "Success", Result: results });
  });
});


// ###########Manage-Admin############## 
// admin register 
app.post("/addNewAdmin", upload.single("photo"), (req, res) => {
  const { name, email, password } = req.body;
  const photo = req.file?.filename || null;
  const searchSql = "SELECT * FROM admins WHERE email = ?";
  con.query(searchSql , [email], (err, results) => {
    if (err) {
      console.error("Database Error:", err);
      return res.status(500).json({ error: "Database error occurred." });
    }
    if (results.length > 0) {
      console.log("Admin already exists");
      return res.status(409).json({
        Status: "Exists",
        message: "Admin already exists. Please log in.",
      });
    } else {
      bcrypt.hash(password, saltRounds, (hashErr, hashedPassword) => {
        if (hashErr) {
          console.error("Hashing Error:", hashErr);
          return res.status(500).json({ error: "Failed to hash password." });
        }
        const sql = "INSERT INTO admins (`name`, `email`,  `password`, `photo`) VALUES (?)";
        const values = [name, email, hashedPassword, photo];
        con.query(sql, [values], (insertErr, result) => {
          if (insertErr) {
            console.error("Insert Error:", insertErr);
            return res
              .status(500)
              .json({ error: "Failed to insert admin details." });
          }
          res.json({ Status: "Success", message: "Admin successfully added!" });
        });
      });
    }
  });
});

//  user login 
app.post("/adminLogin", (req, res) => {
  const { email, password } = req.body;
  const sql = "SELECT * FROM admins WHERE email = ?";
  con.query(sql, [email], (err, results) => {
    if (err) {
      console.error("Database Error:", err);
      return res.status(500).json({ error: "Database error occurred." });
    }
    if (results.length === 0) {
      return res.status(401).json({ Status: "Error", message: "Admin not found. Please register." });
    }
    const admin = results[0];
    // console.log("User Object Before Token:", user);
    bcrypt.compare(password, admin.password, (compareErr, isMatch) => {
      if (compareErr || !isMatch) {
        console.error("Password Verification Failed:", compareErr);
        return res.status(401).json({ Status: "Error", message: "Incorrect password." });
      }
      // Generate JWT token
      const token = jwt.sign({ id: admin.id, name: admin.name, email: admin.email, photo: admin.photo}, "jwt-secret-key", { expiresIn: "1d" });
      // Set cookie
      res.cookie("token", token);
      // console.log("Login Successful, Token:", token);
      res.json({Status: "Success", message: "Login successful!", token, admin: { id: admin.id, name: admin.name, email: admin.email, photo: admin.photo },});
    });
  });
});
// ###########End-Manage-Admin###########

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

