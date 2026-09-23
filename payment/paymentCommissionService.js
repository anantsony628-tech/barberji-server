// =========================================================
// BARBER JI - PAYMENT COMMISSION SERVICE
// =========================================================
// Responsibility:
// - Firebase se admin commission settings read karna
// - Backend par commission calculate karna
// - Salon receivable calculate karna
//
// IMPORTANT:
// - Android SharedPreferences par trust nahi karega
// - Payment ke time backend calculation authoritative hogi
// - Existing CommissionManager.java ko abhi touch nahi kiya gaya
//
// This file does NOT:
// - create Razorpay order
// - verify Razorpay payment
// - process refund
// - process payout
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
// DEFAULT COMMISSION SETTINGS
// =========================================================
// Ye fallback hai.
// Production mein admin setting Firebase mein available
// honi chahiye.
// =========================================================

const DEFAULT_SETTINGS = {

    mode:
        "PERCENT",

    value:
        10,

    feeType:
        "PER_BOOKING",

    paymentMode:
        "HYBRID",

    extraFee:
        0

};


// =========================================================
// GET COMMISSION SETTINGS
// =========================================================
// Existing Android setting ka Firebase counterpart.
// Expected path:
//
// BarberJi/Settings/Commission
//
// Example:
//
// {
//   mode: "PERCENT",
//   value: 10,
//   fee_type: "PER_BOOKING",
//   payment_mode: "HYBRID",
//   extra_fee: 5
// }
// =========================================================

async function getCommissionSettings() {

    const snapshot =
        await db
            .ref(
                "BarberJi/Settings/Commission"
            )
            .once("value");


    if (
        !snapshot.exists()
    ) {

        return {
            ...DEFAULT_SETTINGS
        };
    }


    const data =
        snapshot.val();


    if (
        !data ||
        typeof data !== "object"
    ) {

        return {
            ...DEFAULT_SETTINGS
        };
    }


    const mode =
        data.mode
            ? String(
                data.mode
            ).toUpperCase()
            : DEFAULT_SETTINGS.mode;


    const value =
        Number(
            data.value
        );


    const feeType =
        data.fee_type
            ? String(
                data.fee_type
            ).toUpperCase()
            : DEFAULT_SETTINGS.feeType;


    const paymentMode =
        data.payment_mode
            ? String(
                data.payment_mode
            ).toUpperCase()
            : DEFAULT_SETTINGS.paymentMode;


    const extraFee =
        Number(
            data.extra_fee
        );


    return {

        mode:
            mode === "FIXED" ||
            mode === "NONE" ||
            mode === "PERCENT"
                ? mode
                : DEFAULT_SETTINGS.mode,

        value:
            Number.isFinite(value) &&
            value >= 0
                ? value
                : DEFAULT_SETTINGS.value,

        feeType:
            feeType === "PER_SERVICE" ||
            feeType === "PER_BOOKING"
                ? feeType
                : DEFAULT_SETTINGS.feeType,

        paymentMode:
            paymentMode === "FULL_ONLINE" ||
            paymentMode === "HYBRID"
                ? paymentMode
                : DEFAULT_SETTINGS.paymentMode,

        extraFee:
            Number.isFinite(extraFee) &&
            extraFee >= 0
                ? extraFee
                : DEFAULT_SETTINGS.extraFee

    };
}


// =========================================================
// CALCULATE COMMISSION
// =========================================================

function calculateCommission(
    bookingAmount,
    settings
) {

    const amount =
        Number(
            bookingAmount
        );


    if (
        !Number.isFinite(amount) ||
        amount <= 0
    ) {

        throw new Error(
            "Invalid booking amount"
        );
    }


    if (
        !settings ||
        typeof settings !== "object"
    ) {

        throw new Error(
            "Commission settings are required"
        );
    }


    const mode =
        String(
            settings.mode || "PERCENT"
        ).toUpperCase();


    const value =
        Number(
            settings.value
        );


    let commission = 0;


    // =====================================================
    // NONE
    // =====================================================

    if (
        mode === "NONE"
    ) {

        commission = 0;

    }

    // =====================================================
    // FIXED
    // =====================================================

    else if (
        mode === "FIXED"
    ) {

        commission =
            Number.isFinite(value)
                ? value
                : 0;

    }

    // =====================================================
    // PERCENT
    // =====================================================

    else {

        const percentage =
            Number.isFinite(value)
                ? value
                : 0;


        if (
            percentage < 0 ||
            percentage > 100
        ) {

            throw new Error(
                "Commission percentage must be between 0 and 100"
            );
        }


        commission =
            (
                amount *
                percentage
            ) / 100;

    }


    // =====================================================
    // EXTRA FEE
    // =====================================================

    const extraFee =
        Number(
            settings.extraFee
        );


    if (
        Number.isFinite(extraFee) &&
        extraFee > 0
    ) {

        commission +=
            extraFee;
    }


    // =====================================================
    // ROUND TO 2 DECIMAL PLACES
    // =====================================================

    commission =
        Math.round(
            commission * 100
        ) / 100;


    // =====================================================
    // COMMISSION CANNOT EXCEED BOOKING AMOUNT
    // =====================================================

    if (
        commission > amount
    ) {

        commission =
            amount;
    }


    // =====================================================
    // SALON RECEIVABLE
    // =====================================================

    const salonAmount =
        Math.round(
            (
                amount -
                commission
            ) * 100
        ) / 100;


    return {

        bookingAmount:
            amount,

        commission:
            commission,

        salonAmount:
            salonAmount

    };
}


// =========================================================
// CALCULATE COMMISSION FOR BOOKING
// =========================================================

async function calculateBookingCommission(
    bookingAmount
) {

    const settings =
        await getCommissionSettings();


    const calculation =
        calculateCommission(
            bookingAmount,
            settings
        );


    return {

        ...calculation,

        settings: {

            mode:
                settings.mode,

            value:
                settings.value,

            feeType:
                settings.feeType,

            paymentMode:
                settings.paymentMode,

            extraFee:
                settings.extraFee

        }

    };
}


// =========================================================
// EXPORT
// =========================================================

module.exports = {

    getCommissionSettings,

    calculateCommission,

    calculateBookingCommission

};
