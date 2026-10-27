const mongoose = require("mongoose");
const staffSchema = new mongoose.Schema({
  staffId: { type: String, default: "" },
  permanentId: { type: String, unique: true },
  aadhaarNumber: { type: String, unique: true, required: true },
  name: String,
  mobile: String,
  whatsappNumber: String,
  email: String,
  bankAccountNumber: String,
  ifscCode: String,
  accountHolderName: String,
  staffPinHash: String,
  profilePhotoUrl: String,
  skills: String,
  address: String,
  status: { type: String, default: "PENDING" }
});
module.exports = mongoose.model("Staff", staffSchema);
