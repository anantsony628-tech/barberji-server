const express = require("express");
const admin = require("firebase-admin");
const { getDatabase } = require("firebase-admin/database");
const bcrypt = require("bcryptjs");

// =========================================================
// PARTNER AUTH ROUTER
// =========================================================

const router = express.Router();


// =========================================================
// FIREBASE ADMIN
//
// server.js already Firebase initialize kar chuka hai.
// Partner Auth existing Firebase Admin instance reuse karega.
// Dobara initialize nahi karega.
// =========================================================

const db =
    getDatabase();

const { getAuth } =
    require("firebase-admin/auth");

const auth =
    getAuth();

// =========================================================
// HELPER
// =========================================================

function clean(value) {

    return value == null
        ? ""
        : String(value).trim();
}

// =========================================================
// PARTNER REGISTRATION AUTH
//
// IMPORTANT:
// - Customer Firebase Auth ko touch nahi karta
// - Partner password Firebase me nahi jata
// - Password bcrypt hash ke form me save hota hai
// - Partner ko alag Firebase UID milta hai
// =========================================================

router.post(
    "/register-auth",
    async (req, res) => {

        try {

            const partnerId =
                clean(req.body.partnerId);

            const salonId =
                clean(req.body.salonId);

            const mobile =
                clean(req.body.mobile);

            const email =
                clean(req.body.email)
                    .toLowerCase();

            const password =
                clean(req.body.password);

            // =============================================
            // BASIC VALIDATION
            // =============================================

            if (!partnerId) {

                return res.status(400).json({
                    success: false,
                    message: "Partner ID required"
                });
            }

            if (!salonId) {

                return res.status(400).json({
                    success: false,
                    message: "Salon ID required"
                });
            }

            if (!mobile) {

                return res.status(400).json({
                    success: false,
                    message: "Mobile number required"
                });
            }

            if (!email) {

                return res.status(400).json({
                    success: false,
                    message: "Email required"
                });
            }

            if (!password || password.length < 6) {

                return res.status(400).json({
                    success: false,
                    message:
                        "Partner password minimum 6 characters ka hona chahiye"
                });
            }

            // =============================================
            // CHECK PARTNER ID
            // =============================================

            const partnerIdSnapshot =
                await db
                    .ref("PartnerAuth")
                    .orderByChild("partnerId")
                    .equalTo(partnerId)
                    .once("value");

            if (partnerIdSnapshot.exists()) {

                return res.status(409).json({
                    success: false,
                    message:
                        "Partner ID already registered"
                });
            }

            // =============================================
            // CHECK SALON ID
            // =============================================

            const salonIdSnapshot =
                await db
                    .ref("PartnerAuth")
                    .orderByChild("salonId")
                    .equalTo(salonId)
                    .once("value");

            if (salonIdSnapshot.exists()) {

                return res.status(409).json({
                    success: false,
                    message:
                        "Salon ID already registered"
                });
            }

            // =============================================
            // CHECK MOBILE
            // =============================================

            const mobileSnapshot =
                await db
                    .ref("PartnerAuth")
                    .orderByChild("mobile")
                    .equalTo(mobile)
                    .once("value");

            if (mobileSnapshot.exists()) {

                return res.status(409).json({
                    success: false,
                    message:
                        "Ye mobile Partner account me already registered hai"
                });
            }

            // =============================================
            // CHECK EMAIL
            // =============================================

            const emailSnapshot =
                await db
                    .ref("PartnerAuth")
                    .orderByChild("email")
                    .equalTo(email)
                    .once("value");

            if (emailSnapshot.exists()) {

                return res.status(409).json({
                    success: false,
                    message:
                        "Ye email Partner account me already registered hai"
                });
            }

            // =============================================
            // CREATE SEPARATE FIREBASE UID
            //
            // IMPORTANT:
            // Yahan email/password provider create nahi
            // kiya ja raha.
            //
            // Customer Firebase account se koi relation nahi.
            // =============================================

            const firebaseUser =
                await auth.createUser({});

            const authUid =
                firebaseUser.uid;

            // =============================================
            // HASH PARTNER PASSWORD
            // =============================================

            const passwordHash =
                await bcrypt.hash(
                    password,
                    12
                );

            // =============================================
            // PARTNER AUTH RECORD
            //
            // PASSWORD KABHI PLAIN TEXT ME SAVE NAHI HOGA
            // =============================================

            const partnerAuthData = {

                partnerId:
                    partnerId,

                salonId:
                    salonId,

                authUid:
                    authUid,

                mobile:
                    mobile,

                email:
                    email,

                passwordHash:
                    passwordHash,

                approvalStatus:
                    "PENDING",

                status:
                    "ACTIVE",

                createdAt:
                    Date.now(),

                updatedAt:
                    Date.now()
            };

            // =============================================
            // SAVE PARTNER AUTH
            // =============================================

            await db
                .ref("PartnerAuth")
                .child(authUid)
                .set(partnerAuthData);

            // =============================================
            // RESPONSE
            // =============================================

            return res.status(201).json({

                success:
                    true,

                message:
                    "Partner authentication account created",

                authUid:
                    authUid,

                partnerId:
                    partnerId,

                salonId:
                    salonId
            });

        } catch (error) {

            console.error(
                "PARTNER REGISTER AUTH ERROR:",
                error
            );

            return res.status(500).json({

                success:
                    false,

                message:
                    "Partner authentication account create nahi ho saka"
            });
        }
    }
);

