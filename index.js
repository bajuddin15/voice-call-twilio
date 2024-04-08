const http = require("http");
const dotenv = require("dotenv");
// const path = require("path");
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const connectDB = require("./utils/db");

const router = require("./src/router");

// Create Express webapp
dotenv.config();
const app = express();
// app.use(express.static(path.join(__dirname, "public")));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(cors());

// Api root route
app.get("/", (req, res) => {
  res.send("Api is running..");
});

app.use("/api", router);

// Create http server and run it
const server = http.createServer(app);
const port = process.env.PORT || 3000;

connectDB()
  .then(() => {
    server.listen(port, function () {
      console.log("Express server running on *:" + port);
    });
  })
  .catch((err) => {
    console.log(err);
  });
