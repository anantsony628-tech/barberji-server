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

// =========================================================
// CUSTOMER MOBILE + PASSWORD LOGIN
// =========================================================

app.post("/customer-mobile-login", async (req, res) => {

    try {

        const {
            mobile,
            password,
            email
        } = req.body;

        // -------------------------------------------------
        // BASIC VALIDATION
        // -------------------------------------------------

        if (!mobile || !password) {

            return res.status(400).json({
                success: false,
                message: "Mobile number and password required"
            });
        }

        const safeMobile = String(mobile).trim();

        // -------------------------------------------------
        // FIND CUSTOMER(S) BY MOBILE
        // -------------------------------------------------

        const snapshot = await db
            .ref("Customers")
            .orderByChild("mobile")
            .equalTo(safeMobile)
            .once("value");

        if (!snapshot.exists()) {

            return res.status(404).json({
                success: false,
                message: "Mobile number not registered"
            });
        }

        const customers = [];

        snapshot.forEach(child => {

            const data = child.val() || {};

            customers.push({
                uid: child.key,
                email: data.email || "",
                customerId: data.customerId || "",
                mobile: data.mobile || "",
                name: data.name || "",
                status: data.status || "ACTIVE"
            });

        });

        // -------------------------------------------------
        // IF MULTIPLE ACCOUNTS
        // EMAIL MUST BE SELECTED
        // -------------------------------------------------

        let customer = null;

        if (customers.length > 1) {

            if (!email) {

                return res.json({
                    success: false,
                    multipleAccounts: true,
                    message: "Multiple accounts found",
                    accounts: customers.map(item => ({
                        email: item.email,
                        customerId: item.customerId,
                        name: item.name
                    }))
                });
            }

            customer = customers.find(
                item =>
                    item.email.toLowerCase() ===
                    String(email).trim().toLowerCase()
            );

            if (!customer) {

                return res.status(404).json({
                    success: false,
                    message: "Selected account not found"
                });
            }

        } else {

            // -------------------------------------------------
            // ONLY ONE ACCOUNT
            // -------------------------------------------------

            customer = customers[0];

        }

        // -------------------------------------------------
        // BASIC ACCOUNT CHECK
        // -------------------------------------------------

        if (!customer.email) {

            return res.status(400).json({
                success: false,
                message: "Customer email not available"
            });
        }

        if (customer.status &&
            customer.status.toUpperCase() !== "ACTIVE") {

            return res.status(403).json({
                success: false,
                message: "Customer account is not active"
            });
        }

        // -------------------------------------------------
        // VERIFY EMAIL + PASSWORD THROUGH FIREBASE AUTH
        // -------------------------------------------------

        const firebaseApiKey =
            process.env.FIREBASE_WEB_API_KEY;

        if (!firebaseApiKey) {

            console.error(
                "FIREBASE_WEB_API_KEY is missing"
            );

            return res.status(500).json({
                success: false,
                message: "Server configuration error"
            });
        }

        const authResponse = await fetch(
            `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${firebaseApiKey}`,
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({
                    email: customer.email,
                    password: password,
                    returnSecureToken: true
                })
            }
        );

        const authData = await authResponse.json();

        // -------------------------------------------------
        // WRONG PASSWORD
        // -------------------------------------------------

        if (!authResponse.ok) {

    console.log(
        "Firebase login failed:",
        authData
    );

    const firebaseError =
        authData &&
        authData.error &&
        authData.error.message
            ? authData.error.message
            : "UNKNOWN_AUTH_ERROR";

    return res.status(401).json({
        success: false,
        message: firebaseError
    });
}

        // -------------------------------------------------
        // VERIFY UID
        // -------------------------------------------------

        if (
            authData.localId &&
            authData.localId !== customer.uid
        ) {

            console.error(
                "UID mismatch:",
                authData.localId,
                customer.uid
            );

            return res.status(401).json({
                success: false,
                message: "Account verification failed"
            });
        }

        // -------------------------------------------------
        // CREATE FIREBASE CUSTOM TOKEN
        // -------------------------------------------------

        const customToken =
            await admin
                .auth()
                .createCustomToken(customer.uid);

        // -------------------------------------------------
        // SUCCESS
        // -------------------------------------------------

        console.log(
            "Customer mobile login successful:",
            customer.customerId,
            customer.mobile
        );

        return res.json({

            success: true,

            multipleAccounts: false,

            customToken: customToken,

            uid: customer.uid,

            email: customer.email,

            mobile: customer.mobile,

            customerId: customer.customerId,

            name: customer.name

        });

    } catch (error) {

        console.error(
            "Customer mobile login error:",
            error
        );

        return res.status(500).json({

            success: false,

            message: "Server error"

        });

    }

});

// ==========================================
// FIREBASE WEB API KEY CHECK
// ==========================================

console.log(
    "FIREBASE_WEB_API_KEY loaded:",
    !!process.env.FIREBASE_WEB_API_KEY
);
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
