const { getAuth } =
    require("firebase-admin/auth");

const { getDatabase } =
    require("firebase-admin/database");


// =========================================================
// BARBER JI - ADVERTISEMENT PAYMENT AUTHENTICATION
// =========================================================
// Responsibility:
// - Read Firebase ID Token from Authorization header
// - Verify token with Firebase Admin
// - Verify partnerId + salonId ownership
// - Attach verified user information to req.user
//
// This file does NOT:
// - create Razorpay orders
// - process payments
// - calculate advertisement price
// - process refunds
// =========================================================


async function verifyAdvertisementUser(
    req,
    res,
    next
) {

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
        // EXTRACT FIREBASE ID TOKEN
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
        // READ REQUEST IDs
        // -------------------------------------------------

        const partnerId =
            String(
                req.body?.partnerId || ""
            ).trim();


        const salonId =
            String(
                req.body?.salonId || ""
            ).trim();


        if (!partnerId) {

            return res.status(400).json({

                success: false,

                message:
                    "Partner ID is required"

            });
        }


        if (!salonId) {

            return res.status(400).json({

                success: false,

                message:
                    "Salon ID is required"

            });
        }


        // -------------------------------------------------
        // READ APPROVED SALON
        // -------------------------------------------------

        const db =
            getDatabase();


        const salonSnapshot =
            await db
                .ref(
                    "ApprovedSalons/" +
                    salonId
                )
                .once("value");


        if (!salonSnapshot.exists()) {

            return res.status(403).json({

                success: false,

                message:
                    "Approved salon not found"

            });
        }


        const salon =
            salonSnapshot.val();


        // -------------------------------------------------
        // VERIFY PARTNER + AUTH UID
        // -------------------------------------------------

        const salonPartnerId =
            String(
                salon.partnerId || ""
            ).trim();


        const salonAuthUid =
            String(
                salon.authUid || ""
            ).trim();


        if (
            salonPartnerId !==
            partnerId
        ) {

            return res.status(403).json({

                success: false,

                message:
                    "Partner and salon mismatch"

            });
        }


        if (
            salonAuthUid !==
            String(decodedToken.uid)
        ) {

            return res.status(403).json({

                success: false,

                message:
                    "User is not authorized for this salon"

            });
        }


        // -------------------------------------------------
        // ATTACH VERIFIED USER
        // -------------------------------------------------

        req.user = {

            uid:
                decodedToken.uid,

            email:
                decodedToken.email || "",

            partnerId:
                partnerId,

            salonId:
                salonId

        };


        // -------------------------------------------------
        // CONTINUE
        // -------------------------------------------------

        return next();

    } catch (error) {

        console.error(
            "Advertisement authentication error:",
            error
        );


        return res.status(401).json({

            success: false,

            message:
                error.code ||
                error.message ||
                "Advertisement authentication failed"

        });
    }
}


// =========================================================
// EXPORT
// =========================================================

module.exports = {

    verifyAdvertisementUser

};
