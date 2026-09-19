import axios from "axios";
import type { ApiErrorResponse } from "./types";

/** Extracts a human-readable message from an API error response. */
export function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError<ApiErrorResponse>(error)) {
    const data = error.response?.data;

    if (data?.errors?.length) {
      return data.errors.map((fieldError) => fieldError.msg).join(" ");
    }

    if (data?.message) {
      return data.message;
    }
  }

  return "Something went wrong. Please try again.";
}
