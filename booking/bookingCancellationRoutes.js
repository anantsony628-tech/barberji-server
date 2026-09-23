const express = require("express");

const paymentAuth =
    require("../payment/paymentAuth");

const bookingCancellationController =
    require("./bookingCancellationController");

const router =
    express.Router();

// =====================================================
// CUSTOMER BOOKING CANCELLATION
// =====================================================
//
// POST /booking/cancel
//
// Firebase ID token required.
// The authenticated Firebase UID is verified by
// paymentAuth.verifyFirebaseUser.
//
// =====================================================

router.post(
    "/cancel",
    paymentAuth.verifyFirebaseUser,
    bookingCancellationController.cancelBooking
);

module.exports = router;
