const Router = require("express").Router;
const { tokenGenerator, voiceResponse } = require("./handler");

const router = new Router();

router.post("/token", tokenGenerator);

router.post("/voice", async (req, res) => {
  try {
    const response = await voiceResponse(req);
    res.set("Content-Type", "text/xml");
    res.send(response);
  } catch (error) {
    console.error("Error:", error);
    res.status(500).send("Internal Server Error");
  }
});
module.exports = router;
