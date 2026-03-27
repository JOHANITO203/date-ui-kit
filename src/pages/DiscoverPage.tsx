import { useState } from "react";
import MatchOverlay from "@/components/MatchOverlay";
import SwipeScreen from "@/components/SwipeScreen";

const DiscoverPage = () => {
  const [showMatch, setShowMatch] = useState(false);

  return (
    <>
      <SwipeScreen onMatch={() => setShowMatch(true)} />
      {showMatch && <MatchOverlay onClose={() => setShowMatch(false)} />}
    </>
  );
};

export default DiscoverPage;
