// =========================================================
// BARBER JI - PAYMENT INTENT SERVICE
// =========================================================
// Responsibility:
// - Pre-payment booking/payment intent banana
// - Firebase Services se actual service verify karna
// - Actual service prices backend par calculate karna
// - Admin SALON-SIDE commission calculate karna
// - Per Booking / Per Service extra fee calculate karna
// - PaymentIntent Firebase mein save karna
// - Razorpay Order create karna
//
// IMPORTANT:
// - Client ke amount par trust nahi kiya jayega
// - Service price Firebase se li jayegi
// - Salon-side commission backend par authoritative hai
// - Customer-side commission abhi is file mein nahi hai
// - Final Booking abhi create nahi hogi
// - Payment verify hone ke baad final booking banegi
//
// This file does NOT:
// - verify Razorpay payment
// - process refund
// - process payout
// - directly create final Bookings record
// =========================================================

const admin =
    require("firebase-admin");

const {
    getDatabase
} = require("firebase-admin/database");

const crypto =
    require("crypto");

const db =
    getDatabase();

const paymentService =
    require("./paymentService");

const paymentBookingService =
    require("./paymentBookingService");

const paymentCommissionService =
    require("./paymentCommissionService");


// =========================================================
// HELPERS
// =========================================================

function cleanString(value) {

    if (
        value === undefined ||
        value === null
    ) {
        return "";
    }

    return String(value).trim();
}


function parseServiceIds(serviceIds) {

    if (Array.isArray(serviceIds)) {

        return serviceIds
            .map(id => cleanString(id))
            .filter(id => id !== "");
    }

    return cleanString(serviceIds)
        .split(",")
        .map(id => id.trim())
        .filter(id => id !== "");
}


function parseServicePrice(price) {

    const numericPrice =
        Number(price);

    if (
        !Number.isFinite(numericPrice) ||
        numericPrice <= 0
    ) {
        throw new Error(
            "Invalid service price"
        );
    }

    return Math.round(
        numericPrice * 100
    ) / 100;
}


function createPaymentIntentId() {

    return (
        "PI_" +
        Date.now() +
        "_" +
        crypto
            .randomBytes(5)
            .toString("hex")
            .toUpperCase()
    );
}


// =========================================================
// LOAD AND VERIFY SERVICES
// =========================================================

