const express =
    require("express");

const AdvertisementPaymentController =
    require("./advertisementPaymentController");

const {
    verifyAdvertisementUser
} =
    require("./advertisementPaymentAuth");


const router =
    express.Router();


const controller =
    new AdvertisementPaymentController();


// =====================================================
// CREATE ADVERTISEMENT PAYMENT ORDER
// =====================================================
//
// POST
// /advertisement/payment/create-order
//
// Authentication:
// Firebase ID Token
//
// =====================================================

router.post(
    "/create-order",

    verifyAdvertisementUser,

    async (req, res) => {

        await controller
            .createPaymentOrder(
                req,
                res
            );
    }
);


// =====================================================
// VERIFY ADVERTISEMENT PAYMENT
// =====================================================
//
// POST
// /advertisement/payment/verify-payment
//
// Authentication:
// Firebase ID Token
//
// =====================================================

router.post(
    "/verify-payment",

    verifyAdvertisementUser,

    async (req, res) => {

        await controller
            .verifyPayment(
                req,
                res
            );
    }
);


module.exports =
    router;
