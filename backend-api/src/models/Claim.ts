import { Schema, model, type Document, type Types } from "mongoose";

export type ClaimStatus =
  | "submitted"
  | "under-review"
  | "approved"
  | "denied"
  | "closed";

export interface IClaimNote {
  author: Types.ObjectId;
  text: string;
  createdAt: Date;
}

export interface IClaim extends Document {
  claimNumber: string;
  policy: Types.ObjectId;
  description: string;
  incidentDate: Date;
  amount: number;
  status: ClaimStatus;
  assignedTo: Types.ObjectId;
  notes: Types.DocumentArray<IClaimNote>;
  createdAt: Date;
  updatedAt: Date;
}

const CLAIM_NUMBER_PREFIX = "CLM-";
const CLAIM_NUMBER_START = 1000;

const claimNoteSchema = new Schema<IClaimNote>(
  {
    author: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    text: {
      type: String,
      required: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false },
);

const claimSchema = new Schema<IClaim>(
  {
    claimNumber: {
      type: String,
      unique: true,
    },
    policy: {
      type: Schema.Types.ObjectId,
      ref: "Policy",
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    incidentDate: {
      type: Date,
      required: true,
    },
    amount: {
      type: Number,
      min: 0,
    },
    status: {
      type: String,
      enum: ["submitted", "under-review", "approved", "denied", "closed"],
      default: "submitted",
    },
    assignedTo: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    notes: [claimNoteSchema],
  },
  { timestamps: true },
);

claimSchema.pre("save", async function () {
  if (!this.isNew || this.claimNumber) return;

  const ClaimModel = this.constructor as typeof Claim;
  const count = await ClaimModel.countDocuments();
  this.claimNumber = `${CLAIM_NUMBER_PREFIX}${CLAIM_NUMBER_START + count}`;
});

const Claim = model<IClaim>("Claim", claimSchema);

export default Claim;
