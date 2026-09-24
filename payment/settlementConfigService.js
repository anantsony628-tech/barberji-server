// =========================================================
// BARBER JI - SETTLEMENT CONFIG SERVICE
// =========================================================
// Responsibility:
// - Admin settlement settings read/update karna
// - Partner + Salon settlement preference read/update karna
// - Effective settlement mode determine karna
// - Settlement timing configuration Firebase se lena
//
// IMPORTANT:
// - Actual settlement timing hardcoded nahi hai.
// - Admin allowed modes control karega.
// - Admin har mode ka delay configure karega.
// - Partner allowed modes mein se preference select karega.
// - Partner ki preference salon-wise save hogi.
// - Actual payout is file mein nahi hoga.
//
// FIREBASE:
//
// BarberJi/Settings/Settlement
//
// BarberJi/PartnerSettlementSettings/{partnerId}/{salonId}
//
// Example:
//
// BarberJi
//   Settings
//     Settlement
//       enabled: true
//       defaultMode: "NEXT_DAY"
//       allowedModes:
//         INSTANT: true
//         NEXT_DAY: true
//         AFTER_24_HOURS: true
//
//       modeSettings
//         INSTANT
//           delayMinutes: 0
//         NEXT_DAY
//           delayMinutes: 1440
//         AFTER_24_HOURS
//           delayMinutes: 1440
//
// Partner:
//
// PartnerSettlementSettings
//   PARTNER001
//     SALON00001
//       preferredMode: "NEXT_DAY"
// =========================================================

const {
    getDatabase,
    ServerValue
} = require("firebase-admin/database");


// =========================================================
// FIREBASE DATABASE
// =========================================================

const db =
    getDatabase();


// =========================================================
// DEFAULT CONFIGURATION
// =========================================================
// IMPORTANT:
// Ye payout decision nahi hai.
// Firebase configuration missing hone par
// settlement automatically execute nahi hoga.
// =========================================================

const DEFAULT_ADMIN_SETTINGS = {

    enabled:
        false,

    allowedModes:
        [],

    defaultMode:
        "",

    modeSettings:
        {},

    updatedAt:
        0
};


const DEFAULT_PARTNER_SETTINGS = {

    partnerId:
        "",

    salonId:
        "",

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

    return cleanString(value)
        .toUpperCase()
        .replace(/[\s-]+/g, "_");
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
            value
                .trim()
                .toLowerCase() ===
            "true"
        );
    }


    if (
        typeof value === "number"
    ) {

        return value === 1;
    }


    return false;
}


function safeTimestamp(value) {

    const number =
        Number(value);


    if (
        !Number.isFinite(number)
    ) {

        return 0;
    }


    return number;
}


// =========================================================
// SETTLEMENT MODE VALIDATION
// =========================================================
// Mode names predefined identity hain.
// Lekin actual delay Firebase ke modeSettings se aayega.
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
// NORMALIZE ALLOWED MODES
// =========================================================
//
// Supported Firebase formats:
//
// 1. Array:
//
// allowedModes: [
//     "INSTANT",
//     "NEXT_DAY"
// ]
//
// 2. Object:
//
// allowedModes: {
//     INSTANT: true,
//     NEXT_DAY: true
// }
//
// =========================================================

function normalizeAllowedModes(
    value
) {

    let modes = [];


    if (
        Array.isArray(value)
    ) {

        modes =
            value
                .map(
                    mode =>
                        normalizeMode(mode)
                );

    } else if (
        value &&
        typeof value === "object"
    ) {

        modes =
            Object.keys(value)
                .filter(
                    mode =>
                        normalizeBoolean(
                            value[mode]
                        )
                )
                .map(
                    mode =>
                        normalizeMode(mode)
                );
    }


    modes =
        modes
            .filter(
                mode =>
                    isValidSettlementMode(
                        mode
                    )
            );


    return [
        ...new Set(modes)
    ];
}


// =========================================================
// NORMALIZE MODE SETTINGS
// =========================================================
// Actual delay Firebase se aayega.
//
// Example:
//
// modeSettings: {
//
//   INSTANT: {
//      delayMinutes: 0
//   },
//
//   NEXT_DAY: {
//      delayMinutes: 1440
//   },
//
//   AFTER_24_HOURS: {
//      delayMinutes: 1440
//   }
//
// }
// =========================================================

