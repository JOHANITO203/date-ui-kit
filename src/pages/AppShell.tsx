import { Outlet } from "react-router-dom";
import BottomNav from "@/components/BottomNav";

const AppShell = () => {
  return (
    <>
      <Outlet />
      <BottomNav
        badges={{
          likes: { count: 3 },
          messages: { dot: true },
        }}
      />
    </>
  );
};

export default AppShell;
