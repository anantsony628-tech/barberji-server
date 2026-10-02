const AdvertisementPaymentService =
    require("./advertisementPaymentService");


class AdvertisementPaymentController {

    constructor() {

        this.paymentService =
            new AdvertisementPaymentService();
    }


    // =====================================================
    // CREATE PAYMENT ORDER
    // =====================================================

    async createPaymentOrder(req, res) {

        try {

            if (!req.user) {

                return res.status(401).json({

                    success:
                        false,

                    message:
                        "Authenticated user not found"
                });
            }


            const requestData = {

                ...(
                    req.body || {}
                ),

                // -----------------------------------------
                // NEVER TRUST THESE FROM ANDROID
                // -----------------------------------------

                partnerId:
                    req.user.partnerId,

                salonId:
                    req.user.salonId,

                authUid:
                    req.user.uid
            };


            const result =
                await this.paymentService
                    .createPaymentOrder(
                        requestData
                    );


            return res
                .status(200)
                .json(
                    result
                );

        } catch (error) {

            console.error(
                "ADVERTISEMENT PAYMENT ORDER ERROR:",
                error
            );


            return res
                .status(400)
                .json({

                    success:
                        false,

                    message:
                        error.message ||
                        "Unable to create advertisement payment order"
                });
        }
    }


    // =====================================================
    // VERIFY PAYMENT
    // =====================================================

    async verifyPayment(req, res) {

        try {

            if (!req.user) {

                return res.status(401).json({

                    success:
                        false,

                    message:
                        "Authenticated user not found"
                });
            }


            const requestData = {

                ...(
                    req.body || {}
                ),

                // -----------------------------------------
                // VERIFIED FROM FIREBASE AUTH
                // -----------------------------------------

                partnerId:
                    req.user.partnerId,

                salonId:
                    req.user.salonId
            };


            const result =
                await this.paymentService
                    .verifyPayment(
                        requestData
                    );


            return res
                .status(200)
                .json(
                    result
                );

        } catch (error) {

            console.error(
                "ADVERTISEMENT PAYMENT VERIFY ERROR:",
                error
            );


            return res
                .status(400)
                .json({

                    success:
                        false,

                    message:
                        error.message ||
                        "Unable to verify advertisement payment"
                });
        }
    }
}


module.exports =
    AdvertisementPaymentController;
