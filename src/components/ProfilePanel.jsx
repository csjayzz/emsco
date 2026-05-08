import { Edit3, Save, XCircle } from "lucide-react";

/**
 * Profile panel component — shared by both ambulance and police dashboards.
 * Displays user profile, role-specific details, stats, and trip/alert history.
 */
export default function ProfilePanel({
  darkMode, userRole, profileData, profileLoading,
  editMode, setEditMode, editForm, setEditForm,
  onSaveProfile,
  profileTrips, profileAlerts,
  profilePage, onFetchTrips, onFetchAlerts
}) {
  if (profileLoading) {
    return (
      <div className="text-center py-12">
        <div className={`animate-spin rounded-full h-10 w-10 border-b-2 mx-auto ${userRole === 'ambulance' ? 'border-red-500' : 'border-blue-500'}`}></div>
      </div>
    );
  }

  if (!profileData) return null;

  const accentColor = userRole === 'ambulance' ? 'red' : 'blue';
  const roleFields = userRole === 'ambulance'
    ? { title: 'Vehicle Details', fields: ['vehicle_id', 'vehicle_type', 'license_plate'] }
    : { title: 'Officer Details', fields: ['badge_number', 'station', 'jurisdiction'] };

  const stats = userRole === 'ambulance'
    ? [
        { label: 'Total Rides', val: profileData.stats.total_rides },
        { label: 'Completed', val: profileData.stats.completed_rides },
        { label: 'Avg Duration', val: `${profileData.stats.avg_duration_minutes} min` },
        { label: 'Critical Cases', val: profileData.stats.critical_rides }
      ]
    : [
        { label: 'Total Alerts', val: profileData.stats.total_alerts },
        { label: 'Acknowledged', val: profileData.stats.acknowledged_alerts },
        { label: 'Avg Response', val: `${profileData.stats.avg_response_minutes} min` },
        { label: 'Ack Rate', val: `${profileData.stats.acknowledgment_rate}%` }
      ];

  return (
    <div className="p-4 space-y-4 pb-20">
      {/* Avatar + Name */}
      <div className={`rounded-lg shadow p-6 ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
        <div className="flex items-center gap-4 mb-4">
          <div className={`w-16 h-16 rounded-full bg-${accentColor}-500 flex items-center justify-center text-white text-2xl font-bold`}
            style={{ backgroundColor: accentColor === 'red' ? '#ef4444' : '#3b82f6' }}>
            {profileData.user.name?.charAt(0)?.toUpperCase() || 'U'}
          </div>
          <div className="flex-1">
            {editMode ? (
              <input value={editForm.name || ''} onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                className={`w-full px-3 py-2 rounded border ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'border-gray-300'}`} />
            ) : (
              <h3 className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>{profileData.user.name}</h3>
            )}
            <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{profileData.user.email}</p>
          </div>
          {!editMode ? (
            <button onClick={() => { setEditForm(profileData.user); setEditMode(true); }}
              className={`p-2 rounded-lg ${accentColor === 'red' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
              <Edit3 className="h-5 w-5" />
            </button>
          ) : (
            <div className="flex gap-2">
              <button onClick={onSaveProfile} className="p-2 rounded-lg bg-green-100 text-green-600"><Save className="h-5 w-5" /></button>
              <button onClick={() => setEditMode(false)} className="p-2 rounded-lg bg-red-100 text-red-600"><XCircle className="h-5 w-5" /></button>
            </div>
          )}
        </div>
        {['phone', 'bio', 'years_experience'].map(f => (
          <div key={f} className="mb-3">
            <label className={`block text-xs font-medium mb-1 capitalize ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{f.replace(/_/g, ' ')}</label>
            {editMode ? (
              f === 'bio' ? <textarea value={editForm[f] || ''} onChange={e => setEditForm({ ...editForm, [f]: e.target.value })}
                className={`w-full px-3 py-2 rounded border text-sm ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'border-gray-300'}`} rows={2} />
              : <input value={editForm[f] || ''} onChange={e => setEditForm({ ...editForm, [f]: e.target.value })}
                className={`w-full px-3 py-2 rounded border text-sm ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'border-gray-300'}`} />
            ) : (
              <p className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>{profileData.user[f] || '—'}</p>
            )}
          </div>
        ))}
      </div>

      {/* Role-Specific Details */}
      <div className={`rounded-lg shadow p-6 ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
        <h4 className={`font-bold mb-3 ${darkMode ? 'text-white' : 'text-gray-900'}`}>{roleFields.title}</h4>
        {roleFields.fields.map(f => (
          <div key={f} className="mb-3">
            <label className={`block text-xs font-medium mb-1 capitalize ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{f.replace(/_/g, ' ')}</label>
            {editMode ? (
              <input value={editForm[f] || ''} onChange={e => setEditForm({ ...editForm, [f]: e.target.value })}
                className={`w-full px-3 py-2 rounded border text-sm ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'border-gray-300'}`} />
            ) : (
              <p className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>{profileData.user[f] || '—'}</p>
            )}
          </div>
        ))}
      </div>

      {/* Stats */}
      <div className={`rounded-lg shadow p-6 ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
        <h4 className={`font-bold mb-3 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
          {userRole === 'ambulance' ? 'Stats' : 'Performance Stats'}
        </h4>
        <div className="grid grid-cols-2 gap-4">
          {stats.map(s => (
            <div key={s.label} className={`p-3 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
              <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{s.label}</p>
              <p className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>{s.val}</p>
            </div>
          ))}
        </div>
      </div>

      {/* History (Trips for ambulance, Alerts for police) */}
      <div className={`rounded-lg shadow p-6 ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
        <h4 className={`font-bold mb-3 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
          {userRole === 'ambulance' ? 'Trip History' : 'Alert History'}
        </h4>

        {userRole === 'ambulance' && (
          profileTrips.trips.length === 0 ? (
            <p className={`text-sm text-center py-4 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>No trips yet</p>
          ) : (
            <div className="space-y-2">
              {profileTrips.trips.map(t => (
                <div key={t.id} className={`p-3 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                  <div className="flex justify-between items-start">
                    <div>
                      <p className={`font-medium text-sm ${darkMode ? 'text-white' : 'text-gray-900'}`}>{t.hospital_name}</p>
                      <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{t.case_type} · {t.duration_minutes ? `${parseFloat(t.duration_minutes).toFixed(0)} min` : '—'}</p>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${t.severity === 'critical' ? 'bg-red-100 text-red-700' : t.severity === 'serious' ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>{t.severity}</span>
                  </div>
                  <p className={`text-xs mt-1 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>{new Date(t.start_time).toLocaleString()}</p>
                </div>
              ))}
              {profileTrips.total > 10 && (
                <div className="flex justify-center gap-2 pt-2">
                  <button disabled={profilePage <= 1} onClick={() => onFetchTrips(profilePage - 1)} className="px-3 py-1 rounded bg-red-500 text-white text-sm disabled:opacity-50">Prev</button>
                  <span className={`px-3 py-1 text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>Page {profilePage}</span>
                  <button disabled={profilePage * 10 >= profileTrips.total} onClick={() => onFetchTrips(profilePage + 1)} className="px-3 py-1 rounded bg-red-500 text-white text-sm disabled:opacity-50">Next</button>
                </div>
              )}
            </div>
          )
        )}

        {userRole === 'police' && (
          profileAlerts.alerts.length === 0 ? (
            <p className={`text-sm text-center py-4 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>No alerts yet</p>
          ) : (
            <div className="space-y-2">
              {profileAlerts.alerts.map(a => (
                <div key={a.id} className={`p-3 rounded-lg border-l-4 ${a.acknowledged ? 'border-green-500' : 'border-yellow-500'} ${darkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                  <div className="flex justify-between items-start">
                    <div>
                      <p className={`font-medium text-sm ${darkMode ? 'text-white' : 'text-gray-900'}`}>{a.ambulance_name}</p>
                      <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{a.severity} · {a.case_type} · {a.trigger_type}</p>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${a.acknowledged ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                      {a.acknowledged ? 'Ack' : 'Pending'}
                    </span>
                  </div>
                  <p className={`text-xs mt-1 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>{new Date(a.created_at).toLocaleString()}</p>
                </div>
              ))}
              {profileAlerts.total > 10 && (
                <div className="flex justify-center gap-2 pt-2">
                  <button disabled={profilePage <= 1} onClick={() => onFetchAlerts(profilePage - 1)} className="px-3 py-1 rounded bg-blue-500 text-white text-sm disabled:opacity-50">Prev</button>
                  <span className={`px-3 py-1 text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>Page {profilePage}</span>
                  <button disabled={profilePage * 10 >= profileAlerts.total} onClick={() => onFetchAlerts(profilePage + 1)} className="px-3 py-1 rounded bg-blue-500 text-white text-sm disabled:opacity-50">Next</button>
                </div>
              )}
            </div>
          )
        )}
      </div>
    </div>
  );
}
