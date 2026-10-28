const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { getDatabase } = require("firebase-admin/database");
const db = getDatabase();

// ===== REGISTER - Same tumhara wala =====
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

    const snap = await db.ref("StaffPool").orderByChild("aadhaarNumber").equalTo(aadhaarNumber).once("value");
    if(snap.exists()) return res.status(400).json({ msg: "Is Aadhaar se Staff pehle se hai" });

    const hash = await bcrypt.hash(pin, 10);
    const permanentId = "STAFF_" + Date.now();

    const data = {
      permanentId,
      staffId: "",
      aadhaarNumber, name, mobile, whatsappNumber, email,
      bankAccountNumber, ifscCode, accountHolderName,
      staffPinHash: hash,
      profilePhotoUrl, skills, address,
      aadhaarFrontUrl: aadhaarFrontUrl || "",
      aadhaarBackUrl: aadhaarBackUrl || "",
      panNumber: panNumber || "",
      panPhotoUrl: panPhotoUrl || "",
      status: "PENDING",
      correctionNote: "",
      createdAt: Date.now()
    };

    await db.ref("StaffPool").child(permanentId).set(data);
    res.json({ msg: "Applied Success", permanentId, status: "PENDING" });

  } catch(err){ res.status(500).json({ msg: err.message }); }
};

// ===== LOGIN - Same =====
exports.login = async (req, res) => {
  try {
    const { staffId, pin } = req.body;
    const snap = await db.ref("StaffPool").orderByChild("staffId").equalTo(staffId).once("value");
    if(!snap.exists()) return res.status(404).json({ msg: "Staff ID nahi mila" });
    
    let staffData = null;
    snap.forEach(child => { staffData = child.val(); });

    if(staffData.status !== "APPROVED") return res.status(403).json({ msg: "Admin ne abhi Approve nahi kiya. Status: " + staffData.status });

    const match = await bcrypt.compare(pin, staffData.staffPinHash);
    if(!match) return res.status(401).json({ msg: "Galat PIN" });

    const token = jwt.sign({ staffId: staffData.staffId }, "BARBERJI_STAFF_SECRET_2026", { expiresIn: "7d" });
    res.json({ token, staff: staffData });

  } catch(err){ res.status(500).json({ msg: err.message }); }
};

// ===== NEW 1 - PENDING STATUS CHECK (App ke liye) =====
exports.getStatus = async (req, res) => {
  try {
    const mobile = req.query.mobile || req.query.aadhaar;
    if(!mobile) return res.status(400).json({ status: "MOBILE_REQUIRED" });

    let snap = await db.ref("StaffPool").orderByChild("mobile").equalTo(mobile).once("value");
    if(!snap.exists()){
      snap = await db.ref("StaffPool").orderByChild("aadhaarNumber").equalTo(mobile).once("value");
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

// ===== NEW 2 - ADMIN: PENDING LIST =====
exports.getPendingList = async (req, res) => {
  try {
    const snap = await db.ref("StaffPool").orderByChild("status").equalTo("PENDING").once("value");
    const list = [];
    snap.forEach(child => { list.push(child.val()); });
    list.sort((a,b) => b.createdAt - a.createdAt);
    res.json(list);
  } catch(err){ res.status(500).json({ msg: err.message }); }
};

// ===== NEW 3 - ADMIN: APPROVE + STAFF ID GENERATE =====
exports.approveStaff = async (req, res) => {
  try {
    const { permanentId } = req.body;
    if(!permanentId) return res.status(400).json({ msg: "permanentId chahiye" });

    // Staff Count karke ID banao
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

// ===== NEW 4 - ADMIN: REJECT / CORRECTION =====
exports.actionStaff = async (req, res) => {
  try {
    const { permanentId, action, note } = req.body; // action = REJECTED or CORRECTION
    if(!permanentId || !action) return res.status(400).json({ msg: "Data missing" });

    await db.ref("StaffPool").child(permanentId).update({
      status: action,
      correctionNote: note || ""
    });

    res.json({ success: true, msg: action + " done" });

  } catch(err){ res.status(500).json({ msg: err.message }); }
};
