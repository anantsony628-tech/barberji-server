// =========================================================
// BARBER JI - SETTLEMENT ROUTES
// =========================================================
// Responsibility:
// - Settlement related API routes
// - Admin settlement configuration
// - Partner settlement preference
//
// IMPORTANT:
// - Actual Razorpay payout abhi yahan nahi hoga.
// - Settlement timing hardcoded nahi hai.
// - Configuration settlementConfigService se aayegi.
// - Controller business/configuration logic handle karega.
// =========================================================

const express =
    require("express");

const settlementController =
    require("./settlementController");

const paymentAuth =
    require("./paymentAuth");


// =========================================================
// ROUTER
// =========================================================

const router =
    express.Router();


// =========================================================
// ADMIN - GET SETTLEMENT CONFIG
// =========================================================
// GET:
// /payment/settlement/admin/config
//
// NOTE:
// Firebase authentication required.
// Actual Admin authorization next security step mein
// add ki jayegi.
// =========================================================

router.get(
    "/admin/config",
    paymentAuth.verifyFirebaseUser,
    settlementController.getAdminSettlementConfig
);


// =========================================================
// ADMIN - UPDATE SETTLEMENT CONFIG
// =========================================================
// POST:
// /payment/settlement/admin/config
//
// Body:
// {
//     enabled: true,
//     defaultMode: "NEXT_DAY",
//     allowedModes: {
//         INSTANT: true,
//         NEXT_DAY: true,
//         AFTER_24_HOURS: true
//     },
//     modeSettings: {
//         INSTANT: {
//             delayMinutes: 0
//         },
//         NEXT_DAY: {
//             delayMinutes: 1440
//         },
//         AFTER_24_HOURS: {
//             delayMinutes: 1440
//         }
//     }
// }
// =========================================================

router.post(
    "/admin/config",
    paymentAuth.verifyFirebaseUser,
    settlementController.updateAdminSettlementConfig
);


// =========================================================
// PARTNER - GET SETTLEMENT PREFERENCE
// =========================================================
// GET:
// /payment/settlement/partner/:partnerId/:salonId
//
// Partner + Salon specific preference.
// =========================================================

router.get(
    "/partner/:partnerId/:salonId",
    paymentAuth.verifyFirebaseUser,
    settlementController.getPartnerSettlementPreference
);


// =========================================================
// PARTNER - UPDATE SETTLEMENT PREFERENCE
// =========================================================
// POST:
// /payment/settlement/partner/:partnerId/:salonId
//
// Body example:
// {
//     "mode": "INSTANT"
// }
//
// Partner sirf wahi mode select kar sakta hai
// jo Admin ne allowedModes mein enable kiya hai.
// =========================================================

router.post(
    "/partner/:partnerId/:salonId",
    paymentAuth.verifyFirebaseUser,
    settlementController.updatePartnerSettlementPreference
);


// =========================================================
// EXPORT
// =========================================================

module.exports =
    router;
