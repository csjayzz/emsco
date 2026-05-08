/**
 * Notification toast component.
 * Renders a fixed-position notification bar at the top-right of the screen.
 */
export default function Notification({ notification }) {
  if (!notification) return null;
  
  return (
    <div className={"fixed top-4 right-4 px-6 py-3 rounded-lg shadow-lg z-50 " + (notification.type === "success" ? "bg-green-500 text-white" : "bg-red-500 text-white")}>
      {notification.message}
    </div>
  );
}
