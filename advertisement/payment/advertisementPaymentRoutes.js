const express =
    require("express");

const AdvertisementPaymentController =
    require("./advertisementPaymentController");


const router =
    express.Router();


const controller =
    new AdvertisementPaymentController();


/*
 * =====================================================
 * CREATE ADVERTISEMENT PAYMENT ORDER
 * =====================================================
 *
 * POST /advertisement/payment/create-order
 *
 */

router.post(
    "/create-order",
    async (req, res) => {

        await controller
            .createPaymentOrder(
                req,
                res
            );
    }
);


module.exports =
    router;
