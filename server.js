const express = require("express");
const admin = require("firebase-admin");
const { getDatabase } = require("firebase-admin/database");

// ==========================================
// FIREBASE ADMIN SDK
// ==========================================

const serviceAccount = require("./firebase-key.json");

admin.initializeApp({
    credential: admin.cert(serviceAccount),
    databaseURL:
        "https://barber-ji-default-rtdb.asia-southeast1.firebasedatabase.app"
});

// Firebase Realtime Database
const db = getDatabase();

// ==========================================
// EXPRESS SERVER
// ==========================================

const app = express();
const PORT = 3000;

app.use(express.json());

// ==========================================
// TEST ROUTE
// ==========================================

app.get("/", (req, res) => {
    res.send("Barber Ji Server is Running ✅");
});

// ==========================================
// BOOKING NOTIFICATION API
// ==========================================

app.post("/send-booking-notification", async (req, res) => {

    try {

        const {
            partnerId,
            salonId,
            bookingId,
            customerName,
            serviceName,
            bookingDate,
            bookingTime
        } = req.body;

        // ------------------------------------------
        // CHECK PARTNER ID
        // ------------------------------------------

        if (!partnerId || String(partnerId).trim() === "") {

            return res.status(400).json({
                success: false,
                message: "Partner ID missing"
            });
        }

        // ------------------------------------------
        // CHECK SALON ID
        // ------------------------------------------

        if (!salonId || String(salonId).trim() === "") {

            return res.status(400).json({
                success: false,
                message: "Salon ID missing"
            });
        }

        const safePartnerId = String(partnerId).trim();
        const safeSalonId = String(salonId).trim();

        // ------------------------------------------
        // READ PARTNER FCM TOKEN
        // ------------------------------------------

        const tokenSnapshot = await db
            .ref("BarberJi/FCMTokens/Partners")
            .child(safePartnerId)
            .child(safeSalonId)
            .child("token")
            .once("value");

        const token = tokenSnapshot.val();

        // ------------------------------------------
        // TOKEN NOT FOUND
        // ------------------------------------------

        if (!token || String(token).trim() === "") {

            console.log(
                "Partner FCM token not found:",
                safePartnerId,
                safeSalonId
            );

            return res.status(404).json({
                success: false,
                message: "Partner FCM token not found"
            });
        }

        console.log(
            "Partner FCM token found:",
            safePartnerId,
            safeSalonId
        );

        // ------------------------------------------
        // FCM MESSAGE
        // ------------------------------------------

        const message = {

            token: String(token).trim(),

            notification: {
                title: "New Booking 🔔",
                body:
                    `${customerName || "Customer"} ne ` +
                    `${serviceName || "service"} book ki hai`
            },

            data: {
                type: "NEW_BOOKING",

                partnerId: safePartnerId,

                salonId: safeSalonId,

                bookingId: String(bookingId || ""),

                customerName: String(customerName || ""),

                serviceName: String(serviceName || ""),

                bookingDate: String(bookingDate || ""),

                bookingTime: String(bookingTime || "")
            }
        };

        // ------------------------------------------
        // SEND FCM
        // ------------------------------------------

        const response = await require("firebase-admin/messaging").getMessaging().send(message);

        console.log(
            "FCM sent successfully:",
            response
        );

        // ------------------------------------------
        // SUCCESS RESPONSE
        // ------------------------------------------

        return res.json({

            success: true,

            message: "Booking notification sent ✅",

            messageId: response

        });

    } catch (error) {

        console.error(
            "FCM send error:",
            error
        );

        return res.status(500).json({

            success: false,

            message: error.message

        });
    }
});

// =========================================================
// BOOKING STATUS NOTIFICATION
// CUSTOMER / PARTNER
// =========================================================

