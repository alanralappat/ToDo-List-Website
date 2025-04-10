const express = require("express");
const mongoose = require("mongoose");
const path = require("path");
const bcrypt = require("bcryptjs");
const hbs = require("hbs");
const cors = require("cors");
const session = require("express-session");
require("dotenv").config();

const Todo = require("./models/Todo");
const User = require("./models/User");

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware setup
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, "public")));
app.use(
  session({
    secret: "your-secret-key",
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }, // Set to `true` if using HTTPS
  })
);

// Set up handlebars as the view engine
app.set("view engine", "hbs");
app.set("views", path.join(__dirname, "views"));

// Connect to MongoDB
mongoose
  .connect("mongodb://localhost:27017/todoApp", {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("MongoDB connected"))
  .catch((error) => console.error("MongoDB connection error:", error));

  const isAuthenticated = (req, res, next) => {
    if (req.session.userId) {
      next();
    } else {
      res.status(401).json({ message: "Unauthorized" });
    }
  };

/* --------- Login & Signup Routes --------- */

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "HomePage.html"));
});

app.get("/login", (req, res) => {
  const signupSuccess = req.query.signup === "success";
  res.render("login", { signupSuccess });
});

app.get("/signup", (req, res) => {
  res.render("signup");
});

// Signup route
app.post("/signup", async (req, res) => {
  const hashedPassword = await bcrypt.hash(req.body.password, 10);
  const user = new User({
    name: req.body.name,
    password: hashedPassword,
  });
  await user.save();
  res.redirect("/login?signup=success");
});

// Login route
app.post("/login", async (req, res) => {
  try {
    const user = await User.findOne({ name: req.body.name });
    if (user) {
      const passwordMatch = await bcrypt.compare(req.body.password, user.password);
      if (passwordMatch) {
        req.session.userId = user._id;
        req.session.name = user.name;
        res.redirect("/todo.html");
      } else {
        res.render("login", { errorMessage: "Incorrect password" });
      }
    } else {
      res.render("login", { errorMessage: "No such user found" });
    }
  } catch (error) {
    res.render("login", { errorMessage: "An error occurred, please try again" });
  }
});

/* --------- To-Do List CRUD Routes --------- */

app.get("/todo.html", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "todo.html"));
});

app.get("/api/check-auth", (req, res) => {
  if (req.session.userId) {
    res.status(200).send({ authenticated: true });
  } else {
    res.status(401).send({ authenticated: false });
  }
});

// Get the logged-in user's name
app.get("/api/get-username", (req, res) => {
  if (req.session && req.session.name) {
    res.json({ name: req.session.name });
  } else {
    res.status(401).send("Unauthorized");
  }
});

// Create a new to-do
app.post("/api/todos", isAuthenticated,async (req, res) => {
  try {
    const newTodo = new Todo({
      title: req.body.title,
      description: req.body.description,
      deadline: req.body.deadline,
      completed: req.body.completed || false,
      tags: req.body.tags || [],
      priority: req.body.priority || "Medium",
      userId: req.session.userId, // Associate task with user
    });
    const savedTodo = await newTodo.save();
    res.status(201).json(savedTodo);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Get all to-dos for the logged-in user
app.get("/api/todos", isAuthenticated, async (req, res) => {
  try {
    const todos = await Todo.find({ userId: req.session.userId });
    res.json(todos);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update a to-do
app.put("/api/todos/:id", isAuthenticated, async (req, res) => {
  try {
    const updatedTodo = await Todo.findOneAndUpdate(
      { _id: req.params.id, userId: req.session.userId },
      req.body,
      { new: true }
    );
    if (updatedTodo) {
      res.json(updatedTodo);
    } else {
      res.status(404).json({ message: "Todo not found" });
    }
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});


app.put("/api/todos/:id", isAuthenticated, async (req, res) => {
  try {
    const updatedTodo = await Todo.findOneAndUpdate(
      { _id: req.params.id, userId: req.session.userId },
      req.body,
      { new: true }
    );
    res.json(updatedTodo);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});


// Delete a to-do with a confirmation prompt
app.delete("/api/todos/:id", async (req, res) => {
  try {
    const deletedTodo = await Todo.findOneAndDelete({
      _id: req.params.id,
      userId: req.session.userId,
    });
    if (deletedTodo) {
      res.json({ message: "Todo deleted" });
    } else {
      res.status(404).json({ message: "Todo not found" });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post("/api/logout", (req, res) => {
  req.session.destroy();
  res.redirect("/login");
});


/* --------- Start the Server --------- */
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
