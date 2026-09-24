// =========================================================
// BARBER JI - SETTLEMENT SERVICE
// =========================================================
// Responsibility:
// - Partner settlement amount calculate karna
// - Service complete hone ke baad settlement eligibility
//   determine karna
// - Admin settlement configuration use karna
// - Partner + Salon settlement preference use karna
// - Firebase configured delay ke basis par
//   settlementEligibleAt calculate karna
// - Settlement record create/update karna
//
// IMPORTANT:
// - Koi hardcoded settlement timing nahi hai.
// - Admin configuration authoritative hai.
// - Partner ki allowed settlement preference use hogi.
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
// GET PARTNER SETTLEMENT PREFERENCE
// =========================================================
// ApprovedSalons mein saved preference read karta hai.
//
// IMPORTANT:
// Ye sirf compatibility/read helper hai.
// Final effective settlement mode
// settlementConfigService decide karegi.
// =========================================================

async function getPartnerSettlementPreference(
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
            .child("settlementPreference")
            .once("value");


    if (!snapshot.exists()) {

        return "";
    }


    return cleanString(
        snapshot.val()
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
// Booking:
//
// bookingAmount = customer se total payment
// commission    = Barber Ji commission
// salonAmount   = partner ka payable amount
//
// IMPORTANT:
// Existing stored salonAmount authoritative rahega.
// Agar stored value available nahi hai,
// bookingAmount - commission calculate hoga.
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


    let salonAmount =
        storedSalonAmount;


    // -----------------------------------------------------
    // FALLBACK CALCULATION
    // -----------------------------------------------------

    if (
        salonAmount <= 0 &&
        bookingAmount > commission
    ) {

        salonAmount =
            Math.round(
                (
                    bookingAmount -
                    commission
                ) * 100
            ) / 100;
    }


    if (
        salonAmount < 0
    ) {

        salonAmount = 0;
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
// Service completion ke baad ye function decide karega:
//
// - settlement enabled hai ya nahi
// - partner preference kya hai
// - admin default kya hai
// - configured delay kitna hai
// - settlementEligibleAt kya hoga
//
// IMPORTANT:
// Koi hardcoded timing nahi.
// Delay settlementConfigService se aayega.
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


    const settlement =
        calculatePartnerPayable(
            booking
        );


    const partnerId =
        cleanString(
            booking.partnerId
        );


    const salonId =
        cleanString(
            booking.salonId
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


    // =====================================================
    // GET EFFECTIVE CONFIGURATION
    // =====================================================
    // Admin + Partner + Salon configuration
    // settlementConfigService se aayegi.
    //
    // IMPORTANT:
    // partnerId + salonId dono pass karna zaroori hai.
    // =====================================================

    const effectiveSettings =
        await settlementConfigService
            .getEffectiveSettlementSettings(
                partnerId,
                salonId
            );


    // =====================================================
    // VALIDATE CONFIGURATION
    // =====================================================

    const validConfiguration =
        settlementConfigService
            .validateEffectiveSettlementSettings(
                effectiveSettings
            );


    // =====================================================
    // NO VALID CONFIGURATION
    // =====================================================
    // Settlement record create ho sakta hai,
    // lekin payout eligibility available nahi hogi.
    // =====================================================

    if (!validConfiguration) {

        return {

            eligible:
                false,

            bookingId:
                cleanString(
                    booking.bookingId ||
                    booking.orderId
                ),

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

            settlementEligibleAt:
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


    // =====================================================
    // EFFECTIVE MODE
    // =====================================================

    const settlementMode =
        cleanString(
            effectiveSettings.mode
        ).toUpperCase();


    // =====================================================
    // CONFIGURED DELAY
    // =====================================================

    const delayMinutes =
        Number(
            effectiveSettings.delayMinutes
        );


    if (
        !Number.isFinite(
            delayMinutes
        ) ||
        delayMinutes < 0
    ) {

        return {

            eligible:
                false,

            bookingId:
                cleanString(
                    booking.bookingId ||
                    booking.orderId
                ),

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
                settlementMode,

            settlementType:
                settlementMode,

            settlementDelayMinutes:
                0,

            settlementEligibleAt:
                0,

            reason:
                "Invalid settlement timing configuration",

            adminSettings:
                effectiveSettings.adminSettings,

            partnerSettings:
                effectiveSettings.partnerSettings

        };
    }


    // =====================================================
    // SERVICE COMPLETION TIME
    // =====================================================
    // Agar booking mein already serviceCompletedAt hai
    // to uska use karenge.
    //
    // createSettlementRecord se bhi explicit time
    // pass kiya ja sakta hai.
    // =====================================================

    const completedAt =
        Number(
            booking.serviceCompletedAt ||
            booking.service_completed_at ||
            0
        );


    let settlementEligibleAt = 0;


    if (
        Number.isFinite(completedAt) &&
        completedAt > 0
    ) {

        settlementEligibleAt =
            settlementConfigService
                .calculateSettlementEligibleAt(
                    completedAt,
                    effectiveSettings
                );
    }


    // =====================================================
    // RETURN
    // =====================================================

    return {

        eligible:
            false,

        bookingId:
            cleanString(
                booking.bookingId ||
                booking.orderId
            ),

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
            settlementMode,

        settlementType:
            settlementMode,

        settlementDelayMinutes:
            Math.floor(
                delayMinutes
            ),

        settlementEligibleAt:
            settlementEligibleAt,

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
// Ye function:
// - settlement amount save karega
// - configured delay save karega
// - settlementEligibleAt save karega
// - duplicate settlement prevent karega
//
// Actual Razorpay payout yahan nahi hoga.
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


    // =====================================================
    // SERVICE COMPLETION TIME
    // =====================================================

    const completedAt =
        serviceCompletedAt
            ? Number(serviceCompletedAt)
            : (
                Number(
                    booking.serviceCompletedAt ||
                    booking.service_completed_at ||
                    0
                ) || Date.now()
            );


    if (
        !Number.isFinite(completedAt) ||
        completedAt <= 0
    ) {

        throw new Error(
            "Invalid service completion time"
        );
    }


    // =====================================================
    // CREATE BOOKING COPY FOR ELIGIBILITY
    // =====================================================
    // calculateSettlementEligibility ko exact
    // service completion time available rahe.
    // =====================================================

    const bookingForEligibility = {

        ...booking,

        serviceCompletedAt:
            completedAt

    };


    // =====================================================
    // PARTNER PREFERENCE
    // =====================================================
    // ApprovedSalons preference read ki ja sakti hai,
    // lekin final authoritative preference
    // settlementConfigService se resolve hogi.
    // =====================================================

    const partnerPreference =
        await getPartnerSettlementPreference(
            salonId
        );


    // =====================================================
    // ELIGIBILITY
    // =====================================================

    const eligibility =
        await calculateSettlementEligibility({

            booking:
                bookingForEligibility,

            partnerPreference:
                partnerPreference

        });


    // =====================================================
    // SETTLEMENT RECORD ID
    // =====================================================

    const settlementId =
        "SETTLE_" +
        bookingId;


    const settlementRef =
        db
            .ref("BarberJi")
            .child("Settlements")
            .child(settlementId);


    // =====================================================
    // DUPLICATE PROTECTION
    // =====================================================

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


    // =====================================================
    // SETTLEMENT RECORD
    // =====================================================

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

        settlementEligibleAt:
            eligibility.settlementEligibleAt,

        status:
            "PENDING",

        createdAt:
            ServerValue.TIMESTAMP

    };


    // =====================================================
    // SAVE
    // =====================================================

    await settlementRef.set(
        settlementRecord
    );


    // =====================================================
    // RESULT
    // =====================================================

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
