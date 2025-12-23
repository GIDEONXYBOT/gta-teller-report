import mongoose from "mongoose";

const menuPermissionSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      enum: ["admin", "supervisor", "teller", "supervisor_teller", "declarator", "super_admin"],
      required: true,
      unique: true,
    },
    menuItems: {
      type: [String],
      default: [],
    },
    updatedBy: {
      type: String,
      default: "system",
    },
  },
  { timestamps: true }
);

export default mongoose.model("MenuPermission", menuPermissionSchema);
