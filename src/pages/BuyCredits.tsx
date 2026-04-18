import { Navigate, useLocation } from "react-router-dom";

const BuyCredits = () => {
  const location = useLocation();
  const search = new URLSearchParams(location.search);
  search.set("tab", "credits");
  return <Navigate to={`/profile?${search.toString()}`} replace />;
};

export default BuyCredits;
