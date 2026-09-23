const {
    cancelCustomerBooking
} = require("./bookingCancellationService");

/**
 * Customer booking cancellation controller
 *
 * Authentication is handled by the route middleware.
 * The authenticated Firebase UID is available as req.user.uid.
 */
async function cancelBooking(req, res) {

    try {

        // -------------------------------------------------
        // AUTH CHECK
        // -------------------------------------------------

        if (
            !req.user ||
            !req.user.uid
        ) {

            return res.status(401).json({

                success: false,

                message:
                    "Authentication required"

            });
        }

        // -------------------------------------------------
        // BOOKING ID
        // -------------------------------------------------

        const bookingId =
            String(
                req.body?.bookingId || ""
            ).trim();

        if (!bookingId) {

            return res.status(400).json({

                success: false,

                message:
                    "Booking ID is required"

            });
        }

        // -------------------------------------------------
        // CANCEL BOOKING
        // -------------------------------------------------

        const result =
            await cancelCustomerBooking({

                bookingId:
                    bookingId,

                authUid:
                    req.user.uid

            });

        // -------------------------------------------------
        // SUCCESS
        // -------------------------------------------------

        return res.status(200).json({

            success:
                true,

            message:
                "Booking cancelled successfully",

            bookingId:
                result.bookingId,

            salonId:
                result.salonId,

            status:
                result.status,

            cancellationTime:
                result.cancellationTime

        });

    } catch (error) {

        console.error(
            "Customer booking cancellation error:",
            error
        );

        // -------------------------------------------------
        // KNOWN CLIENT / VALIDATION ERRORS
        // -------------------------------------------------

        const message =
            error?.message ||
            "Unable to cancel booking";

        const knownErrors = [

            "Booking ID is required",

            "Authenticated user is required",

            "Booking not found",

            "You are not authorized to cancel this booking",

            "Booking is already cancelled",

            "Booking cannot be cancelled at this stage",

            "Rejected booking cannot be cancelled",

            "Salon information missing from booking"

        ];

        if (
            knownErrors.includes(message)
        ) {

            return res.status(400).json({

                success:
                    false,

                message:
                    message

            });
        }

        // -------------------------------------------------
        // SERVER ERROR
        // -------------------------------------------------

        return res.status(500).json({

            success:
                false,

            message:
                "Server error while cancelling booking"

        });
    }
}


// -----------------------------------------------------
// EXPORT
// -----------------------------------------------------

module.exports = {
    cancelBooking
};
