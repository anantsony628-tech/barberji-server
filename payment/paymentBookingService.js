// =========================================================
// BARBER JI - PAYMENT BOOKING SERVICE
// =========================================================
// Responsibility:
// - Payment ke liye booking data validate karna
// - Booking amount ko safely paise mein convert karna
// - Future mein authoritative commission/settings yahin
//   se calculate karna
//
// IMPORTANT:
// Abhi existing booking flow ko change nahi kiya ja raha.
// Ye file payment architecture ka foundation hai.
//
// This file does NOT:
// - create Razorpay order
// - verify Razorpay payment
// - process refund
// - process payout
// - directly update booking
// =========================================================

const admin =
    require("firebase-admin");


// =========================================================
// FIREBASE DATABASE
// =========================================================

const db =
    admin.database();


// =========================================================
// CONVERT RUPEES TO PAISE
// =========================================================
// Example:
// ₹500 -> 50000 paise
//
// Payment system mein Razorpay ke liye paise use honge.
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
// Ye function payment order banane se pehle
// booking ko basic level par validate karega.
//
// Abhi commission calculate nahi karta.
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


    // =====================================================
    // REQUIRED BOOKING FIELDS
    // =====================================================

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


    // =====================================================
    // BOOKING AMOUNT
    // =====================================================

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
                : ""

    };
}


// =========================================================
// EXPORT
// =========================================================

module.exports = {

    rupeesToPaise,

    getBooking,

    validateBookingForPayment

};
