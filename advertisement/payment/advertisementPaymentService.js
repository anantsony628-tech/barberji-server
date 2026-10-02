const admin = require("firebase-admin");

const AdvertisementPaymentRepository =
    require("./advertisementPaymentRepository");

const RazorpayAdvertisementGateway =
    require("./razorpayAdvertisementGateway");


class AdvertisementPaymentService {

    constructor() {

        this.db =
            admin.database();

        this.repository =
            new AdvertisementPaymentRepository();

        this.gateway =
            new RazorpayAdvertisementGateway();

        this.plansRef =
            this.db.ref(
                "AdvertisementPlans"
            );
    }


    async createPaymentOrder(data) {

        if (!data || typeof data !== "object") {

            throw new Error(
                "Advertisement payment data is required"
            );
        }


        const partnerId =
            String(data.partnerId || "").trim();

        const salonId =
            String(data.salonId || "").trim();

        const planId =
            String(data.planId || "").trim();


        if (!partnerId) {

            throw new Error(
                "Partner ID is required"
            );
        }


        if (!salonId) {

            throw new Error(
                "Salon ID is required"
            );
        }


        if (!planId) {

            throw new Error(
                "Advertisement plan ID is required"
            );
        }


        /*
         * =====================================================
         * LOAD AUTHORITATIVE ADVERTISEMENT PLAN
         * =====================================================
         */

        const planSnapshot =
            await this.plansRef
                .child(planId)
                .once("value");


        if (!planSnapshot.exists()) {

            throw new Error(
                "Advertisement plan not found"
            );
        }


        const plan =
            planSnapshot.val();


        const planPrice =
            Number(plan.price);


        if (
            !Number.isInteger(planPrice) ||
            planPrice <= 0
        ) {

            throw new Error(
                "Invalid advertisement plan price"
            );
        }


        /*
         * =====================================================
         * GENERATE SERVER-SIDE IDs
         * =====================================================
         */

        const advertisementId =
            await this.generateAdvertisementId();


        const advertisementPaymentId =
            await this.generatePaymentId();


        /*
         * =====================================================
         * UNIQUE RAZORPAY RECEIPT
         * =====================================================
         */

        const receipt =
            "ADREC_" +
            advertisementPaymentId;


        /*
         * =====================================================
         * CREATE INTERNAL PAYMENT RECORD
         * =====================================================
         */

        await this.repository.createPaymentRecord(
            advertisementPaymentId,
            {

                advertisementId:
                    advertisementId,

                partnerId:
                    partnerId,

                salonId:
                    salonId,

                planId:
                    planId,

                amount:
                    planPrice,

                gateway:
                    "RAZORPAY",

                status:
                    "CREATED"
            }
        );


        /*
         * =====================================================
         * CREATE RAZORPAY ORDER
         * =====================================================
         */

        let gatewayOrder;

        try {

            gatewayOrder =
                await this.gateway.createOrder({

                    advertisementId:
                        advertisementId,

                    advertisementPaymentId:
                        advertisementPaymentId,

                    partnerId:
                        partnerId,

                    salonId:
                        salonId,

                    planId:
                        planId,

                    amount:
                        planPrice,

                    receipt:
                        receipt
                });

        } catch (error) {

            await this.repository
                .updatePaymentRecord(
                    advertisementPaymentId,
                    {

                        status:
                            "ORDER_CREATION_FAILED",

                        errorMessage:
                            String(
                                error.message ||
                                "Unable to create payment order"
                            )
                    }
                );

            throw error;
        }


        /*
         * =====================================================
         * SAVE GATEWAY ORDER DETAILS
         * =====================================================
         */

        await this.repository
            .updatePaymentRecord(
                advertisementPaymentId,
                {

                    gateway:
                        "RAZORPAY",

                    gatewayOrderId:
                        String(
                            gatewayOrder.orderId || ""
                        ),

                    status:
                        "ORDER_CREATED"
                }
            );


        /*
         * =====================================================
         * PAYMENT HISTORY
         * =====================================================
         */

        await this.repository
            .savePaymentHistory(
                advertisementPaymentId,
                {

                    advertisementId:
                        advertisementId,

                    partnerId:
                        partnerId,

                    salonId:
                        salonId,

                    planId:
                        planId,

                    amount:
                        planPrice,

                    gateway:
                        "RAZORPAY",

                    gatewayOrderId:
                        String(
                            gatewayOrder.orderId || ""
                        ),

                    status:
                        "ORDER_CREATED",

                    event:
                        "PAYMENT_ORDER_CREATED"
                }
            );


        /*
         * =====================================================
         * RESPONSE
         * =====================================================
         */

        return {

            success:
                true,

            advertisementId:
                advertisementId,

            advertisementPaymentId:
                advertisementPaymentId,

            planId:
                planId,

            amount:
                planPrice,

            currency:
                "INR",

            gateway:
                "RAZORPAY",

            orderId:
                gatewayOrder.orderId,

            orderAmount:
                gatewayOrder.amount,

            orderCurrency:
                gatewayOrder.currency,

            orderStatus:
                gatewayOrder.status
        };
    }


    /*
     * =========================================================
     * ADVERTISEMENT ID GENERATOR
     * =========================================================
     */

    async generateAdvertisementId() {

        const counterRef =
            this.db.ref(
                "Counters/advertisementCounter"
            );


        const result =
            await counterRef.transaction(
                current => {

                    const currentValue =
                        Number(current || 0);

                    return currentValue + 1;
                }
            );


        const counter =
            Number(
                result.snapshot.val()
            );


        if (
            !Number.isInteger(counter) ||
            counter <= 0
        ) {

            throw new Error(
                "Unable to generate advertisement ID"
            );
        }


        return (
            "AD" +
            String(counter).padStart(6, "0")
        );
    }


    /*
     * =========================================================
     * ADVERTISEMENT PAYMENT ID GENERATOR
     * =========================================================
     */

    async generatePaymentId() {

        const counterRef =
            this.db.ref(
                "Counters/advertisementPaymentCounter"
            );


        const result =
            await counterRef.transaction(
                current => {

                    const currentValue =
                        Number(current || 0);

                    return currentValue + 1;
                }
            );


        const counter =
            Number(
                result.snapshot.val()
            );


        if (
            !Number.isInteger(counter) ||
            counter <= 0
        ) {

            throw new Error(
                "Unable to generate advertisement payment ID"
            );
        }


        return (
            "ADPAY" +
            String(counter).padStart(6, "0")
        );
    }
}


module.exports =
    AdvertisementPaymentService;
