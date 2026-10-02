const Razorpay =
    require("razorpay");

const crypto =
    require("crypto");

const AdvertisementPaymentGateway =
    require("./advertisementPaymentGateway");


class RazorpayAdvertisementGateway
    extends AdvertisementPaymentGateway {


    constructor() {

        super();

        const keyId =
            process.env.RAZORPAY_KEY_ID;

        const keySecret =
            process.env.RAZORPAY_KEY_SECRET;


        if (!keyId || !keySecret) {

            throw new Error(
                "Advertisement Razorpay configuration is missing"
            );
        }


        this.keyId =
            keyId;

        this.keySecret =
            keySecret;


        this.razorpay =
            new Razorpay({

                key_id:
                    keyId,

                key_secret:
                    keySecret
            });
    }


    // =====================================================
    // CREATE RAZORPAY ORDER
    // =====================================================

    async createOrder(paymentData) {

        if (!paymentData) {

            throw new Error(
                "Payment data is required"
            );
        }


        const amount =
            Number(
                paymentData.amount
            );


        if (
            !Number.isInteger(amount) ||
            amount <= 0
        ) {

            throw new Error(
                "Invalid advertisement payment amount"
            );
        }


        const receipt =
            String(
                paymentData.receipt || ""
            ).trim();


        if (!receipt) {

            throw new Error(
                "Payment receipt is required"
            );
        }


        const order =
            await this.razorpay.orders.create({

                amount:
                    amount * 100,

                currency:
                    "INR",

                receipt:
                    receipt,

                notes: {

                    advertisementId:
                        String(
                            paymentData.advertisementId || ""
                        ),

                    advertisementPaymentId:
                        String(
                            paymentData.advertisementPaymentId || ""
                        ),

                    partnerId:
                        String(
                            paymentData.partnerId || ""
                        ),

                    salonId:
                        String(
                            paymentData.salonId || ""
                        ),

                    planId:
                        String(
                            paymentData.planId || ""
                        )
                }
            });


        return {

            success:
                true,

            gateway:
                "RAZORPAY",

            keyId:
                this.keyId,

            orderId:
                order.id,

            amount:
                order.amount,

            currency:
                order.currency,

            status:
                order.status,

            receipt:
                order.receipt
        };
    }


    // =====================================================
    // VERIFY RAZORPAY PAYMENT
    // =====================================================

    async verifyPayment(paymentData) {

        if (!paymentData) {

            throw new Error(
                "Payment verification data is required"
            );
        }


        const orderId =
            String(
                paymentData.orderId || ""
            ).trim();


        const paymentId =
            String(
                paymentData.paymentId || ""
            ).trim();


        const signature =
            String(
                paymentData.signature || ""
            ).trim();


        if (!orderId) {

            throw new Error(
                "Razorpay order ID is required"
            );
        }


        if (!paymentId) {

            throw new Error(
                "Razorpay payment ID is required"
            );
        }


        if (!signature) {

            throw new Error(
                "Razorpay payment signature is required"
            );
        }


        // -------------------------------------------------
        // SERVER-SIDE HMAC SIGNATURE
        // -------------------------------------------------

        const generatedSignature =
            crypto
                .createHmac(
                    "sha256",
                    this.keySecret
                )
                .update(
                    orderId +
                    "|" +
                    paymentId
                )
                .digest("hex");


        const generatedBuffer =
            Buffer.from(
                generatedSignature,
                "utf8"
            );


        const receivedBuffer =
            Buffer.from(
                signature,
                "utf8"
            );


        if (
            generatedBuffer.length !==
            receivedBuffer.length
        ) {

            throw new Error(
                "Invalid Razorpay payment signature"
            );
        }


        const signatureValid =
            crypto.timingSafeEqual(
                generatedBuffer,
                receivedBuffer
            );


        if (!signatureValid) {

            throw new Error(
                "Invalid Razorpay payment signature"
            );
        }


        // -------------------------------------------------
        // FETCH PAYMENT FROM RAZORPAY
        // -------------------------------------------------

        const payment =
            await this.razorpay
                .payments
                .fetch(
                    paymentId
                );


        if (!payment) {

            throw new Error(
                "Razorpay payment not found"
            );
        }


        // -------------------------------------------------
        // PAYMENT MUST BELONG TO SAME ORDER
        // -------------------------------------------------

        const paymentOrderId =
            String(
                payment.order_id || ""
            ).trim();


        if (
            paymentOrderId !==
            orderId
        ) {

            throw new Error(
                "Razorpay payment and order mismatch"
            );
        }


        // -------------------------------------------------
        // FETCH RAZORPAY ORDER
        // -------------------------------------------------

        const order =
            await this.razorpay
                .orders
                .fetch(
                    orderId
                );


        if (!order) {

            throw new Error(
                "Razorpay order not found"
            );
        }


        // -------------------------------------------------
        // AMOUNT CHECK
        // -------------------------------------------------

        if (
            Number(payment.amount) !==
            Number(order.amount)
        ) {

            throw new Error(
                "Razorpay payment amount mismatch"
            );
        }


        // -------------------------------------------------
        // CURRENCY CHECK
        // -------------------------------------------------

        if (
            String(
                payment.currency || ""
            ).toUpperCase() !== "INR"
        ) {

            throw new Error(
                "Invalid Razorpay payment currency"
            );
        }


        if (
            String(
                order.currency || ""
            ).toUpperCase() !== "INR"
        ) {

            throw new Error(
                "Invalid Razorpay order currency"
            );
        }


        // -------------------------------------------------
        // PAYMENT MUST BE CAPTURED
        // -------------------------------------------------

        const paymentStatus =
            String(
                payment.status || ""
            ).toLowerCase();


        if (
            paymentStatus !==
            "captured"
        ) {

            throw new Error(
                "Razorpay payment is not captured"
            );
        }


        return {

            success:
                true,

            verified:
                true,

            gateway:
                "RAZORPAY",

            orderId:
                orderId,

            paymentId:
                paymentId,

            signature:
                signature,

            amount:
                Number(
                    payment.amount
                ) / 100,

            amountPaise:
                Number(
                    payment.amount
                ),

            currency:
                String(
                    payment.currency
                ),

            paymentStatus:
                paymentStatus
        };
    }


    // =====================================================
    // REFUND
    // =====================================================

    async refundPayment(paymentData) {

        throw new Error(
            "Advertisement Razorpay refund is not implemented yet"
        );
    }
}


module.exports =
    RazorpayAdvertisementGateway;
