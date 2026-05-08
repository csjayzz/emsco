import { useState } from "react";
import { Ambulance, Shield, Moon, Sun } from "lucide-react";
import Notification from "./Notification";

/**
 * Login / Register Screen.
 * Handles both sign-in and account creation flows.
 */
export default function LoginScreen({
  darkMode, setDarkMode, notification,
  onLogin, onSignUp, loginLoading, signUpLoading
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [signUpName, setSignUpName] = useState("");
  const [signUpRole, setSignUpRole] = useState("ambulance");

  const handleLogin = (e) => {
    e?.preventDefault();
    onLogin(email, password);
  };

  const handleSignUp = () => {
    onSignUp(signUpName, email, password, signUpRole);
  };

  const inputClass = `w-full px-4 py-2 border rounded-lg outline-none ${
    darkMode
      ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500'
      : 'bg-white border-gray-300 text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent'
  }`;
  const labelClass = `block text-sm font-medium mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`;

  return (
    <div className={`min-h-screen flex items-center justify-center p-4 ${darkMode ? 'bg-gradient-to-br from-gray-900 to-gray-800' : 'bg-gradient-to-br from-gray-50 to-gray-100'}`}>
      <Notification notification={notification} />

      <button
        onClick={() => setDarkMode(!darkMode)}
        className={`fixed top-4 left-4 p-3 rounded-full shadow-lg transition-all z-50 ${
          darkMode ? 'bg-gray-700 hover:bg-gray-600 text-yellow-400' : 'bg-white hover:bg-gray-100 text-gray-700'
        }`}
      >
        {darkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
      </button>

      <div className={`rounded-2xl shadow-xl w-full max-w-md p-8 ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className={`text-3xl font-bold mb-1 ${darkMode ? 'text-white' : 'text-gray-800'}`}>EMS Coordination</h1>
          <p className={darkMode ? 'text-gray-400' : 'text-gray-500'}>Emergency Medical Services System</p>
        </div>

        {/* Tab Toggle */}
        <div className={`flex rounded-lg p-1 mb-6 ${darkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
          <button
            onClick={() => { setIsSignUp(false); setSignUpName(""); setSignUpRole("ambulance"); }}
            className={`flex-1 py-2 rounded-md text-sm font-semibold transition-colors ${
              !isSignUp
                ? 'bg-blue-500 text-white shadow'
                : darkMode ? 'text-gray-300 hover:text-white' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Sign In
          </button>
          <button
            onClick={() => { setIsSignUp(true); }}
            className={`flex-1 py-2 rounded-md text-sm font-semibold transition-colors ${
              isSignUp
                ? 'bg-blue-500 text-white shadow'
                : darkMode ? 'text-gray-300 hover:text-white' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Create Account
          </button>
        </div>

        <div className="space-y-4 mb-6">
          {/* Name — sign-up only */}
          {isSignUp && (
            <div>
              <label className={labelClass}>Full Name</label>
              <input
                type="text"
                placeholder="e.g. Officer Patil or Ambulance Unit 1"
                value={signUpName}
                onChange={(e) => setSignUpName(e.target.value)}
                className={inputClass}
              />
            </div>
          )}

          <div>
            <label className={labelClass}>Email</label>
            <input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => !isSignUp && e.key === "Enter" && handleLogin()}
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>Password</label>
            <input
              type="password"
              placeholder={isSignUp ? "Min. 6 characters" : "Enter password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => !isSignUp && e.key === "Enter" && handleLogin()}
              className={inputClass}
            />
          </div>

          {/* Role selector — sign-up only */}
          {isSignUp && (
            <div>
              <label className={labelClass}>Role</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setSignUpRole("ambulance")}
                  className={`flex items-center justify-center gap-2 py-3 px-4 rounded-lg border-2 font-medium transition-colors ${
                    signUpRole === "ambulance"
                      ? 'border-red-500 bg-red-50 text-red-600'
                      : darkMode
                        ? 'border-gray-600 text-gray-300 hover:border-gray-400'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  <Ambulance className="h-4 w-4" />
                  Ambulance
                </button>
                <button
                  onClick={() => setSignUpRole("police")}
                  className={`flex items-center justify-center gap-2 py-3 px-4 rounded-lg border-2 font-medium transition-colors ${
                    signUpRole === "police"
                      ? 'border-blue-500 bg-blue-50 text-blue-600'
                      : darkMode
                        ? 'border-gray-600 text-gray-300 hover:border-gray-400'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  <Shield className="h-4 w-4" />
                  Police
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Action button */}
        {isSignUp ? (
          <button
            onClick={handleSignUp}
            disabled={signUpLoading}
            className={`w-full h-14 rounded-lg font-semibold text-lg flex items-center justify-center transition-colors ${
              signUpLoading ? 'bg-gray-400 cursor-not-allowed text-white' : 'bg-blue-500 hover:bg-blue-600 text-white'
            }`}
          >
            {signUpLoading ? (
              <><div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>Creating account…</>
            ) : "Create Account"}
          </button>
        ) : (
          <button
            onClick={handleLogin}
            disabled={loginLoading}
            className={`w-full h-14 rounded-lg font-semibold text-lg flex items-center justify-center transition-colors ${
              loginLoading ? 'bg-gray-400 cursor-not-allowed text-white' : 'bg-blue-500 hover:bg-blue-600 text-white'
            }`}
          >
            {loginLoading ? (
              <><div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>Signing in…</>
            ) : "Sign In"}
          </button>
        )}
      </div>
    </div>
  );
}
