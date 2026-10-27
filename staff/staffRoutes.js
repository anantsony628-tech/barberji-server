const express = require("express");
const router = express.Router();
const ctrl = require("./staffController");
router.post("/register", ctrl.register);
router.post("/login", ctrl.login);
module.exports = router;
