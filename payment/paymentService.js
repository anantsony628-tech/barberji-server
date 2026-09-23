// =========================================================
// BARBER JI - RAZORPAY PAYMENT SERVICE
// =========================================================
// Responsibility:
// ONLY communicate with Razorpay.
//
// Current responsibilities:
// - Create Razorpay Order
// - Verify Razorpay payment signature
//
// This file does NOT:
// - calculate commission
// - process refund
// - process payout
// - update booking
// - decide refund eligibility
// =========================================================

const crypto =
    require("crypto");

const paymentConfig =
    require("./paymentConfig");


// =========================================================
// RAZORPAY API BASE URL
// =========================================================

const RAZORPAY_BASE_URL =
    "https://api.razorpay.com/v1";


// =========================================================
// GET RAZORPAY BASIC AUTH
// =========================================================

function getBasicAuth() {

    const keyId =
        paymentConfig.razorpay.keyId;

    const keySecret =
        paymentConfig.razorpay.keySecret;

    if (
        !keyId ||
        !keySecret
    ) {

        throw new Error(
            "Razorpay credentials are not configured"
        );
    }

    return Buffer
        .from(
            `${keyId}:${keySecret}`
        )
        .toString("base64");
}


// =========================================================
// CREATE RAZORPAY ORDER
// =========================================================

async function createOrder({
    amountPaise,
    receipt,
    notes = {}
}) {

    if (
        !Number.isInteger(amountPaise) ||
        amountPaise <= 0
    ) {

        throw new Error(
            "Invalid payment amount"
        );
    }


    if (
        !receipt ||
        String(receipt).trim() === ""
    ) {

        throw new Error(
            "Payment receipt is required"
        );
    }


    const basicAuth =
        getBasicAuth();


    const orderBody = {

        amount:
            amountPaise,

        currency:
            "INR",

        receipt:
            String(receipt).trim(),

        notes:
            notes &&
            typeof notes === "object"
                ? notes
                : {}

    };


    const response =
        await fetch(
            `${RAZORPAY_BASE_URL}/orders`,
            {
                method:
                    "POST",

                headers: {

                    "Authorization":
                        `Basic ${basicAuth}`,

                    "Content-Type":
                        "application/json"

                },

                body:
                    JSON.stringify(
                        orderBody
                    )
            }
        );


    const responseData =
        await response.json();


    if (!response.ok) {

        console.error(
            "Razorpay order creation failed:",
            responseData
        );


        const razorpayMessage =
            responseData &&
            responseData.error &&
            responseData.error.description
                ? responseData.error.description
                : "Razorpay order creation failed";


        throw new Error(
            razorpayMessage
        );
    }


    return {

        success:
            true,

        orderId:
            responseData.id,

        amountPaise:
            responseData.amount,

        currency:
            responseData.currency,

        status:
            responseData.status,

        receipt:
            responseData.receipt

    };
}


// =========================================================
// VERIFY RAZORPAY PAYMENT SIGNATURE
// =========================================================
// Razorpay Checkout success ke baad:
//
// order_id
// payment_id
// signature
//
// in teen values ko backend par verify kiya jayega.
//
// IMPORTANT:
// Secret key kabhi Android app mein nahi jayegi.
// =========================================================

function verifyPaymentSignature({

    orderId,
    paymentId,
    signature

}) {

    if (
        !orderId ||
        !paymentId ||
        !signature
    ) {

        return false;
    }


    const keySecret =
        paymentConfig.razorpay.keySecret;


    if (!keySecret) {

        throw new Error(
            "Razorpay secret is not configured"
        );
    }


    const generatedSignature =
        crypto
            .createHmac(
                "sha256",
                keySecret
            )
            .update(
                `${orderId}|${paymentId}`
            )
            .digest("hex");


    return crypto.timingSafeEqual(

        Buffer.from(
            generatedSignature,
            "utf8"
        ),

        Buffer.from(
            String(signature),
            "utf8"
        )
    );
}


// =========================================================
// EXPORT
// =========================================================

module.exports = {

    createOrder,

    verifyPaymentSignature

};