async function getVerifiedServices({
    salonId,
    partnerId,
    salonName,
    serviceIds
}) {

    const cleanSalonId =
        cleanString(salonId);

    const cleanPartnerId =
        cleanString(partnerId);

    const cleanSalonName =
        cleanString(salonName);

    const uniqueIds =
        [
            ...new Set(
                parseServiceIds(serviceIds)
            )
        ];


    // =====================================================
    // BASIC VALIDATION
    // =====================================================

    if (!cleanSalonId) {

        throw new Error(
            "Salon ID is required"
        );
    }


    if (!cleanPartnerId) {

        throw new Error(
            "Partner ID is required"
        );
    }


    if (!cleanSalonName) {

        throw new Error(
            "Salon name is required"
        );
    }


    if (uniqueIds.length === 0) {

        throw new Error(
            "At least one service is required"
        );
    }


    if (uniqueIds.length > 20) {

        throw new Error(
            "Too many services selected"
        );
    }


    // =====================================================
    // CURRENT FIREBASE STRUCTURE
    //
    // Services
    //   └── SALON00008
    //       ├── serviceId
    //       └── serviceId
    //
    // OLD STRUCTURE ALSO SUPPORTED:
    //
    // Services
    //   └── SALON00008
    //       └── salonName
    //           └── serviceId
    // =====================================================

    const salonServicesRef =
        db
            .ref("Services")
            .child(cleanSalonId);


    // =====================================================
    // VERIFY EACH SERVICE DIRECTLY
    // =====================================================

    const verifiedServices = [];

    let totalAmount = 0;


    for (
        const serviceId
        of uniqueIds
    ) {

        // -------------------------------------------------
        // CURRENT STRUCTURE
        // -------------------------------------------------

        let serviceSnapshot =
            await salonServicesRef
                .child(serviceId)
                .once("value");


        // -------------------------------------------------
        // OLD STRUCTURE
        // -------------------------------------------------

        if (!serviceSnapshot.exists()) {

            serviceSnapshot =
                await salonServicesRef
                    .child(cleanSalonName)
                    .child(serviceId)
                    .once("value");
        }


        // -------------------------------------------------
        // SERVICE NOT FOUND
        // -------------------------------------------------

        if (!serviceSnapshot.exists()) {

            throw new Error(
                "Selected service not found: " +
                serviceId
            );
        }


        // -------------------------------------------------
        // SERVICE DATA
        // -------------------------------------------------

        const service =
            serviceSnapshot.val();


        if (
            !service ||
            typeof service !== "object"
        ) {

            throw new Error(
                "Invalid service data: " +
                serviceId
            );
        }


        // -------------------------------------------------
        // VERIFY PARTNER
        // -------------------------------------------------

        const servicePartnerId =
            cleanString(
                service.partnerId
            );


        if (
            servicePartnerId !==
            cleanPartnerId
        ) {

            throw new Error(
                "Service does not belong to this partner"
            );
        }


        // -------------------------------------------------
        // SERVICE NAME
        // -------------------------------------------------

        const serviceName =
            cleanString(
                service.name
            );


        if (!serviceName) {

            throw new Error(
                "Service name missing: " +
                serviceId
            );
        }


        // -------------------------------------------------
        // SERVICE PRICE
        // -------------------------------------------------

        const price =
            parseServicePrice(
                service.price
            );


        // -------------------------------------------------
        // SERVICE DURATION
        // -------------------------------------------------

        const duration =
            cleanString(
                service.duration
            );


        // -------------------------------------------------
        // TOTAL SERVICE AMOUNT
        // -------------------------------------------------

        totalAmount +=
            price;


        // -------------------------------------------------
        // VERIFIED SERVICE
        // -------------------------------------------------

        verifiedServices.push({

            serviceId:
                serviceId,

            name:
                serviceName,

            price:
                price,

            duration:
                duration,

            partnerId:
                servicePartnerId

        });
    }


    // =====================================================
    // ROUND TOTAL
    // =====================================================

    totalAmount =
        Math.round(
            totalAmount * 100
        ) / 100;


    if (totalAmount <= 0) {

        throw new Error(
            "Invalid total booking amount"
        );
    }


    // =====================================================
    // RETURN VERIFIED DATA
    // =====================================================

    return {

        salonId:
            cleanSalonId,

        partnerId:
            cleanPartnerId,

        salonName:
            cleanSalonName,

        services:
            verifiedServices,

        serviceCount:
            verifiedServices.length,

        totalAmount:
            totalAmount

    };
}


// =========================================================
// CREATE PAYMENT INTENT
// =========================================================

