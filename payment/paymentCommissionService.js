// =========================================================
// BARBER JI - PAYMENT COMMISSION SERVICE
// =========================================================
// ADMIN COMMISSION SETTINGS = AUTHORITATIVE SOURCE
//
// Firebase:
// BarberJi/Settings/Commission
//
// Supported:
// - PERCENT
// - FIXED
// - NONE
// - PER_BOOKING
// - PER_SERVICE
// - EXTRA FEE
// - HYBRID
// - FULL_ONLINE
//
// This file does NOT:
// - create Razorpay order
// - verify Razorpay payment
// - process refund
// - process payout
// - create/finalize booking
// =========================================================

const {
    getDatabase
} = require("firebase-admin/database");

const db = getDatabase();

const DEFAULT_SETTINGS = {
    mode: "PERCENT",
    value: 10,
    feeType: "PER_BOOKING",
    paymentMode: "HYBRID",
    extraFee: 0
};


// =========================================================
// READ ADMIN COMMISSION SETTINGS
// =========================================================

async function getCommissionSettings() {

    const snapshot =
        await db
            .ref("BarberJi/Settings/Commission")
            .once("value");


    if (!snapshot.exists()) {

        return {
            ...DEFAULT_SETTINGS
        };
    }


    const data =
        snapshot.val();


    if (!data || typeof data !== "object") {

        return {
            ...DEFAULT_SETTINGS
        };
    }


    const mode =
        data.mode
            ? String(data.mode).toUpperCase()
            : DEFAULT_SETTINGS.mode;


    const value =
        Number(data.value);


    const feeType =
        data.fee_type
            ? String(data.fee_type).toUpperCase()
            : DEFAULT_SETTINGS.feeType;


    const paymentMode =
        data.payment_mode
            ? String(data.payment_mode).toUpperCase()
            : DEFAULT_SETTINGS.paymentMode;


    const extraFee =
        Number(data.extra_fee);


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
    settings,
    serviceCount = 1
) {

    const amount =
        Number(bookingAmount);


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


    const feeType =
        String(
            settings.feeType || "PER_BOOKING"
        ).toUpperCase();


    const value =
        Number(settings.value);


    const extraFee =
        Number(settings.extraFee);


    const count =
        Math.max(
            1,
            Number(serviceCount) || 1
        );


    let commission = 0;


    // =====================================================
    // NO COMMISSION
    // =====================================================

    if (mode === "NONE") {

        commission = 0;

    }


    // =====================================================
    // FIXED COMMISSION
    // =====================================================

    else if (mode === "FIXED") {

        if (
            !Number.isFinite(value) ||
            value < 0
        ) {

            throw new Error(
                "Invalid fixed commission"
            );
        }


        if (feeType === "PER_SERVICE") {

            commission =
                value * count;

        } else {

            commission =
                value;
        }
    }


    // =====================================================
    // PERCENTAGE COMMISSION
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


        // Percentage on total booking amount.
        // Per Booking / Per Service gives same percentage
        // mathematically when all selected services are included
        // in bookingAmount.
        commission =
            (
                amount *
                percentage
            ) / 100;
    }


    // =====================================================
    // EXTRA FEE
    // =====================================================

    if (
        Number.isFinite(extraFee) &&
        extraFee > 0
    ) {

        if (feeType === "PER_SERVICE") {

            commission +=
                extraFee * count;

        } else {

            commission +=
                extraFee;
        }
    }


    // =====================================================
    // ROUND
    // =====================================================

    commission =
        Math.round(
            commission * 100
        ) / 100;


    // =====================================================
    // NEVER CHARGE MORE THAN BOOKING AMOUNT
    // =====================================================

    if (
        commission > amount
    ) {

        commission =
            amount;
    }


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
            salonAmount,

        feeType:
            feeType,

        serviceCount:
            count,

        extraFee:
            Number.isFinite(extraFee)
                ? extraFee
                : 0
    };
}


// =========================================================
// BOOKING COMMISSION
// =========================================================

async function calculateBookingCommission(
    bookingAmount,
    serviceCount = 1
) {

    const settings =
        await getCommissionSettings();


    const calculation =
        calculateCommission(
            bookingAmount,
            settings,
            serviceCount
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
// EXPORTS
// =========================================================

module.exports = {

    getCommissionSettings,

    calculateCommission,

    calculateBookingCommission
};
