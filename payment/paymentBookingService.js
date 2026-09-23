// =========================================================
// BARBER JI - PAYMENT BOOKING SERVICE
// =========================================================
// Responsibility:
// - Payment ke liye booking data validate karna
// - Booking amount ko safely paise mein convert karna
// - Booking ownership/auth information provide karna
// - Verified PaymentIntent se final Booking banana
// - Booking ke liye OTP + Salon Token generate karna
//
// IMPORTANT:
// - Final booking sirf verified payment ke baad banegi.
// - Existing Booking fields preserve kiye gaye hain.
// - Duplicate payment verification se duplicate booking nahi banegi.
//
// This file does NOT:
// - create Razorpay order
// - verify Razorpay payment signature
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
// CONVERT RUPEES TO PAISE
// =========================================================

function rupeesToPaise(amountRupees) {

    const numericAmount =
        Number(amountRupees);

    if (
        !Number.isFinite(
            numericAmount
        ) ||
        numericAmount <= 0
    ) {

        throw new Error(
            "Invalid booking amount"
        );
    }


    const paise =
        Math.round(
            numericAmount * 100
        );


    if (
        !Number.isSafeInteger(
            paise
        ) ||
        paise <= 0
    ) {

        throw new Error(
            "Invalid payment amount"
        );
    }


    return paise;
}


// =========================================================
// GET BOOKING
// =========================================================

async function getBooking(
    bookingId
) {

    if (
        !bookingId ||
        String(bookingId).trim() === ""
    ) {

        throw new Error(
            "Booking ID is required"
        );
    }


    const cleanBookingId =
        String(
            bookingId
        ).trim();


    const snapshot =
        await db
            .ref(
                `Bookings/${cleanBookingId}`
            )
            .once("value");


    if (
        !snapshot.exists()
    ) {

        throw new Error(
            "Booking not found"
        );
    }


    const booking =
        snapshot.val();


    if (
        !booking ||
        typeof booking !== "object"
    ) {

        throw new Error(
            "Invalid booking data"
        );
    }


    return {

        bookingId:
            cleanBookingId,

        booking
    };
}


// =========================================================
// VALIDATE BOOKING FOR PAYMENT
// =========================================================

async function validateBookingForPayment(
    bookingId
) {

    const result =
        await getBooking(
            bookingId
        );


    const booking =
        result.booking;


    if (
        !booking.customerId
    ) {

        throw new Error(
            "Customer ID missing in booking"
        );
    }


    if (
        !booking.salonId
    ) {

        throw new Error(
            "Salon ID missing in booking"
        );
    }


    if (
        !booking.serviceName
    ) {

        throw new Error(
            "Service missing in booking"
        );
    }


    const bookingAmount =
        Number(
            booking.bookingAmount
        );


    if (
        !Number.isFinite(
            bookingAmount
        ) ||
        bookingAmount <= 0
    ) {

        throw new Error(
            "Invalid booking amount"
        );
    }


    const amountPaise =
        rupeesToPaise(
            bookingAmount
        );


    const authUid =
        booking.authUid
            ? String(
                booking.authUid
            )
            : "";


    const customerAuthUid =
        booking.customerAuthUid
            ? String(
                booking.customerAuthUid
            )
            : "";


    return {

        bookingId:
            result.bookingId,

        customerId:
            String(
                booking.customerId
            ),

        salonId:
            String(
                booking.salonId
            ),

        partnerId:
            booking.partnerId
                ? String(
                    booking.partnerId
                )
                : "",

        serviceName:
            String(
                booking.serviceName
            ),

        bookingAmount:
            bookingAmount,

        amountPaise:
            amountPaise,

        paymentMode:
            booking.paymentMode
                ? String(
                    booking.paymentMode
                )
                : "",

        authUid:
            authUid,

        customerAuthUid:
            customerAuthUid
    };
}


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

    if (!Array.isArray(services)) {

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
// FINALIZE PAYMENT BOOKING
// =========================================================
// IMPORTANT:
// Is function ko Razorpay signature verification ke
// BAAD call kiya jayega.
//
// PaymentIntent se authoritative data liya jayega.
// Client ke amount par trust nahi kiya jayega.
//
// Creates:
// Bookings/{bookingId}
//
// Updates:
// BarberJi/PaymentIntents/{paymentIntentId}
// =========================================================

async function finalizePaymentBooking({
    paymentIntent,
    razorpayPaymentId
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


    const cleanPaymentId =
        String(
            razorpayPaymentId || ""
        ).trim();


    if (!cleanPaymentId) {

        throw new Error(
            "Razorpay payment ID is missing"
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


    if (!snapshot.exists()) {

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
                storedIntent.paymentId ||
                cleanPaymentId,

            otp:
                storedIntent.otp ||
                "",

            tokenNo:
                storedIntent.tokenNo ||
                ""
        };
    }


    // =====================================================
    // PAYMENT INTENT STATUS CHECK
    // =====================================================

    if (
        storedIntent.status !== "CREATED"
    ) {

        throw new Error(
            "Payment intent is not available for booking"
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


    const paymentMode =
        String(
            storedIntent.paymentMode || "UPI"
        ).trim();


    const bookingAmount =
        Number(
            storedIntent.bookingAmount || 0
        );


    const commission =
        Number(
            storedIntent.commission || 0
        );


    const salonAmount =
        Number(
            storedIntent.salonAmount || 0
        );


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


    if (
        !Number.isFinite(
            bookingAmount
        ) ||
        bookingAmount <= 0
    ) {

        throw new Error(
            "Invalid booking amount"
        );
    }


    // =====================================================
    // PAYMENT AMOUNT SAFETY
    // =====================================================

    const amountPaise =
        rupeesToPaise(
            bookingAmount
        );


    const storedRazorpayAmountPaise =
        Number(
            storedIntent.razorpayAmountPaise || 0
        );


    if (
        storedRazorpayAmountPaise <= 0
    ) {

        throw new Error(
            "Invalid Razorpay amount in payment intent"
        );
    }


    if (
        amountPaise !==
        storedRazorpayAmountPaise
    ) {

        throw new Error(
            "Payment amount mismatch"
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
    // GENERATE SALON TOKEN
    // =====================================================
    // Transaction ensures two simultaneous bookings
    // do not receive the same token.
    // =====================================================

    const salonTokenRef =
        db
            .ref("ApprovedSalons")
            .child(salonId)
            .child("currentToken");


    const tokenTransaction =
        await salonTokenRef.transaction(
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
        !Number.isFinite(
            tokenNo
        ) ||
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
            cleanPaymentId,

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
            paymentMode,

        bookingAmount:
            bookingAmount,

        commission:
            commission,

        paidOnline:
            bookingAmount,

        payAtSalon:
            0,

        salonAmount:
            salonAmount,

        status:
            "BOOKED"
    };


    // =====================================================
    // FIREBASE ATOMIC UPDATE
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
        cleanPaymentId;


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
            cleanPaymentId,

        otp:
            otp,

        tokenNo:
            tokenNo,

        bookingAmount:
            bookingAmount,

        commission:
            commission,

        salonAmount:
            salonAmount
    };
}


// =========================================================
// EXPORT
// =========================================================

module.exports = {

    rupeesToPaise,

    getBooking,

    validateBookingForPayment,

    finalizePaymentBooking
};
