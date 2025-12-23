import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const mongoUri = process.env.MONGO_URI;
console.log("📌 MONGO_URI from .env:");
console.log(mongoUri ? mongoUri.substring(0, 50) + "..." : "NOT SET");

if (!mongoUri) {
  console.log("\n❌ MONGO_URI not set in .env");
  process.exit(1);
}

mongoose.connect(mongoUri)
  .then(() => {
    console.log("\n✅ Successfully connected to MongoDB!");
    mongoose.connection.close();
    process.exit(0);
  })
  .catch((err) => {
    console.log("\n❌ Connection failed:", err.message);
    process.exit(1);
  });
