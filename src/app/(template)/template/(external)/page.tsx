import { Navigate } from "react-router";

/**
 * `/template` used to call Next's `redirect()`; a client-side redirect is the
 * equivalent now that there is no server.
 */
export default function Home() {
  return <Navigate to="/template/dashboard/default" replace />;
}
