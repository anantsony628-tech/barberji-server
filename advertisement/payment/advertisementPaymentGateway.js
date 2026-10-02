class AdvertisementPaymentGateway {

    /**
     * Create a payment order for an advertisement.
     *
     * @param {Object} paymentData
     * @returns {Promise<Object>}
     */
    async createOrder(paymentData) {
        throw new Error(
            "createOrder() must be implemented by advertisement payment gateway"
        );
    }

    /**
     * Verify a completed advertisement payment.
     *
     * @param {Object} paymentData
     * @returns {Promise<Object>}
     */
    async verifyPayment(paymentData) {
        throw new Error(
            "verifyPayment() must be implemented by advertisement payment gateway"
        );
    }

    /**
     * Refund an advertisement payment.
     *
     * @param {Object} paymentData
     * @returns {Promise<Object>}
     */
    async refundPayment(paymentData) {
        throw new Error(
            "refundPayment() must be implemented by advertisement payment gateway"
        );
    }
}

module.exports = AdvertisementPaymentGateway;
