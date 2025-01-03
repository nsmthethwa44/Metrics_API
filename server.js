import express from "express"
import mysql from "mysql"
import cors from "cors"
import cookieParser from "cookie-parser"
import bcrypt from "bcrypt"
import jwt from "jsonwebtoken"
import multer from "multer"
import path from "path"

import dotenv from "dotenv";
import { register } from "module"
dotenv.config(); // Load .env variables

const app = express ();
app.use(cookieParser());

app.use(cors({
        origin: ["http://localhost:5173", "https://symphonious-empanada-03d609.netlify.app/"], 
        credentials: true,
        methods: ["POST", "GET", "PUT", "DELETE"],
    }
));

app.use(express.json());
app.use(express.static("public"));

const con = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

const storage = multer.diskStorage({
    destination: (req, file, cb) =>{
        cb(null, "./public/images") 
    },
    filename: (req, file, cb) =>{
                cb(null, file.fieldname + "_" + Date.now() + path.extname(file.originalname));
    }
})

const upload = multer({
    storage : storage
})

con.connect(function(err){
    if(err){
        console.log("Error in connection");
    }else{
        console.log("connected")
    }
})


// ###########Manage-Users############## 

// adding new users 
      const saltRounds = 10; 

      app.post("/addNewUser", upload.single("photo"), (req, res) => {
        const { name, email, role, password } = req.body;
        const photo = req.file?.filename || null;
        const searchSql = "SELECT * FROM users WHERE email = ?";
        con.query(searchSql , [email], (err, results) => {
          if (err) {
            console.error("Database Error:", err);
            return res.status(500).json({ error: "Database error occurred." });
          }
          if (results.length > 0) {
            console.log("User already exists");
            return res.status(409).json({
              Status: "Exists",
              message: "User already exists. Please log in.",
            });
          } else {
            bcrypt.hash(password, saltRounds, (hashErr, hashedPassword) => {
              if (hashErr) {
                console.error("Hashing Error:", hashErr);
                return res.status(500).json({ error: "Failed to hash password." });
              }
              const sql = "INSERT INTO users (`name`, `email`, `role`, `password`, `photo`) VALUES (?)";
              const values = [name, email, role, hashedPassword, photo];
              con.query(sql, [values], (insertErr, result) => {
                if (insertErr) {
                  console.error("Insert Error:", insertErr);
                  return res
                    .status(500)
                    .json({ error: "Failed to insert admin details." });
                }
                res.json({ Status: "Success", message: "User successfully added!" });
              });
            });
          }
        });
      });

    //   getting all users 
    app.get("/getUsers", (req, res) =>{
        const sql = "SELECT * FROM users ORDER BY id DESC";
        con.query(sql, (err, result) =>{
            if(err){
                console.log("SQL Error:", err);
                return res.json({Error: "Get users data error in sql"});
            } return res.json({Status: "Success", Result: result})
        })
    })

    // remove user data 
    // delete from database 
app.delete("/deleteUser/:id", (req, res) =>{
    const id = req.params.id;
    const sql = "Delete FROM users WHERE id = ?";
     con.query(sql, [id], (err, result) =>{
    if(err) return res.json({Error: "delete data error in sql"});
    return res.json({Status: "Success"})
  })
})

// count users 
app.get("/usersCount", (req, res) =>{
  const sql = "SELECT COUNT(id) AS users FROM users";
  con.query(sql, (err, result) =>{
      if(err) return res.json({Error: "Error in running users count query"});
      return res.json(result);
  })
})

//  user login 
app.post("/userLogin", (req, res) => {
  const { email, password } = req.body;
  const sql = "SELECT * FROM users WHERE email = ?";
  con.query(sql, [email], (err, results) => {
    if (err) {
      console.error("Database Error:", err);
      return res.status(500).json({ error: "Database error occurred." });
    }
    if (results.length === 0) {
      return res.status(401).json({ Status: "Error", message: "User not found. Please register." });
    }
    const user = results[0];
    // console.log("User Object Before Token:", user);
    bcrypt.compare(password, user.password, (compareErr, isMatch) => {
      if (compareErr || !isMatch) {
        console.error("Password Verification Failed:", compareErr);
        return res.status(401).json({ Status: "Error", message: "Incorrect password." });
      }
      // Generate JWT token
      const token = jwt.sign({ id: user.id, name: user.name, email: user.email, photo: user.photo}, "jwt-secret-key", { expiresIn: "1d" });
      // Set cookie
      res.cookie("token", token);
      // console.log("Login Successful, Token:", token);
      res.json({Status: "Success", message: "Login successful!", token, user: { id: user.id, name: user.name, email: user.email, photo: user.photo },});
    });
  });
});


// ###########End-Manage-Users###########

// ###########Manage-Campaigns###########

// create campaigns 
app.post("/createCampaign", upload.single("image"), (req, res) => {
  const { title, goalAmount, description, startDate, endDate, status } = req.body;
  const image = req.file?.filename || null;
  const sql = "INSERT INTO campaigns (`title`, `goal`, `description`, `start`, `end`, `status`, `image`) VALUES (?)";
  const values = [title, goalAmount, description, startDate, endDate, status, image];

  con.query(sql, [values], (err, result) => {
    if (err) {
      console.error("Database Error:", err);
      return res.status(500).json({ error: "Failed to insert data." });
    }
    res.json({Status: "Success"})
  });
});

// fetch campaigns 
app.get("/getCampaigns", (req, res) =>{
  const sql = "SELECT * FROM campaigns ORDER BY id DESC";
  con.query(sql, (err, result) =>{
      if(err){
          console.log("SQL Error:", err);
          return res.json({Error: "Get users data error in sql"});
      } return res.json({Status: "Success", Result: result})
  })
})

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

// counting campaigns 
app.get("/campaignsCount", (req, res) =>{
  const sql = "SELECT COUNT(id) AS campaigns FROM campaigns";
  con.query(sql, (err, result) =>{
      if(err) return res.json({Error: "Error in running campaigns count query"});
      return res.json(result);
  })
})

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


// ###########End-Manage-Campaigns########

// ###########Donations############## 
// get donations data 
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

// count donations total 
app.get("/donationsCount", (req, res) =>{
  const sql = "SELECT COUNT(id) AS donations FROM donations";
  con.query(sql, (err, result) =>{
      if(err) return res.json({Error: "Error in running donation count query"});
      return res.json(result);
  })
})

// get user donations 
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

// ###########End-Donations###########

// ###########Leaderboard############## 

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

// ###########End-Leaderboard###########

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

// ###########Manage-Users############## 
// ###########End-Manage-Users###########

// ###########Manage-Users############## 
// ###########End-Manage-Users###########

// ###########Manage-Users############## 
// ###########End-Manage-Users###########

// ###########Manage-Users############## 
// ###########End-Manage-Users###########

// ###########Manage-Users############## 
// ###########End-Manage-Users###########



// ###########Log-Out############## 
  // create logout API 
  app.get("/logout", (req, res) =>{
    res.clearCookie("token");
    return res.json({Status: "Success"});
  })
// ###########End-Log-Out###########


























const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