app.post("/send-booking-status-notification", async (req, res) => {

    try {

        const {
            recipientType,
            customerId,
            partnerId,
            salonId,
            bookingId,
            status,
            customerName,
            serviceName,
            bookingDate,
            bookingTime,
            newDate,
            newTime
        } = req.body;


        // -------------------------------------------------
        // BASIC VALIDATION
        // -------------------------------------------------

        if (!recipientType) {

            return res.status(400).json({
                success: false,
                message: "Recipient type missing"
            });
        }

        if (!bookingId) {

            return res.status(400).json({
                success: false,
                message: "Booking ID missing"
            });
        }

        if (!status) {

            return res.status(400).json({
                success: false,
                message: "Status missing"
            });
        }


        let token = null;


        // =================================================
        // CUSTOMER TOKEN
        // =================================================

        if (recipientType === "CUSTOMER") {

            if (!customerId ||
                String(customerId).trim() === "") {

                return res.status(400).json({
                    success: false,
                    message: "Customer ID missing"
                });
            }


            const safeCustomerId =
                String(customerId).trim();


            const tokenSnapshot = await db
                .ref("BarberJi/FCMTokens/Customers")
                .child(safeCustomerId)
                .child("token")
                .once("value");


            token = tokenSnapshot.val();


            if (!token ||
                String(token).trim() === "") {

                console.log(
                    "Customer FCM token not found:",
                    safeCustomerId
                );

                return res.status(404).json({
                    success: false,
                    message: "Customer FCM token not found"
                });
            }


            console.log(
                "Customer FCM token found:",
                safeCustomerId
            );
        }


        // =================================================
        // PARTNER TOKEN
        // =================================================

        else if (recipientType === "PARTNER") {

            if (!partnerId ||
                String(partnerId).trim() === "") {

                return res.status(400).json({
                    success: false,
                    message: "Partner ID missing"
                });
            }


            if (!salonId ||
                String(salonId).trim() === "") {

                return res.status(400).json({
                    success: false,
                    message: "Salon ID missing"
                });
            }


            const safePartnerId =
                String(partnerId).trim();

            const safeSalonId =
                String(salonId).trim();


            const tokenSnapshot = await db
                .ref("BarberJi/FCMTokens/Partners")
                .child(safePartnerId)
                .child(safeSalonId)
                .child("token")
                .once("value");


            token = tokenSnapshot.val();


            if (!token ||
                String(token).trim() === "") {

                console.log(
                    "Partner FCM token not found:",
                    safePartnerId,
                    safeSalonId
                );

                return res.status(404).json({
                    success: false,
                    message: "Partner FCM token not found"
                });
            }


            console.log(
                "Partner FCM token found:",
                safePartnerId,
                safeSalonId
            );
        }


        // =================================================
        // INVALID RECIPIENT
        // =================================================

        else {

            return res.status(400).json({
                success: false,
                message: "Invalid recipient type"
            });
        }


        // =================================================
        // NOTIFICATION TEXT
        // =================================================

        let title = "Booking Update 🔔";
        let body = "Aapki booking update hui hai";


        if (status === "ACCEPTED") {

            title = "Booking Accepted ✅";

            body =
                `${serviceName || "Service"} booking ` +
                `partner ne accept kar li hai`;
        }


        else if (status === "REJECTED") {

            title = "Booking Rejected ❌";

            body =
                `${serviceName || "Service"} booking ` +
                `partner ne reject kar di hai`;
        }


        else if (status === "RESCHEDULED") {

            title = "Booking Rescheduled 📅";

            body =
                `${serviceName || "Service"} booking ` +
                `reschedule ki gayi hai`;

            if (newDate || newTime) {

                body +=
                    ` ${newDate || bookingDate || ""}` +
                    ` ${newTime || bookingTime || ""}`;
            }
        }


        else if (status === "SERVICE_STARTED") {

            title = "Service Started ✂️";

            body =
                `${serviceName || "Service"} ` +
                `ab start ho gayi hai`;
        }


        else if (status === "SERVICE_COMPLETED") {

            title = "Service Completed ✅";

            body =
                `${serviceName || "Service"} ` +
                `complete ho gayi hai`;
        }


        else if (status === "CANCELLED") {

            title = "Booking Cancelled ❌";

            body =
                `${customerName || "Customer"} ne ` +
                `${serviceName || "booking"} cancel kar di hai`;
        }


        // =================================================
        // FCM MESSAGE
        // =================================================

        const message = {

            token: String(token).trim(),

            notification: {
                title: title,
                body: body
            },

            data: {

                type:
                    "BOOKING_STATUS",

                recipientType:
                    String(recipientType),

                bookingId:
                    String(bookingId || ""),

                status:
                    String(status || ""),

                customerId:
                    String(customerId || ""),

                partnerId:
                    String(partnerId || ""),

                salonId:
                    String(salonId || ""),

                customerName:
                    String(customerName || ""),

                serviceName:
                    String(serviceName || ""),

                bookingDate:
                    String(bookingDate || ""),

                bookingTime:
                    String(bookingTime || ""),

                newDate:
                    String(newDate || ""),

                newTime:
                    String(newTime || "")
            }
        };


        // =================================================
        // SEND FCM
        // =================================================

        const response =
            await admin
                .messaging()
                .send(message);


        console.log(
            "Booking status notification sent:",
            response
        );


        return res.json({

            success: true,

            message:
                "Booking status notification sent ✅",

            messageId:
                response
        });


    } catch (error) {

        console.error(
            "Booking status notification error:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                error.message
        });
    }
});

// ==========================================
// START SERVER
// ==========================================

app.listen(PORT, () => {

    console.log(
        `Barber Ji Server running on port ${PORT}`
    );

    console.log(
        "Firebase Admin SDK connected ✅"
    );

});
