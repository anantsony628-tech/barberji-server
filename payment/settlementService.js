// =========================================================
// BARBER JI - SETTLEMENT SERVICE
// =========================================================
// Responsibility:
// - Partner settlement amount calculate karna
// - Service complete hone ke baad settlement eligibility
//   determine karna
// - Admin settlement configuration use karna
// - Partner + Salon settlement preference use karna
// - Settlement record create karna
//
// IMPORTANT:
// - Settlement timing hardcoded nahi hai.
// - Admin configuration authoritative hai.
// - Partner ki preference sirf admin allowed modes mein se hogi.
// - Actual Razorpay payout is file mein nahi hoga.
// =========================================================

const {
    getDatabase,
    ServerValue
} = require("firebase-admin/database");

const db =
    getDatabase();

const settlementConfigService =
    require("./settlementConfigService");


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


function safeNumber(value) {

    const number =
        Number(value);

    if (
        !Number.isFinite(number)
    ) {

        return 0;
    }

    return Math.round(
        number * 100
    ) / 100;
}


// =========================================================
// GET PARTNER + SALON SETTLEMENT PREFERENCE
// =========================================================

async function getPartnerSettlementPreference(
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


    if (!cleanSalonId) {

        throw new Error(
            "Salon ID is required"
        );
    }


    const settings =
        await settlementConfigService
            .getPartnerSettlementSettings(
                cleanPartnerId,
                cleanSalonId
            );


    return cleanString(
        settings.preferredMode
    ).toUpperCase();
}


// =========================================================
// GET PARTNER / SALON DATA
// =========================================================

async function getPartnerSettlementData(
    salonId
) {

    const cleanSalonId =
        cleanString(
            salonId
        );


    if (!cleanSalonId) {

        throw new Error(
            "Salon ID is required"
        );
    }


    const snapshot =
        await db
            .ref("ApprovedSalons")
            .child(cleanSalonId)
            .once("value");


    if (!snapshot.exists()) {

        throw new Error(
            "Salon not found"
        );
    }


    const salon =
        snapshot.val();


    if (
        !salon ||
        typeof salon !== "object"
    ) {

        throw new Error(
            "Invalid salon data"
        );
    }


    return salon;
}


// =========================================================
// CALCULATE PARTNER PAYABLE
// =========================================================
//
// bookingAmount = customer se total payment
// commission    = Barber Ji commission
// salonAmount   = partner ka payable amount
//
// Stored salonAmount available ho to wahi authoritative hai.
// =========================================================

function calculatePartnerPayable(
    booking
) {

    if (
        !booking ||
        typeof booking !== "object"
    ) {

        throw new Error(
            "Invalid booking"
        );
    }


    const bookingAmount =
        safeNumber(
            booking.bookingAmount
        );


    const commission =
        safeNumber(
            booking.commission
        );


    const storedSalonAmount =
        safeNumber(
            booking.salonAmount
        );


    if (
        bookingAmount <= 0
    ) {

        throw new Error(
            "Invalid booking amount"
        );
    }


    if (
        commission < 0
    ) {

        throw new Error(
            "Invalid commission"
        );
    }


    let salonAmount =
        storedSalonAmount;


    // -----------------------------------------------------
    // Stored salon amount available nahi hai to calculate
    // karo.
    // -----------------------------------------------------

    if (
        salonAmount <= 0 &&
        bookingAmount > commission
    ) {

        salonAmount =
            safeNumber(
                bookingAmount -
                commission
            );
    }


    if (
        salonAmount < 0
    ) {

        salonAmount = 0;
    }


    // -----------------------------------------------------
    // Partner amount booking amount se zyada nahi ho sakta.
    // -----------------------------------------------------

    if (
        salonAmount > bookingAmount
    ) {

        salonAmount =
            bookingAmount;
    }


    return {

        bookingAmount:
            bookingAmount,

        commission:
            commission,

        salonAmount:
            salonAmount
    };
}


// =========================================================
// CALCULATE SETTLEMENT ELIGIBILITY
// =========================================================
// Service completion ke baad ye function determine karega:
//
// - settlement mode
// - configured delay
// - eligibleAt
//
// Timing Firebase Admin configuration se aayegi.
// =========================================================

