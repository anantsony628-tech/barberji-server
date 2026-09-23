const { getAuth } =
    require("firebase-admin/auth");


// =========================================================
// BARBER JI - PAYMENT AUTHENTICATION
// =========================================================
// Responsibility:
// - Read Firebase ID Token from Authorization header
// - Verify token with Firebase Admin
// - Attach verified user information to req.user
//
// This file does NOT:
// - create Razorpay orders
// - calculate commission
// - process refunds
// - process payouts
// =========================================================


async function verifyFirebaseUser(req, res, next) {

    try {

        // -------------------------------------------------
        // READ AUTHORIZATION HEADER
        // -------------------------------------------------

        const authorization =
            req.headers.authorization;


        if (
            !authorization ||
            !authorization.startsWith("Bearer ")
        ) {

            return res.status(401).json({

                success: false,

                message:
                    "Authentication required"

            });
        }


        // -------------------------------------------------
        // EXTRACT TOKEN
        // -------------------------------------------------

        const idToken =
            authorization
                .substring(7)
                .trim();


        if (!idToken) {

            return res.status(401).json({

                success: false,

                message:
                    "Invalid authentication token"

            });
        }


        // -------------------------------------------------
        // VERIFY FIREBASE ID TOKEN
        // -------------------------------------------------

        const decodedToken =
    await getAuth()
        .verifyIdToken(idToken);


        // -------------------------------------------------
        // STORE VERIFIED USER
        // -------------------------------------------------

        req.user = decodedToken;


        // -------------------------------------------------
        // CONTINUE
        // -------------------------------------------------

        next();

    } catch (error) {

    console.error(
        "Payment authentication error:",
        error
    );

    return res.status(401).json({

        success: false,

        message:
            error.code ||
            error.message ||
            "Firebase authentication failed"

    });
}
}


// =========================================================
// EXPORT
// =========================================================

module.exports = {

    verifyFirebaseUser

};
