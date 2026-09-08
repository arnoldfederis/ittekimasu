/**
 * Barrel for the api module. Every screen imports from `@/lib/api`, so the split into
 * client / endpoints / types stays an implementation detail of this folder.
 */
export {
  ApiError,
  NetworkError,
  NotSignedInError,
  request,
} from "@/lib/api/client";
export { api } from "@/lib/api/endpoints";
export type * from "@/lib/api/types";