async function calculateSettlementEligibility({
    booking,
    partnerPreference
}) {

    if (
        !booking ||
        typeof booking !== "object"
    ) {

        throw new Error(
            "Booking is required"
        );
    }


    const bookingId =
        cleanString(
            booking.bookingId ||
            booking.orderId
        );


    const salonId =
        cleanString(
            booking.salonId
        );


    const partnerId =
        cleanString(
            booking.partnerId
        );


    if (!bookingId) {

        throw new Error(
            "Booking ID is required"
        );
    }


    if (!salonId) {

        throw new Error(
            "Salon ID is required"
        );
    }


    if (!partnerId) {

        throw new Error(
            "Partner ID is required"
        );
    }


    const settlement =
        calculatePartnerPayable(
            booking
        );


    // -----------------------------------------------------
    // ADMIN + PARTNER CONFIGURATION
    // -----------------------------------------------------

    const effectiveSettings =
        await settlementConfigService
            .getEffectiveSettlementSettings(
                partnerId,
                salonId
            );


    // -----------------------------------------------------
    // VALIDATE EFFECTIVE CONFIGURATION
    // -----------------------------------------------------

    const validConfiguration =
        settlementConfigService
            .validateEffectiveSettlementSettings(
                effectiveSettings
            );


    // -----------------------------------------------------
    // NO VALID CONFIGURATION
    // -----------------------------------------------------

    if (!validConfiguration) {

        return {

            eligible:
                false,

            bookingId:
                bookingId,

            salonId:
                salonId,

            partnerId:
                partnerId,

            bookingAmount:
                settlement.bookingAmount,

            commission:
                settlement.commission,

            salonAmount:
                settlement.salonAmount,

            settlementPreference:
                "",

            settlementType:
                "",

            settlementDelayMinutes:
                0,

            serviceCompletedAt:
                0,

            eligibleAt:
                0,

            reason:
                effectiveSettings.enabled === false
                    ? "Settlement system is disabled by admin"
                    : "No valid settlement configuration is available",

            adminSettings:
                effectiveSettings.adminSettings,

            partnerSettings:
                effectiveSettings.partnerSettings

        };
    }


    // -----------------------------------------------------
    // EFFECTIVE MODE
    // -----------------------------------------------------

    const mode =
        cleanString(
            effectiveSettings.mode
        ).toUpperCase();


    // -----------------------------------------------------
    // GET CONFIGURED DELAY
    // -----------------------------------------------------

    const modeSettings =
        effectiveSettings
            .adminSettings
            .modeSettings ||
        {};


    const modeSetting =
        modeSettings[
            mode
        ];


    if (
        !modeSetting
    ) {

        return {

            eligible:
                false,

            bookingId:
                bookingId,

            salonId:
                salonId,

            partnerId:
                partnerId,

            bookingAmount:
                settlement.bookingAmount,

            commission:
                settlement.commission,

            salonAmount:
                settlement.salonAmount,

            settlementPreference:
                mode,

            settlementType:
                mode,

            settlementDelayMinutes:
                0,

            serviceCompletedAt:
                0,

            eligibleAt:
                0,

            reason:
                "Settlement timing is not configured for selected mode",

            adminSettings:
                effectiveSettings.adminSettings,

            partnerSettings:
                effectiveSettings.partnerSettings

        };
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
            "Invalid settlement delay configuration"
        );
    }


    return {

        eligible:
            false,

        bookingId:
            bookingId,

        salonId:
            salonId,

        partnerId:
            partnerId,

        bookingAmount:
            settlement.bookingAmount,

        commission:
            settlement.commission,

        salonAmount:
            settlement.salonAmount,

        settlementPreference:
            mode,

        settlementType:
            mode,

        settlementDelayMinutes:
            Math.floor(
                delayMinutes
            ),

        serviceCompletedAt:
            0,

        eligibleAt:
            0,

        reason:
            "Settlement will become eligible after service completion and configured settlement time",

        adminSettings:
            effectiveSettings.adminSettings,

        partnerSettings:
            effectiveSettings.partnerSettings

    };
}


// =========================================================
// CREATE SETTLEMENT RECORD
// =========================================================
// Service complete hone ke baad call hoga.
//
// IMPORTANT:
// Ye Razorpay payout nahi karta.
// Ye sirf settlement record create karta hai.
// =========================================================

