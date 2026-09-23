// =========================================================
// BARBER JI - PAYMENT CONTROLLER
// =========================================================
// Responsibility:
// - Receive payment API requests
// - Validate request data
// - Call paymentService
// - Return clean API responses
//
// This file does NOT:
// - calculate commission
// - process refund
// - process payout
// - directly call Razorpay
// - update booking
// =========================================================

const paymentService =
    require("./paymentService");


// =========================================================
// CREATE RAZORPAY ORDER
// =========================================================

async function createOrder(req, res) {

    try {

        const {
            amountPaise,
            receipt,
            notes
        } = req.body || {};


        // =================================================
        // BASIC AMOUNT VALIDATION
        // =================================================

        if (
            amountPaise === undefined ||
            amountPaise === null
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Payment amount is required"

            });
        }


        const numericAmount =
            Number(amountPaise);


        if (
            !Number.isInteger(numericAmount) ||
            numericAmount <= 0
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Invalid payment amount"

            });
        }


        // =================================================
        // RECEIPT VALIDATION
        // =================================================

        if (
            !receipt ||
            String(receipt).trim() === ""
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Payment receipt is required"

            });
        }


        // =================================================
        // CREATE RAZORPAY ORDER
        // =================================================

        const result =
            await paymentService.createOrder({

                amountPaise:
                    numericAmount,

                receipt:
                    String(receipt).trim(),

                notes:
                    notes &&
                    typeof notes === "object"
                        ? notes
                        : {}

            });


        return res.status(201).json({

            success: true,

            orderId:
                result.orderId,

            amountPaise:
                result.amountPaise,

            currency:
                result.currency,

            status:
                result.status,

            receipt:
                result.receipt

        });

    } catch (error) {

        console.error(
            "Create payment order error:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                error.message ||
                "Unable to create payment order"

        });

    }
}


// =========================================================
// VERIFY RAZORPAY PAYMENT
// =========================================================
// Android se milne wale:
//
// razorpay_order_id
// razorpay_payment_id
// razorpay_signature
//
// ko backend par verify kiya jayega.
//
// IMPORTANT:
// Sirf successful verification ke baad hi
// future mein booking ko payment-confirmed maana jayega.
//
// Abhi ye endpoint booking update nahi karta.
// =========================================================

async function verifyPayment(req, res) {

    try {

        const {
            razorpayOrderId,
            razorpayPaymentId,
            razorpaySignature
        } = req.body || {};


        // =================================================
        // REQUIRED FIELD CHECK
        // =================================================

        if (
            !razorpayOrderId ||
            String(razorpayOrderId).trim() === ""
        ) {

            return res.status(400).json({

                success: false,

                verified: false,

                message:
                    "Razorpay order ID is required"

            });
        }


        if (
            !razorpayPaymentId ||
            String(razorpayPaymentId).trim() === ""
        ) {

            return res.status(400).json({

                success: false,

                verified: false,

                message:
                    "Razorpay payment ID is required"

            });
        }


        if (
            !razorpaySignature ||
            String(razorpaySignature).trim() === ""
        ) {

            return res.status(400).json({

                success: false,

                verified: false,

                message:
                    "Razorpay payment signature is required"

            });
        }


        // =================================================
        // VERIFY SIGNATURE
        // =================================================

        const verified =
            paymentService.verifyPaymentSignature({

                orderId:
                    String(
                        razorpayOrderId
                    ).trim(),

                paymentId:
                    String(
                        razorpayPaymentId
                    ).trim(),

                signature:
                    String(
                        razorpaySignature
                    ).trim()

            });


        // =================================================
        // INVALID SIGNATURE
        // =================================================

        if (!verified) {

            return res.status(400).json({

                success: false,

                verified: false,

                message:
                    "Payment signature verification failed"

            });
        }


        // =================================================
        // VERIFIED
        // =================================================

        return res.status(200).json({

            success: true,

            verified: true,

            orderId:
                String(
                    razorpayOrderId
                ).trim(),

            paymentId:
                String(
                    razorpayPaymentId
                ).trim(),

            message:
                "Payment signature verified successfully"

        });

    } catch (error) {

        console.error(
            "Payment verification error:",
            error
        );


        return res.status(500).json({

            success: false,

            verified: false,

            message:
                error.message ||
                "Unable to verify payment"

        });

    }
}


// =========================================================
// EXPORT
// =========================================================

module.exports = {

    createOrder,

    verifyPayment

};
