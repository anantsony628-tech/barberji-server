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
            customerName,
            serviceName,
            bookingDate,
            bookingTime,
            newDate,
            newTime,
            status
        } = req.body;

        if (!recipientType || !bookingId || !status) {
            return res.status(400).json({
                success: false,
                message: "Missing required fields"
            });
        }

        let token = null;

        // =====================================================
        // CUSTOMER TOKEN
        // =====================================================

        if (recipientType === "CUSTOMER") {

            if (!customerId) {
                return res.status(400).json({
                    success: false,
                    message: "customerId required"
                });
            }

            const snapshot = await db
                .ref(`BarberJi/FCMTokens/Customers/${customerId}/token`)
                .once("value");

            token = snapshot.val();
        }

        // =====================================================
        // PARTNER TOKEN
        // =====================================================

        else if (recipientType === "PARTNER") {

            if (!partnerId || !salonId) {
                return res.status(400).json({
                    success: false,
                    message: "partnerId and salonId required"
                });
            }

            const snapshot = await db
                .ref(`BarberJi/FCMTokens/Partners/${partnerId}/${salonId}/token`)
                .once("value");

            token = snapshot.val();
        }

        else {
            return res.status(400).json({
                success: false,
                message: "Invalid recipientType"
            });
        }

        if (!token) {
            return res.status(404).json({
                success: false,
                message: "FCM token not found"
            });
        }

        // =====================================================
        // NOTIFICATION TEXT
        // =====================================================

        let title = "Barber Ji";
        let body = "";

        switch (status) {

            case "ACCEPTED":
                body = `Booking Accepted${serviceName ? " - " + serviceName : ""}`;
                break;

            case "REJECTED":
                body = `Booking Rejected${serviceName ? " - " + serviceName : ""}`;
                break;

            case "RESCHEDULED":
                body = `Booking Rescheduled to ${newDate || bookingDate} ${newTime || bookingTime}`;
                break;

            case "SERVICE_STARTED":
                body = `Service Started${serviceName ? " - " + serviceName : ""}`;
                break;

                case "NEXT_CUSTOMER":
    body =
        `🔔 आपका नंबर आने वाला है` +
        `${bookingTime ? " | कृपया Salon पर पहुँचें" : ""}`;
    break;

            case "SERVICE_COMPLETED":
                body = `Service Completed${serviceName ? " - " + serviceName : ""}`;
                break;

            case "CANCELLED":
                body = `Booking Cancelled${serviceName ? " - " + serviceName : ""}`;
                break;

            default:
                body = `Booking status updated: ${status}`;
        }

        // =====================================================
        // FCM MESSAGE
        // =====================================================

        const message = {
            token: token,

            notification: {
                title: title,
                body: body
            },

            data: {
                type: "BOOKING_STATUS",
                bookingId: String(bookingId),
                status: String(status),

                customerId: customerId ? String(customerId) : "",
                partnerId: partnerId ? String(partnerId) : "",
                salonId: salonId ? String(salonId) : "",

                customerName: customerName ? String(customerName) : "",
                serviceName: serviceName ? String(serviceName) : "",

                bookingDate: bookingDate ? String(bookingDate) : "",
                bookingTime: bookingTime ? String(bookingTime) : "",

                newDate: newDate ? String(newDate) : "",
                newTime: newTime ? String(newTime) : ""
            }
        };

        const response =
            await require("firebase-admin/messaging")
                .getMessaging()
                .send(message);

        console.log("Booking status notification sent:", response);

        return res.json({
            success: true,
            message: "Booking status notification sent ✅",
            messageId: response
        });

    } catch (error) {

        console.error("Booking status notification error:", error);

        return res.status(500).json({
            success: false,
            message: error.message
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