async function createPaymentIntent({
    authUid,
    customerId,
    customerName,
    customerMobile,
    salonId,
    partnerId,
    salonName,
    ownerMobile,
    serviceIds,
    bookingDate,
    bookingTime,
    tokenNo,
    paymentMode
}) {

    const cleanAuthUid =
        cleanString(authUid);

    const cleanCustomerId =
        cleanString(customerId);

    const cleanCustomerName =
        cleanString(customerName);

    const cleanCustomerMobile =
        cleanString(customerMobile);

    const cleanOwnerMobile =
        cleanString(ownerMobile);

    const cleanBookingDate =
        cleanString(bookingDate);

    const cleanBookingTime =
        cleanString(bookingTime);

    const cleanTokenNo =
        cleanString(tokenNo);


    // =====================================================
    // AUTH
    // =====================================================

    if (!cleanAuthUid) {

        throw new Error(
            "Customer authentication is required"
        );
    }


    // =====================================================
    // CUSTOMER ID
    // =====================================================

    if (!cleanCustomerId) {

        throw new Error(
            "Customer ID is required"
        );
    }


    // =====================================================
    // CUSTOMER NAME
    // =====================================================

    if (!cleanCustomerName) {

        throw new Error(
            "Customer name is required"
        );
    }


    // =====================================================
    // CUSTOMER MOBILE
    // =====================================================

    if (
        !/^[6-9][0-9]{9}$/.test(
            cleanCustomerMobile
        )
    ) {

        throw new Error(
            "Invalid customer mobile number"
        );
    }


    // =====================================================
    // BOOKING DATE
    // =====================================================

    if (!cleanBookingDate) {

        throw new Error(
            "Booking date is required"
        );
    }


    // =====================================================
    // BOOKING TIME
    // =====================================================

    if (!cleanBookingTime) {

        throw new Error(
            "Booking time is required"
        );
    }


    // =====================================================
    // VERIFY SERVICES
    // =====================================================

    const verified =
        await getVerifiedServices({

            salonId:
                salonId,

            partnerId:
                partnerId,

            salonName:
                salonName,

            serviceIds:
                serviceIds

        });


    // =====================================================
    // BACKEND SALON-SIDE COMMISSION
    // =====================================================
    //
    // serviceCount is now passed.
    //
    // Example:
    //
    // Service = ₹100
    // Commission = 10%
    // Extra Fee = ₹5 PER_SERVICE
    // 1 service
    //
    // commissionAmount = ₹10
    // extraFee = ₹5
    // totalSalonDeduction = ₹15
    // salonAmount = ₹85
    //
    // No customer-side charge here.
    // =====================================================

    const commission =
        await paymentCommissionService
            .calculateBookingCommission(
                verified.totalAmount,
                verified.serviceCount
            );


    // =====================================================
    // NORMALIZE CUSTOMER PAYMENT MODE
    // =====================================================

    const normalizedPaymentMode =
        String(
            paymentMode || "Cash"
        )
            .trim()
            .toUpperCase();


    if (
        normalizedPaymentMode !== "CASH" &&
        normalizedPaymentMode !== "UPI"
    ) {

        throw new Error(
            "Invalid payment mode"
        );
    }


    // =====================================================
    // RAZORPAY AMOUNT
    // =====================================================
    //
    // CASH:
    // Customer salon par service amount dega.
    // Barber Ji ka salon-side deduction booking ke
    // time online collect hoga.
    //
    // UPI:
    // Full service amount online collect hoga.
    // Salon payout later settlement se hoga.
    //
    // Customer-side commission abhi nahi hai.
    // =====================================================

    const razorpayAmount =
        normalizedPaymentMode === "CASH"
            ? commission.totalSalonDeduction
            : verified.totalAmount;


    const razorpayAmountRounded =
        Math.round(
            Number(razorpayAmount) * 100
        ) / 100;


    if (
        !Number.isFinite(
            razorpayAmountRounded
        ) ||
        razorpayAmountRounded < 0
    ) {

        throw new Error(
            "Invalid payment amount"
        );
    }


    // =====================================================
    // ZERO ONLINE PAYMENT
    // =====================================================
    //
    // Agar CASH + salon-side total deduction = ₹0,
    // Razorpay ₹0 order create nahi kar sakta.
    //
    // Is special case ko next payment-flow step mein
    // properly handle kiya jayega.
    //
    // Abhi invalid Razorpay order banane se rok rahe hain.
    // =====================================================

    if (
        normalizedPaymentMode === "CASH" &&
        razorpayAmountRounded <= 0
    ) {

        throw new Error(
            "No online salon charge is required for this cash booking"
        );
    }


    // =====================================================
    // CREATE UNIQUE PAYMENT INTENT
    // =====================================================

    const paymentIntentId =
        createPaymentIntentId();


    const receipt =
        paymentIntentId
            .replace(
                /[^a-zA-Z0-9]/g,
                ""
            )
            .substring(
                0,
                40
            );


    // =====================================================
    // CREATE RAZORPAY ORDER
    // =====================================================

    const razorpayOrder =
        await paymentService.createOrder({

            amountPaise:
                paymentBookingService
                    .rupeesToPaise(
                        razorpayAmountRounded
                    ),

            receipt:
                receipt,

            notes: {

                paymentIntentId:
                    paymentIntentId,

                customerId:
                    cleanCustomerId,

                salonId:
                    verified.salonId,

                partnerId:
                    verified.partnerId

            }

        });


    // =====================================================
    // SAVE PAYMENT INTENT
    // =====================================================

    const paymentIntent = {

        paymentIntentId:
            paymentIntentId,

        authUid:
            cleanAuthUid,

        customerId:
            cleanCustomerId,

        customerName:
            cleanCustomerName,

        customerMobile:
            cleanCustomerMobile,

        salonId:
            verified.salonId,

        partnerId:
            verified.partnerId,

        salonName:
            verified.salonName,

        ownerMobile:
            cleanOwnerMobile,

        services:
            verified.services,

        serviceIds:
            verified.services.map(
                service =>
                    service.serviceId
            ),

        serviceCount:
            verified.serviceCount,

        bookingDate:
            cleanBookingDate,

        bookingTime:
            cleanBookingTime,

        tokenNo:
            cleanTokenNo,


        // =================================================
        // AUTHORITATIVE FINANCIAL VALUES
        // =================================================

        bookingAmount:
            commission.bookingAmount,

        // Existing compatibility field:
        // total salon-side deduction.
        commission:
            commission.totalSalonDeduction,

        // Separate salon-side base commission.
        commissionAmount:
            commission.commissionAmount,

        // Separate salon-side extra fee.
        extraFee:
            commission.extraFee,

        // Explicit total salon deduction.
        salonCommissionTotal:
            commission.totalSalonDeduction,

        // Salon amount after salon-side deduction.
        salonAmount:
            commission.salonAmount,

        commissionSettings:
            commission.settings,


        // =================================================
        // PAYMENT
        // =================================================

        paymentMode:
            normalizedPaymentMode,

        razorpayOrderId:
            razorpayOrder.orderId,

        razorpayAmountPaise:
            razorpayOrder.amountPaise,

        currency:
            razorpayOrder.currency,

        razorpayOrderStatus:
            razorpayOrder.status,

        status:
            "CREATED",

        createdAt:
            admin
                .database
                .ServerValue
                .TIMESTAMP

    };


    // =====================================================
    // SAVE TO FIREBASE
    // =====================================================

    await db
        .ref("BarberJi")
        .child("PaymentIntents")
        .child(paymentIntentId)
        .set(
            paymentIntent
        );


    // =====================================================
    // RETURN TO ANDROID
    // =====================================================

    return {

        success:
            true,

        paymentIntentId:
            paymentIntentId,

        razorpayOrderId:
            razorpayOrder.orderId,

        razorpayKeyId:
            require("./paymentConfig")
                .razorpay
                .keyId,

        amountPaise:
            razorpayOrder.amountPaise,

        // Actual service amount.
        amount:
            commission.bookingAmount,

        currency:
            razorpayOrder.currency,


        // =================================================
// FINANCIAL BREAKDOWN
// =================================================

bookingAmount:
    commission.bookingAmount,

commission:
    commission.totalSalonDeduction,

commissionAmount:
    commission.commissionAmount,

extraFee:
    commission.extraFee,

salonCommissionTotal:
    commission.totalSalonDeduction,

salonAmount:
    commission.salonAmount,

serviceCount:
    verified.serviceCount,

paymentMode:
    normalizedPaymentMode,

services:
    verified.services

    };
}


// =========================================================
// GET PAYMENT INTENT
// =========================================================

async function getPaymentIntent(
    paymentIntentId
) {

    const cleanId =
        cleanString(
            paymentIntentId
        );


    if (!cleanId) {

        throw new Error(
            "Payment Intent ID is required"
        );
    }


    const snapshot =
        await db
            .ref("BarberJi")
            .child("PaymentIntents")
            .child(cleanId)
            .once("value");


    if (!snapshot.exists()) {

        throw new Error(
            "Payment intent not found"
        );
    }


    const data =
        snapshot.val();


    if (
        !data ||
        typeof data !== "object"
    ) {

        throw new Error(
            "Invalid payment intent"
        );
    }


    return {

        ...data,

        paymentIntentId:
            cleanId

    };
}


// =========================================================
// EXPORT
// =========================================================

module.exports = {

    createPaymentIntent,

    getPaymentIntent,

    getVerifiedServices

};
        
