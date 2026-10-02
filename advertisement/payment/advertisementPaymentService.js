const { getDatabase } =
    require("firebase-admin/database");

const AdvertisementPaymentRepository =
    require("./advertisementPaymentRepository");

const RazorpayAdvertisementGateway =
    require("./razorpayAdvertisementGateway");


class AdvertisementPaymentService {

    constructor() {

        this.db =
            getDatabase();

        this.repository =
            new AdvertisementPaymentRepository();

        this.gateway =
            new RazorpayAdvertisementGateway();

        this.plansRef =
            this.db.ref(
                "AdvertisementPlans"
            );

        this.pendingAdvertisementsRef =
            this.db.ref(
                "PendingAdvertisements"
            );
    }


    // =====================================================
    // CREATE ADVERTISEMENT PAYMENT ORDER
    // =====================================================

    async createPaymentOrder(data) {

        if (
            !data ||
            typeof data !== "object"
        ) {

            throw new Error(
                "Advertisement payment data is required"
            );
        }


        const partnerId =
            String(
                data.partnerId || ""
            ).trim();


        const salonId =
            String(
                data.salonId || ""
            ).trim();


        const planId =
            String(
                data.planId || ""
            ).trim();


        const authUid =
            String(
                data.authUid || ""
            ).trim();


        const salonName =
            String(
                data.salonName || ""
            ).trim();


        const ownerName =
            String(
                data.ownerName || ""
            ).trim();


        const partnerMobile =
            String(
                data.partnerMobile || ""
            ).trim();


        const photoUrl =
            String(
                data.photoUrl ||
                data.photoPath ||
                ""
            ).trim();


        const adText =
            String(
                data.adText || ""
            ).trim();


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


        if (!authUid) {

            throw new Error(
                "Authenticated user ID is required"
            );
        }


        if (!salonName) {

            throw new Error(
                "Salon name is required"
            );
        }


        if (!ownerName) {

            throw new Error(
                "Owner name is required"
            );
        }


        if (!photoUrl) {

            throw new Error(
                "Advertisement image is required"
            );
        }


        if (!adText) {

            throw new Error(
                "Advertisement text is required"
            );
        }


        // =================================================
        // LOAD AUTHORITATIVE PLAN
        // =================================================

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
            Number(
                plan.price
            );


        if (
            !Number.isInteger(planPrice) ||
            planPrice <= 0
        ) {

            throw new Error(
                "Invalid advertisement plan price"
            );
        }


        const planName =
            String(
                plan.planName || ""
            ).trim();


        const planDays =
            String(
                plan.days || ""
            ).trim();


        // =================================================
        // SERVER-SIDE IDS
        // =================================================

        const advertisementId =
            await this.generateAdvertisementId();


        const advertisementPaymentId =
            await this.generatePaymentId();


        // =================================================
        // RAZORPAY RECEIPT
        // =================================================

        const receipt =
            "ADREC_" +
            advertisementPaymentId;


        // =================================================
        // CREATE INTERNAL PAYMENT RECORD
        // =================================================

        await this.repository
            .createPaymentRecord(
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


        // =================================================
        // SAVE VERIFIED USER + ADVERTISEMENT DATA
        // =================================================

        await this.repository
            .updatePaymentRecord(
                advertisementPaymentId,
                {

                    authUid:
                        authUid,

                    salonName:
                        salonName,

                    ownerName:
                        ownerName,

                    partnerMobile:
                        partnerMobile,

                    photoPath:
                        photoUrl,

                    photoUrl:
                        photoUrl,

                    adText:
                        adText,

                    planName:
                        planName,

                    planDays:
                        planDays
                }
            );


        // =================================================
        // CREATE RAZORPAY ORDER
        // =================================================

        let gatewayOrder;


        try {

            gatewayOrder =
                await this.gateway
                    .createOrder({

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


        // =================================================
        // SAVE RAZORPAY ORDER
        // =================================================

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


        // =================================================
        // PAYMENT HISTORY
        // =================================================

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


        // =================================================
        // RESPONSE
        // =================================================

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

            keyId:
                gatewayOrder.keyId,

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


    // =====================================================
    // VERIFY ADVERTISEMENT PAYMENT
    // =====================================================

    async verifyPayment(data) {

        if (
            !data ||
            typeof data !== "object"
        ) {

            throw new Error(
                "Advertisement payment verification data is required"
            );
        }


        const advertisementPaymentId =
            String(
                data.advertisementPaymentId || ""
            ).trim();


        const orderId =
            String(
                data.orderId || ""
            ).trim();


        const paymentId =
            String(
                data.paymentId || ""
            ).trim();


        const signature =
            String(
                data.signature || ""
            ).trim();


        const partnerId =
            String(
                data.partnerId || ""
            ).trim();


        const salonId =
            String(
                data.salonId || ""
            ).trim();


        if (!advertisementPaymentId) {

            throw new Error(
                "Advertisement payment ID is required"
            );
        }


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


        // =================================================
        // LOAD INTERNAL PAYMENT
        // =================================================

        const paymentRecord =
            await this.repository
                .getPaymentById(
                    advertisementPaymentId
                );


        if (!paymentRecord) {

            throw new Error(
                "Advertisement payment record not found"
            );
        }


        // =================================================
        // OWNERSHIP CHECK
        // =================================================

        if (
            String(
                paymentRecord.partnerId || ""
            ).trim() !==
            partnerId
        ) {

            throw new Error(
                "Partner and payment mismatch"
            );
        }


        if (
            String(
                paymentRecord.salonId || ""
            ).trim() !==
            salonId
        ) {

            throw new Error(
                "Salon and payment mismatch"
            );
        }


        // =================================================
        // IDEMPOTENCY
        // =================================================

        const currentStatus =
            String(
                paymentRecord.status || ""
            ).trim();


        if (
            currentStatus ===
            "ADVERTISEMENT_PENDING"
        ) {

            return {

                success:
                    true,

                alreadyProcessed:
                    true,

                verified:
                    true,

                advertisementId:
                    paymentRecord.advertisementId,

                advertisementPaymentId:
                    advertisementPaymentId,

                status:
                    "ADVERTISEMENT_PENDING"
            };
        }


        // =================================================
        // ORDER ID MUST MATCH OUR DATABASE
        // =================================================

        const storedOrderId =
            String(
                paymentRecord.gatewayOrderId || ""
            ).trim();


        if (!storedOrderId) {

            throw new Error(
                "Stored Razorpay order ID not found"
            );
        }


        if (
            storedOrderId !==
            orderId
        ) {

            throw new Error(
                "Razorpay order ID mismatch"
            );
        }


        // =================================================
        // STATUS CHECK
        // =================================================

        if (
            currentStatus !==
            "ORDER_CREATED" &&
            currentStatus !==
            "PAYMENT_VERIFIED"
        ) {

            throw new Error(
                "Advertisement payment is not ready for verification"
            );
        }


        // =================================================
        // RAZORPAY VERIFICATION
        // =================================================

        let verification;


        try {

            verification =
                await this.gateway
                    .verifyPayment({

                        orderId:
                            orderId,

                        paymentId:
                            paymentId,

                        signature:
                            signature
                    });

        } catch (error) {

            await this.repository
                .updatePaymentRecord(
                    advertisementPaymentId,
                    {

                        status:
                            "PAYMENT_VERIFICATION_FAILED",

                        errorMessage:
                            String(
                                error.message ||
                                "Advertisement payment verification failed"
                            )
                    }
                );


            await this.repository
                .savePaymentHistory(
                    advertisementPaymentId,
                    {

                        advertisementId:
                            paymentRecord.advertisementId,

                        partnerId:
                            paymentRecord.partnerId,

                        salonId:
                            paymentRecord.salonId,

                        planId:
                            paymentRecord.planId,

                        amount:
                            paymentRecord.amount,

                        gateway:
                            "RAZORPAY",

                        gatewayOrderId:
                            orderId,

                        gatewayPaymentId:
                            paymentId,

                        status:
                            "PAYMENT_VERIFICATION_FAILED",

                        event:
                            "PAYMENT_VERIFICATION_FAILED"
                    }
                );


            throw error;
        }


        if (
            !verification ||
            verification.success !== true ||
            verification.verified !== true
        ) {

            throw new Error(
                "Advertisement payment verification failed"
            );
        }


        // =================================================
        // SERVER-SIDE AMOUNT CHECK
        // =================================================

        const internalAmount =
            Number(
                paymentRecord.amount
            );


        const verifiedAmount =
            Number(
                verification.amount
            );


        if (
            !Number.isInteger(
                internalAmount
            ) ||
            internalAmount <= 0
        ) {

            throw new Error(
                "Invalid internal advertisement payment amount"
            );
        }


        if (
            verifiedAmount !==
            internalAmount
        ) {

            throw new Error(
                "Advertisement payment amount mismatch"
            );
        }


        // =================================================
        // AUTHORITATIVE PLAN CHECK
        // =================================================

        const planId =
            String(
                paymentRecord.planId || ""
            ).trim();


        const planSnapshot =
            await this.plansRef
                .child(planId)
                .once("value");


        if (!planSnapshot.exists()) {

            throw new Error(
                "Advertisement plan not found during verification"
            );
        }


        const plan =
            planSnapshot.val();


        const planPrice =
            Number(
                plan.price
            );


        if (
            !Number.isInteger(planPrice) ||
            planPrice <= 0
        ) {

            throw new Error(
                "Invalid advertisement plan price"
            );
        }


        if (
            planPrice !==
            internalAmount
        ) {

            throw new Error(
                "Advertisement plan price mismatch"
            );
        }


        // =================================================
        // SAVE VERIFIED PAYMENT
        // =================================================

        await this.repository
            .updatePaymentRecord(
                advertisementPaymentId,
                {

                    gateway:
                        "RAZORPAY",

                    gatewayOrderId:
                        orderId,

                    gatewayPaymentId:
                        paymentId,

                    gatewaySignature:
                        signature,

                    status:
                        "PAYMENT_VERIFIED",

                    verifiedAt:
                        Date.now()
                }
            );


        await this.repository
            .savePaymentHistory(
                advertisementPaymentId,
                {

                  
