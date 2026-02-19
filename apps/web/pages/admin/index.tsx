import type { NextPage } from "next";
import { useEffect } from "react";
import { useRouter } from "next/router";

const AdminIndexPage: NextPage = () => {
  const router = useRouter();
  useEffect(() => {
    void router.replace("/admin/approvals");
  }, [router]);
  return null;
};

export default AdminIndexPage;
