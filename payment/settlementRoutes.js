// =========================================================
// BARBER JI - SETTLEMENT ROUTES
// =========================================================
// Responsibility:
// - Settlement related API routes
// - Firebase authenticated partner/admin requests
//
// IMPORTANT:
// - Actual payout abhi yahan nahi hoga.
// - Settlement timing hardcoded nahi hai.
// - Configuration settlementConfigService se aayegi.
// =========================================================

const express =
    require("express");

const settlementService =
    require("./settlementService");

const paymentAuth =
    require("./paymentAuth");


// =========================================================
// ROUTER
// =========================================================

const router =
    express.Router();


// =========================================================
// GET PARTNER SETTLEMENT PREFERENCE
// =========================================================
// Partner dashboard ke liye.
//
// GET:
// /payment/settlement/partner/:salonId
// =========================================================

router.get(
    "/partner/:salonId",
    paymentAuth.verifyFirebaseUser,
    async (req, res) => {

        try {

            const salonId =
                req.params.salonId;


            if (
                !salonId ||
                String(salonId).trim() === ""
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Salon ID is required"

                });
            }


            const preference =
                await settlementService
                    .getPartnerSettlementPreference(
                        salonId
                    );


            return res.status(200).json({

                success: true,

                salonId:
                    String(salonId).trim(),

                settlementPreference:
                    preference

            });

        } catch (error) {

            console.error(
                "Get settlement preference error:",
                error
            );


            return res.status(500).json({

                success: false,

                message:
                    error.message ||
                    "Unable to get settlement preference"

            });
        }
    }
);


// =========================================================
// CREATE SETTLEMENT RECORD
// =========================================================
// Ye route service completion ke baad backend se
// settlement record create karne ke liye use hoga.
//
// Actual Razorpay payout abhi nahi karega.
// =========================================================

router.post(
    "/create",
    paymentAuth.verifyFirebaseUser,
    async (req, res) => {

        try {

            const body =
                req.body || {};


            const booking =
                body.booking;


            const serviceCompletedAt =
                body.serviceCompletedAt;


            if (
                !booking ||
                typeof booking !== "object"
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Booking data is required"

                });
            }


            const result =
                await settlementService
                    .createSettlementRecord({

                        booking:
                            booking,

                        serviceCompletedAt:
                            serviceCompletedAt

                    });


            return res.status(200).json(
                result
            );

        } catch (error) {

            console.error(
                "Create settlement error:",
                error
            );


            return res.status(500).json({

                success: false,

                message:
                    error.message ||
                    "Unable to create settlement"

            });
        }
    }
);


// =========================================================
// EXPORT
// =========================================================

module.exports =
    router;
