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
      createdAt: Date.now()
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
