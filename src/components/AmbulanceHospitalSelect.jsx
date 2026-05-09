import { useState, useMemo } from "react";
import { Ambulance, MapPin, Search, Moon, Sun, User } from "lucide-react";
import Notification from "./Notification";
import ProfilePanel from "./ProfilePanel";

function toNumber(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/**
 * Ambulance Hospital Selection Screen.
 * Shows when ambulance driver is logged in but hasn't selected a destination.
 */
export default function AmbulanceHospitalSelect({
  darkMode, setDarkMode, notification,
  hospitals, onSelectHospital, onLogout,
  // Profile props
  activeTab, setActiveTab,
  profileData, profileLoading, editMode, setEditMode,
  editForm, setEditForm, onSaveProfile,
  profileTrips, profilePage, onFetchTrips
}) {
  const [searchQuery, setSearchQuery] = useState("");

  const uniqueHospitals = useMemo(() => {
    const seen = new Set();
    return hospitals.filter((h) => {
      const normalizedName = h.name?.trim().toLowerCase() || "";
      const lat = toNumber(h.lat);
      const lng = toNumber(h.lng);
      if (!normalizedName || lat === null || lng === null) return false;
      const key = `${normalizedName}-${lat.toFixed(6)}-${lng.toFixed(6)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [hospitals]);

  const filteredHospitals = uniqueHospitals.filter(h =>
    h.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className={`min-h-screen pb-16 ${darkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
      <Notification notification={notification} />

      <button onClick={() => setDarkMode(!darkMode)}
        className={`fixed top-4 left-4 p-3 rounded-full shadow-lg transition-all z-50 ${darkMode ? 'bg-gray-700 hover:bg-gray-600 text-yellow-400' : 'bg-white hover:bg-gray-100 text-gray-700'}`}>
        {darkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
      </button>

      <div className="bg-red-500 text-white p-4 flex items-center justify-between">
        <div className="flex items-center">
          <Ambulance className="h-8 w-8 mr-3" />
          <div>
            <h2 className="text-xl font-bold">Ambulance Driver</h2>
            <p className="text-sm text-red-100">Emergency Response System</p>
          </div>
        </div>
        <button onClick={onLogout} className="bg-transparent bg-opacity-20 hover:bg-opacity-30 px-4 py-2 rounded-lg transition-colors border border-white text-white font-medium">Logout</button>
      </div>

      {/* Map Tab — Hospital selection */}
      {activeTab === 'map' && (
        <div className="p-4">
          <div className={`rounded-lg shadow-lg p-6 mb-4 ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
            <h2 className={`text-2xl font-bold mb-2 ${darkMode ? 'text-white' : 'text-gray-800'}`}>Select Destination Hospital</h2>
            <p className={darkMode ? 'text-gray-400' : 'text-gray-500'}>Choose where you need to go</p>
            <div className="mt-4 relative">
              <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400`} />
              <input type="text" placeholder="Search hospitals..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                className={`w-full pl-10 pr-4 py-3 border rounded-lg outline-none transition-all ${darkMode ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:ring-2 focus:ring-red-500' : 'bg-white border-gray-300 text-gray-900 focus:ring-2 focus:ring-red-500 focus:border-transparent'}`} />
            </div>
          </div>
          <div className="space-y-3">
            {filteredHospitals.length > 0 ? filteredHospitals.map((hospital) => (
              <div key={hospital.id} className={`rounded-lg shadow p-6 hover:shadow-lg transition-shadow ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
                <div className="flex items-start mb-4">
                  <div className="bg-red-100 p-3 rounded-full mr-4"><MapPin className="h-6 w-6 text-red-500" /></div>
                  <div className="flex-1">
                    <h3 className={`font-bold text-lg mb-1 ${darkMode ? 'text-white' : 'text-gray-800'}`}>{hospital.name}</h3>
                    <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                      {toNumber(hospital.lat)?.toFixed(4)}, {toNumber(hospital.lng)?.toFixed(4)}
                    </p>
                  </div>
                </div>
                <button onClick={() => onSelectHospital(hospital)} className="w-full bg-red-500 hover:bg-red-600 text-white py-3 rounded-lg font-semibold transition-colors">Select</button>
              </div>
            )) : (
              <div className={`text-center py-12 ${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow`}>
                <Search className={`h-12 w-12 mx-auto mb-3 ${darkMode ? 'text-gray-600' : 'text-gray-300'}`} />
                <p className={darkMode ? 'text-gray-400' : 'text-gray-500'}>No hospitals found</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Profile Tab */}
      {activeTab === 'profile' && (
        <ProfilePanel darkMode={darkMode} userRole="ambulance" profileData={profileData}
          profileLoading={profileLoading} editMode={editMode} setEditMode={setEditMode}
          editForm={editForm} setEditForm={setEditForm} onSaveProfile={onSaveProfile}
          profileTrips={profileTrips} profileAlerts={{ alerts: [], total: 0 }}
          profilePage={profilePage} onFetchTrips={onFetchTrips} onFetchAlerts={() => {}} />
      )}

      {/* Bottom Tab Bar */}
      <div className={`fixed bottom-0 left-0 right-0 border-t flex ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
        <button onClick={() => setActiveTab('map')} className={`flex-1 py-3 flex flex-col items-center gap-1 text-xs font-semibold ${activeTab === 'map' ? 'text-red-500' : darkMode ? 'text-gray-400' : 'text-gray-500'}`}><MapPin className="h-5 w-5" />Map</button>
        <button onClick={() => setActiveTab('profile')} className={`flex-1 py-3 flex flex-col items-center gap-1 text-xs font-semibold ${activeTab === 'profile' ? 'text-red-500' : darkMode ? 'text-gray-400' : 'text-gray-500'}`}><User className="h-5 w-5" />Profile</button>
      </div>
    </div>
  );
}
