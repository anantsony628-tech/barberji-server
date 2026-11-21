const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { getDatabase } = require("firebase-admin/database");
const db = getDatabase();

// ===== REGISTER =====
exports.register = async (req, res) => {
  try {
    const { 
      aadhaarNumber, name, mobile, whatsappNumber, email, pin, 
      bankAccountNumber, ifscCode, accountHolderName, 
      profilePhotoUrl, skills, address,
      aadhaarFrontUrl, aadhaarBackUrl, panNumber, panPhotoUrl
    } = req.body;

    if(!aadhaarNumber || aadhaarNumber.length != 12) return res.status(400).json({ msg: "12 digit Aadhaar chahiye" });
    if(!aadhaarFrontUrl || !aadhaarBackUrl) return res.status(400).json({ msg: "Aadhaar Front + Back Photo Compulsory hai" });
    if(!profilePhotoUrl) return res.status(400).json({ msg: "Profile Photo Compulsory hai" });
    if(!mobile) return res.status(400).json({ msg: "Mobile number chahiye" });
    if(!pin) return res.status(400).json({ msg: "PIN chahiye" });

    const snap = await db.ref("StaffPool").orderByChild("aadhaarNumber").equalTo(aadhaarNumber).once("value");
    if(snap.exists()) return res.status(400).json({ msg: "Is Aadhaar se Staff pehle se hai" });

    const hash = await bcrypt.hash(pin.toString(), 10);
    const permanentId = "STAFF_" + Date.now();

    const data = {
      permanentId,
      staffId: "",
      aadhaarNumber, 
      name, 
      mobile: mobile.toString().trim(), 
      whatsappNumber: whatsappNumber || mobile,
      email: email || "",
      bankAccountNumber, 
      ifscCode, 
      accountHolderName,
      staffPinHash: hash,
      profilePhotoUrl, 
      skills: skills || "", 
      address: address || "",
      aadhaarFrontUrl: aadhaarFrontUrl || "",
      aadhaarBackUrl: aadhaarBackUrl || "",
      panNumber: panNumber || "",
      panPhotoUrl: panPhotoUrl || "",
            status: "PENDING",
      correctionNote: "",
      createdAt: Date.now(),
      gender: req.body.gender || "",
      age: req.body.age || "",
      isAvailable: true,
      isOnline: false,
      lat: 0,
      lng: 0
    };

    await db.ref("StaffPool").child(permanentId).set(data);
    res.json({ msg: "Applied Success", permanentId, status: "PENDING" });

  } catch(err){ 
    console.error(err);
    res.status(500).json({ msg: err.message }); 
  }
};

// ===== LOGIN - FIXED FOR BOTH MOBILE + STAFF ID =====
exports.login = async (req, res) => {
  try {
    const { staffId, mobile, pin } = req.body;
    
    if(!pin) return res.status(400).json({ msg: "PIN dalo" });

    let queryField = "";
    let queryValue = "";

    if (staffId && staffId.toString().trim() !== "") {
      queryField = "staffId";
      queryValue = staffId.toString().trim().toUpperCase();
    } else if (mobile && mobile.toString().trim() !== "") {
      queryField = "mobile";
      queryValue = mobile.toString().trim();
    } else {
      return res.status(400).json({ msg: "Staff ID ya Mobile chahiye" });
    }

    console.log(`Login attempt: ${queryField} = ${queryValue}`);

    const snap = await db.ref("StaffPool").orderByChild(queryField).equalTo(queryValue).once("value");
    
    if(!snap.exists()) {
      return res.status(404).json({ msg: `${queryField} nahi mila: ${queryValue}` });
    }
    
    let staffData = null;
    snap.forEach(child => { staffData = child.val(); });

    if(staffData.status !== "APPROVED") {
      return res.status(403).json({ msg: "Admin ne abhi Approve nahi kiya. Status: " + staffData.status });
    }

    const match = await bcrypt.compare(pin.toString(), staffData.staffPinHash);
    if(!match) return res.status(401).json({ msg: "Galat PIN" });

    const token = jwt.sign({ staffId: staffData.staffId, mobile: staffData.mobile, permanentId: staffData.permanentId }, "BARBERJI_STAFF_SECRET_2026", { expiresIn: "7d" });
    
    res.json({ 
      success: true,
      token, 
      data: staffData,
      staff: staffData 
    });

  } catch(err){ 
    console.error("LOGIN ERROR:", err);
    res.status(500).json({ msg: err.message }); 
  }
};

