// =========================================================
// BARBER JI - SETTLEMENT SERVICE
// =========================================================
// Responsibility:
// - Partner settlement amount calculate karna
// - Service complete hone ke baad settlement eligibility
//   determine karna
// - Admin settlement configuration use karna
// - Partner ki settlement preference use karna
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
// Expected path:
//
// ApprovedSalons/{salonId}/settlementPreference
//
// Possible value:
// - INSTANT
// - NEXT_DAY
// - configured option
//
// Agar preference available nahi hai to settlement
// configuration service decide karegi.
// =========================================================

async function getPartnerSettlementPreference(
    salonId
) {

    const cleanSalonId =
        cleanString(salonId);


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
        cleanString(salonId);


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
// Existing PaymentIntent/Booking ka calculated
// salonAmount authoritative rahega.
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
    // Agar stored salonAmount available nahi hai,
    // to booking amount - commission calculate hoga.
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
// Service complete hone ke baad ye function decide karega
// ki settlement kab eligible hoga.
//
// Actual timing settlementConfigService se aayegi.
//
// NO HARDCODED:
// - instant
// - 24 hours
// - next day
//
// Kuch bhi yahan fixed nahi hai.
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


    const config =
        await settlementConfigService
            .getSettlementConfig();


    const settlement =
        calculatePartnerPayable(
            booking
        );


    const preference =
        cleanString(
            partnerPreference
        ).toUpperCase();


    // -----------------------------------------------------
    // Settlement config service decide karegi ki
    // kaunsi preference allowed hai.
    // -----------------------------------------------------

    const timing =
        settlementConfigService
            .resolveSettlementTiming({

                config:
                    config,

                partnerPreference:
                    preference
            });


    return {

        eligible:
            false,

        bookingId:
            cleanString(
                booking.bookingId ||
                booking.orderId
            ),

        salonId:
            cleanString(
                booking.salonId
            ),

        partnerId:
            cleanString(
                booking.partnerId
            ),

        bookingAmount:
            settlement.bookingAmount,

        commission:
            settlement.commission,

        salonAmount:
            settlement.salonAmount,

        settlementPreference:
            timing.preference,

        settlementType:
            timing.type,

        settlementDelayMinutes:
            timing.delayMinutes,

        reason:
            "Settlement will become eligible after service completion and configured settlement time"
    };
}


// =========================================================
// CREATE SETTLEMENT RECORD
// =========================================================
// Service complete hone ke baad is function ko call kiya
// jayega.
//
// Ye sirf settlement record create karega.
// Razorpay payout yahan nahi hoga.
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
    // PARTNER PREFERENCE
    // -----------------------------------------------------

    const partnerPreference =
        await getPartnerSettlementPreference(
            salonId
        );


    // -----------------------------------------------------
    // ELIGIBILITY
    // -----------------------------------------------------

    const eligibility =
        await calculateSettlementEligibility({

            booking:
                booking,

            partnerPreference:
                partnerPreference

        });


    // -----------------------------------------------------
    // SERVICE COMPLETION TIME
    // -----------------------------------------------------

    const completedAt =
        serviceCompletedAt
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


    const existingSnapshot =
        await settlementRef.once(
            "value"
        );


    // -----------------------------------------------------
    // DUPLICATE PROTECTION
    // -----------------------------------------------------

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

        status:
            "PENDING",

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
