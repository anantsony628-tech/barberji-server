// =========================================================
// BARBER JI - SETTLEMENT CONTROLLER
// =========================================================
// Responsibility:
// - Admin settlement settings read/update karna
// - Partner + Salon settlement preference read/update karna
// - Settlement record create karna
// - Actual settlement calculation/process settlementService karegi
// - Koi settlement timing hardcode nahi karna
//
// IMPORTANT:
// - Actual configuration Firebase se aayegi.
// - Admin global settlement policy control karega.
// - Partner apni allowed settlement preference select karega.
// - Final payout settlement service karegi.
// - Settlement creation sirf authenticated Partner ke liye hai.
// =========================================================

const settlementConfigService =
    require("./settlementConfigService");


// =========================================================
// GET ADMIN SETTLEMENT CONFIG
// =========================================================

async function getAdminSettlementConfig(
    req,
    res
) {

    try {

        const config =
            await settlementConfigService
                .getAdminSettlementSettings();


        return res.status(200).json({

            success:
                true,

            config:
                config

        });

    } catch (error) {

        console.error(
            "Get admin settlement config error:",
            error
        );


        return res.status(500).json({

            success:
                false,

            message:
                error.message ||
                "Unable to load settlement configuration"

        });
    }
}


// =========================================================
// UPDATE ADMIN SETTLEMENT CONFIG
// =========================================================

async function updateAdminSettlementConfig(
    req,
    res
) {

    try {

        const body =
            req.body || {};


        const result =
            await settlementConfigService
                .updateAdminSettlementConfig(
                    body
                );


        return res.status(200).json({

            success:
                true,

            message:
                "Settlement configuration updated successfully",

            config:
                result

        });

    } catch (error) {

        console.error(
            "Update admin settlement config error:",
            error
        );


        return res.status(400).json({

            success:
                false,

            message:
                error.message ||
                "Unable to update settlement configuration"

        });
    }
}


// =========================================================
// GET PARTNER SETTLEMENT PREFERENCE
// =========================================================
// Partner + Salon specific preference.
// =========================================================

async function getPartnerSettlementPreference(
    req,
    res
) {

    try {

        const partnerId =
            String(
                req.params.partnerId || ""
            ).trim();


        const salonId =
            String(
                req.params.salonId || ""
            ).trim();


        if (!partnerId) {

            return res.status(400).json({

                success:
                    false,

                message:
                    "Partner ID is required"

            });
        }


        if (!salonId) {

            return res.status(400).json({

                success:
                    false,

                message:
                    "Salon ID is required"

            });
        }


        const settings =
            await settlementConfigService
                .getPartnerSettlementSettings(
                    partnerId,
                    salonId
                );


        return res.status(200).json({

            success:
                true,

            partnerId:
                partnerId,

            salonId:
                salonId,

            preference:
                settings.preferredMode || "",

            settings:
                settings

        });

    } catch (error) {

        console.error(
            "Get partner settlement preference error:",
            error
        );


        return res.status(500).json({

            success:
                false,

            message:
                error.message ||
                "Unable to load partner settlement preference"

        });
    }
}


// =========================================================
// UPDATE PARTNER SETTLEMENT PREFERENCE
// =========================================================
// Partner wahi mode select kar sakta hai jo Admin ne
// allowedModes mein enable kiya hai.
//
// Body example:
//
// {
//     "mode": "INSTANT"
// }
// =========================================================

async function updatePartnerSettlementPreference(
    req,
    res
) {

    try {

        const partnerId =
            String(
                req.params.partnerId || ""
            ).trim();


        const salonId =
            String(
                req.params.salonId || ""
            ).trim();


        if (!partnerId) {

            return res.status(400).json({

                success:
                    false,

                message:
                    "Partner ID is required"

            });
        }


        if (!salonId) {

            return res.status(400).json({

                success:
                    false,

                message:
                    "Salon ID is required"

            });
        }


        const body =
            req.body || {};


        const result =
            await settlementConfigService
                .updatePartnerSettlementPreference({

                    partnerId:
                        partnerId,

                    salonId:
                        salonId,

                    preference:
                        body

                });


        return res.status(200).json({

            success:
                true,

            message:
                "Partner settlement preference updated successfully",

            partnerId:
                partnerId,

            salonId:
                salonId,

            preference:
                result

        });

    } catch (error) {

        console.error(
            "Update partner settlement preference error:",
            error
        );


        return res.status(400).json({

            success:
                false,

            message:
                error.message ||
                "Unable to update partner settlement preference"

        });
    }
}


// =========================================================
// CREATE SETTLEMENT RECORD
// =========================================================
// Service complete hone ke baad call hoga.
//
// Body:
//
// {
//     "bookingId": "...",
//     "serviceCompletedAt": 1234567890000
// }
//
// IMPORTANT:
// - Client commission/salonAmount nahi bhejega.
// - Server Firebase booking se actual data lega.
// - Authenticated Partner hi apni booking ka
//   settlement record create kar sakta hai.
// - Partner ID + Salon ID Firebase Custom Token
//   claims se verify honge.
// - Actual settlement calculation settlementService karegi.
// =========================================================

