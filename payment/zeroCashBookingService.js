// =========================================================
// BARBER JI - ZERO CASH BOOKING SERVICE
// =========================================================
// Responsibility:
// - Sirf CASH + ₹0 online deduction booking
// - Razorpay ki zarurat nahi
// - Existing paymentBookingService ko touch nahi karta
// - PaymentIntent ke server-calculated data se booking create
// - OTP + daily salon token generate
//
// This file does NOT:
// - create Razorpay order
// - verify Razorpay payment
// - process refund
// - process payout
// =========================================================

const {
    getDatabase,
    ServerValue
} = require("firebase-admin/database");

const crypto =
    require("crypto");


// =========================================================
// FIREBASE DATABASE
// =========================================================

const db =
    getDatabase();


// =========================================================
// CREATE OTP
// =========================================================

function createBookingOtp() {

    return String(
        crypto.randomInt(
            1000,
            10000
        )
    );
}


// =========================================================
// CREATE BOOKING ID
// =========================================================

function createBookingId() {

    return (
        "BJ" +
        Date.now() +
        crypto
            .randomBytes(3)
            .toString("hex")
            .toUpperCase()
    );
}


// =========================================================
// GET SERVICE NAME
// =========================================================

function getServiceName(
    services
) {

    if (
        !Array.isArray(services)
    ) {

        return "";
    }


    return services
        .map(service => {

            if (
                !service ||
                typeof service !== "object"
            ) {

                return "";
            }


            return String(
                service.name || ""
            ).trim();

        })
        .filter(
            name => name !== ""
        )
        .join(", ");
}


// =========================================================
// FINALIZE ZERO CASH BOOKING
// =========================================================
// IMPORTANT:
// - Sirf CASH payment mode.
// - Sirf ₹0 salon deduction.
// - Razorpay payment ID nahi chahiye.
// - Booking data stored PaymentIntent se liya jayega.
// - Client amount par trust nahi kiya jayega.
// =========================================================

