import { useState } from "react";
import api from "../services/api";

/**
 * Login / Register page using backend JWT authentication.
 * onLogin receives { role, uid, name }
 */
export default function Login({ onLogin }) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("ambulance");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const reset = () => { setError(""); setEmail(""); setPassword(""); setName(""); };

  const handleSignIn = async () => {
    setError("");
    if (!email || !password) { setError("Please enter your email and password."); return; }
    setLoading(true);
    try {
      const res = await api.post("/auth/login", { email, password });
      localStorage.setItem("ems_token", res.data.token);
      const { user } = res.data;
      onLogin({ role: user.role, uid: user.id, name: user.name || email });
    } catch (err) {
      setError(err.response?.data?.error || "Login failed. Please try again.");
    } finally { setLoading(false); }
  };

  const handleSignUp = async () => {
    setError("");
    if (!name.trim()) { setError("Please enter your full name."); return; }
    if (!email || !password) { setError("Please enter your email and password."); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters."); return; }
    setLoading(true);
    try {
      const res = await api.post("/auth/register", {
        name: name.trim(),
        email,
        password,
        role,
      });
      localStorage.setItem("ems_token", res.data.token);
      const { user } = res.data;
      onLogin({ role: user.role, uid: user.id, name: user.name || name.trim() });
    } catch (err) {
      setError(err.response?.data?.error || "Registration failed. Please try again.");
    } finally { setLoading(false); }
  };

  return (
    <div style={{ padding: 40, maxWidth: 400, margin: "0 auto" }}>
      <h2>EMS Coordination</h2>

      <div style={{ display: "flex", marginBottom: 20 }}>
        <button onClick={() => { setIsSignUp(false); reset(); }}
          style={{ flex: 1, padding: 8, fontWeight: !isSignUp ? "bold" : "normal", borderBottom: !isSignUp ? "2px solid blue" : "none", background: "none", cursor: "pointer" }}>
          Sign In
        </button>
        <button onClick={() => { setIsSignUp(true); reset(); }}
          style={{ flex: 1, padding: 8, fontWeight: isSignUp ? "bold" : "normal", borderBottom: isSignUp ? "2px solid blue" : "none", background: "none", cursor: "pointer" }}>
          Create Account
        </button>
      </div>

      {error && <p style={{ color: "red", marginBottom: 12 }}>{error}</p>}

      {isSignUp && (
        <>
          <label>Full Name</label><br />
          <input type="text" placeholder="e.g. Officer Patil" value={name}
            onChange={(e) => setName(e.target.value)} style={{ width: "100%", marginBottom: 12, padding: 8 }} />
        </>
      )}

      <label>Email</label><br />
      <input type="email" placeholder="Enter your email" value={email}
        onChange={(e) => setEmail(e.target.value)} style={{ width: "100%", marginBottom: 12, padding: 8 }} />

      <label>Password</label><br />
      <input type="password" placeholder={isSignUp ? "Min. 6 characters" : "Enter password"} value={password}
        onChange={(e) => setPassword(e.target.value)} style={{ width: "100%", marginBottom: 16, padding: 8 }} />

      {isSignUp && (
        <>
          <label>Role</label>
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            <button onClick={() => setRole("ambulance")}
              style={{ flex: 1, padding: 10, background: role === "ambulance" ? "#ef4444" : "#eee", color: role === "ambulance" ? "white" : "#333", borderRadius: 8, border: "none", cursor: "pointer" }}>
              🚑 Ambulance
            </button>
            <button onClick={() => setRole("police")}
              style={{ flex: 1, padding: 10, background: role === "police" ? "#3b82f6" : "#eee", color: role === "police" ? "white" : "#333", borderRadius: 8, border: "none", cursor: "pointer" }}>
              🛡️ Police
            </button>
          </div>
        </>
      )}

      <button onClick={isSignUp ? handleSignUp : handleSignIn} disabled={loading}
        style={{ width: "100%", padding: "10px 0", cursor: loading ? "not-allowed" : "pointer", background: "#3b82f6", color: "white", border: "none", borderRadius: 8, fontSize: 16 }}>
        {loading ? (isSignUp ? "Creating account…" : "Signing in…") : (isSignUp ? "Create Account" : "Sign In")}
      </button>
    </div>
  );
}
