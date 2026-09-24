// =========================================================
// BARBER JI - SETTLEMENT CONFIG SERVICE
// =========================================================
// Responsibility:
// - Admin settlement settings read karna
// - Partner settlement preference read karna
// - Settlement configuration validate karna
// - Effective settlement mode determine karna
//
// IMPORTANT:
// - Instant / Next Day / 24 Hours hardcoded decision nahi hai
// - Actual setting Firebase se aayegi
// - Admin settlement system ko control karega
// - Partner apni preferred settlement timing choose karega
//
// This file does NOT:
// - transfer money
// - create Razorpay payout
// - process refund
// - complete service
// - update booking
// =========================================================

const {
    getDatabase
} = require("firebase-admin/database");


// =========================================================
// FIREBASE DATABASE
// =========================================================

const db =
    getDatabase();


// =========================================================
// DEFAULT CONFIGURATION
// =========================================================
// Ye sirf schema-safe fallback hai.
// Iska purpose automatic payout decision lena nahi hai.
// Admin setting available na ho to settlement allowed
// nahi ki jayegi.
// =========================================================

const DEFAULT_ADMIN_SETTINGS = {

    enabled:
        false,

    allowedModes: [],

    defaultMode:
        "",

    updatedAt:
        0
};


const DEFAULT_PARTNER_SETTINGS = {

    preferredMode:
        "",

    updatedAt:
        0
};


// =========================================================
// HELPERS
// =========================================================

function cleanString(value) {

    if (
        value === undefined ||
        value === null
    ) {

        return "";
    }

    return String(value).trim();
}


function normalizeMode(value) {

    const mode =
        cleanString(value)
            .toUpperCase()
            .replace(/[\s-]+/g, "_");

    return mode;
}


function normalizeBoolean(value) {

    if (value === true) {
        return true;
    }

    if (value === false) {
        return false;
    }

    if (
        typeof value === "string"
    ) {

        return (
            value.toLowerCase() ===
            "true"
        );
    }

    return false;
}


// =========================================================
// NORMALIZE SETTLEMENT MODE
// =========================================================
// Supported values Firebase mein admin/partner setting
// ke through aayengi.
//
// Example:
// INSTANT
// NEXT_DAY
// AFTER_24_HOURS
// =========================================================

function isValidSettlementMode(mode) {

    const cleanMode =
        normalizeMode(mode);

    return (
        cleanMode === "INSTANT" ||
        cleanMode === "NEXT_DAY" ||
        cleanMode === "AFTER_24_HOURS"
    );
}


// =========================================================
// GET ADMIN SETTLEMENT SETTINGS
// =========================================================
// Firebase path:
//
// BarberJi/Settings/Settlement
//
// Example:
//
// {
//   enabled: true,
//   allowedModes: [
//      "INSTANT",
//      "NEXT_DAY",
//      "AFTER_24_HOURS"
//   ],
//   defaultMode: "NEXT_DAY"
// }
// =========================================================

async function getAdminSettlementSettings() {

    const snapshot =
        await db
            .ref(
                "BarberJi/Settings/Settlement"
            )
            .once("value");


    if (
        !snapshot.exists()
    ) {

        return {
            ...DEFAULT_ADMIN_SETTINGS
        };
    }


    const data =
        snapshot.val();


    if (
        !data ||
        typeof data !== "object"
    ) {

        return {
            ...DEFAULT_ADMIN_SETTINGS
        };
    }


    const enabled =
        normalizeBoolean(
            data.enabled
        );


    let allowedModes = [];


    if (
        Array.isArray(
            data.allowedModes
        )
    ) {

        allowedModes =
            data.allowedModes
                .map(
                    mode =>
                        normalizeMode(mode)
                )
                .filter(
                    mode =>
                        isValidSettlementMode(
                            mode
                        )
                );

    } else if (
        Array.isArray(
            data.allowed_modes
        )
    ) {

        allowedModes =
            data.allowed_modes
                .map(
                    mode =>
                        normalizeMode(mode)
                )
                .filter(
                    mode =>
                        isValidSettlementMode(
                            mode
                        )
                );
    }


    // Remove duplicate modes

    allowedModes =
        [
            ...new Set(
                allowedModes
            )
        ];


    const defaultMode =
        normalizeMode(
            data.defaultMode ||
            data.default_mode
        );


    return {

        enabled:
            enabled,

        allowedModes:
            allowedModes,

        defaultMode:
            isValidSettlementMode(
                defaultMode
            )
                ? defaultMode
                : "",

        updatedAt:
            Number(
                data.updatedAt ||
                data.updated_at ||
                0
            )

    };
}