// ===== STATUS CHECK (App ke liye) =====
exports.getStatus = async (req, res) => {
  try {
    const mobile = req.query.mobile || req.query.aadhaar;
    if(!mobile) return res.status(400).json({ status: "MOBILE_REQUIRED" });

    let snap = await db.ref("StaffPool").orderByChild("mobile").equalTo(mobile.toString().trim()).once("value");
    if(!snap.exists()){
      snap = await db.ref("StaffPool").orderByChild("aadhaarNumber").equalTo(mobile.toString().trim()).once("value");
    }
    if(!snap.exists()) return res.json({ status: "NOT_FOUND" });

    let staffData = null;
    snap.forEach(c => { staffData = c.val(); });

    res.json({ 
      status: staffData.status,
      correctionNote: staffData.correctionNote || "",
      staffId: staffData.staffId || "",
      name: staffData.name || ""
    });

  } catch(err){ res.status(500).json({ status: "ERROR", msg: err.message }); }
};

// ===== ADMIN: PENDING LIST =====
exports.getPendingList = async (req, res) => {
  try {
    const snap = await db.ref("StaffPool").orderByChild("status").equalTo("PENDING").once("value");
    const list = [];
    snap.forEach(child => { list.push(child.val()); });
    list.sort((a,b) => b.createdAt - a.createdAt);
    res.json(list);
  } catch(err){ res.status(500).json({ msg: err.message }); }
};

// ===== ADMIN: APPROVE + STAFF ID GENERATE =====
exports.approveStaff = async (req, res) => {
  try {
    const { permanentId } = req.body;
    if(!permanentId) return res.status(400).json({ msg: "permanentId chahiye" });

    const counterRef = db.ref("Counters/StaffCounter");
    const counterSnap = await counterRef.once("value");
    let count = counterSnap.val() || 1000;
    count = count + 1;
    await counterRef.set(count);

    const newStaffId = "BARBER_" + count; // BARBER_1001

    await db.ref("StaffPool").child(permanentId).update({
      status: "APPROVED",
      staffId: newStaffId,
      approvedAt: Date.now()
    });

    res.json({ success: true, staffId: newStaffId, msg: "Approved" });

  } catch(err){ res.status(500).json({ msg: err.message }); }
};

// ===== ADMIN: REJECT / CORRECTION =====
exports.actionStaff = async (req, res) => {
  try {
    const { permanentId, action, note } = req.body;
    if(!permanentId || !action) return res.status(400).json({ msg: "Data missing" });

    await db.ref("StaffPool").child(permanentId).update({
      status: action,
      correctionNote: note || ""
    });

    res.json({ success: true, msg: action + " done" });

  } catch(err){ res.status(500).json({ msg: err.message }); }
};

// ===== ONLINE / LOCATION UPDATE - 404 FIX =====
exports.updateLocation = async (req, res) => {
  try {
    const { staffId, mobile, lat, lng, isOnline, gender, age } = req.body;
    console.log("updateLocation:", staffId, mobile, lat, lng, isOnline);

    if (!staffId && !mobile) {
      return res.status(400).json({ success: false, msg: "staffId ya mobile chahiye" });
    }

    let key = null;
    let staffData = null;

    // 1. staffId se dhoondho
    if (staffId) {
      const snap = await db.ref("StaffPool").orderByChild("staffId").equalTo(staffId.toString().trim().toUpperCase()).once("value");
      if (snap.exists()) {
        snap.forEach(child => { key = child.key; staffData = child.val(); });
      }
    }
    // 2. Nahi mila toh mobile se dhoondho
    if (!key && mobile) {
      const snap = await db.ref("StaffPool").orderByChild("mobile").equalTo(mobile.toString().trim()).once("value");
      if (snap.exists()) {
        snap.forEach(child => { key = child.key; staffData = child.val(); });
      }
    }

    if (!key) {
      return res.status(404).json({ success: false, msg: "Staff not found" });
    }

        await db.ref("StaffPool").child(key).update({
      lat: lat || 0,
      lng: lng || 0,
      latitude: lat || 0,
      longitude: lng || 0,
      isOnline: isOnline === true || isOnline === "true",
      isAvailable: req.body.isAvailable !== false,
      lastUpdated: Date.now(),
      ...(gender ? { gender } : {}),
      ...(age ? { age } : {})
    });

    return res.json({ success: true, message: "Location updated" });
  } catch (err) {
    console.log("updateLocation error:", err.message);
    return res.status(500).json({ success: false, msg: err.message });
  }
};
// ===== ADMIN: APPROVED + ONLINE LIST - Home Booking Assign ke liye =====
exports.getApprovedList = async (req, res) => {
  try {
    const snap = await db.ref("StaffPool").orderByChild("status").equalTo("APPROVED").once("value");
    const list = [];
    snap.forEach(child => {
      const s = child.val();
      // Sirf zaroori data bhejo - Aadhaar / Bank mat bhejo
      list.push({
        permanentId: s.permanentId || child.key,
        staffId: s.staffId || "",
        name: s.name || "",
        mobile: s.mobile || "",
        profilePhotoUrl: s.profilePhotoUrl || "",
        skills: s.skills || "",
        isOnline: s.isOnline || false,
        lat: s.lat || 0,
        lng: s.lng || 0,
        lastUpdated: s.lastUpdated || 0
      });
    });
    // Online wale upar
    list.sort((a,b) => (b.isOnline === true) - (a.isOnline === true));
    res.json(list);
  } catch(err){ res.status(500).json({ msg: err.message }); }
};
// ===== HOME BOOKING AUTO-ASSIGN - SERVER =====
function getDistanceKm(lat1, lon1, lat2, lon2) {
  if (!lat2 || lat2 === 0) return 999999;
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  return R * 2 * Math.asin(Math.sqrt(a));
}

