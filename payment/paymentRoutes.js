// =========================================================
// BARBER JI - PAYMENT ROUTES
// =========================================================

const express =
    require("express");

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

router.post(
    "/create-payment-intent",
    paymentAuth.verifyFirebaseUser,
    paymentController.createPaymentIntent
);


// =========================================================
// VERIFY RAZORPAY PAYMENT
// =========================================================

router.post(
    "/verify-payment",
    paymentAuth.verifyFirebaseUser,
    paymentController.verifyPayment
);
// =========================================================
// CONFIRM ZERO CASH BOOKING
// =========================================================
// CASH + ₹0 salon-side deduction
// Razorpay payment required nahi hai.
// =========================================================

router.post(
    "/confirm-zero-cash-booking",
    paymentAuth.verifyFirebaseUser,
    paymentController.confirmZeroCashBooking
);


// =========================================================
// EXPORT
// =========================================================

module.exports =
    router;