function normalizeModeSettings(
    value
) {

    const result = {};


    if (
        !value ||
        typeof value !== "object"
    ) {

        return result;
    }


    Object.keys(value)
        .forEach(modeKey => {

            const mode =
                normalizeMode(
                    modeKey
                );


            if (
                !isValidSettlementMode(
                    mode
                )
            ) {

                return;
            }


            const data =
                value[modeKey];


            if (
                !data ||
                typeof data !== "object"
            ) {

                return;
            }


            const delayMinutes =
                Number(
                    data.delayMinutes ??
                    data.delay_minutes
                );


            if (
                !Number.isFinite(
                    delayMinutes
                ) ||
                delayMinutes < 0
            ) {

                return;
            }


            result[mode] = {

                delayMinutes:
                    Math.floor(
                        delayMinutes
                    )

            };

        });


    return result;
}


// =========================================================
// GET ADMIN SETTLEMENT SETTINGS
// =========================================================
// Firebase:
//
// BarberJi/Settings/Settlement
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
            ...DEFAULT_ADMIN_SETTINGS,

            modeSettings:
                {}
        };
    }


    const data =
        snapshot.val();


    if (
        !data ||
        typeof data !== "object"
    ) {

        return {
            ...DEFAULT_ADMIN_SETTINGS,

            modeSettings:
                {}
        };
    }


    const allowedModes =
        normalizeAllowedModes(
            data.allowedModes ??
            data.allowed_modes
        );


    const defaultMode =
        normalizeMode(
            data.defaultMode ??
            data.default_mode
        );


    const modeSettings =
        normalizeModeSettings(
            data.modeSettings ??
            data.mode_settings
        );


    return {

        enabled:
            normalizeBoolean(
                data.enabled
            ),

        allowedModes:
            allowedModes,

        defaultMode:
            isValidSettlementMode(
                defaultMode
            )
                ? defaultMode
                : "",

        modeSettings:
            modeSettings,

        updatedAt:
            safeTimestamp(
                data.updatedAt ??
                data.updated_at
            )

    };
}


// =========================================================
// UPDATE ADMIN SETTLEMENT SETTINGS
// =========================================================
// Admin Panel se call hoga.
//
// Accepted body:
//
// {
//   enabled: true,
//
//   allowedModes: [
//      "INSTANT",
//      "NEXT_DAY",
//      "AFTER_24_HOURS"
//   ],
//
//   defaultMode: "NEXT_DAY",
//
//   modeSettings: {
//
//      INSTANT: {
//          delayMinutes: 0
//      },
//
//      NEXT_DAY: {
//          delayMinutes: 1440
//      },
//
//      AFTER_24_HOURS: {
//          delayMinutes: 1440
//      }
//
//   }
// }
//
// IMPORTANT:
// Delay Admin Firebase mein configure karega.
// Code kisi timing ko decide nahi karega.
// =========================================================

async function updateAdminSettlementConfig(
    input
) {

    const data =
        input &&
        typeof input === "object"
            ? input
            : {};


    const enabled =
        normalizeBoolean(
            data.enabled
        );


    const allowedModes =
        normalizeAllowedModes(
            data.allowedModes ??
            data.allowed_modes
        );


    const defaultMode =
        normalizeMode(
            data.defaultMode ??
            data.default_mode
        );


    if (
        enabled &&
        allowedModes.length === 0
    ) {

        throw new Error(
            "At least one settlement mode must be allowed"
        );
    }


    if (
        defaultMode &&
        !isValidSettlementMode(
            defaultMode
        )
    ) {

        throw new Error(
            "Invalid default settlement mode"
        );
    }


    if (
        defaultMode &&
        !allowedModes.includes(
            defaultMode
        )
    ) {

        throw new Error(
            "Default settlement mode must be one of the allowed modes"
        );
    }


    const suppliedModeSettings =
        normalizeModeSettings(
            data.modeSettings ??
            data.mode_settings
        );


    const modeSettings = {};


    for (
        const mode of allowedModes
    ) {

        const setting =
            suppliedModeSettings[
                mode
            ];


        if (
            !setting
        ) {

            throw new Error(
                "Settlement timing configuration missing for mode: " +
                mode
            );
        }


        const delayMinutes =
            Number(
                setting.delayMinutes
            );


        if (
            !Number.isFinite(
                delayMinutes
            ) ||
            delayMinutes < 0
        ) {

            throw new Error(
                "Invalid delayMinutes for settlement mode: " +
                mode
            );
        }


        modeSettings[mode] = {

            delayMinutes:
                Math.floor(
                    delayMinutes
                )

        };
    }


    const updatedAt =
        ServerValue.TIMESTAMP;


    const config = {

        enabled:
            enabled,

        allowedModes:
            allowedModes,

        defaultMode:
            defaultMode,

        modeSettings:
            modeSettings,

        updatedAt:
            updatedAt

    };


    await db
        .ref(
            "BarberJi/Settings/Settlement"
        )
        .set(
            config
        );


    return {

        ...config

    };
}


