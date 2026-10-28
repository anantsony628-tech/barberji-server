const express = require("express");
const router = express.Router();
const ctrl = require("./staffController");

// ===== STAFF SIDE =====
router.post("/register", ctrl.register);
router.post("/login", ctrl.login);
router.get("/status", ctrl.getStatus); // <-- PENDING page ke liye naya

// ===== ADMIN SIDE - Alag Routes =====
router.get("/admin/pending", ctrl.getPendingList);
router.post("/admin/approve", ctrl.approveStaff);
router.post("/admin/action", ctrl.actionStaff);

module.exports = router;
