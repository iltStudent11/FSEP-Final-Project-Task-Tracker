import { Link } from "react-router-dom";

export default function ClaimDetail() {
  return (
    <section className="page claim-detail-page">
      <h1>Task detail has moved</h1>
      <p>This app now uses Projects and Tasks tabs.</p>
      <p>
        Go to <Link to="/tasks">Tasks</Link>.
      </p>
    </section>
  );
}
