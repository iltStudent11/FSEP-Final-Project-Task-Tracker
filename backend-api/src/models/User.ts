import { Schema, model, type Document, type Model } from "mongoose";
import bcrypt from "bcryptjs";

const SALT_ROUNDS = 12;

export type UserRole = "adjuster" | "admin";

export interface IUser extends Document {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  createdAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

export type UserModel = Model<IUser>;

const userSchema = new Schema<IUser>({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  password: {
    type: String,
    required: true,
    minlength: 8,
  },
  role: {
    type: String,
    enum: ["adjuster", "admin"],
    default: "adjuster",
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;

  this.password = await bcrypt.hash(this.password, SALT_ROUNDS);
});

userSchema.methods.comparePassword = function (
  candidatePassword: string,
): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

userSchema.set("toJSON", {
  transform: (_doc, ret) => {
    delete (ret as { password?: string }).password;
    return ret;
  },
});

export default model<IUser>("User", userSchema);
