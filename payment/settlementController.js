// =========================================================
// BARBER JI - SETTLEMENT CONTROLLER
// =========================================================
// Responsibility:
// - Admin settlement settings read/update karna
// - Partner + Salon settlement preference read/update karna
// - Actual settlement calculation/process nahi karna
// - Koi settlement timing hardcode nahi karna
//
// IMPORTANT:
// - Actual configuration Firebase se aayegi.
// - Admin global settlement policy control karega.
// - Partner apni allowed settlement preference select karega.
// - Final payout settlement service karegi.
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
// EXPORT
// =========================================================

module.exports = {

    getAdminSettlementConfig,

    updateAdminSettlementConfig,

    getPartnerSettlementPreference,

    updatePartnerSettlementPreference

};
