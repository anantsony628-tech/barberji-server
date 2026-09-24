// =========================================================
// BARBER JI - SETTLEMENT CONTROLLER
// =========================================================
// Responsibility:
// - Admin settlement settings read/update karna
// - Partner settlement preference read/update karna
// - Actual settlement calculation/process nahi karna
// - Koi settlement timing hardcode nahi karna
//
// IMPORTANT:
// - Actual configuration Firebase se aayegi.
// - Admin global settlement policy control karega.
// - Partner apni allowed settlement preference select karega.
// - Final payout baad mein settlement service karegi.
// =========================================================

const settlementConfigService =
    require("./settlementConfigService");


// =========================================================
// GET ADMIN SETTLEMENT CONFIG
// =========================================================

async function getAdminSettlementConfig(req, res) {

    try {

        const config =
            await settlementConfigService
                .getAdminSettlementConfig();


        return res.status(200).json({

            success: true,

            config: config

        });

    } catch (error) {

        console.error(
            "Get admin settlement config error:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                error.message ||
                "Unable to load settlement configuration"

        });
    }
}


// =========================================================
// UPDATE ADMIN SETTLEMENT CONFIG
// =========================================================
// Admin Panel se call hoga.
//
// Example body:
//
// {
//     "enabled": true,
//     "defaultMode": "NEXT_DAY",
//     "instantEnabled": true,
//     "nextDayEnabled": true,
//     "afterHoursEnabled": true,
//     "afterHours": 24
// }
//
// IMPORTANT:
// Controller values ko hardcode nahi karta.
// Validation settlementConfigService karegi.
// =========================================================

async function updateAdminSettlementConfig(req, res) {

    try {

        const body =
            req.body || {};


        const result =
            await settlementConfigService
                .updateAdminSettlementConfig(
                    body
                );


        return res.status(200).json({

            success: true,

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

            success: false,

            message:
                error.message ||
                "Unable to update settlement configuration"

        });
    }
}


// =========================================================
// GET PARTNER SETTLEMENT PREFERENCE
// =========================================================
// Partner Dashboard se call hoga.
//
// partnerId + salonId ke basis par preference milegi.
// =========================================================

async function getPartnerSettlementPreference(
    req,
    res
) {

    try {

        const partnerId =
            req.params.partnerId;

        const salonId =
            req.params.salonId;


        if (
            !partnerId ||
            String(partnerId).trim() === ""
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Partner ID is required"

            });
        }


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
            await settlementConfigService
                .getPartnerSettlementPreference({

                    partnerId:
                        String(
                            partnerId
                        ).trim(),

                    salonId:
                        String(
                            salonId
                        ).trim()

                });


        return res.status(200).json({

            success: true,

            partnerId:
                String(
                    partnerId
                ).trim(),

            salonId:
                String(
                    salonId
                ).trim(),

            preference:
                preference

        });

    } catch (error) {

        console.error(
            "Get partner settlement preference error:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                error.message ||
                "Unable to load partner settlement preference"

        });
    }
}


// =========================================================
// UPDATE PARTNER SETTLEMENT PREFERENCE
// =========================================================
// Partner Dashboard se call hoga.
//
// Example:
//
// {
//     "mode": "INSTANT"
// }
//
// Ya:
//
// {
//     "mode": "NEXT_DAY"
// }
//
// Ya admin dwara allowed koi configured mode.
//
// Actual validation service karegi.
// =========================================================

async function updatePartnerSettlementPreference(
    req,
    res
) {

    try {

        const partnerId =
            req.params.partnerId;

        const salonId =
            req.params.salonId;


        if (
            !partnerId ||
            String(partnerId).trim() === ""
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Partner ID is required"

            });
        }


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


        const body =
            req.body || {};


        const result =
            await settlementConfigService
                .updatePartnerSettlementPreference({

                    partnerId:
                        String(
                            partnerId
                        ).trim(),

                    salonId:
                        String(
                            salonId
                        ).trim(),

                    preference:
                        body

                });


        return res.status(200).json({

            success: true,

            message:
                "Partner settlement preference updated successfully",

            partnerId:
                String(
                    partnerId
                ).trim(),

            salonId:
                String(
                    salonId
                ).trim(),

            preference:
                result

        });

    } catch (error) {

        console.error(
            "Update partner settlement preference error:",
            error
        );


        return res.status(400).json({

            success: false,

            message:
                error.message ||
                "Unable to update partner settlement preference"

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

    updatePartnerSettlementPreference

};
