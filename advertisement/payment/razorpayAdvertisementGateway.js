const Razorpay = require("razorpay");

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

        this.razorpay =
            new Razorpay({
                key_id: keyId,
                key_secret: keySecret
            });
    }

    async createOrder(paymentData) {

        if (!paymentData) {
            throw new Error(
                "Payment data is required"
            );
        }

        const amount =
            Number(paymentData.amount);

        if (
            !Number.isInteger(amount) ||
            amount <= 0
        ) {
            throw new Error(
                "Invalid advertisement payment amount"
            );
        }

        const receipt =
            String(paymentData.receipt || "").trim();

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

            success: true,

            gateway: "RAZORPAY",

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

    async verifyPayment(paymentData) {

        throw new Error(
            "Advertisement Razorpay payment verification is not implemented yet"
        );
    }

    async refundPayment(paymentData) {

        throw new Error(
            "Advertisement Razorpay refund is not implemented yet"
        );
    }
}

module.exports =
    RazorpayAdvertisementGateway;
