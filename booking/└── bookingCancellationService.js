const admin = require("firebase-admin");
const { getDatabase } = require("firebase-admin/database");

const db = getDatabase();

/**
 * Customer booking cancellation
 *
 * Responsibilities:
 * 1. Booking existence check
 * 2. Authenticated customer ownership check
 * 3. Cancellation status validation
 * 4. Booking status update
 * 5. waitingCustomers safe decrement
 *
 * Notification is intentionally NOT handled here.
 * Existing notification flow can remain separate.
 */
async function cancelCustomerBooking({
    bookingId,
    authUid
}) {

    // -------------------------------------------------
    // BASIC VALIDATION
    // -------------------------------------------------

    if (!bookingId) {
        throw new Error("Booking ID is required");
    }

    if (!authUid) {
        throw new Error("Authenticated user is required");
    }

    // -------------------------------------------------
    // LOAD BOOKING
    // -------------------------------------------------

    const bookingRef =
        db.ref("Bookings").child(bookingId);

    const bookingSnapshot =
        await bookingRef.once("value");

    if (!bookingSnapshot.exists()) {
        throw new Error("Booking not found");
    }

    const booking =
        bookingSnapshot.val();

    // -------------------------------------------------
    // VERIFY BOOKING OWNER
    // -------------------------------------------------

    const bookingAuthUid =
        booking.authUid ||
        booking.customerAuthUid ||
        "";

    if (
        !bookingAuthUid ||
        bookingAuthUid !== authUid
    ) {
        throw new Error(
            "You are not authorized to cancel this booking"
        );
    }

    // -------------------------------------------------
    // CURRENT STATUS
    // -------------------------------------------------

    const currentStatus =
        String(
            booking.status || ""
        ).trim().toUpperCase();

    // -------------------------------------------------
    // ALREADY CANCELLED
    // -------------------------------------------------

    if (currentStatus === "CANCELLED") {
        throw new Error(
            "Booking is already cancelled"
        );
    }

    // -------------------------------------------------
    // STATUSES THAT CANNOT BE CANCELLED
    // -------------------------------------------------

    const nonCancellableStatuses = [
        "SERVICE_STARTED",
        "SERVICE_COMPLETED",
        "FINAL_COMPLETED",
        "COMPLETED"
    ];

    if (
        nonCancellableStatuses.includes(
            currentStatus
        )
    ) {
        throw new Error(
            "Booking cannot be cancelled at this stage"
        );
    }

    // -------------------------------------------------
    // REJECTED BOOKING
    // -------------------------------------------------

    if (currentStatus === "REJECTED") {
        throw new Error(
            "Rejected booking cannot be cancelled"
        );
    }

    // -------------------------------------------------
    // SALON ID MUST COME FROM BOOKING
    // NEVER TRUST CLIENT SALON ID
    // -------------------------------------------------

    const salonId =
        String(
            booking.salonId || ""
        ).trim();

    if (!salonId) {
        throw new Error(
            "Salon information missing from booking"
        );
    }

    // -------------------------------------------------
    // CANCELLATION TIME
    // -------------------------------------------------

    const cancellationTime =
        new Date().toISOString();

    // -------------------------------------------------
    // UPDATE BOOKING
    // -------------------------------------------------

    const bookingUpdates = {

        status:
            "CANCELLED",

        cancellationTime:
            cancellationTime,

        cancellationReason:
            "Customer cancelled booking",

        cancelledBy:
            "CUSTOMER"

    };

    await bookingRef.update(
        bookingUpdates
    );

    // -------------------------------------------------
    // SAFELY DECREMENT WAITING CUSTOMERS
    // -------------------------------------------------

    const waitingRef =
        db.ref("ApprovedSalons")
            .child(salonId)
            .child("waitingCustomers");

    await waitingRef.transaction(
        currentValue => {

            let waitingCount =
                Number(currentValue);

            // Handle null / invalid Firebase value
            if (
                !Number.isFinite(
                    waitingCount
                ) ||
                waitingCount < 0
            ) {
                waitingCount = 0;
            }

            // Never allow negative count
            return Math.max(
                0,
                waitingCount - 1
            );
        }
    );

    // -------------------------------------------------
    // SUCCESS
    // -------------------------------------------------

    return {

        success:
            true,

        bookingId:
            bookingId,

        salonId:
            salonId,

        status:
            "CANCELLED",

        cancellationTime:
            cancellationTime

    };
}


// -----------------------------------------------------
// EXPORT
// -----------------------------------------------------

module.exports = {
    cancelCustomerBooking
};
