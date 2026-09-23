// =========================================================
// BARBER JI - PAYMENT CONFIGURATION
// =========================================================
// IMPORTANT:
// Razorpay secret values code में hard-code नहीं होंगी.
// Render Environment Variables से आएँगी.
// =========================================================

const paymentConfig = {

    razorpay: {

        keyId:
            process.env.RAZORPAY_KEY_ID || "",

        keySecret:
            process.env.RAZORPAY_KEY_SECRET || ""

    }

};

module.exports = paymentConfig;