async function createSettlementRecord(
    req,
    res
) {

    try {

        // =====================================================
        // FIREBASE AUTH USER
        // =====================================================

        const authUser =
            req.user || {};


        const authUid =
            String(
                authUser.uid || ""
            ).trim();


        const authRole =
            String(
                authUser.role || ""
            ).trim().toLowerCase();


        const authPartnerId =
            String(
                authUser.partnerId || ""
            ).trim();


        const authSalonId =
            String(
                authUser.salonId || ""
            ).trim();


        if (!authUid) {

            return res.status(401).json({

                success:
                    false,

                message:
                    "Authentication required"

            });
        }


        if (
            authRole !==
            "partner"
        ) {

            return res.status(403).json({

                success:
                    false,

                message:
                    "Partner authentication required"

            });
        }


        if (!authPartnerId) {

            return res.status(403).json({

                success:
                    false,

                message:
                    "Partner ID authentication mein nahi mila"

            });
        }


        if (!authSalonId) {

            return res.status(403).json({

                success:
                    false,

                message:
                    "Salon ID authentication mein nahi mila"

            });
        }


        // =====================================================
        // REQUEST DATA
        // =====================================================

        const bookingId =
            String(
                req.body?.bookingId || ""
            ).trim();


        const serviceCompletedAt =
            Number(
                req.body?.serviceCompletedAt || 0
            );


        if (!bookingId) {

            return res.status(400).json({

                success:
                    false,

                message:
                    "Booking ID is required"

            });
        }


        if (
            !Number.isFinite(
                serviceCompletedAt
            ) ||
            serviceCompletedAt <= 0
        ) {

            return res.status(400).json({

                success:
                    false,

                message:
                    "Valid service completion time is required"

            });
        }


        // =====================================================
        // BOOKING LOAD
        // =====================================================

        const {
            getDatabase
        } =
            require("firebase-admin/database");


        const db =
            getDatabase();


        const bookingSnapshot =
            await db
                .ref("Bookings")
                .child(bookingId)
                .once("value");


        if (!bookingSnapshot.exists()) {

            return res.status(404).json({

                success:
                    false,

                message:
                    "Booking not found"

            });
        }


        const booking =
            bookingSnapshot.val();


        if (
            !booking ||
            typeof booking !== "object"
        ) {

            return res.status(400).json({

                success:
                    false,

                message:
                    "Invalid booking data"

            });
        }


        // =====================================================
        // BOOKING PARTNER / SALON
        // =====================================================

        const partnerId =
            String(
                booking.partnerId || ""
            ).trim();


        const salonId =
            String(
                booking.salonId || ""
            ).trim();


        if (!partnerId) {

            return res.status(400).json({

                success:
                    false,

                message:
                    "Booking partner ID is missing"

            });
        }


        if (!salonId) {

            return res.status(400).json({

                success:
                    false,

                message:
                    "Booking salon ID is missing"

            });
        }


        // =====================================================
        // PARTNER OWNERSHIP CHECK
        // =====================================================
        // Firebase Custom Token se aaye partnerId/salonId
        // ko booking ke partnerId/salonId se exact match
        // karna zaroori hai.
        // =====================================================

        if (
            authPartnerId !==
            partnerId
        ) {

            return res.status(403).json({

                success:
                    false,

                message:
                    "This booking does not belong to this Partner"

            });
        }


        if (
            authSalonId !==
            salonId
        ) {

            return res.status(403).json({

                success:
                    false,

                message:
                    "This booking does not belong to this Salon"

            });
        }


        // =====================================================
        // SERVICE STATUS VALIDATION
        // =====================================================

        const bookingStatus =
            String(
                booking.status || ""
            ).trim().toUpperCase();


        if (
            bookingStatus !==
            "SERVICE_COMPLETED"
        ) {

            return res.status(400).json({

                success:
                    false,

                message:
                    "Service is not completed"

            });
        }


        // =====================================================
        // CREATE SETTLEMENT
        // =====================================================

        const settlementService =
            require("./settlementService");


        const result =
            await settlementService
                .createSettlementRecord({

                    booking: {

                        ...booking,

                        bookingId:
                            bookingId

                    },

                    serviceCompletedAt:
                        serviceCompletedAt

                });


        // =====================================================
        // RESPONSE
        // =====================================================

        return res.status(200).json({

            success:
                true,

            message:
                result.duplicate
                    ? "Settlement record already exists"
                    : "Settlement record created successfully",

            duplicate:
                result.duplicate,

            settlementId:
                result.settlementId,

            settlement:
                result.settlement

        });

    } catch (error) {

        console.error(
            "Create settlement record error:",
            error
        );


        return res.status(500).json({

            success:
                false,

            message:
                error.message ||
                "Unable to create settlement record"

        });
    }
}


// =========================================================
// EXPORT
// =========================================================

module.exports = {

    getAdminSettlementConfig,

    updateAdminSettlementConfig,

    getPartnerSettlementPreference,

    updatePartnerSettlementPreference,

    createSettlementRecord

};
