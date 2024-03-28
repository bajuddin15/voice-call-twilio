const http = require("http");
const path = require("path");
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");

const router = require("./src/router");

// Create Express webapp
const app = express();
app.use(express.static(path.join(__dirname, "public")));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(cors());

app.use("/api", router);

// Create http server and run it
const server = http.createServer(app);
const port = process.env.PORT || 3000;

server.listen(port, function () {
  console.log("Express server running on *:" + port);
});
