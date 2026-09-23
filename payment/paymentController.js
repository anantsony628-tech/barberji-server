// =========================================================
// BARBER JI - PAYMENT CONTROLLER
// =========================================================
// Responsibility:
// - Payment API requests handle karna
// - Firebase authenticated customer se payment intent banana
// - Existing Razorpay order/verification endpoints preserve karna
//
// IMPORTANT:
// - Actual booking amount client se trust nahi kiya jayega
// - New payment-intent flow backend service se amount calculate karega
// =========================================================

const paymentService =
    require("./paymentService");

const paymentIntentService =
    require("./paymentIntentService");


// =========================================================
// OLD CREATE ORDER
// =========================================================
// Existing endpoint preserved.
// Future production flow mein new /create-payment-intent
// endpoint use hoga.
// =========================================================

async function createOrder(req, res) {

    try {

        const {
            amountPaise,
            receipt,
            notes
        } = req.body || {};


        if (!Number.isInteger(amountPaise) ||
            amountPaise <= 0) {

            return res.status(400).json({

                success: false,

                message:
                    "Invalid payment amount"
            });
        }


        if (!receipt ||
            String(receipt).trim() === "") {

            return res.status(400).json({

                success: false,

                message:
                    "Payment receipt is required"
            });
        }


        const result =
            await paymentService.createOrder({

                amountPaise:
                    amountPaise,

                receipt:
                    receipt,

                notes:
                    notes
            });


        return res.status(200).json(result);

    } catch (error) {

        console.error(
            "Payment create-order error:",
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
// NEW CREATE PAYMENT INTENT
// =========================================================
// Production payment flow:
// Android
//    ↓
// create-payment-intent
//    ↓
// Firebase Services verification
//    ↓
// Actual price calculation
//    ↓
// Commission calculation
//    ↓
// Razorpay Order
//    ↓
// PaymentIntent saved
// =========================================================

async function createPaymentIntent(req, res) {

    try {

        const user =
            req.user || {};


        const authUid =
            user.uid
                ? String(user.uid)
                : "";


        if (!authUid) {

            return res.status(401).json({

                success: false,

                message:
                    "Customer authentication required"
            });
        }


        const body =
            req.body || {};


        const customerId =
            body.customerId;


        const customerName =
            body.customerName;


        const customerMobile =
            body.customerMobile;


        const salonId =
            body.salonId;


        const partnerId =
            body.partnerId;


        const salonName =
            body.salonName;


        const ownerMobile =
            body.ownerMobile;


        const serviceIds =
            body.serviceIds;


        const bookingDate =
            body.bookingDate;


        const bookingTime =
            body.bookingTime;


        const tokenNo =
            body.tokenNo;


        // -------------------------------------------------
        // BASIC INPUT VALIDATION
        // -------------------------------------------------

        if (!customerId) {

            return res.status(400).json({

                success: false,

                message:
                    "Customer ID is required"
            });
        }


        if (!salonId) {

            return res.status(400).json({

                success: false,

                message:
                    "Salon ID is required"
            });
        }


        if (!partnerId) {

            return res.status(400).json({

                success: false,

                message:
                    "Partner ID is required"
            });
        }


        if (!salonName) {

            return res.status(400).json({

                success: false,

                message:
                    "Salon name is required"
            });
        }


        if (!serviceIds) {

            return res.status(400).json({

                success: false,

                message:
                    "Service IDs are required"
            });
        }


        if (!bookingDate) {

            return res.status(400).json({

                success: false,

                message:
                    "Booking date is required"
            });
        }


        if (!bookingTime) {

            return res.status(400).json({

                success: false,

                message:
                    "Booking time is required"
            });
        }


        // -------------------------------------------------
        // CREATE PAYMENT INTENT
        // -------------------------------------------------

        const result =
            await paymentIntentService
                .createPaymentIntent({

                    authUid:
                        authUid,

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

                    serviceIds:
                        serviceIds,

                    bookingDate:
                        bookingDate,

                    bookingTime:
                        bookingTime,

                    tokenNo:
                        tokenNo
                });


        return res.status(200).json(result);

    } catch (error) {

        console.error(
            "Payment intent creation error:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                error.message ||
                "Unable to create payment intent"
        });
    }
}


// =========================================================
// VERIFY PAYMENT
// =========================================================
// Existing endpoint preserved for now.
// Final production verification will additionally
// validate PaymentIntent before booking completion.
// =========================================================

async function verifyPayment(req, res) {

    try {

        const {
            razorpayOrderId,
            razorpayPaymentId,
            razorpaySignature
        } = req.body || {};


        if (!razorpayOrderId ||
            !razorpayPaymentId ||
            !razorpaySignature) {

            return res.status(400).json({

                success: false,

                message:
                    "Payment verification data is incomplete"
            });
        }


        const verified =
            paymentService
                .verifyPaymentSignature({

                    orderId:
                        razorpayOrderId,

                    paymentId:
                        razorpayPaymentId,

                    signature:
                        razorpaySignature
                });


        if (!verified) {

            return res.status(400).json({

                success: false,

                verified: false,

                message:
                    "Invalid payment signature"
            });
        }


        return res.status(200).json({

            success: true,

            verified: true,

            message:
                "Payment signature verified"
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
                "Payment verification failed"
        });
    }
}


// =========================================================
// EXPORT
// =========================================================

module.exports = {

    createOrder,

    createPaymentIntent,

    verifyPayment
};