async function assignToNearestStaff(bookingId) {
  const bookSnap = await db.ref(`HomeServiceBookings/${bookingId}`).once("value");
  const book = bookSnap.val();
  if (!book) return;
  const cur = book.status || "";
  if (cur === "ACCEPTED" || cur === "ON_THE_WAY" || cur === "COMPLETED" || cur === "CANCELLED") return;
  const custLat = book.custLat || book.lat || 0;
  const custLng = book.custLng || book.lng || 0;
  const gender = book.gender || book.customerGender || "ANY";
  const rejectedBy = book.rejectedBy || {};
  const staffSnap = await db.ref("StaffPool").once("value");
  let candidates = [];
  staffSnap.forEach((st) => {
    const s = st.val() || {};
    const key = st.key;
    if (s.status !== "APPROVED") return;
    if (rejectedBy[key]) return;
    if (s.staffId && rejectedBy[s.staffId]) return;
    const sg = (s.gender || "").toUpperCase();
    if (gender === "FEMALE" && sg === "MALE") return;
    if (gender === "MALE" && sg === "FEMALE") return;
    if (s.isAvailable === false) return;
    if (s.isOnline === false) return;
    if (s.isAvailable === undefined && s.isOnline === undefined) return;
    candidates.push({ key, data: s, dist: getDistanceKm(custLat, custLng, s.lat || 0, s.lng || 0) });
  });
  candidates.sort((a,b) => a.dist - b.dist);
  if (candidates.length === 0) {
    await db.ref(`HomeServiceBookings/${bookingId}/status`).set("SEARCHING");
    return;
  }
  const first = candidates[0];
  const staffId = first.data.staffId || first.key;
  await db.ref(`HomeServiceBookings/${bookingId}`).update({
    assignedStaffId: staffId,
    assignedStaffName: first.data.name || "",
    assignedStaffMobile: first.data.mobile || "",
    assignedStaffPhotoUrl: first.data.profilePhotoUrl || "",
    assignedAt: Date.now(),
    status: "ASSIGNED"
  });
  await db.ref(`HomeServiceBookings/${bookingId}/offeredTo/${staffId}`).set(true);
}

exports.onNewHomeBooking = async (req, res) => {
  try {
    const { bookingId } = req.body;
    if (!bookingId) return res.status(400).json({ msg: "bookingId chahiye" });
    await assignToNearestStaff(bookingId);
    res.json({ success: true, msg: "Assigned" });
  } catch(e){ res.status(500).json({ msg: e.message }); }
};

exports.onStaffRejectBooking = async (req, res) => {
  try {
    const { bookingId, staffId } = req.body;
    if (staffId) await db.ref(`HomeServiceBookings/${bookingId}/rejectedBy/${staffId}`).set(true);
    await assignToNearestStaff(bookingId);
    res.json({ success: true });
  } catch(e){ res.status(500).json({ msg: e.message }); }
};
