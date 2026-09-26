export default function Footer() {
  const toTop = () => window.scrollTo({ top: 0, behavior: "smooth" });

  return (
    <footer>
      <button className="back-to-top" onClick={toTop}>
        Back to top
      </button>
      <div className="footer">
        <div className="footer-inner">
          <div className="f-brand">ShopSphere.in</div>
          <p>DBMS Assignment 1 &middot; V Meenakshi Iyer &middot; 2025SL70043</p>
          <p>
            React &middot; Express &middot; JSON file database &middot; Razorpay
            &middot; {new Date().getFullYear()}
          </p>
        </div>
      </div>
    </footer>
  );
}
