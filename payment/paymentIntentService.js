// =========================================================
// BARBER JI - PAYMENT INTENT SERVICE
// =========================================================
// Responsibility:
// - Pre-payment booking/payment intent banana
// - Firebase Services se actual service verify karna
// - Actual service prices backend par calculate karna
// - Admin commission calculate karna
// - PaymentIntent Firebase mein save karna
// - Razorpay Order create karna
//
// IMPORTANT:
// - Client ke amount par trust nahi kiya jayega
// - Service price Firebase se li jayegi
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

    if (value === undefined ||
        value === null) {

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

    if (!Number.isFinite(numericPrice) ||
        numericPrice <= 0) {

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

    const ids =
        parseServiceIds(serviceIds);


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


    if (ids.length === 0) {

        throw new Error(
            "At least one service is required"
        );
    }


    if (ids.length > 20) {

        throw new Error(
            "Too many services selected"
        );
    }


    const uniqueIds =
        [...new Set(ids)];


    const servicesRef =
        db
            .ref("Services")
            .child(cleanSalonId)
            .child(cleanSalonName);


    const snapshot =
        await servicesRef.once("value");


    if (!snapshot.exists()) {

        throw new Error(
            "Services not found for this salon"
        );
    }


    const verifiedServices = [];

    let totalAmount = 0;


    for (const serviceId of uniqueIds) {

        const serviceSnapshot =
            snapshot.child(serviceId);


        if (!serviceSnapshot.exists()) {

            throw new Error(
                "Selected service not found: " +
                serviceId
            );
        }


        const service =
            serviceSnapshot.val();


        if (!service ||
            typeof service !== "object") {

            throw new Error(
                "Invalid service data: " +
                serviceId
            );
        }


        const servicePartnerId =
            cleanString(
                service.partnerId
            );


        if (servicePartnerId !==
            cleanPartnerId) {

            throw new Error(
                "Service does not belong to this partner"
            );
        }


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


        const price =
            parseServicePrice(
                service.price
            );


        const duration =
            cleanString(
                service.duration
            );


        totalAmount += price;


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


    totalAmount =
        Math.round(
            totalAmount * 100
        ) / 100;


    if (totalAmount <= 0) {

        throw new Error(
            "Invalid total booking amount"
        );
    }


    return {

        salonId:
            cleanSalonId,

        partnerId:
            cleanPartnerId,

        salonName:
            cleanSalonName,

        services:
            verifiedServices,

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

    tokenNo

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


    if (!cleanAuthUid) {

        throw new Error(
            "Customer authentication is required"
        );
    }


    if (!cleanCustomerId) {

        throw new Error(
            "Customer ID is required"
        );
    }


    if (!cleanCustomerName) {

        throw new Error(
            "Customer name is required"
        );
    }


    if (!/^[6-9][0-9]{9}$/.test(
        cleanCustomerMobile
    )) {

        throw new Error(
            "Invalid customer mobile number"
        );
    }


    if (!cleanBookingDate) {

        throw new Error(
            "Booking date is required"
        );
    }


    if (!cleanBookingTime) {

        throw new Error(
            "Booking time is required"
        );
    }


    // -----------------------------------------------------
    // VERIFY SERVICES + CALCULATE ACTUAL AMOUNT
    // -----------------------------------------------------

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


    // -----------------------------------------------------
    // BACKEND COMMISSION
    // -----------------------------------------------------

    const commission =
        await paymentCommissionService
            .calculateBookingCommission(
                verified.totalAmount
            );


    // -----------------------------------------------------
    // CREATE UNIQUE PAYMENT INTENT
    // -----------------------------------------------------

    const paymentIntentId =
        createPaymentIntentId();


    const receipt =
        paymentIntentId
            .replace(/[^a-zA-Z0-9]/g, "")
            .substring(0, 40);


    // -----------------------------------------------------
    // CREATE RAZORPAY ORDER
    // -----------------------------------------------------

    const razorpayOrder =
        await paymentService.createOrder({

            amountPaise:
                paymentBookingService
                    .rupeesToPaise(
                        verified.totalAmount
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


    // -----------------------------------------------------
    // SAVE PAYMENT INTENT
    // -----------------------------------------------------

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
                service => service.serviceId
            ),

        bookingDate:
            cleanBookingDate,

        bookingTime:
            cleanBookingTime,

        tokenNo:
            cleanTokenNo,

        bookingAmount:
            commission.bookingAmount,

        commission:
            commission.commission,

        salonAmount:
            commission.salonAmount,

        commissionSettings:
            commission.settings,

        paymentMode:
            "UPI",

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
    require("firebase-admin/database")
        .ServerValue.TIMESTAMP
    };


    await db
        .ref("BarberJi")
        .child("PaymentIntents")
        .child(paymentIntentId)
        .set(paymentIntent);


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

        amount:
            commission.bookingAmount,

        currency:
            razorpayOrder.currency,

        bookingAmount:
            commission.bookingAmount,

        commission:
            commission.commission,

        salonAmount:
            commission.salonAmount,

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
        cleanString(paymentIntentId);


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


    if (!data ||
        typeof data !== "object") {

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


module.exports = {

    createPaymentIntent,

    getPaymentIntent,

    getVerifiedServices
};