async function createSettlementRecord({
    booking,
    serviceCompletedAt
}) {

    if (
        !booking ||
        typeof booking !== "object"
    ) {

        throw new Error(
            "Booking is required"
        );
    }


    const bookingId =
        cleanString(
            booking.bookingId ||
            booking.orderId
        );


    if (!bookingId) {

        throw new Error(
            "Booking ID is required"
        );
    }


    const salonId =
        cleanString(
            booking.salonId
        );


    const partnerId =
        cleanString(
            booking.partnerId
        );


    if (!salonId) {

        throw new Error(
            "Salon ID is required"
        );
    }


    if (!partnerId) {

        throw new Error(
            "Partner ID is required"
        );
    }


    // -----------------------------------------------------
    // SERVICE COMPLETION TIME
    // -----------------------------------------------------

    const completedAt =
        serviceCompletedAt !== undefined &&
        serviceCompletedAt !== null
            ? Number(serviceCompletedAt)
            : Date.now();


    if (
        !Number.isFinite(completedAt) ||
        completedAt <= 0
    ) {

        throw new Error(
            "Invalid service completion time"
        );
    }


    // -----------------------------------------------------
    // CALCULATE ELIGIBILITY CONFIG
    // -----------------------------------------------------

    const eligibility =
        await calculateSettlementEligibility({

            booking:
                booking,

            partnerPreference:
                ""

        });


    // -----------------------------------------------------
    // ELIGIBLE AT
    // -----------------------------------------------------

    let eligibleAt = 0;


    if (
        eligibility.settlementDelayMinutes >= 0 &&
        eligibility.settlementType
    ) {

        eligibleAt =
            completedAt +
            (
                eligibility
                    .settlementDelayMinutes *
                60 *
                1000
            );
    }


    // -----------------------------------------------------
    // FINAL ELIGIBILITY
    // -----------------------------------------------------

    const isEligible =
        eligibility.eligible === true ||
        (
            eligibility.settlementType !== "" &&
            eligibleAt > 0 &&
            Date.now() >= eligibleAt
        );


    // -----------------------------------------------------
    // SETTLEMENT RECORD ID
    // -----------------------------------------------------

    const settlementId =
        "SETTLE_" +
        bookingId;


    const settlementRef =
        db
            .ref("BarberJi")
            .child("Settlements")
            .child(settlementId);


    // -----------------------------------------------------
    // DUPLICATE PROTECTION
    // -----------------------------------------------------

    const existingSnapshot =
        await settlementRef.once(
            "value"
        );


    if (
        existingSnapshot.exists()
    ) {

        return {

            success:
                true,

            duplicate:
                true,

            settlementId:
                settlementId,

            settlement:
                existingSnapshot.val()

        };
    }


    // -----------------------------------------------------
    // SETTLEMENT RECORD
    // -----------------------------------------------------

    const settlementRecord = {

        settlementId:
            settlementId,

        bookingId:
            bookingId,

        salonId:
            salonId,

        partnerId:
            partnerId,

        customerId:
            cleanString(
                booking.customerId
            ),

        bookingAmount:
            eligibility.bookingAmount,

        commission:
            eligibility.commission,

        salonAmount:
            eligibility.salonAmount,

        paymentId:
            cleanString(
                booking.paymentId
            ),

        paymentIntentId:
            cleanString(
                booking.paymentIntentId
            ),

        settlementPreference:
            eligibility.settlementPreference,

        settlementType:
            eligibility.settlementType,

        settlementDelayMinutes:
            eligibility.settlementDelayMinutes,

        serviceCompletedAt:
            completedAt,

        eligibleAt:
            eligibleAt,

        status:
            isEligible
                ? "ELIGIBLE"
                : "PENDING",

        payoutStatus:
            "NOT_PROCESSED",

        createdAt:
            ServerValue.TIMESTAMP

    };


    await settlementRef.set(
        settlementRecord
    );


    return {

        success:
            true,

        duplicate:
            false,

        settlementId:
            settlementId,

        settlement:
            settlementRecord

    };
}


// =========================================================
// EXPORT
// =========================================================

module.exports = {

    getPartnerSettlementPreference,

    getPartnerSettlementData,

    calculatePartnerPayable,

    calculateSettlementEligibility,

    createSettlementRecord

};