// =========================================================
// GET PARTNER SETTLEMENT SETTINGS
// =========================================================
// Preferred path:
//
// BarberJi/PartnerSettlementSettings/{partnerId}/{salonId}
//
// Old partner-level path bhi read kiya jayega fallback ke
// liye, taaki existing data unnecessarily break na ho.
// =========================================================

async function getPartnerSettlementSettings(
    partnerId,
    salonId
) {

    const cleanPartnerId =
        cleanString(
            partnerId
        );


    const cleanSalonId =
        cleanString(
            salonId
        );


    if (!cleanPartnerId) {

        throw new Error(
            "Partner ID is required"
        );
    }


    // -----------------------------------------------------
    // SALON-SPECIFIC SETTING
    // -----------------------------------------------------

    if (cleanSalonId) {

        const salonSnapshot =
            await db
                .ref(
                    "BarberJi/PartnerSettlementSettings"
                )
                .child(
                    cleanPartnerId
                )
                .child(
                    cleanSalonId
                )
                .once("value");


        if (
            salonSnapshot.exists()
        ) {

            const data =
                salonSnapshot.val();


            if (
                data &&
                typeof data === "object"
            ) {

                const preferredMode =
                    normalizeMode(
                        data.preferredMode ??
                        data.preferred_mode
                    );


                return {

                    partnerId:
                        cleanPartnerId,

                    salonId:
                        cleanSalonId,

                    preferredMode:
                        isValidSettlementMode(
                            preferredMode
                        )
                            ? preferredMode
                            : "",

                    updatedAt:
                        safeTimestamp(
                            data.updatedAt ??
                            data.updated_at
                        )

                };
            }
        }
    }


    // -----------------------------------------------------
    // OLD PARTNER-LEVEL FALLBACK
    // -----------------------------------------------------

    const partnerSnapshot =
        await db
            .ref(
                "BarberJi/PartnerSettlementSettings"
            )
            .child(
                cleanPartnerId
            )
            .once("value");


    if (
        partnerSnapshot.exists()
    ) {

        const data =
            partnerSnapshot.val();


        if (
            data &&
            typeof data === "object"
        ) {

            const preferredMode =
                normalizeMode(
                    data.preferredMode ??
                    data.preferred_mode
                );


            if (
                isValidSettlementMode(
                    preferredMode
                )
            ) {

                return {

                    partnerId:
                        cleanPartnerId,

                    salonId:
                        cleanSalonId,

                    preferredMode:
                        preferredMode,

                    updatedAt:
                        safeTimestamp(
                            data.updatedAt ??
                            data.updated_at
                        )

                };
            }
        }
    }


    return {

        ...DEFAULT_PARTNER_SETTINGS,

        partnerId:
            cleanPartnerId,

        salonId:
            cleanSalonId

    };
}


// =========================================================
// UPDATE PARTNER SETTLEMENT PREFERENCE
// =========================================================
// Partner Dashboard se call hoga.
//
// Path:
//
// BarberJi/PartnerSettlementSettings/{partnerId}/{salonId}
//
// Body:
//
// {
//    mode: "INSTANT"
// }
//
// IMPORTANT:
// Partner wahi mode select kar sakta hai jo Admin ne
// allowedModes mein enable kiya hai.
// =========================================================

