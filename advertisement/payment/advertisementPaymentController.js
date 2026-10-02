const AdvertisementPaymentService =
    require("./advertisementPaymentService");


class AdvertisementPaymentController {

    constructor() {

        this.paymentService =
            new AdvertisementPaymentService();
    }


    async createPaymentOrder(req, res) {

        try {

            const result =
                await this.paymentService
                    .createPaymentOrder(
                        req.body
                    );


            return res.status(200).json(
                result
            );

        } catch (error) {

            console.error(
                "ADVERTISEMENT PAYMENT ORDER ERROR:",
                error
            );


            return res.status(400).json({

                success:
                    false,

                message:
                    error.message ||
                    "Unable to create advertisement payment order"
            });
        }
    }
}


module.exports =
    AdvertisementPaymentController;
