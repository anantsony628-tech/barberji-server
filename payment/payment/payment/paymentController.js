// =========================================================
// BARBER JI - PAYMENT CONTROLLER
// =========================================================
// Responsibility:
// - Receive payment API request
// - Validate basic request data
// - Call paymentService
// - Return clean API response
//
// This file does NOT:
// - calculate commission
// - verify payment
// - process refund
// - process payout
// - directly call Razorpay
// - update booking
// =========================================================

const paymentService =
    require("./paymentService");


// =========================================================
// CREATE PAYMENT ORDER
// =========================================================

async function createOrder(req, res) {

    try {

        const {
            amountPaise,
            receipt,
            notes
        } = req.body || {};


        // -------------------------------------------------
        // AMOUNT REQUIRED
        // -------------------------------------------------

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


        // -------------------------------------------------
        // CONVERT STRING NUMBER SAFELY
        // -------------------------------------------------

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


        // -------------------------------------------------
        // RECEIPT REQUIRED
        // -------------------------------------------------

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


        // -------------------------------------------------
        // CREATE RAZORPAY ORDER
        // -------------------------------------------------

        const result =
            await paymentService.createOrder({

                amountPaise:
                    numericAmount,

                receipt:
                    String(receipt).trim(),

                notes:
                    notes && typeof notes === "object"
                        ? notes
                        : {}

            });


        // -------------------------------------------------
        // SUCCESS
        // -------------------------------------------------

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

        // -------------------------------------------------
        // SERVER ERROR
        // -------------------------------------------------

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
// EXPORT
// =========================================================

module.exports = {

    createOrder

};