async function updatePartnerSettlementPreference(
    input
) {

    const data =
        input &&
        typeof input === "object"
            ? input
            : {};


    const partnerId =
        cleanString(
            data.partnerId
        );


    const salonId =
        cleanString(
            data.salonId
        );


    if (!partnerId) {

        throw new Error(
            "Partner ID is required"
        );
    }


    if (!salonId) {

        throw new Error(
            "Salon ID is required"
        );
    }


    let requestedMode = "";


    // -----------------------------------------------------
    // Accept multiple body formats safely
    // -----------------------------------------------------

    if (
        typeof data.preference ===
        "string"
    ) {

        requestedMode =
            normalizeMode(
                data.preference
            );

    } else if (
        data.preference &&
        typeof data.preference === "object"
    ) {

        requestedMode =
            normalizeMode(
                data.preference.mode ??
                data.preference.preferredMode ??
                data.preference.preferred_mode
            );

    } else {

        requestedMode =
            normalizeMode(
                data.mode ??
                data.preferredMode ??
                data.preferred_mode
            );
    }


    if (
        !isValidSettlementMode(
            requestedMode
        )
    ) {

        throw new Error(
            "Invalid settlement preference"
        );
    }


    // -----------------------------------------------------
    // READ CURRENT ADMIN CONFIG
    // -----------------------------------------------------

    const adminSettings =
        await getAdminSettlementSettings();


    if (
        adminSettings.enabled !== true
    ) {

        throw new Error(
            "Settlement system is disabled by admin"
        );
    }


    // -----------------------------------------------------
    // CHECK ADMIN ALLOWED MODE
    // -----------------------------------------------------

    if (
        !adminSettings.allowedModes
            .includes(
                requestedMode
            )
    ) {

        throw new Error(
            "Selected settlement mode is not allowed by admin"
        );
    }


    // -----------------------------------------------------
    // CHECK MODE TIMING CONFIGURATION
    // -----------------------------------------------------

    const modeSetting =
        adminSettings
            .modeSettings[
                requestedMode
            ];


    if (
        !modeSetting
    ) {

        throw new Error(
            "Settlement timing is not configured for selected mode"
        );
    }


    const delayMinutes =
        Number(
            modeSetting.delayMinutes
        );


    if (
        !Number.isFinite(
            delayMinutes
        ) ||
        delayMinutes < 0
    ) {

        throw new Error(
            "Invalid settlement timing configuration"
        );
    }


    // -----------------------------------------------------
    // SAVE PARTNER + SALON PREFERENCE
    // -----------------------------------------------------

    const updatedAt =
        ServerValue.TIMESTAMP;


    const partnerSetting = {

        partnerId:
            partnerId,

        salonId:
            salonId,

        preferredMode:
            requestedMode,

        delayMinutes:
            Math.floor(
                delayMinutes
            ),

        updatedAt:
            updatedAt

    };


    await db
        .ref(
            "BarberJi/PartnerSettlementSettings"
        )
        .child(
            partnerId
        )
        .child(
            salonId
        )
        .set(
            partnerSetting
        );


    // -----------------------------------------------------
    // ALSO SAVE PREFERENCE IN APPROVED SALON
    // -----------------------------------------------------
    // Partner dashboard / salon data se bhi preference
    // easily read ki ja sakegi.
    //
    // Ye settlement timing decide nahi karta.
    // Actual timing Admin configuration se hi aayegi.
    // -----------------------------------------------------

    await db
        .ref(
            "ApprovedSalons"
        )
        .child(
            salonId
        )
        .update({

            settlementPreference:
                requestedMode,

            settlementPreferenceUpdatedAt:
                updatedAt

        });


    return {

        partnerId:
            partnerId,

        salonId:
            salonId,

        preferredMode:
            requestedMode,

        delayMinutes:
            Math.floor(
                delayMinutes
            ),

        updatedAt:
            updatedAt

    };
}


// =========================================================
// GET EFFECTIVE SETTLEMENT SETTINGS
// =========================================================
// Final settlement decision ke liye:
//
// 1. Admin enabled check
// 2. Admin allowed modes check
// 3. Partner preference check
// 4. Admin default mode fallback
// 5. Selected mode ka delay Firebase se
//
// IMPORTANT:
// Yahan bhi koi timing hardcoded nahi hai.
// =========================================================

