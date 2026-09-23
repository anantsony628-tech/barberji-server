// =========================================================
// BARBER JI - PAYMENT ROUTES
// =========================================================

const express = require("express");

const paymentController =
    require("./paymentController");

const paymentAuth =
    require("./paymentAuth");


// =========================================================
// ROUTER
// =========================================================

const router =
    express.Router();


// =========================================================
// CREATE RAZORPAY ORDER
// =========================================================

router.post(
    "/create-order",
    paymentAuth.verifyFirebaseUser,
    paymentController.createOrder
);


// =========================================================
// EXPORT
// =========================================================

module.exports = router;
