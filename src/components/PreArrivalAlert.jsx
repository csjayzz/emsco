import { useState } from "react";
import { X, Heart, Activity, Droplet, Wind } from "lucide-react";

/**
 * Pre-Arrival Alert Modal Component.
 * Allows ambulance drivers to transmit patient vitals and case details
 * to the destination hospital before arrival.
 */
export default function PreArrivalAlert({ isOpen, onClose, selectedHospital, eta, ambulanceId, onTransmit }) {
  const [patientData, setPatientData] = useState({
    caseSeverity: "critical",
    emergencyType: "trauma",
    heartRate: "118",
    bloodPressure: "142",
    spO2: "94",
    treatments: {
      oxygen: true,
      ivAccess: true,
      cpr: false
    }
  });

  if (!isOpen) return null;

  const handleTransmit = () => {
    onTransmit(patientData);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70 backdrop-blur-sm animate-fadeIn">
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white rounded-3xl shadow-2xl w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto animate-slideUp border border-slate-700">
        {/* Header */}
        <div className="sticky top-0 bg-slate-900 border-b border-slate-700 p-6 flex items-center justify-between z-10">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Pre-Arrival Alert</h2>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-sm text-blue-400 font-mono">{ambulanceId}</span>
              <span className="text-slate-500">•</span>
              <span className="text-sm text-slate-400">{new Date().toLocaleTimeString()}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-800 rounded-full transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Patient Status */}
          <div>
            <h3 className="text-lg font-semibold mb-4 text-slate-200">Patient Status</h3>
            
            {/* Case Severity */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-400 mb-2">CASE SEVERITY</label>
              <div className="grid grid-cols-3 gap-2">
                {["critical", "serious", "stable"].map((level) => (
                  <button
                    key={level}
                    onClick={() => setPatientData({ ...patientData, caseSeverity: level })}
                    className={`py-3 px-4 rounded-xl font-semibold capitalize transition-all ${
                      patientData.caseSeverity === level
                        ? level === "critical"
                          ? "bg-red-600 text-white shadow-lg shadow-red-900/50"
                          : level === "serious"
                          ? "bg-orange-600 text-white shadow-lg shadow-orange-900/50"
                          : "bg-green-600 text-white shadow-lg shadow-green-900/50"
                        : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                    }`}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </div>

            {/* Emergency Type */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-400 mb-2">EMERGENCY TYPE</label>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { type: "cardiac", icon: Heart, color: "red" },
                  { type: "trauma", icon: Activity, color: "orange" },
                  { type: "stroke", icon: Droplet, color: "purple" },
                  { type: "resp.", icon: Wind, color: "blue" }
                ].map(({ type, icon: Icon, color }) => (
                  <button
                    key={type}
                    onClick={() => setPatientData({ ...patientData, emergencyType: type })}
                    className={`py-4 px-3 rounded-xl font-medium capitalize transition-all flex flex-col items-center gap-2 ${
                      patientData.emergencyType === type
                        ? `bg-${color}-600 text-white border-2 border-${color}-400 shadow-lg`
                        : "bg-slate-800 text-slate-400 hover:bg-slate-700 border-2 border-transparent"
                    }`}
                    style={
                      patientData.emergencyType === type
                        ? {
                            backgroundColor: color === "red" ? "#dc2626" : color === "orange" ? "#ea580c" : color === "purple" ? "#9333ea" : "#2563eb",
                            borderColor: color === "red" ? "#f87171" : color === "orange" ? "#fb923c" : color === "purple" ? "#c084fc" : "#60a5fa"
                          }
                        : {}
                    }
                  >
                    <Icon className="h-6 w-6" />
                    <span className="text-xs">{type}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Live Vitals */}
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-3">LIVE VITALS</label>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
                <div className="text-xs text-slate-400 mb-1">HR (bpm)</div>
                <input
                  type="number"
                  value={patientData.heartRate}
                  onChange={(e) => setPatientData({ ...patientData, heartRate: e.target.value })}
                  className="w-full bg-transparent text-3xl font-bold text-white outline-none"
                />
              </div>
              <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
                <div className="text-xs text-slate-400 mb-1">BP (sys)</div>
                <input
                  type="number"
                  value={patientData.bloodPressure}
                  onChange={(e) => setPatientData({ ...patientData, bloodPressure: e.target.value })}
                  className="w-full bg-transparent text-3xl font-bold text-white outline-none"
                />
              </div>
              <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
                <div className="text-xs text-slate-400 mb-1">SpO2 (%)</div>
                <input
                  type="number"
                  value={patientData.spO2}
                  onChange={(e) => setPatientData({ ...patientData, spO2: e.target.value })}
                  className="w-full bg-transparent text-3xl font-bold text-white outline-none"
                />
              </div>
            </div>
          </div>

          {/* Treatments Administered */}
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-3">TREATMENTS ADMINISTERED</label>
            <div className="space-y-3">
              {[
                { key: "oxygen", label: "Oxygen", icon: Wind, color: "blue" },
                { key: "ivAccess", label: "IV Access", icon: Droplet, color: "purple" },
                { key: "cpr", label: "CPR in Progress", icon: Heart, color: "red" }
              ].map(({ key, label, icon: Icon, color }) => (
                <div
                  key={key}
                  className={`flex items-center justify-between p-4 rounded-xl border-2 transition-all ${
                    patientData.treatments[key]
                      ? "bg-slate-800 border-slate-600"
                      : "bg-slate-900 border-slate-800"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${
                      patientData.treatments[key]
                        ? color === "blue" ? "bg-blue-600" : color === "purple" ? "bg-purple-600" : "bg-red-600"
                        : "bg-slate-800"
                    }`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className="font-medium">{label}</span>
                  </div>
                  <button
                    onClick={() =>
                      setPatientData({
                        ...patientData,
                        treatments: { ...patientData.treatments, [key]: !patientData.treatments[key] }
                      })
                    }
                    className="relative w-14 h-8 rounded-full transition-colors"
                    style={{
                      backgroundColor: patientData.treatments[key] ? "#3b82f6" : "#1e293b"
                    }}
                  >
                    <div
                      className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full transition-transform ${
                        patientData.treatments[key] ? "translate-x-6" : ""
                      }`}
                    />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Transmit Button */}
          <button
            onClick={handleTransmit}
            className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white py-4 rounded-xl font-bold text-lg shadow-lg shadow-blue-900/50 transition-all transform hover:scale-[1.02] active:scale-[0.98]"
          >
            Transmit Alert
          </button>

          {/* ETA Info */}
          <div className="flex items-center justify-between p-4 bg-slate-800 rounded-xl border border-slate-700">
            <div className="text-slate-400 text-sm">ESTIMATED ARRIVAL</div>
            <div className="flex items-center gap-3">
              <span className="text-3xl font-bold">{eta}</span>
              <span className="text-slate-400">min</span>
              <button className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg font-medium text-sm transition-colors">
                Call Hospital
              </button>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fadeIn {
          animation: fadeIn 0.2s ease-out;
        }
        .animate-slideUp {
          animation: slideUp 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}