async function getEffectiveSettlementSettings(
    partnerId,
    salonId
) {

    const adminSettings =
        await getAdminSettlementSettings();


    const partnerSettings =
        await getPartnerSettlementSettings(
            partnerId,
            salonId
        );


    // -----------------------------------------------------
    // ADMIN DISABLED
    // -----------------------------------------------------

    if (
        adminSettings.enabled !== true
    ) {

        return {

            enabled:
                false,

            mode:
                "",

            delayMinutes:
                0,

            source:
                "ADMIN_DISABLED",

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

        const modeSetting =
            adminSettings
                .modeSettings[
                    partnerMode
                ];


        if (
            modeSetting &&
            Number.isFinite(
                Number(
                    modeSetting.delayMinutes
                )
            )
        ) {

            return {

                enabled:
                    true,

                mode:
                    partnerMode,

                delayMinutes:
                    Math.floor(
                        Number(
                            modeSetting.delayMinutes
                        )
                    ),

                source:
                    "PARTNER_PREFERENCE",

                adminSettings:
                    adminSettings,

                partnerSettings:
                    partnerSettings

            };
        }
    }


    // -----------------------------------------------------
    // ADMIN DEFAULT
    // -----------------------------------------------------

    const defaultMode =
        normalizeMode(
            adminSettings.defaultMode
        );


    if (
        isValidSettlementMode(
            defaultMode
        ) &&
        adminSettings.allowedModes
            .includes(
                defaultMode
            )
    ) {

        const modeSetting =
            adminSettings
                .modeSettings[
                    defaultMode
                ];


        if (
            modeSetting &&
            Number.isFinite(
                Number(
                    modeSetting.delayMinutes
                )
            )
        ) {

            return {

                enabled:
                    true,

                mode:
                    defaultMode,

                delayMinutes:
                    Math.floor(
                        Number(
                            modeSetting.delayMinutes
                        )
                    ),

                source:
                    "ADMIN_DEFAULT",

                adminSettings:
                    adminSettings,

                partnerSettings:
                    partnerSettings

            };
        }
    }


    // -----------------------------------------------------
    // NO VALID CONFIGURATION
    // -----------------------------------------------------

    return {

        enabled:
            true,

        mode:
            "",

        delayMinutes:
            0,

        source:
            "NO_VALID_CONFIGURATION",

        adminSettings:
            adminSettings,

        partnerSettings:
            partnerSettings

    };
}


// =========================================================
// VALIDATE EFFECTIVE SETTLEMENT SETTINGS
// =========================================================

function validateEffectiveSettlementSettings(
    settings
) {

    if (
        !settings ||
        typeof settings !== "object"
    ) {

        return false;
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


    const delayMinutes =
        Number(
            settings.delayMinutes
        );


    if (
        !Number.isFinite(
            delayMinutes
        ) ||
        delayMinutes < 0
    ) {

        return false;
    }


    return true;
}


// =========================================================
// CALCULATE SETTLEMENT ELIGIBILITY TIME
// =========================================================
// serviceCompletedAt + Admin configured delay
//
// IMPORTANT:
// Delay Firebase configuration se aata hai.
// =========================================================

function calculateSettlementEligibleAt(
    serviceCompletedAt,
    effectiveSettings
) {

    const completedAt =
        Number(
            serviceCompletedAt
        );


    if (
        !Number.isFinite(
            completedAt
        ) ||
        completedAt <= 0
    ) {

        throw new Error(
            "Invalid service completion time"
        );
    }


    if (
        !validateEffectiveSettlementSettings(
            effectiveSettings
        )
    ) {

        throw new Error(
            "Invalid settlement configuration"
        );
    }


    const delayMinutes =
        Number(
            effectiveSettings.delayMinutes
        );


    return (
        completedAt +
        (
            delayMinutes *
            60 *
            1000
        )
    );
}


// =========================================================
// EXPORT
// =========================================================

module.exports = {

    getAdminSettlementSettings,

    updateAdminSettlementConfig,

    getPartnerSettlementSettings,

    updatePartnerSettlementPreference,

    getEffectiveSettlementSettings,

    validateEffectiveSettlementSettings,

    calculateSettlementEligibleAt,

    isValidSettlementMode

};
