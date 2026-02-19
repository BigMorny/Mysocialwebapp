import type { NextPage } from "next";
import { useRouter } from "next/router";
import { FormEvent, useEffect, useState } from "react";
import { DashboardLayout, useDashboardShell } from "../../components/DashboardLayout";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Field, Input } from "../../components/ui/Field";
import { Banner } from "../../components/ui/Banner";
import { useToast } from "../../components/providers/ToastProvider";
import { apiJson } from "../../lib/api";
import { logoutRequest } from "../../lib/logout";
import { getStoredTheme, setTheme, ThemeMode } from "../../lib/theme";

function ProfileBody() {
  const router = useRouter();
  const { push: toast } = useToast();
  const { viewOnly, refreshSummary } = useDashboardShell();

  const [ownerName, setOwnerName] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [locationNote, setLocationNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [theme, setThemeState] = useState<ThemeMode>("dark");

  const load = async () => {
    try {
      const data = await apiJson<any>("/api/shop/me");
      setOwnerName(data.ownerName ?? "");
      setName(data.name ?? "");
      setEmail(data.email ?? "");
      setPhone(data.phone ?? "");
      setLocationNote(data.locationNote ?? "");
    } catch (e) {
      toast({ kind: "error", text: e instanceof Error ? e.message : "Failed to load profile" });
    }
  };

  useEffect(() => {
    void load();
    setThemeState(getStoredTheme());
  }, []);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (viewOnly) return;
    setSaving(true);
    try {
      await apiJson("/api/shop/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ownerName, name, email, phone, locationNote }),
      });
      toast({ kind: "success", text: "Profile updated." });
      await refreshSummary();
    } catch (e) {
      toast({ kind: "error", text: e instanceof Error ? e.message : "Failed to save profile" });
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logoutRequest();
      await router.push("/login");
    } catch (error) {
      toast({ kind: "error", text: error instanceof Error ? error.message : "Logout failed." });
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold tracking-tight">Profile</h1>
      {viewOnly && <Banner kind="warning">View-only mode: profile changes are disabled until billing is active.</Banner>}

      <Card>
        <form onSubmit={save} className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Field label="Owner name"><Input value={ownerName} onChange={(e) => setOwnerName(e.target.value)} /></Field>
          <Field label="Shop name"><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <Field label="Email"><Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" /></Field>
          <Field label="Phone"><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
          <Field label="Location note"><Input value={locationNote} onChange={(e) => setLocationNote(e.target.value)} /></Field>
          <div className="md:col-span-2 flex justify-end">
            <Button type="submit" loading={saving} disabled={viewOnly}>Save changes</Button>
          </div>
        </form>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold">Appearance</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Choose your preferred app theme.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            variant={theme === "dark" ? "primary" : "secondary"}
            onClick={() => {
              setTheme("dark");
              setThemeState("dark");
            }}
          >
            Dark
          </Button>
          <Button
            variant={theme === "light" ? "primary" : "secondary"}
            onClick={() => {
              setTheme("light");
              setThemeState("light");
            }}
          >
            Light
          </Button>
        </div>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold text-rose-600 dark:text-rose-300">Session</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Use this to safely log out from your current browser session.</p>
        <Button variant="danger" className="mt-4 w-full sm:w-auto" onClick={() => void handleLogout()} loading={loggingOut}>
          Log out
        </Button>
      </Card>
    </div>
  );
}

const ProfilePage: NextPage = () => (
  <DashboardLayout>
    <ProfileBody />
  </DashboardLayout>
);

export default ProfilePage;
