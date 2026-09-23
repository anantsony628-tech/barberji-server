// =========================================================
// BARBER JI - RAZORPAY PAYMENT SERVICE
// =========================================================
// Responsibility:
// ONLY create Razorpay Orders.
//
// This file does NOT:
// - verify payment
// - process refund
// - process payout
// - calculate commission
// - update booking
//
// Those responsibilities will have separate files.
// =========================================================

const paymentConfig =
    require("./paymentConfig");


// =========================================================
// RAZORPAY API BASE URL
// =========================================================

const RAZORPAY_BASE_URL =
    "https://api.razorpay.com/v1";


// =========================================================
// CREATE RAZORPAY ORDER
// =========================================================

async function createOrder({
    amountPaise,
    receipt,
    notes = {}
}) {

    // -----------------------------------------------------
    // VALIDATE AMOUNT
    // -----------------------------------------------------

    if (
        !Number.isInteger(amountPaise) ||
        amountPaise <= 0
    ) {

        throw new Error(
            "Invalid payment amount"
        );
    }


    // -----------------------------------------------------
    // VALIDATE RECEIPT
    // -----------------------------------------------------

    if (
        !receipt ||
        String(receipt).trim() === ""
    ) {

        throw new Error(
            "Payment receipt is required"
        );
    }


    // -----------------------------------------------------
    // RAZORPAY CREDENTIALS
    // -----------------------------------------------------

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


    // -----------------------------------------------------
    // BASIC AUTH
    // -----------------------------------------------------

    const basicAuth =
        Buffer.from(
            `${keyId}:${keySecret}`
        ).toString("base64");


    // -----------------------------------------------------
    // ORDER BODY
    // -----------------------------------------------------

    const orderBody = {

        amount:
            amountPaise,

        currency:
            "INR",

        receipt:
            String(receipt).trim(),

        notes:
            notes

    };


    // -----------------------------------------------------
    // CREATE ORDER
    // -----------------------------------------------------

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


    // -----------------------------------------------------
    // READ RESPONSE
    // -----------------------------------------------------

    const responseData =
        await response.json();


    // -----------------------------------------------------
    // RAZORPAY ERROR
    // -----------------------------------------------------

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


    // -----------------------------------------------------
    // SUCCESS
    // -----------------------------------------------------

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
// EXPORT
// =========================================================

module.exports = {

    createOrder

};
