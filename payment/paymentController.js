// =========================================================
// BARBER JI - PAYMENT CONTROLLER
// =========================================================
// Responsibility:
// - Payment API requests handle karna
// - Firebase authenticated customer se payment intent banana
// - Razorpay payment verify karna
// - Verified payment ke baad final booking create karna
//
// IMPORTANT:
// - Actual booking amount client se trust nahi kiya jayega
// - New payment-intent flow backend service se amount calculate karega
// - Final booking sirf verified PaymentIntent se banegi
// =========================================================

const paymentService =
    require("./paymentService");

const paymentIntentService =
    require("./paymentIntentService");

const paymentBookingService =
    require("./paymentBookingService");


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
//
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
// VERIFY PAYMENT + FINALIZE BOOKING
// =========================================================
// Production flow:
//
// Android
//    ↓
// Razorpay success
//    ↓
// /verify-payment
//    ↓
// Firebase authenticated user verify
//    ↓
// PaymentIntent load
//    ↓
// PaymentIntent owner check
//    ↓
// Razorpay Order ID match
//    ↓
// Razorpay signature verify
//    ↓
// Final Booking create
//    ↓
// OTP + Token return
// =========================================================

async function verifyPayment(req, res) {

    try {

        // -------------------------------------------------
        // AUTHENTICATED USER
        // -------------------------------------------------

        const user =
            req.user || {};


        const authUid =
            user.uid
                ? String(user.uid)
                : "";


        if (!authUid) {

            return res.status(401).json({

                success: false,

                verified: false,

                message:
                    "Customer authentication required"
            });
        }


        // -------------------------------------------------
        // REQUEST DATA
        // -------------------------------------------------

        const {
            paymentIntentId,
            razorpayOrderId,
            razorpayPaymentId,
            razorpaySignature
        } = req.body || {};


        if (!paymentIntentId ||
            !razorpayOrderId ||
            !razorpayPaymentId ||
            !razorpaySignature) {

            return res.status(400).json({

                success: false,

                verified: false,

                message:
                    "Payment verification data is incomplete"
            });
        }


        // -------------------------------------------------
        // LOAD STORED PAYMENT INTENT
        // -------------------------------------------------

        const paymentIntent =
            await paymentIntentService
                .getPaymentIntent(
                    paymentIntentId
                );


        if (!paymentIntent) {

            return res.status(404).json({

                success: false,

                verified: false,

                message:
                    "Payment intent not found"
            });
        }


        // -------------------------------------------------
        // PAYMENT INTENT OWNER CHECK
        // -------------------------------------------------
        // Important:
        // Kisi dusre customer ka PaymentIntent use
        // karke booking create nahi ki ja sakti.
        // -------------------------------------------------

        const intentAuthUid =
            paymentIntent.authUid
                ? String(paymentIntent.authUid)
                : "";

        console.log(
    "PAYMENT AUTH UID:",
    authUid
);

console.log(
    "PAYMENT INTENT AUTH UID:",
    intentAuthUid
);

console.log(
    "PAYMENT INTENT ID:",
    paymentIntentId
);


        if (!intentAuthUid ||
            intentAuthUid !== authUid) {

            return res.status(403).json({

                success: false,

                verified: false,

                message:
                    "Payment intent does not belong to this customer"
            });
        }


        // -------------------------------------------------
        // PAYMENT INTENT STATUS CHECK
        // -------------------------------------------------

        if (
            paymentIntent.status &&
            paymentIntent.status !== "CREATED" &&
            paymentIntent.status !== "BOOKED"
        ) {

            return res.status(400).json({

                success: false,

                verified: false,

                message:
                    "Payment intent is not available for verification"
            });
        }


        // -------------------------------------------------
        // RAZORPAY ORDER ID CHECK
        // -------------------------------------------------
        // Client ka order ID stored server order ID
        // se exactly match hona chahiye.
        // -------------------------------------------------

        const storedRazorpayOrderId =
            paymentIntent.razorpayOrderId
                ? String(
                    paymentIntent.razorpayOrderId
                )
                : "";


        if (!storedRazorpayOrderId ||
            storedRazorpayOrderId !==
                String(razorpayOrderId)) {

            return res.status(400).json({

                success: false,

                verified: false,

                message:
                    "Razorpay order does not match payment intent"
            });
        }


        // -------------------------------------------------
        // STORED AMOUNT VALIDATION
        // -------------------------------------------------
        // Razorpay order amount server-created PaymentIntent
        // ke amount ke saath match hona chahiye.
        // -------------------------------------------------

        const storedAmountPaise =
            Number(
                paymentIntent.razorpayAmountPaise
            );


        if (!Number.isSafeInteger(
                storedAmountPaise
            ) ||
            storedAmountPaise <= 0) {

            return res.status(400).json({

                success: false,

                verified: false,

                message:
                    "Invalid stored payment amount"
            });
        }


        // -------------------------------------------------
        // RAZORPAY SIGNATURE VERIFICATION
        // -------------------------------------------------

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


        // -------------------------------------------------
        // FINALIZE BOOKING
        // -------------------------------------------------
        // Important:
        // Booking amount / commission / salon amount
        // PaymentIntent se liya jayega.
        //
        // Client ke amount par trust nahi kiya jayega.
        // -------------------------------------------------

        const result =
            await paymentBookingService
                .finalizePaymentBooking({

                    paymentIntent:
                        paymentIntent,

                    razorpayPaymentId:
                        razorpayPaymentId
                });


        // -------------------------------------------------
        // FINAL RESPONSE
        // -------------------------------------------------

        return res.status(200).json({

            success:
                result.success,

            verified:
                true,

            duplicate:
                result.duplicate || false,

            message:
                result.duplicate
                    ? "Payment already verified and booking exists"
                    : "Payment verified and booking created",

            paymentIntentId:
                result.paymentIntentId,

            bookingId:
                result.bookingId,

            paymentId:
                result.paymentId,

            tokenNo:
                result.tokenNo,

            otp:
                result.otp,

            bookingAmount:
                result.bookingAmount,

            commission:
                result.commission,

            salonAmount:
                result.salonAmount
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