// =========================================================
// PARTNER LOGIN
//
// Login:
// mobile/password
// OR
// email/password
//
// Customer Firebase password ko touch nahi karta.
// =========================================================

router.post(
    "/login",
    async (req, res) => {

        try {

            const identifier =
                clean(req.body.identifier);

            const password =
                clean(req.body.password);

            if (!identifier) {

                return res.status(400).json({
                    success: false,
                    message:
                        "Mobile ya email required"
                });
            }

            if (!password) {

                return res.status(400).json({
                    success: false,
                    message:
                        "Partner password required"
                });
            }

            // =============================================
            // FIND PARTNER ACCOUNT
            // =============================================

            let snapshot;

            if (
                identifier.includes("@")
            ) {

                snapshot =
                    await db
                        .ref("PartnerAuth")
                        .orderByChild("email")
                        .equalTo(
                            identifier.toLowerCase()
                        )
                        .once("value");

            } else {

                snapshot =
                    await db
                        .ref("PartnerAuth")
                        .orderByChild("mobile")
                        .equalTo(identifier)
                        .once("value");
            }

            if (!snapshot.exists()) {

                return res.status(401).json({
                    success: false,
                    message:
                        "Partner account nahi mila"
                });
            }

            let partnerData = null;
            let partnerAuthUid = null;

            snapshot.forEach(
                child => {

                    if (!partnerData) {

                        partnerData =
                            child.val();

                        partnerAuthUid =
                            child.key;
                    }
                }
            );

            if (
                !partnerData ||
                !partnerAuthUid
            ) {

                return res.status(401).json({
                    success: false,
                    message:
                        "Partner account invalid hai"
                });
            }

            // =============================================
            // ACCOUNT STATUS
            // =============================================

            if (
                partnerData.status &&
                partnerData.status !== "ACTIVE"
            ) {

                return res.status(403).json({
                    success: false,
                    message:
                        "Partner account disabled hai"
                });
            }

            // =============================================
            // PASSWORD VERIFY
            // =============================================

            const passwordMatched =
                await bcrypt.compare(
                    password,
                    partnerData.passwordHash
                );

            if (!passwordMatched) {

                return res.status(401).json({
                    success: false,
                    message:
                        "Partner password galat hai"
                });
            }

            // =============================================
            // CHECK APPROVED SALON
            // =============================================

            const salonId =
                clean(
                    partnerData.salonId
                );

            if (!salonId) {

                return res.status(403).json({
                    success: false,
                    message:
                        "Salon ID nahi mila"
                });
            }

            const salonSnapshot =
                await db
                    .ref("ApprovedSalons")
                    .child(salonId)
                    .once("value");

            if (!salonSnapshot.exists()) {

                return res.status(403).json({
                    success: false,
                    message:
                        "Salon abhi approved nahi hai"
                });
            }

            const approvedSalon =
                salonSnapshot.val() || {};

            const approvalStatus =
                clean(
                    approvedSalon.approvalStatus
                ).toUpperCase();

            if (
                approvalStatus &&
                approvalStatus !== "APPROVED"
            ) {

                return res.status(403).json({
                    success: false,
                    message:
                        "Salon abhi approved nahi hai"
                });
            }

            // =============================================
            // CREATE FIREBASE CUSTOM TOKEN
            //
            // Existing Partner Dashboard ko Firebase
            // authenticated user mil jayega.
            // =============================================

            const customToken =
                await auth.createCustomToken(
                    partnerAuthUid,
                    {
                        role:
                            "partner",

                        partnerId:
                            partnerData.partnerId,

                        salonId:
                            partnerData.salonId
                    }
                );

            // =============================================
            // LOGIN SUCCESS
            // =============================================

            return res.status(200).json({

                success:
                    true,

                message:
                    "Partner login successful",

                customToken:
                    customToken,

                authUid:
                    partnerAuthUid,

                partnerId:
                    partnerData.partnerId,

                salonId:
                    partnerData.salonId,

                mobile:
                    partnerData.mobile,

                email:
                    partnerData.email,

                salonName:
                    approvedSalon.salonName ||
                    approvedSalon.name ||
                    "",

                ownerName:
                    approvedSalon.ownerName ||
                    approvedSalon.owner_name ||
                    ""
            });

        } catch (error) {

            console.error(
                "PARTNER LOGIN ERROR:",
                error
            );

            return res.status(500).json({

                success:
                    false,

                message:
                    "Partner login failed"
            });
        }
    }
);
// =========================================================
// PARTNER GOOGLE LOGIN
//
// IMPORTANT:
// - Google credential directly Firebase Auth me login nahi karega
// - Google ID Token Render server par verify hoga
// - PartnerAuth ke email se Partner account identify hoga
// - Approved salon verify hone ke baad Firebase Custom Token milega
// - Customer Auth ko touch nahi karta
// =========================================================

