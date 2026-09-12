const express = require("express");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const admin = require("firebase-admin");
const { getDatabase } = require("firebase-admin/database");

const router = express.Router();

const db = getDatabase();

const RESET_EXPIRY_MS = 15 * 60 * 1000;

// =========================================
// HELPER
// =========================================

function clean(value) {
    return value == null
        ? ""
        : String(value).trim();
}

// =========================================
// FIND PARTNER AUTH BY EMAIL
// =========================================

async function findPartnerByEmail(email) {

    const snapshot =
        await db
            .ref("PartnerAuth")
            .orderByChild("email")
            .equalTo(email)
            .once("value");

    if (!snapshot.exists()) {
        return null;
    }

    let result = null;

    snapshot.forEach(child => {

        if (!result) {
            result = {
                key: child.key,
                data: child.val()
            };
        }
    });

    return result;
}

// =========================================
// FORGOT PASSWORD
// =========================================

router.post(
    "/forgot-password",
    async (req, res) => {

        try {

            const email =
                clean(req.body.email)
                    .toLowerCase();

            if (!email) {

                return res.status(400).json({
                    success: false,
                    message:
                        "Email required hai"
                });
            }

            // ---------------------------------
            // FIND PARTNER
            // ---------------------------------

            const partner =
                await findPartnerByEmail(email);

            /*
             * Security:
             * Existing / non-existing email ka
             * alag response nahi dena.
             */

            if (!partner) {

                return res.json({
                    success: true,
                    message:
                        "Agar email registered hai to reset link bheja jayega"
                });
            }

            const partnerData =
                partner.data || {};

            if (
                partnerData.status &&
                partnerData.status !== "ACTIVE"
            ) {

                return res.json({
                    success: true,
                    message:
                        "Agar email registered hai to reset link bheja jayega"
                });
            }

            // ---------------------------------
            // GENERATE SECURE TOKEN
            // ---------------------------------

            const rawToken =
                crypto.randomBytes(32)
                    .toString("hex");

            const tokenHash =
                crypto
                    .createHash("sha256")
                    .update(rawToken)
                    .digest("hex");

            const expiresAt =
                Date.now() + RESET_EXPIRY_MS;

            // ---------------------------------
            // SAVE RESET REQUEST
            // ---------------------------------

            await db
                .ref(
                    "PartnerPasswordResets/" +
                    tokenHash
                )
                .set({

                    authUid:
                        partnerData.authUid || "",

                    partnerId:
                        partnerData.partnerId || "",

                    salonId:
                        partnerData.salonId || "",

                    email:
                        email,

                    tokenHash:
                        tokenHash,

                    expiresAt:
                        expiresAt,

                    used:
                        false,

                    createdAt:
                        Date.now()
                });

            // ---------------------------------
            // RESET LINK
            // ---------------------------------

            const resetBaseUrl =
                clean(
                    process.env.PARTNER_RESET_URL
                );

            if (!resetBaseUrl) {

                console.error(
                    "PARTNER_RESET_URL environment variable missing"
                );

                return res.status(500).json({
                    success: false,
                    message:
                        "Password reset service configured nahi hai"
                });
            }

            const resetLink =
                resetBaseUrl +
                "?token=" +
                encodeURIComponent(
                    rawToken
                );

            // ---------------------------------
            // EMAIL SENDING
            // ---------------------------------

            /*
             * IMPORTANT:
             *
             * Abhi yahan email provider ko
             * hard-code nahi kiya gaya hai.
             *
             * Next step mein SMTP/email provider
             * connect kiya jayega.
             */

            console.log(
                "PARTNER PASSWORD RESET LINK:",
                resetLink
            );

            return res.json({

                success: true,

                message:
                    "Agar email registered hai to reset link bheja jayega"

            });

        } catch (error) {

            console.error(
                "Partner forgot password error:",
                error
            );

            return res.status(500).json({

                success: false,

                message:
                    "Password reset request failed"

            });
        }
    }
);

// =========================================
// RESET PASSWORD
// =========================================

router.post(
    "/reset-password",
    async (req, res) => {

        try {

            const token =
                clean(req.body.token);

            const newPassword =
                clean(req.body.newPassword);

            if (!token) {

                return res.status(400).json({
                    success: false,
                    message:
                        "Reset token required hai"
                });
            }

            if (!newPassword) {

                return res.status(400).json({
                    success: false,
                    message:
                        "New password required hai"
                });
            }

            if (newPassword.length < 6) {

                return res.status(400).json({
                    success: false,
                    message:
                        "Password minimum 6 characters ka hona chahiye"
                });
            }

            // ---------------------------------
            // HASH TOKEN
            // ---------------------------------

            const tokenHash =
                crypto
                    .createHash("sha256")
                    .update(token)
                    .digest("hex");

            // ---------------------------------
            // READ RESET REQUEST
            // ---------------------------------

            const resetRef =
                db.ref(
                    "PartnerPasswordResets/" +
                    tokenHash
                );

            const resetSnapshot =
                await resetRef.once("value");

            if (!resetSnapshot.exists()) {

                return res.status(400).json({
                    success: false,
                    message:
                        "Invalid ya expired reset link"
                });
            }

            const resetData =
                resetSnapshot.val() || {};

            // ---------------------------------
            // CHECK TOKEN USED
            // ---------------------------------

            if (resetData.used === true) {

                return res.status(400).json({
                    success: false,
                    message:
                        "Ye reset link already use ho chuka hai"
                });
            }

            // ---------------------------------
            // CHECK EXPIRY
            // ---------------------------------

            if (
                !resetData.expiresAt ||
                Date.now() >
                Number(resetData.expiresAt)
            ) {

                await resetRef.remove();

                return res.status(400).json({
                    success: false,
                    message:
                        "Reset link expire ho chuka hai"
                });
            }

            // ---------------------------------
            // FIND PARTNER AUTH RECORD
            // ---------------------------------

            const authUid =
                clean(
                    resetData.authUid
                );

            if (!authUid) {

                return res.status(400).json({
                    success: false,
                    message:
                        "Partner account invalid hai"
                });
            }

            const partnerRef =
                db.ref(
                    "PartnerAuth/" +
                    authUid
                );

            const partnerSnapshot =
                await partnerRef.once("value");

            if (!partnerSnapshot.exists()) {

                return res.status(400).json({
                    success: false,
                    message:
                        "Partner account nahi mila"
                });
            }

            const partnerData =
                partnerSnapshot.val() || {};

            // ---------------------------------
            // HASH NEW PASSWORD
            // ---------------------------------

            const passwordHash =
                await bcrypt.hash(
                    newPassword,
                    12
                );

            // ---------------------------------
            // UPDATE PARTNER PASSWORD
            // ---------------------------------

            await partnerRef.update({

                passwordHash:
                    passwordHash,

                updatedAt:
                    Date.now()

            });

            // ---------------------------------
            // MARK TOKEN USED
            // ---------------------------------

            await resetRef.update({

                used:
                    true,

                usedAt:
                    Date.now()

            });

            return res.json({

                success: true,

                message:
                    "Partner password successfully reset ho gaya"

            });

        } catch (error) {

            console.error(
                "Partner reset password error:",
                error
            );

            return res.status(500).json({

                success: false,

                message:
                    "Password reset failed"

            });
        }
    }
);

// =========================================
// EXPORT
// =========================================

module.exports = router;
