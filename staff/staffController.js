const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Staff = require("./staffModel");

exports.register = async (req, res) => {
  try {
    const { aadhaarNumber, name, mobile, whatsappNumber, email, pin, bankAccountNumber, ifscCode, profilePhotoUrl, skills, address } = req.body;
    const exists = await Staff.findOne({ aadhaarNumber });
    if(exists) return res.status(400).json({ msg: "Ye Aadhaar pehle se hai" });
    const hash = await bcrypt.hash(pin, 10);
    const newStaff = await Staff.create({
      permanentId: "STAFF_" + Date.now(),
      aadhaarNumber, name, mobile, whatsappNumber, email, bankAccountNumber, ifscCode, profilePhotoUrl, skills, address,
      staffPinHash: hash, status: "PENDING", staffId: ""
    });
    res.json({ msg: "Applied" });
  } catch(e){ res.status(500).json({ msg: e.message }); }
};

exports.login = async (req, res) => {
  const { staffId, pin } = req.body;
  const staff = await Staff.findOne({ staffId });
  if(!staff) return res.status(404).json({ msg: "ID nahi mila" });
  const ok = await bcrypt.compare(pin, staff.staffPinHash);
  if(!ok) return res.status(401).json({ msg: "Galat PIN" });
  const token = jwt.sign({ staffId: staff.staffId }, "BARBERJI_STAFF_SECRET_2026", { expiresIn: "7d" });
  res.json({ token, staff });
};
