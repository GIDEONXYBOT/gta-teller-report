import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';
import Payroll from '../models/Payroll.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/rmi-teller-report';

async function run() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');

    // Modify the GET /api/payroll/user/:id endpoint to return null instead of 404
    const modifiedCode = `// 💰 Get latest payroll by USER ID (return 200 + null if none)
router.get("/user/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    console.log("📥 Fetching payroll by USER ID:", userId);

    const payroll = await Payroll.findOne({ user: userId })
      .sort({ createdAt: -1 })
      .populate("user", "username name role")
      .lean();

    if (!payroll) {
      return res.json({ success: true, payroll: null });
    }

    res.json({ success: true, payroll });
  } catch (err) {
    console.error("❌ Error fetching payroll by user:", err);
    res.status(500).json({ message: "Failed to fetch payroll by user" });
  }
});`;

    console.log('To remove 404s, update the payroll route with this code:');
    console.log('\nIn backend/routes/payroll.js:\n');
    console.log(modifiedCode);

    await mongoose.connection.close();
    process.exit(0);
  } catch (err) {
    console.error('Error:', err && err.stack ? err.stack : err);
    process.exit(1);
  }
}

run();