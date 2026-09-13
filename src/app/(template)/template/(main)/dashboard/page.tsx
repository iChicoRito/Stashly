import { Navigate } from "react-router";

/** `/template/dashboard` has no content of its own; send visitors to the default dashboard. */
export default function Page() {
  return <Navigate to="/template/dashboard/default" replace />;
}