async function finalizeZeroCashBooking({
    paymentIntent
}) {

    if (
        !paymentIntent ||
        typeof paymentIntent !== "object"
    ) {

        throw new Error(
            "Invalid payment intent"
        );
    }


    const paymentIntentId =
        String(
            paymentIntent.paymentIntentId || ""
        ).trim();


    if (!paymentIntentId) {

        throw new Error(
            "Payment intent ID is missing"
        );
    }


    // =====================================================
    // READ STORED PAYMENT INTENT
    // =====================================================

    const paymentIntentRef =
        db
            .ref("BarberJi")
            .child("PaymentIntents")
            .child(paymentIntentId);


    const snapshot =
        await paymentIntentRef.once(
            "value"
        );


    if (
        !snapshot.exists()
    ) {

        throw new Error(
            "Payment intent not found"
        );
    }


    const storedIntent =
        snapshot.val();


    if (
        !storedIntent ||
        typeof storedIntent !== "object"
    ) {

        throw new Error(
            "Invalid stored payment intent"
        );
    }


    // =====================================================
    // DUPLICATE PROTECTION
    // =====================================================

    if (
        storedIntent.status === "BOOKED" &&
        storedIntent.bookingId
    ) {

        return {

            success: true,

            duplicate: true,

            bookingId:
                String(
                    storedIntent.bookingId
                ),

            paymentIntentId:
                paymentIntentId,

            paymentId:
                "",

            otp:
                storedIntent.otp || "",

            tokenNo:
                storedIntent.tokenNo || "",

            bookingAmount:
                Number(
                    storedIntent.bookingAmount || 0
                ),

            commission:
                0,

            salonAmount:
                Number(
                    storedIntent.salonAmount || 0
                )
        };
    }


    // =====================================================
    // STATUS CHECK
    // =====================================================

    if (
        storedIntent.status !==
        "NO_PAYMENT_REQUIRED"
    ) {

        throw new Error(
            "Payment intent is not available for zero-payment booking"
        );
    }


    // =====================================================
    // PAYMENT MODE CHECK
    // =====================================================

    const paymentMode =
        String(
            storedIntent.paymentMode || ""
        ).trim().toUpperCase();


    if (
        paymentMode !== "CASH"
    ) {

        throw new Error(
            "Zero-payment booking is allowed only for Cash"
        );
    }


    // =====================================================
    // REQUIRED DATA
    // =====================================================

    const customerId =
        String(
            storedIntent.customerId || ""
        ).trim();


    const customerName =
        String(
            storedIntent.customerName || ""
        ).trim();


    const customerMobile =
        String(
            storedIntent.customerMobile || ""
        ).trim();


    const salonId =
        String(
            storedIntent.salonId || ""
        ).trim();


    const partnerId =
        String(
            storedIntent.partnerId || ""
        ).trim();


    const salonName =
        String(
            storedIntent.salonName || ""
        ).trim();


    const ownerMobile =
        String(
            storedIntent.ownerMobile || ""
        ).trim();


    const bookingDate =
        String(
            storedIntent.bookingDate || ""
        ).trim();


    const bookingTime =
        String(
            storedIntent.bookingTime || ""
        ).trim();


    if (!customerId) {

        throw new Error(
            "Customer ID missing"
        );
    }


    if (!salonId) {

        throw new Error(
            "Salon ID missing"
        );
    }


    if (!partnerId) {

        throw new Error(
            "Partner ID missing"
        );
    }


    if (!salonName) {

        throw new Error(
            "Salon name missing"
        );
    }


    if (!bookingDate) {

        throw new Error(
            "Booking date missing"
        );
    }


    if (!bookingTime) {

        throw new Error(
            "Booking time missing"
        );
    }


    // =====================================================
    // AMOUNT VALIDATION
    // =====================================================

    const bookingAmount =
        Number(
            storedIntent.bookingAmount || 0
        );


    const commission =
        Number(
            storedIntent.commission || 0
        );


    const commissionAmount =
        Number(
            storedIntent.commissionAmount || 0
        );


    const extraFee =
        Number(
            storedIntent.extraFee || 0
        );


    const salonCommissionTotal =
        Number(
            storedIntent.salonCommissionTotal ||
            commission
        );


    const salonAmount =
        Number(
            storedIntent.salonAmount || 0
        );


    if (
        !Number.isFinite(bookingAmount) ||
        bookingAmount <= 0
    ) {

        throw new Error(
            "Invalid booking amount"
        );
    }


    if (
        !Number.isFinite(commission) ||
        commission !== 0
    ) {

        throw new Error(
            "Zero-payment booking requires zero commission"
        );
    }


    if (
        !Number.isFinite(commissionAmount) ||
        commissionAmount < 0
    ) {

        throw new Error(
            "Invalid commission base amount"
        );
    }


    if (
        !Number.isFinite(extraFee) ||
        extraFee < 0
    ) {

        throw new Error(
            "Invalid extra fee"
        );
    }


    if (
        !Number.isFinite(salonCommissionTotal) ||
        salonCommissionTotal !== 0
    ) {

        throw new Error(
            "Zero-payment booking requires zero salon deduction"
        );
    }


    if (
        !Number.isFinite(salonAmount) ||
        salonAmount !== bookingAmount
    ) {

        throw new Error(
            "Invalid salon amount for zero-payment booking"
        );
    }


    // =====================================================
    // RAZORPAY AMOUNT MUST BE ZERO
    // =====================================================

    const storedRazorpayAmountPaise =
        Number(
            storedIntent.razorpayAmountPaise || 0
        );


    if (
        !Number.isSafeInteger(
            storedRazorpayAmountPaise
        ) ||
        storedRazorpayAmountPaise !== 0
    ) {

        throw new Error(
            "Invalid zero-payment amount"
        );
    }


    // =====================================================
    // GENERATE BOOKING ID + OTP
    // =====================================================

    const bookingId =
        createBookingId();


    const otp =
        createBookingOtp();


    // =====================================================
    // DAILY TOKEN DATE KEY
    // =====================================================

    const tokenDateKey =
        bookingDate
            .replace(/\//g, "-")
            .replace(/\s+/g, "_")
            .trim();


    if (!tokenDateKey) {

        throw new Error(
            "Invalid booking date for token generation"
        );
    }


    // =====================================================
    // DAILY TOKEN REFERENCE
    // =====================================================

    const dailyTokenRef =
        db
            .ref("BarberJi")
            .child("TokenCounters")
            .child(salonId)
            .child(tokenDateKey)
            .child("lastToken");


    // =====================================================
    // INITIALIZE TOKEN COUNTER
    // =====================================================

    const dailyCounterSnapshot =
        await dailyTokenRef.once(
            "value"
        );


    if (
        !dailyCounterSnapshot.exists()
    ) {

        const bookingsSnapshot =
            await db
                .ref("Bookings")
                .orderByChild("salonId")
                .equalTo(salonId)
                .once("value");


        let highestExistingToken = 0;


        bookingsSnapshot.forEach(
            bookingSnapshot => {

                const existingBookingDate =
                    String(
                        bookingSnapshot
                            .child("bookingDate")
                            .val() || ""
                    ).trim();


                if (
                    existingBookingDate !==
                    bookingDate
                ) {

                    return;
                }


                const existingToken =
                    Number(
                        bookingSnapshot
                            .child("tokenNo")
                            .val() || 0
                    );


                if (
                    Number.isFinite(
                        existingToken
                    ) &&
                    existingToken >
                        highestExistingToken
                ) {

                    highestExistingToken =
                        existingToken;
                }
            }
        );


        await dailyTokenRef.set(
            highestExistingToken
        );
    }


    // =====================================================
    // ATOMIC TOKEN INCREMENT
    // =====================================================

    const tokenTransaction =
        await dailyTokenRef.transaction(
            currentValue => {

                const current =
                    Number(
                        currentValue || 0
                    );


                return current + 1;
            }
        );


    if (
        !tokenTransaction.committed
    ) {

        throw new Error(
            "Unable to generate booking token"
        );
    }


    const tokenNo =
        Number(
            tokenTransaction.snapshot.val()
        );


    if (
        !Number.isFinite(tokenNo) ||
        tokenNo <= 0
    ) {

        throw new Error(
            "Invalid booking token"
        );
    }


    // =====================================================
    // SERVICE NAME
    // =====================================================

    const serviceName =
        getServiceName(
            storedIntent.services
        );


    // =====================================================
    // FINAL BOOKING OBJECT
    // =====================================================

    const booking = {

        orderId:
            bookingId,

        bookingId:
            bookingId,

        paymentIntentId:
            paymentIntentId,

        paymentId:
            "",

        authUid:
            storedIntent.authUid || "",

        customerAuthUid:
            storedIntent.customerAuthUid || "",

        customerId:
            customerId,

        customerName:
            customerName,

        customerMobile:
            customerMobile,

        salonId:
            salonId,

        partnerId:
            partnerId,

        salonName:
            salonName,

        ownerMobile:
            ownerMobile,

        serviceName:
            serviceName,

        serviceIds:
            Array.isArray(
                storedIntent.serviceIds
            )
                ? storedIntent.serviceIds
                : [],

        services:
            Array.isArray(
                storedIntent.services
            )
                ? storedIntent.services
                : [],

        bookingDate:
            bookingDate,

        bookingTime:
            bookingTime,

        bookingCreatedTime:
            ServerValue.TIMESTAMP,

        tokenNo:
            tokenNo,

        otp:
            otp,

        paymentMode:
            "Cash",

        bookingAmount:
            bookingAmount,

        commission:
            0,

        commissionAmount:
            commissionAmount,

        extraFee:
            extraFee,

        salonCommissionTotal:
            0,

        paidOnline:
            0,

        payAtSalon:
            bookingAmount,

        salonAmount:
            bookingAmount,

        status:
            "BOOKED"
    };


    // =====================================================
    // ATOMIC FIREBASE UPDATE
    // =====================================================

    const updates = {};


    updates[
        "Bookings/" +
        bookingId
    ] =
        booking;


    updates[
        "BarberJi/PaymentIntents/" +
        paymentIntentId +
        "/status"
    ] =
        "BOOKED";


    updates[
        "BarberJi/PaymentIntents/" +
        paymentIntentId +
        "/bookingId"
    ] =
        bookingId;


    updates[
        "BarberJi/PaymentIntents/" +
        paymentIntentId +
        "/paymentId"
    ] =
        "";


    updates[
        "BarberJi/PaymentIntents/" +
        paymentIntentId +
        "/otp"
    ] =
        otp;


    updates[
        "BarberJi/PaymentIntents/" +
        paymentIntentId +
        "/tokenNo"
    ] =
        tokenNo;


    updates[
        "BarberJi/PaymentIntents/" +
        paymentIntentId +
        "/verifiedAt"
    ] =
        ServerValue.TIMESTAMP;


    await db
        .ref()
        .update(
            updates
        );


    // =====================================================
    // RESULT
    // =====================================================

    return {

        success: true,

        duplicate: false,

        bookingId:
            bookingId,

        paymentIntentId:
            paymentIntentId,

        paymentId:
            "",

        otp:
            otp,

        tokenNo:
            tokenNo,

        bookingAmount:
            bookingAmount,

        commission:
            0,

        salonAmount:
            bookingAmount
    };
}


// =========================================================
// EXPORT
// =========================================================

module.exports = {

    finalizeZeroCashBooking

};
