import type { NextPage } from "next";
import Link from "next/link";
import { useRouter } from "next/router";
import { FormEvent, useState } from "react";
import { AuthShell } from "../components/AuthShell";
import { Banner } from "../components/ui/Banner";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Field";
import { apiFetch } from "../lib/api";

const SignupPage: NextPage = () => {
  const router = useRouter();
  const [ownerName, setOwnerName] = useState("");
  const [shopName, setShopName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [location, setLocation] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const validatePhone = (value: string) => {
    if (!/^\d*$/.test(value)) return "Phone number must contain only digits.";
    if (value.length !== 10) return "Phone number must be exactly 10 digits.";
    return null;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (password !== confirmPassword) {
      setMessage("Passwords do not match.");
      return;
    }
    const phoneValidation = validatePhone(phone);
    setPhoneError(phoneValidation);
    if (phoneValidation) return;

    setLoading(true);
    try {
      const res = await apiFetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ownerName, shopName, phone, email, password, location: location || null }),
      });
      const json = await res.json();
      if (!json.ok) {
        setMessage(json.error?.message ?? "Signup failed");
        return;
      }
      await router.push("/dashboard");
    } catch {
      setMessage("Network error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Create your shop account"
      subtitle="Set up your MySocial workspace in one step."
      footer={
        <p className="text-slate-700 dark:text-slate-300">
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-brand-700 hover:text-brand-800 dark:text-brand-300 dark:hover:text-brand-200">
            Login
          </Link>
        </p>
      }
    >
      {message && <Banner kind="error">{message}</Banner>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block space-y-1.5 sm:col-span-2">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Owner Name</span>
            <Input value={ownerName} onChange={(e) => setOwnerName(e.target.value)} required />
          </label>
          <label className="block space-y-1.5 sm:col-span-2">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Shop Name</span>
            <Input value={shopName} onChange={(e) => setShopName(e.target.value)} required />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Phone</span>
            <Input
              value={phone}
              maxLength={10}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, "");
                setPhone(value);
                setPhoneError(value.length === 0 ? null : validatePhone(value));
              }}
              required
            />
            {phoneError ? <p className="text-xs text-rose-600 dark:text-rose-300">{phoneError}</p> : null}
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Email</span>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Password</span>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Confirm Password</span>
            <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
          </label>
          <label className="block space-y-1.5 sm:col-span-2">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Location (Optional)</span>
            <Input value={location} onChange={(e) => setLocation(e.target.value)} />
          </label>
        </div>
        <Button type="submit" className="w-full" loading={loading} disabled={Boolean(phoneError) || phone.length !== 10}>
          Create account
        </Button>
      </form>
    </AuthShell>
  );
};

export default SignupPage;