router.post(
    "/google-login",
    async (req, res) => {

        try {

            const idToken =
                clean(req.body.idToken);

            // =============================================
            // BASIC VALIDATION
            // =============================================

            if (!idToken) {

                return res.status(400).json({
                    success: false,
                    message:
                        "Google ID Token required"
                });
            }

            // =============================================
            // VERIFY GOOGLE ID TOKEN
            //
            // Firebase Admin Google ID token verify karega.
            // Isse Google account ki identity verify hogi.
            // =============================================

            const decodedToken =
                await auth.verifyIdToken(
                    idToken
                );

            const googleEmail =
                clean(
                    decodedToken.email
                ).toLowerCase();

            const emailVerified =
                decodedToken.email_verified === true;

            if (!googleEmail) {

                return res.status(401).json({
                    success: false,
                    message:
                        "Google email nahi mila"
                });
            }

            if (!emailVerified) {

                return res.status(403).json({
                    success: false,
                    message:
                        "Google email verified nahi hai"
                });
            }

            // =============================================
            // FIND PARTNER ACCOUNT BY EMAIL
            // =============================================

            const partnerSnapshot =
                await db
                    .ref("PartnerAuth")
                    .orderByChild("email")
                    .equalTo(googleEmail)
                    .once("value");

            if (!partnerSnapshot.exists()) {

                return res.status(401).json({
                    success: false,
                    message:
                        "This Google email is not registered as a Partner"
                });
            }

            let partnerData = null;
            let partnerAuthUid = null;

            partnerSnapshot.forEach(
                child => {

                    if (!partnerData) {

                        partnerData =
                            child.val();

                        partnerAuthUid =
                            child.key;
                    }
                }
            );

            if (
                !partnerData ||
                !partnerAuthUid
            ) {

                return res.status(401).json({
                    success: false,
                    message:
                        "Partner account invalid hai"
                });
            }

            // =============================================
            // ACCOUNT STATUS
            // =============================================

            if (
                partnerData.status &&
                partnerData.status !== "ACTIVE"
            ) {

                return res.status(403).json({
                    success: false,
                    message:
                        "Partner account disabled hai"
                });
            }

            // =============================================
            // SALON ID
            // =============================================

            const salonId =
                clean(
                    partnerData.salonId
                );

            if (!salonId) {

                return res.status(403).json({
                    success: false,
                    message:
                        "Salon ID nahi mila"
                });
            }

            // =============================================
            // CHECK APPROVED SALON
            // =============================================

            const salonSnapshot =
                await db
                    .ref("ApprovedSalons")
                    .child(salonId)
                    .once("value");

            if (!salonSnapshot.exists()) {

                return res.status(403).json({
                    success: false,
                    message:
                        "Salon abhi approved nahi hai"
                });
            }

            const approvedSalon =
                salonSnapshot.val() || {};

            const approvalStatus =
                clean(
                    approvedSalon.approvalStatus
                ).toUpperCase();

            if (
                approvalStatus &&
                approvalStatus !== "APPROVED"
            ) {

                return res.status(403).json({
                    success: false,
                    message:
                        "Salon abhi approved nahi hai"
                });
            }

            // =============================================
            // CREATE PARTNER FIREBASE CUSTOM TOKEN
            // =============================================

            const customToken =
                await auth.createCustomToken(
                    partnerAuthUid,
                    {
                        role:
                            "partner",

                        partnerId:
                            partnerData.partnerId,

                        salonId:
                            partnerData.salonId
                    }
                );

            // =============================================
            // SUCCESS
            // =============================================

            return res.status(200).json({

                success:
                    true,

                message:
                    "Partner Google login successful",

                customToken:
                    customToken,

                authUid:
                    partnerAuthUid,

                partnerId:
                    partnerData.partnerId,

                salonId:
                    partnerData.salonId,

                mobile:
                    partnerData.mobile,

                email:
                    partnerData.email,

                salonName:
                    approvedSalon.salonName ||
                    approvedSalon.name ||
                    "",

                ownerName:
                    approvedSalon.ownerName ||
                    approvedSalon.owner_name ||
                    ""
            });

        } catch (error) {

            console.error(
                "PARTNER GOOGLE LOGIN ERROR:",
                error
            );

            return res.status(401).json({

                success:
                    false,

                message:
                    "Google Partner authentication failed"
            });
        }
    }
);
// =========================================================
// EXPORT ROUTER
// =========================================================

module.exports = router;
