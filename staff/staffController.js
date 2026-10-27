const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { getDatabase } = require("firebase-admin/database");
const db = getDatabase();

exports.register = async (req, res) => {
  try {
    const { aadhaarNumber, name, mobile, whatsappNumber, email, pin, bankAccountNumber, ifscCode, accountHolderName, profilePhotoUrl, skills, address } = req.body;

    if(!aadhaarNumber || aadhaarNumber.length != 12) return res.status(400).json({ msg: "12 digit Aadhaar chahiye" });

    // Aadhaar se duplicate check - StaffPool me
    const snap = await db.ref("StaffPool").orderByChild("aadhaarNumber").equalTo(aadhaarNumber).once("value");
    if(snap.exists()) return res.status(400).json({ msg: "Is Aadhaar se Staff pehle se hai" });

    const hash = await bcrypt.hash(pin, 10);
    const permanentId = "STAFF_" + Date.now();

    const data = {
      permanentId,
      staffId: "", // Admin approve pe dega BARBER_1001
      aadhaarNumber, name, mobile, whatsappNumber, email,
      bankAccountNumber, ifscCode, accountHolderName,
      staffPinHash: hash,
      profilePhotoUrl, skills, address,
      status: "PENDING",
      createdAt: Date.now()
    };

    await db.ref("StaffPool").child(permanentId).set(data);
    res.json({ msg: "Applied Success", permanentId });

  } catch(err){ res.status(500).json({ msg: err.message }); }
};

exports.login = async (req, res) => {
  try {
    const { staffId, pin } = req.body;
    // staffId se search karo (BARBER_1001)
    const snap = await db.ref("StaffPool").orderByChild("staffId").equalTo(staffId).once("value");
    if(!snap.exists()) return res.status(404).json({ msg: "Staff ID nahi mila" });
    
    let staffData = null;
    snap.forEach(child => { staffData = child.val(); });

    const match = await bcrypt.compare(pin, staffData.staffPinHash);
    if(!match) return res.status(401).json({ msg: "Galat PIN" });

    const token = jwt.sign({ staffId: staffData.staffId }, "BARBERJI_STAFF_SECRET_2026", { expiresIn: "7d" });
    res.json({ token, staff: staffData });

  } catch(err){ res.status(500).json({ msg: err.message }); }
};
