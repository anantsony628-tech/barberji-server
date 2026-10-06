// =========================================================
// BARBER JI - PAYMENT COMMISSION SERVICE
// =========================================================
// SALON-SIDE COMMISSION ONLY
//
// Responsibility:
// - Admin Firebase settings read karna
// - Salon-side commission calculate karna
// - Per Booking / Per Service extra fee calculate karna
// - Salon receivable calculate karna
//
// IMPORTANT:
// - Customer-side commission is NOT handled here.
// - No hardcoded commission/fee.
// - Firebase Admin settings are authoritative.
// - Missing/invalid settings => NO CHARGE.
// - Existing payment/booking services ke liye
//   commission field compatibility maintain ki gayi hai.
// =========================================================

const {
    getDatabase
} = require("firebase-admin/database");

const db = getDatabase();


// =========================================================
// SAFE DEFAULT
// =========================================================
// Firebase setting missing ho to koi hardcoded charge nahi.
// =========================================================

const DEFAULT_SETTINGS = {
    mode: "NONE",
    value: 0,
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

    const data = snapshot.val();

    if (!data || typeof data !== "object") {
        return {
            ...DEFAULT_SETTINGS
        };
    }


    // -------------------------
    // MODE
    // -------------------------

    const mode =
        data.mode
            ? String(data.mode).toUpperCase()
            : DEFAULT_SETTINGS.mode;


    // -------------------------
    // VALUE
    // -------------------------

    const rawValue = Number(data.value);

    const value =
        Number.isFinite(rawValue) && rawValue >= 0
            ? rawValue
            : 0;


    // -------------------------
    // FEE TYPE
    // -------------------------

    const feeType =
        data.fee_type
            ? String(data.fee_type).toUpperCase()
            : DEFAULT_SETTINGS.feeType;


    // -------------------------
    // PAYMENT MODE
    // -------------------------

    const paymentMode =
        data.payment_mode
            ? String(data.payment_mode).toUpperCase()
            : DEFAULT_SETTINGS.paymentMode;


    // -------------------------
    // EXTRA FEE
    // -------------------------

    const rawExtraFee =
        Number(data.extra_fee);

    const extraFee =
        Number.isFinite(rawExtraFee) && rawExtraFee >= 0
            ? rawExtraFee
            : 0;


    return {

        mode:
            mode === "FIXED" ||
            mode === "NONE" ||
            mode === "PERCENT"
                ? mode
                : "NONE",

        value:
            mode === "NONE"
                ? 0
                : value,

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

        extraFee
    };
}


// =========================================================
// CALCULATE SALON-SIDE COMMISSION
// =========================================================
//
// bookingAmount:
//     Total verified service amount.
//
// serviceCount:
//     Number of selected services.
//
// NOTE:
// feeType currently controls EXTRA FEE.
// Base commission remains percentage/fixed/none.
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


    // -------------------------
    // SAFE SERVICE COUNT
    // -------------------------

    let count =
        Number(serviceCount);

    if (
        !Number.isFinite(count) ||
        count < 1
    ) {
        count = 1;
    }

    count = Math.floor(count);


    // =====================================================
    // BASE SALON COMMISSION
    // =====================================================

    const mode =
        String(
            settings.mode || "NONE"
        ).toUpperCase();

    const value =
        Number(settings.value);


    let commissionAmount = 0;


    // -------------------------
    // NO CHARGE
    // -------------------------

    if (mode === "NONE") {

        commissionAmount = 0;

    }

    // -------------------------
    // FIXED
    // -------------------------

    else if (mode === "FIXED") {

        commissionAmount =
            Number.isFinite(value) &&
            value >= 0
                ? value
                : 0;

    }

    // -------------------------
    // PERCENT
    // -------------------------

    else if (mode === "PERCENT") {

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


        commissionAmount =
            (
                amount *
                percentage
            ) / 100;

    }

    else {

        // Unknown mode = NO CHARGE
        commissionAmount = 0;
    }


    // =====================================================
    // SALON EXTRA FEE
    // =====================================================

    const configuredExtraFee =
        Number(settings.extraFee);


    let extraFeeTotal = 0;


    if (
        Number.isFinite(configuredExtraFee) &&
        configuredExtraFee > 0
    ) {

        const feeType =
            String(
                settings.feeType || "PER_BOOKING"
            ).toUpperCase();


        if (feeType === "PER_SERVICE") {

            // Example:
            // ₹5 × 2 services = ₹10

            extraFeeTotal =
                configuredExtraFee *
                count;

        } else {

            // PER_BOOKING
            // Example:
            // ₹5 × 1 booking = ₹5

            extraFeeTotal =
                configuredExtraFee;
        }
    }


    // =====================================================
    // ROUND INDIVIDUAL VALUES
    // =====================================================

    commissionAmount =
        Math.round(
            commissionAmount * 100
        ) / 100;


    extraFeeTotal =
        Math.round(
            extraFeeTotal * 100
        ) / 100;


    // =====================================================
    // TOTAL SALON-SIDE DEDUCTION
    // =====================================================

    let totalSalonDeduction =
        commissionAmount +
        extraFeeTotal;


    totalSalonDeduction =
        Math.round(
            totalSalonDeduction * 100
        ) / 100;


    // Salon se service amount se zyada
    // deduction kabhi nahi hoga.

    if (
        totalSalonDeduction >
        amount
    ) {
        totalSalonDeduction =
            amount;
    }


    // =====================================================
    // SALON RECEIVABLE
    // =====================================================

    const salonAmount =
        Math.round(
            (
                amount -
                totalSalonDeduction
            ) * 100
        ) / 100;


    // =====================================================
    // RETURN
    // =====================================================
    //
    // commission:
    //     Existing backend compatibility ke liye
    //     TOTAL salon-side deduction.
    //
    // commissionAmount:
    //     Actual percentage/fixed commission.
    //
    // extraFee:
    //     Actual calculated extra fee.
    // =====================================================

    return {

        bookingAmount:
            amount,

        serviceCount:
            count,

        commissionAmount:
            commissionAmount,

        extraFee:
            extraFeeTotal,

        totalSalonDeduction:
            totalSalonDeduction,

        // Existing services ke liye compatibility.
        commission:
            totalSalonDeduction,

        salonAmount:
            salonAmount
    };
}


// =========================================================
// CALCULATE BOOKING COMMISSION
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
