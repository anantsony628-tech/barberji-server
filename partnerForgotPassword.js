const express = require("express");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const admin = require("firebase-admin");
const { getDatabase } = require("firebase-admin/database");

const router = express.Router();

const db = getDatabase();

const RESET_EXPIRY_MS =
    15 * 60 * 1000;


// =========================================
// CLEAN VALUE
// =========================================

function clean(value) {

    return value == null
        ? ""
        : String(value).trim();
}


// =========================================
// FIND PARTNER BY EMAIL
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

                key:
                    child.key,

                data:
                    child.val()

            };
        }
    });

    return result;
}


// =========================================
// SEND EMAIL THROUGH BREVO
// =========================================

async function sendBrevoResetEmail(
    email,
    resetLink
) {

    const apiKey =
        clean(
            process.env.BREVO_API_KEY
        );

    const senderEmail =
        clean(
            process.env.BREVO_SENDER_EMAIL
        );

    const senderName =
        clean(
            process.env.BREVO_SENDER_NAME
        ) ||
        "Barber Ji";

    if (!apiKey) {

        throw new Error(
            "BREVO_API_KEY environment variable missing"
        );
    }

    if (!senderEmail) {

        throw new Error(
            "BREVO_SENDER_EMAIL environment variable missing"
        );
    }


    const emailData = {

        sender: {

            name:
                senderName,

            email:
                senderEmail
        },

        to: [

            {
                email:
                    email
            }

        ],

        subject:
            "Barber Ji Partner Password Reset",

        htmlContent: `

<!DOCTYPE html>

<html>

<head>

<meta charset="UTF-8">

<title>Barber Ji Password Reset</title>

</head>

<body
style="
font-family: Arial, sans-serif;
background:#f5f5f5;
padding:30px;
">

<div
style="
max-width:600px;
margin:auto;
background:white;
padding:30px;
border-radius:10px;
">

<h2>
Barber Ji Partner
</h2>

<p>
Hello,
</p>

<p>
We received a request to reset your
Barber Ji Partner password.
</p>

<p>
Click the button below to create a
new password.
</p>

<p style="text-align:center;margin:30px 0;">

<a
href="${resetLink}"
style="
display:inline-block;
background:#111111;
color:white;
text-decoration:none;
padding:14px 24px;
border-radius:6px;
font-weight:bold;
">

Reset Partner Password

</a>

</p>

<p>
This link will expire in
<strong>15 minutes</strong>.
</p>

<p>
If you did not request this password reset,
you can safely ignore this email.
</p>

<p>
Regards,<br>
<strong>Barber Ji Team</strong>
</p>

</div>

</body>

</html>

`,

        textContent:
            "Barber Ji Partner Password Reset\n\n" +
            "Reset your password using this link:\n\n" +
            resetLink +
            "\n\n" +
            "This link will expire in 15 minutes.\n\n" +
            "If you did not request this password reset, ignore this email.\n\n" +
            "Barber Ji Team"

    };


    const response =
        await fetch(
            "https://api.brevo.com/v3/smtp/email",
            {

                method:
                    "POST",

                headers: {

                    "accept":
                        "application/json",

                    "api-key":
                        apiKey,

                    "content-type":
                        "application/json"

                },

                body:
                    JSON.stringify(
                        emailData
                    )
            }
        );


    const responseText =
        await response.text();


    if (!response.ok) {

        console.error(
            "Brevo email error:",
            response.status,
            responseText
        );

        throw new Error(
            "Brevo email send failed"
        );
    }


    let result = {};

    try {

        result =
            JSON.parse(
                responseText
            );

    } catch (e) {

        result = {};
    }


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
                clean(
                    req.body.email
                ).toLowerCase();


            if (!email) {

                return res.status(400).json({

                    success:
                        false,

                    message:
                        "Email required hai"

                });
            }


            const partner =
                await findPartnerByEmail(
                    email
                );


            // =================================
            // SECURITY:
            // SAME RESPONSE WHETHER EMAIL
            // EXISTS OR NOT
            // =================================

            if (!partner) {

                return res.json({

                    success:
                        true,

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

                    success:
                        true,

                    message:
                        "Agar email registered hai to reset link bheja jayega"

                });
            }


            // =================================
            // CREATE SECURE RANDOM TOKEN
            // =================================

            const rawToken =
                crypto
                    .randomBytes(32)
                    .toString("hex");


            const tokenHash =
                crypto
                    .createHash("sha256")
                    .update(rawToken)
                    .digest("hex");


            const expiresAt =
                Date.now() +
                RESET_EXPIRY_MS;


            // =================================
            // SAVE RESET RECORD
            // =================================

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


            // =================================
            // RESET URL
            // =================================

            const resetBaseUrl =
                clean(
                    process.env.PARTNER_RESET_URL
                );


            if (!resetBaseUrl) {

                console.error(
                    "PARTNER_RESET_URL environment variable missing"
                );

                return res.status(500).json({

                    success:
                        false,

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


            // =================================
            // SEND EMAIL
            // =================================

            await sendBrevoResetEmail(
                email,
                resetLink
            );


            // IMPORTANT:
            // RAW RESET LINK IS NEVER LOGGED


            return res.json({

                success:
                    true,

                message:
                    "Agar email registered hai to reset link bheja jayega"

            });


        } catch (error) {

            console.error(
                "Partner forgot password error:",
                error
            );


            return res.status(500).json({

                success:
                    false,

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
                clean(
                    req.body.token
                );


            const newPassword =
                clean(
                    req.body.newPassword
                );


            if (!token) {

                return res.status(400).json({

                    success:
                        false,

                    message:
                        "Reset token required hai"

                });
            }


            if (!newPassword) {

                return res.status(400).json({

                    success:
                        false,

                    message:
                        "New password required hai"

                });
            }


            if (
                newPassword.length < 6
            ) {

                return res.status(400).json({

                    success:
                        false,

                    message:
                        "Password minimum 6 characters ka hona chahiye"

                });
            }


            // =================================
            // HASH TOKEN
            // =================================

            const tokenHash =
                crypto
                    .createHash("sha256")
                    .update(token)
                    .digest("hex");


            const resetRef =
                db.ref(
                    "PartnerPasswordResets/" +
                    tokenHash
                );


            const resetSnapshot =
                await resetRef.once(
                    "value"
                );


            if (!resetSnapshot.exists()) {

                return res.status(400).json({

                    success:
                        false,

                    message:
                        "Invalid ya expired reset link"

                });
            }


            const resetData =
                resetSnapshot.val() || {};


            // =================================
            // ONE-TIME TOKEN
            // =================================

            if (
                resetData.used === true
            ) {

                return res.status(400).json({

                    success:
                        false,

                    message:
                        "Ye reset link already use ho chuka hai"

                });
            }


            // =================================
            // EXPIRY CHECK
            // =================================

            if (
                !resetData.expiresAt ||
                Date.now() >
                Number(
                    resetData.expiresAt
                )
            ) {

                await resetRef.remove();

                return res.status(400).json({

                    success:
                        false,

                    message:
                        "Reset link expire ho chuka hai"

                });
            }


            const authUid =
                clean(
                    resetData.authUid
                );


            if (!authUid) {

                return res.status(400).json({

                    success:
                        false,

                    message:
                        "Partner account invalid hai"

                });
            }


            // =================================
            // PARTNER ACCOUNT
            // =================================

            const partnerRef =
                db.ref(
                    "PartnerAuth/" +
                    authUid
                );


            const partnerSnapshot =
                await partnerRef.once(
                    "value"
                );


            if (
                !partnerSnapshot.exists()
            ) {

                return res.status(400).json({

                    success:
                        false,

                    message:
                        "Partner account nahi mila"

                });
            }


            // =================================
            // BCRYPT PASSWORD
            // =================================

            const passwordHash =
                await bcrypt.hash(
                    newPassword,
                    12
                );


            await partnerRef.update({

                passwordHash:
                    passwordHash,

                updatedAt:
                    Date.now()

            });


            // =================================
            // TOKEN USED
            // =================================

            await resetRef.update({

                used:
                    true,

                usedAt:
                    Date.now()

            });


            return res.json({

                success:
                    true,

                message:
                    "Partner password successfully reset ho gaya"

            });


        } catch (error) {

            console.error(
                "Partner reset password error:",
                error
            );


            return res.status(500).json({

                success:
                    false,

                message:
                    "Password reset failed"

            });
        }
    }
);


module.exports = router;
