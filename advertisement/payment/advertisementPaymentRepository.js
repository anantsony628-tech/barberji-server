const { getDatabase } =
    require("firebase-admin/database");

class AdvertisementPaymentRepository {

    constructor() {

        this.db =
    getDatabase();

        this.paymentsRef =
            this.db.ref(
                "AdvertisementPayments"
            );

        this.historyRef =
            this.db.ref(
                "AdvertisementPaymentHistory"
            );
    }

    // =====================================================
    // CREATE PAYMENT RECORD
    // =====================================================

    async createPaymentRecord(paymentId, data) {

        if (
            !paymentId ||
            String(paymentId).trim() === ""
        ) {
            throw new Error(
                "Advertisement payment ID is required"
            );
        }

        if (!data || typeof data !== "object") {

            throw new Error(
                "Payment data is required"
            );
        }

        const safePaymentId =
            String(paymentId).trim();

        const now =
            Date.now();

        const paymentRecord = {

            paymentId:
                safePaymentId,

            advertisementId:
                String(
                    data.advertisementId || ""
                ).trim(),

            partnerId:
                String(
                    data.partnerId || ""
                ).trim(),

            salonId:
                String(
                    data.salonId || ""
                ).trim(),

            planId:
                String(
                    data.planId || ""
                ).trim(),

            amount:
                Number(
                    data.amount || 0
                ),

            currency:
                "INR",

            gateway:
                String(
                    data.gateway || ""
                ).trim(),

            gatewayOrderId:
                String(
                    data.gatewayOrderId || ""
                ).trim(),

            gatewayPaymentId:
                String(
                    data.gatewayPaymentId || ""
                ).trim(),

            gatewaySignature:
                String(
                    data.gatewaySignature || ""
                ).trim(),

            status:
                String(
                    data.status || "CREATED"
                ).trim(),

            createdAt:
                Number(
                    data.createdAt || now
                ),

            updatedAt:
                now
        };

        await this.paymentsRef
            .child(safePaymentId)
            .set(paymentRecord);

        return paymentRecord;
    }

    // =====================================================
    // UPDATE PAYMENT RECORD
    // =====================================================

    async updatePaymentRecord(
        paymentId,
        updates
    ) {

        if (
            !paymentId ||
            String(paymentId).trim() === ""
        ) {
            throw new Error(
                "Advertisement payment ID is required"
            );
        }

        if (
            !updates ||
            typeof updates !== "object"
        ) {
            throw new Error(
                "Payment updates are required"
            );
        }

        const safePaymentId =
            String(paymentId).trim();

        const safeUpdates = {
            ...updates,
            updatedAt: Date.now()
        };

        await this.paymentsRef
            .child(safePaymentId)
            .update(safeUpdates);

        return true;
    }

    // =====================================================
    // GET PAYMENT BY ID
    // =====================================================

    async getPaymentById(paymentId) {

        if (
            !paymentId ||
            String(paymentId).trim() === ""
        ) {
            throw new Error(
                "Advertisement payment ID is required"
            );
        }

        const safePaymentId =
            String(paymentId).trim();

        const snapshot =
            await this.paymentsRef
                .child(safePaymentId)
                .once("value");

        if (!snapshot.exists()) {

            return null;
        }

        return snapshot.val();
    }

    // =====================================================
    // CHECK PAYMENT EXISTS
    // =====================================================

    async paymentExists(paymentId) {

        if (
            !paymentId ||
            String(paymentId).trim() === ""
        ) {
            return false;
        }

        const snapshot =
            await this.paymentsRef
                .child(
                    String(paymentId).trim()
                )
                .once("value");

        return snapshot.exists();
    }

    // =====================================================
    // SAVE PAYMENT HISTORY
    // =====================================================

    async savePaymentHistory(
        paymentId,
        data
    ) {

        if (
            !paymentId ||
            String(paymentId).trim() === ""
        ) {
            throw new Error(
                "Advertisement payment ID is required"
            );
        }

        if (
            !data ||
            typeof data !== "object"
        ) {
            throw new Error(
                "Payment history data is required"
            );
        }

        const safePaymentId =
            String(paymentId).trim();

        const historyId =
            this.historyRef.push().key;

        const historyRecord = {

            historyId:
                historyId,

            paymentId:
                safePaymentId,

            advertisementId:
                String(
                    data.advertisementId || ""
                ).trim(),

            partnerId:
                String(
                    data.partnerId || ""
                ).trim(),

            salonId:
                String(
                    data.salonId || ""
                ).trim(),

            planId:
                String(
                    data.planId || ""
                ).trim(),

            amount:
                Number(
                    data.amount || 0
                ),

            gateway:
                String(
                    data.gateway || ""
                ).trim(),

            gatewayOrderId:
                String(
                    data.gatewayOrderId || ""
                ).trim(),

            gatewayPaymentId:
                String(
                    data.gatewayPaymentId || ""
                ).trim(),

            status:
                String(
                    data.status || ""
                ).trim(),

            event:
                String(
                    data.event || ""
                ).trim(),

            createdAt:
                Date.now()
        };

        await this.historyRef
            .child(historyId)
            .set(historyRecord);

        return historyRecord;
    }
}

module.exports =
    AdvertisementPaymentRepository;