// =========================================================
// GET PARTNER SETTLEMENT PREFERENCE
// =========================================================
// Firebase path:
//
// BarberJi/PartnerSettlementSettings/{partnerId}
//
// Example:
//
// {
//   preferredMode: "INSTANT"
// }
// =========================================================

async function getPartnerSettlementSettings(
    partnerId
) {

    const cleanPartnerId =
        cleanString(
            partnerId
        );


    if (!cleanPartnerId) {

        throw new Error(
            "Partner ID is required"
        );
    }


    const snapshot =
        await db
            .ref(
                "BarberJi/PartnerSettlementSettings"
            )
            .child(
                cleanPartnerId
            )
            .once("value");


    if (
        !snapshot.exists()
    ) {

        return {
            ...DEFAULT_PARTNER_SETTINGS
        };
    }


    const data =
        snapshot.val();


    if (
        !data ||
        typeof data !== "object"
    ) {

        return {
            ...DEFAULT_PARTNER_SETTINGS
        };
    }


    const preferredMode =
        normalizeMode(
            data.preferredMode ||
            data.preferred_mode
        );


    return {

        preferredMode:
            isValidSettlementMode(
                preferredMode
            )
                ? preferredMode
                : "",

        updatedAt:
            Number(
                data.updatedAt ||
                data.updated_at ||
                0
            )

    };
}


// =========================================================
// GET EFFECTIVE SETTLEMENT CONFIGURATION
// =========================================================
// Important:
//
// Admin decides:
// - settlement system enabled hai ya nahi
// - kaun-kaun se modes allowed hain
//
// Partner decides:
// - allowed modes mein se uski preference kya hai
//
// Agar partner preference invalid/missing hai,
// to admin ka defaultMode tabhi use hoga jab woh
// admin ke allowedModes mein present ho.
//
// Koi automatic hardcoded settlement timing nahi.
// =========================================================

async function getEffectiveSettlementSettings(
    partnerId
) {

    const adminSettings =
        await getAdminSettlementSettings();


    const partnerSettings =
        await getPartnerSettlementSettings(
            partnerId
        );


    // -----------------------------------------------------
    // SETTLEMENT SYSTEM DISABLED
    // -----------------------------------------------------

    if (
        !adminSettings.enabled
    ) {

        return {

            enabled:
                false,

            mode:
                "",

            adminSettings:
                adminSettings,

            partnerSettings:
                partnerSettings

        };
    }


    // -----------------------------------------------------
    // PARTNER PREFERENCE
    // -----------------------------------------------------

    const partnerMode =
        normalizeMode(
            partnerSettings.preferredMode
        );


    if (
        isValidSettlementMode(
            partnerMode
        ) &&
        adminSettings.allowedModes
            .includes(
                partnerMode
            )
    ) {

        return {

            enabled:
                true,

            mode:
                partnerMode,

            source:
                "PARTNER_PREFERENCE",

            adminSettings:
                adminSettings,

            partnerSettings:
                partnerSettings

        };
    }


    // -----------------------------------------------------
    // ADMIN DEFAULT
    // -----------------------------------------------------

    const adminDefaultMode =
        normalizeMode(
            adminSettings.defaultMode
        );


    if (
        isValidSettlementMode(
            adminDefaultMode
        ) &&
        adminSettings.allowedModes
            .includes(
                adminDefaultMode
            )
    ) {

        return {

            enabled:
                true,

            mode:
                adminDefaultMode,

            source:
                "ADMIN_DEFAULT",

            adminSettings:
                adminSettings,

            partnerSettings:
                partnerSettings

        };
    }


    // -----------------------------------------------------
    // NO VALID MODE
    // -----------------------------------------------------
    // IMPORTANT:
    // Yahan koi hardcoded fallback nahi diya gaya.
    // Admin configuration incomplete hone par settlement
    // system ko mode nahi milega.
    // -----------------------------------------------------

    return {

        enabled:
            true,

        mode:
            "",

        source:
            "NO_VALID_CONFIGURATION",

        adminSettings:
            adminSettings,

        partnerSettings:
            partnerSettings

    };
}


// =========================================================
// VALIDATE EFFECTIVE SETTLEMENT
// =========================================================

function validateEffectiveSettlementSettings(
    settings
) {

    if (
        !settings ||
        typeof settings !== "object"
    ) {

        throw new Error(
            "Settlement settings are required"
        );
    }


    if (
        settings.enabled !== true
    ) {

        return false;
    }


    const mode =
        normalizeMode(
            settings.mode
        );


    if (
        !isValidSettlementMode(
            mode
        )
    ) {

        return false;
    }


    return true;
}


// =========================================================
// EXPORT
// =========================================================

module.exports = {

    getAdminSettlementSettings,

    getPartnerSettlementSettings,

    getEffectiveSettlementSettings,

    validateEffectiveSettlementSettings,

    isValidSettlementMode

};
